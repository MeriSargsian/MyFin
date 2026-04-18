import csv
from collections import Counter, defaultdict
from datetime import date, timedelta
from statistics import mean, pstdev

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from transactions.models import Transaction


def _median(xs: list[float]) -> float:
    if not xs:
        return 0.0
    ys = sorted(xs)
    mid = len(ys) // 2
    if len(ys) % 2 == 0:
        return (ys[mid - 1] + ys[mid]) / 2
    return ys[mid]


def _days_between(a: date, b: date) -> int:
    return (b - a).days


class Command(BaseCommand):
    help = "Export detected recurring spendings (subscriptions) into a CSV .txt file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            default="test",
            help="Username to export subscriptions for (default: test)",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=365,
            help="Lookback window in days (default: 365)",
        )
        parser.add_argument(
            "--out",
            type=str,
            default="subscriptions_from_db.txt",
            help="Output file path (default: subscriptions_from_db.txt)",
        )

    def handle(self, *args, **options):
        username: str = options["username"]
        days: int = options["days"]
        out_path: str = options["out"]

        User = get_user_model()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User '{username}' not found"))
            return

        end = date.today()
        start = end - timedelta(days=days)

        qs = (
            Transaction.objects.filter(
                user=user,
                type=Transaction.TransactionType.EXPENSE,
                date__gte=start,
                date__lte=end,
            )
            .exclude(amount__isnull=True)
            .order_by("date")
        )

        by_merchant: dict[str, list[Transaction]] = defaultdict(list)
        for t in qs:
            merchant = (t.merchant or "Unknown").strip() or "Unknown"
            by_merchant[merchant].append(t)

        rows: list[dict[str, object]] = []

        for merchant, txs in by_merchant.items():
            if len(txs) < 3:
                continue

            txs_sorted = sorted(txs, key=lambda x: x.date)
            dates = [t.date for t in txs_sorted]
            dom = [d.day for d in dates]
            weekday = [d.weekday() for d in dates]

            intervals = [_days_between(dates[i - 1], dates[i]) for i in range(1, len(dates))]
            if not intervals:
                continue

            cadence = mean(intervals)
            cadence_sd = pstdev(intervals) if len(intervals) > 1 else 0.0

            amounts = [float(t.amount) for t in txs_sorted]
            typical = _median(amounts)
            amount_ok = sum(1 for a in amounts if abs(a - typical) <= max(5.0, abs(typical) * 0.2))
            stable_amount = (amount_ok / len(amounts)) >= 0.7

            looks_monthly = 25 <= cadence <= 36 and cadence_sd <= 7
            med_dom = _median([float(x) for x in dom])
            same_date_monthly = max(abs(float(x) - med_dom) for x in dom) <= 5

            looks_weekly = 5 <= cadence <= 9 and cadence_sd <= 3
            weekday_counts = Counter(weekday)
            same_weekday = (max(weekday_counts.values()) / len(weekday)) >= 0.7

            cadence_type: str | None = None
            if looks_monthly and same_date_monthly:
                cadence_type = "monthly"
            elif looks_weekly and same_weekday:
                cadence_type = "weekly"

            if cadence_type is None or not stable_amount:
                continue

            total = sum(amounts)
            avg_monthly = total / 12

            rows.append(
                {
                    "merchant": merchant,
                    "cadence_type": cadence_type,
                    "cadence_days": round(cadence),
                    "payments": len(txs_sorted),
                    "typical_amount_usd": round(typical, 2),
                    "avg_monthly_usd": round(avg_monthly, 2),
                    "total_year_usd": round(total, 2),
                    "last_date": str(dates[-1]),
                }
            )

        rows.sort(key=lambda r: float(r["avg_monthly_usd"]), reverse=True)

        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "merchant",
                    "cadence_type",
                    "cadence_days",
                    "payments",
                    "typical_amount_usd",
                    "avg_monthly_usd",
                    "total_year_usd",
                    "last_date",
                ],
            )
            writer.writeheader()
            writer.writerows(rows)

        self.stdout.write(self.style.SUCCESS(f"Exported {len(rows)} recurring merchants to {out_path}"))
