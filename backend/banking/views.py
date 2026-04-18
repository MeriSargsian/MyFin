from decimal import Decimal
import hashlib
import json
import os
import re
import threading
import time
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from django.db.models import Case, DecimalField, ExpressionWrapper, F, Sum, Value, When
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Account
from .serializers import AccountSerializer


def _strip_code_fences(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"```\s*$", "", t)
    return t.strip()


_gemini_cache = {}
_gemini_cache_lock = threading.Lock()


def _gemini_generate_json(prompt: str, api_key: str, timeout: int = 20) -> dict:
    key = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    now = time.time()
    with _gemini_cache_lock:
        hit = _gemini_cache.get(key)
        if hit and hit.get("expires_at", 0) > now:
            if hit.get("ok"):
                return hit.get("data") or {}
            raise ValueError(hit.get("error") or "Gemini cached error")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt,
                    }
                ]
            }
        ]
    }

    model_env = (os.getenv("GEMINI_MODEL") or "").strip()
    models_to_try = [
        model_env,
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
    ]
    models_to_try = [m for m in models_to_try if m]

    last_err = None
    raw = None
    for m in models_to_try:
        try:
            req = urlrequest.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
            last_err = None
            break
        except HTTPError as e:
            last_err = e
            if getattr(e, "code", None) == 429:
                with _gemini_cache_lock:
                    _gemini_cache[key] = {
                        "ok": False,
                        "error": str(e),
                        "expires_at": now + 300,
                    }
                raise
            if getattr(e, "code", None) == 404:
                continue
            raise

    if raw is None:
        if last_err is not None:
            raise last_err
        raise ValueError("Gemini request failed")
    data = json.loads(raw)
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )

    text = _strip_code_fences(text)
    if not text:
        raise ValueError("Empty Gemini response")
    j = json.loads(text)
    with _gemini_cache_lock:
        _gemini_cache[key] = {
            "ok": True,
            "data": j,
            "expires_at": now + (6 * 60 * 60),
        }
    return j


def _as_number(x):
    try:
        if x is None:
            return None
        return float(x)
    except Exception:
        return None


def _as_int(x):
    try:
        if x is None or x == "":
            return None
        return int(float(x))
    except Exception:
        return None


def _as_str(x):
    return str(x or "").strip()


def _clamp_confidence(x):
    v = _as_number(x)
    if v is None:
        return 0.0
    return max(0.0, min(1.0, v))


class MainView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        dec_field = DecimalField(max_digits=14, decimal_places=2)
        signed_amount = Case(
            When(transactions__type="income", then=F("transactions__amount")),
            When(
                transactions__type="expense",
                then=ExpressionWrapper(
                    F("transactions__amount") * Value(Decimal("-1.00"), output_field=dec_field),
                    output_field=dec_field,
                ),
            ),
            default=Value(Decimal("0.00"), output_field=dec_field),
            output_field=dec_field,
        )

        qs = (
            Account.objects.filter(user=request.user, is_active=True)
            .annotate(
                balance=Coalesce(
                    Sum(signed_amount, output_field=dec_field),
                    Value(Decimal("0.00"), output_field=dec_field),
                    output_field=dec_field,
                )
            )
            .order_by("id")
        )
        data = AccountSerializer(qs, many=True).data
        return Response({"accounts": data})


class AccountListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        name = (body.get("name") or "").strip()
        acc_type = (body.get("type") or Account.AccountType.CARD).strip()
        last4 = (body.get("last4") or "").strip()
        brand = (body.get("brand") or "").strip()
        default_is_business = bool(body.get("default_is_business") or False)

        if not name:
            return Response({"error": "name is required"}, status=400)
        if last4 and (len(last4) != 4 or not last4.isdigit()):
            return Response({"error": "last4 must be 4 digits"}, status=400)

        allowed = {c for c, _ in Account.AccountType.choices}
        if acc_type not in allowed:
            return Response({"error": f"type must be one of: {', '.join(sorted(allowed))}"}, status=400)

        a = Account.objects.create(
            user=request.user,
            name=name,
            type=acc_type,
            last4=last4,
            brand=brand,
            default_is_business=default_is_business,
            is_active=True,
        )
        return Response(AccountSerializer(a).data, status=201)


class AccountDeactivateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        try:
            a = Account.objects.get(pk=pk, user=request.user)
        except Account.DoesNotExist:
            return Response({"error": "not found"}, status=404)

        a.is_active = False
        a.save(update_fields=["is_active", "updated_at"])
        return Response({"ok": True})


class RealEstateAppreciationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return Response(
                {
                    "ok": False,
                    "source": "fallback",
                    "appreciation_5y_pct": 0.0,
                    "error": "GEMINI_API_KEY is not configured",
                },
                status=200,
            )

        body = request.data or {}
        zip_code = (body.get("zip") or "").strip()
        city = (body.get("city") or "").strip()
        state = (body.get("state") or "").strip()

        location = (body.get("location") or "").strip()
        if not location:
            parts = []
            if zip_code:
                parts.append(zip_code)
            if city:
                parts.append(city)
            if state:
                parts.append(state)
            location = ", ".join(parts)

        property_type = (body.get("property_type") or "").strip()
        sqft = body.get("sqft")
        bedrooms = body.get("bedrooms")
        bathrooms = body.get("bathrooms")

        prompt = (
            "You are a real-estate data assistant. Estimate the total percent change in typical market value "
            "over the last 5 years for a residential property matching the inputs. "
            "Return ONLY valid JSON with keys: appreciation_5y_pct (number), confidence (0-1), notes (string).\n\n"
            f"location: {location}\n"
            f"property_type: {property_type}\n"
            f"sqft: {sqft}\n"
            f"bedrooms: {bedrooms}\n"
            f"bathrooms: {bathrooms}\n"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ]
                }
            ]
        }

        try:
            req = urlrequest.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
            data = json.loads(raw)
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            appreciation = None
            notes = ""

            text = (text or "").strip()
            if text:
                try:
                    j = json.loads(text)
                    appreciation = j.get("appreciation_5y_pct")
                    notes = str(j.get("notes") or "")
                except Exception:
                    m = re.search(r"(-?\d+(?:\.\d+)?)", text)
                    if m:
                        appreciation = float(m.group(1))
                        notes = "Parsed from non-JSON response"

            if appreciation is None:
                raise ValueError("Could not parse appreciation_5y_pct")

            return Response(
                {
                    "ok": True,
                    "source": "gemini",
                    "appreciation_5y_pct": float(appreciation),
                    "notes": notes,
                },
                status=200,
            )
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
            return Response(
                {
                    "ok": False,
                    "source": "fallback",
                    "appreciation_5y_pct": 0.0,
                    "error": str(e),
                },
                status=200,
            )


class VehicleValueView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return Response(
                {
                    "ok": False,
                    "source": "fallback",
                    "value_today": 0.0,
                    "value_at_horizon": 0.0,
                    "error": "GEMINI_API_KEY is not configured",
                },
                status=200,
            )

        body = request.data or {}
        make = (body.get("make") or "").strip()
        model = (body.get("model") or "").strip()

        try:
            year = int(body.get("year") or 0)
        except Exception:
            year = 0

        try:
            horizon_years = int(body.get("horizon_years") or 0)
        except Exception:
            horizon_years = 0

        try:
            current_year = int(body.get("current_year") or 0)
        except Exception:
            current_year = 0

        if not current_year:
            from datetime import datetime

            current_year = datetime.utcnow().year

        if not make or not model or not year or horizon_years < 0:
            return Response(
                {
                    "ok": False,
                    "source": "fallback",
                    "value_today": 0.0,
                    "value_at_horizon": 0.0,
                    "error": "Missing required fields (make, model, year, horizon_years)",
                },
                status=200,
            )

        is_new = year >= current_year
        horizon_year = current_year + horizon_years
        compare_year = year - horizon_years

        if is_new:
            scenario = (
                "New vehicle scenario: estimate market value today for the new vehicle year, and estimate the market value "
                "today of an older model-year as a proxy for value at payoff."
            )
        else:
            scenario = (
                "Used vehicle scenario: estimate market value today for the given model-year, and forecast expected market value "
                "at the horizon year."
            )

        prompt = (
            "You are a vehicle market pricing assistant. "
            "Return ONLY valid JSON with keys: value_today (number), value_at_horizon (number), confidence (0-1), notes (string). "
            "Do not include currency symbols, commas, or extra text outside JSON.\n\n"
            f"make: {make}\n"
            f"model: {model}\n"
            f"vehicle_year: {year}\n"
            f"current_year: {current_year}\n"
            f"horizon_years: {horizon_years}\n"
            f"horizon_year: {horizon_year}\n"
            f"is_new: {str(is_new).lower()}\n"
            f"compare_year_for_new_proxy: {compare_year if is_new else ''}\n"
            f"scenario: {scenario}\n"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ]
                }
            ]
        }

        try:
            req = urlrequest.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
            data = json.loads(raw)
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            text = (text or "").strip()
            if not text:
                raise ValueError("Empty Gemini response")

            value_today = None
            value_at_horizon = None
            notes = ""

            try:
                j = json.loads(text)
                value_today = j.get("value_today")
                value_at_horizon = j.get("value_at_horizon")
                notes = str(j.get("notes") or "")
            except Exception:
                nums = re.findall(r"(-?\d+(?:\.\d+)?)", text)
                if len(nums) >= 2:
                    value_today = float(nums[0])
                    value_at_horizon = float(nums[1])
                    notes = "Parsed from non-JSON response"

            if value_today is None or value_at_horizon is None:
                raise ValueError("Could not parse value_today/value_at_horizon")

            return Response(
                {
                    "ok": True,
                    "source": "gemini",
                    "value_today": float(value_today),
                    "value_at_horizon": float(value_at_horizon),
                    "notes": notes,
                },
                status=200,
            )
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
            return Response(
                {
                    "ok": False,
                    "source": "fallback",
                    "value_today": 0.0,
                    "value_at_horizon": 0.0,
                    "error": str(e),
                },
                status=200,
            )


class VehicleValuationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return Response({"ok": False, "source": "fallback", "error": "GEMINI_API_KEY is not configured"}, status=200)

        body = request.data or {}
        brand = _as_str(body.get("brand"))
        model = _as_str(body.get("model"))
        year = _as_int(body.get("year")) or 0
        mileage = _as_int(body.get("mileage"))
        horizon_years = _as_int(body.get("horizon_years"))

        if not brand or not model or not year:
            return Response({"ok": False, "source": "fallback", "error": "Missing required fields (brand, model, year)"}, status=200)

        if mileage is None:
            mileage = 0

        if horizon_years is None:
            horizon_years = 0

        prompt = (
            "You are a vehicle market pricing assistant.\n"
            f"Vehicle: {brand} {model}, Year: {year}, Mileage: {mileage}\n"
            f"Horizon: {horizon_years} years\n\n"
            "Instructions:\n"
            "1. Estimate an upper-average current market price based on similar listings (target ~55-70th percentile; slightly above the mean, not the highest).\n"
            "2. Provide a realistic price range.\n"
            "3. Estimate annual depreciation rate (%).\n"
            "4. Forecast the car value over time based on depreciation.\n"
            "5. Assume standard market conditions (no extreme crashes or spikes).\n\n"
            "Output STRICT JSON:\n"
            "{\n"
            '  "current_price": number,\n'
            '  "price_range": [min, max],\n'
            '  "annual_depreciation_percent": number,\n'
            '  "forecast": {\n'
            '    "1y": number,\n'
            '    "3y": number,\n'
            '    "5y": number\n'
            "  },\n"
            '  "trend": "up"|"down"|"flat",\n'
            '  "confidence": number,\n'
            '  "reasoning": string\n'
            "}\n\n"
            "Rules: Return ONLY JSON. current_price should be within price_range and reflect the upper-average estimate. current_price and forecast values must be numbers (no currency symbols)."
        )

        try:
            j = _gemini_generate_json(prompt, api_key)
            current_price = _as_number(j.get("current_price"))
            price_range = j.get("price_range")
            ann_dep = _as_number(j.get("annual_depreciation_percent"))
            forecast = j.get("forecast") or {}
            v1 = _as_number(forecast.get("1y"))
            v3 = _as_number(forecast.get("3y"))
            v5 = _as_number(forecast.get("5y"))
            trend = _as_str(j.get("trend")) or "down"
            conf = _clamp_confidence(j.get("confidence"))
            reasoning = _as_str(j.get("reasoning"))

            if current_price is None or ann_dep is None or v1 is None or v3 is None or v5 is None:
                raise ValueError("Could not parse required numeric fields")

            pr_min, pr_max = None, None
            if isinstance(price_range, (list, tuple)) and len(price_range) >= 2:
                pr_min = _as_number(price_range[0])
                pr_max = _as_number(price_range[1])
            if pr_min is None or pr_max is None:
                pr_min, pr_max = current_price * 0.9, current_price * 1.1

            return Response(
                {
                    "ok": True,
                    "source": "gemini",
                    "current_price": float(current_price),
                    "price_range": [float(pr_min), float(pr_max)],
                    "annual_depreciation_percent": float(ann_dep),
                    "forecast": {"1y": float(v1), "3y": float(v3), "5y": float(v5)},
                    "trend": trend,
                    "confidence": conf,
                    "reasoning": reasoning,
                    "horizon_years": int(horizon_years),
                },
                status=200,
            )
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
            return Response({"ok": False, "source": "fallback", "error": str(e)}, status=200)


class RealEstateValuationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return Response({"ok": False, "source": "fallback", "error": "GEMINI_API_KEY is not configured"}, status=200)

        body = request.data or {}
        zip_code = _as_str(body.get("zip"))
        city = _as_str(body.get("city"))
        beds = _as_int(body.get("beds"))
        baths = _as_int(body.get("baths"))
        sqft = _as_int(body.get("sqft"))
        property_type = _as_str(body.get("property_type"))

        if not zip_code and not city:
            return Response({"ok": False, "source": "fallback", "error": "Missing required fields (zip or city)"}, status=200)

        prompt = (
            "You are a real estate market valuation assistant.\n"
            f"Location: {zip_code}, {city}\n"
            f"Property: {property_type}, Beds: {beds}, Baths: {baths}, Sqft: {sqft}\n\n"
            "Instructions:\n"
            "1. Estimate an upper-average current property value based on comparable homes (target ~55-70th percentile; slightly above the mean).\n"
            "2. Provide price range.\n"
            "3. Estimate annual growth rate based on location.\n"
            "4. Forecast price for 1, 3, and 5 years.\n"
            "5. Consider general market trends (interest rates, demand, location growth).\n"
            "6. If data is uncertain, reduce confidence.\n\n"
            "Output STRICT JSON:\n"
            "{\n"
            '  "estimated_price": number,\n'
            '  "price_range": [min, max],\n'
            '  "annual_growth_percent": number,\n'
            '  "forecast": {\n'
            '    "1y": number,\n'
            '    "3y": number,\n'
            '    "5y": number\n'
            "  },\n"
            '  "trend": "up"|"down"|"flat",\n'
            '  "confidence": number,\n'
            '  "reasoning": string\n'
            "}\n\n"
            "Rules: Return ONLY JSON. estimated_price should be within price_range and reflect the upper-average estimate. estimated_price and forecast values must be numbers (no currency symbols)."
        )

        try:
            j = _gemini_generate_json(prompt, api_key)
            estimated_price = _as_number(j.get("estimated_price"))
            price_range = j.get("price_range")
            ann_growth = _as_number(j.get("annual_growth_percent"))
            forecast = j.get("forecast") or {}
            v1 = _as_number(forecast.get("1y"))
            v3 = _as_number(forecast.get("3y"))
            v5 = _as_number(forecast.get("5y"))
            trend = _as_str(j.get("trend"))
            conf = _clamp_confidence(j.get("confidence"))
            reasoning = _as_str(j.get("reasoning"))

            if estimated_price is None or ann_growth is None or v1 is None or v3 is None or v5 is None:
                raise ValueError("Could not parse required numeric fields")

            pr_min, pr_max = None, None
            if isinstance(price_range, (list, tuple)) and len(price_range) >= 2:
                pr_min = _as_number(price_range[0])
                pr_max = _as_number(price_range[1])
            if pr_min is None or pr_max is None:
                pr_min, pr_max = estimated_price * 0.9, estimated_price * 1.1

            return Response(
                {
                    "ok": True,
                    "source": "gemini",
                    "estimated_price": float(estimated_price),
                    "price_range": [float(pr_min), float(pr_max)],
                    "annual_growth_percent": float(ann_growth),
                    "forecast": {"1y": float(v1), "3y": float(v3), "5y": float(v5)},
                    "trend": trend,
                    "confidence": conf,
                    "reasoning": reasoning,
                },
                status=200,
            )
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
            return Response({"ok": False, "source": "fallback", "error": str(e)}, status=200)


class TechValuationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return Response({"ok": False, "source": "fallback", "error": "GEMINI_API_KEY is not configured"}, status=200)

        body = request.data or {}
        product_name = _as_str(body.get("product_name"))
        condition = _as_str(body.get("condition"))
        age_years = _as_number(body.get("age_years"))

        if not product_name:
            return Response({"ok": False, "source": "fallback", "error": "Missing required field (product_name)"}, status=200)

        if age_years is None:
            age_years = 0

        prompt = (
            "You are a tech resale valuation assistant.\n"
            f"Product: {product_name}\n"
            f"Condition: {condition}\n"
            f"Age: {age_years} years\n\n"
            "Instructions:\n"
            "1. Estimate an upper-average resale price based on similar products (target ~55-70th percentile; slightly above the mean).\n"
            "2. Provide price range.\n"
            "3. Estimate depreciation based on age and category.\n"
            "4. Forecast price decline over time.\n\n"
            "Output STRICT JSON:\n"
            "{\n"
            '  "current_price": number,\n'
            '  "price_range": [min, max],\n'
            '  "annual_depreciation_percent": number,\n'
            '  "forecast": {\n'
            '    "1y": number,\n'
            '    "2y": number\n'
            "  },\n"
            '  "trend": "up"|"down"|"flat",\n'
            '  "confidence": number,\n'
            '  "reasoning": string\n'
            "}\n\n"
            "Rules: Return ONLY JSON. current_price should be within price_range and reflect the upper-average estimate. current_price and forecast values must be numbers (no currency symbols)."
        )

        try:
            j = _gemini_generate_json(prompt, api_key)
            current_price = _as_number(j.get("current_price"))
            price_range = j.get("price_range")
            ann_dep = _as_number(j.get("annual_depreciation_percent"))
            forecast = j.get("forecast") or {}
            v1 = _as_number(forecast.get("1y"))
            v2 = _as_number(forecast.get("2y"))
            trend = _as_str(j.get("trend")) or "down"
            conf = _clamp_confidence(j.get("confidence"))
            reasoning = _as_str(j.get("reasoning"))

            if current_price is None or ann_dep is None or v1 is None or v2 is None:
                raise ValueError("Could not parse required numeric fields")

            pr_min, pr_max = None, None
            if isinstance(price_range, (list, tuple)) and len(price_range) >= 2:
                pr_min = _as_number(price_range[0])
                pr_max = _as_number(price_range[1])
            if pr_min is None or pr_max is None:
                pr_min, pr_max = current_price * 0.85, current_price * 1.15

            return Response(
                {
                    "ok": True,
                    "source": "gemini",
                    "current_price": float(current_price),
                    "price_range": [float(pr_min), float(pr_max)],
                    "annual_depreciation_percent": float(ann_dep),
                    "forecast": {"1y": float(v1), "2y": float(v2)},
                    "trend": trend,
                    "confidence": conf,
                    "reasoning": reasoning,
                },
                status=200,
            )
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as e:
            return Response({"ok": False, "source": "fallback", "error": str(e)}, status=200)
