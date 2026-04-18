from decimal import Decimal
import json
import os
import re
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from django.db.models import Case, DecimalField, ExpressionWrapper, F, Sum, Value, When
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Account
from .serializers import AccountSerializer


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
            Account.objects.filter(user=request.user)
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
