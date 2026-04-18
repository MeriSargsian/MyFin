from datetime import date, timedelta
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from banking.models import Account
from catalog.models import Category
from transactions.models import Transaction


def _shift_month(d: date, delta_months: int) -> date:
    month_index = (d.year * 12 + (d.month - 1)) + delta_months
    y = month_index // 12
    m = (month_index % 12) + 1
    return date(y, m, 1)


class Command(BaseCommand):
    help = "Seed demo user, accounts, categories, and 1 year of fake transactions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Recreate demo transactions for the last year (deletes existing).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        user, created = User.objects.get_or_create(
            username="test",
            defaults={"email": "test@example.com"},
        )
        if created:
            user.set_password("1234")
            user.save(update_fields=["password"])

        self.stdout.write(self.style.SUCCESS(f"User: {user.username} (created={created})"))

        accounts_data = [
            {"name": "Personal Card", "type": Account.AccountType.CARD, "last4": "1111", "brand": "visa", "default_is_business": False},
            {"name": "Business Card", "type": Account.AccountType.CARD, "last4": "2222", "brand": "mastercard", "default_is_business": True},
            {"name": "Checking", "type": Account.AccountType.CHECKING, "last4": "3333", "brand": "", "default_is_business": False},
        ]

        accounts = []
        for a in accounts_data:
            acc, _ = Account.objects.get_or_create(user=user, name=a["name"], defaults=a)
            accounts.append(acc)

        self.stdout.write(self.style.SUCCESS(f"Accounts: {len(accounts)}"))

        categories_data = [
            ("Salary", Category.Kind.INCOME),
            ("Business Income", Category.Kind.INCOME),
            ("Housing", Category.Kind.EXPENSE),
            ("Food", Category.Kind.EXPENSE),
            ("Transport", Category.Kind.EXPENSE),
            ("Subscriptions & Services", Category.Kind.EXPENSE),
            ("Shopping", Category.Kind.EXPENSE),
            ("Health", Category.Kind.EXPENSE),
            ("Education", Category.Kind.EXPENSE),
            ("Entertainment", Category.Kind.EXPENSE),
            ("Finance", Category.Kind.EXPENSE),
        ]

        categories = {}
        for name, kind in categories_data:
            c, _ = Category.objects.get_or_create(name=name, kind=kind)
            categories[(name, kind)] = c

        end = date.today()
        start = end - timedelta(days=365)

        force = bool(options.get("force"))

        existing = Transaction.objects.filter(user=user, date__gte=start, date__lte=end).count()
        if existing > 0 and not force:
            self.stdout.write(self.style.WARNING(f"Skipping transactions seed: {existing} transactions already exist in last year."))
            return

        if existing > 0 and force:
            Transaction.objects.filter(user=user, date__gte=start, date__lte=end).delete()
            self.stdout.write(self.style.WARNING(f"Deleted {existing} existing transactions in last year (--force)."))

        txns = []

        subscriptions = [
            ("Spotify", 11.99, 11, accounts[0], False),
            ("Apple Music", 10.99, 13, accounts[0], False),
            ("Netflix", 15.49, 10, accounts[0], False),
            ("Disney+", 7.99, 16, accounts[0], False),
            ("Amazon Prime Video", 8.99, 18, accounts[0], False),
            ("Hulu", 7.99, 19, accounts[0], False),
            ("YouTube Premium", 13.99, 21, accounts[0], False),
            ("YouTube Music", 10.99, 22, accounts[0], False),
            ("Google One", 1.99, 8, accounts[0], False),
            ("iCloud+", 0.99, 9, accounts[0], False),
            ("Microsoft 365", 6.99, 23, accounts[0], False),
            ("Google Workspace", 6.0, 12, accounts[1], True),
            ("Adobe Creative Cloud", 59.99, 24, accounts[1], True),
            ("Canva", 14.99, 25, accounts[1], True),
            ("ChatGPT", 20.0, 26, accounts[0], False),
        ]

        first_seed_month = _shift_month(end, -12)
        start = first_seed_month

        if force:
            existing_seed_range = Transaction.objects.filter(user=user, date__gte=start, date__lte=end).count()
            if existing_seed_range > 0:
                Transaction.objects.filter(user=user, date__gte=start, date__lte=end).delete()
                self.stdout.write(
                    self.style.WARNING(
                        f"Deleted {existing_seed_range} existing transactions in seed range {start}..{end} (--force)."
                    )
                )

        for month_offset in range(12):
            # Seed only full months in the past to avoid creating future-dated transactions
            month_date = _shift_month(end, -(month_offset + 1))

            if month_offset == 11:
                txns.append(
                    Transaction(
                        user=user,
                        account=accounts[0],
                        amount=4000,
                        type=Transaction.TransactionType.INCOME,
                        category=categories[("Salary", Category.Kind.INCOME)],
                        is_business=False,
                        date=first_seed_month,
                        merchant="",
                    )
                )
                txns.append(
                    Transaction(
                        user=user,
                        account=accounts[1],
                        amount=6000,
                        type=Transaction.TransactionType.INCOME,
                        category=categories[("Business Income", Category.Kind.INCOME)],
                        is_business=True,
                        date=first_seed_month,
                        merchant="",
                    )
                )
                txns.append(
                    Transaction(
                        user=user,
                        account=accounts[2],
                        amount=8000,
                        type=Transaction.TransactionType.INCOME,
                        category=categories[("Salary", Category.Kind.INCOME)],
                        is_business=False,
                        date=first_seed_month,
                        merchant="",
                    )
                )

            salary_date = month_date.replace(day=1)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[2],
                    amount=5000,
                    type=Transaction.TransactionType.INCOME,
                    category=categories[("Salary", Category.Kind.INCOME)],
                    is_business=False,
                    date=salary_date,
                    merchant="",
                )
            )

            business_income_date = month_date.replace(day=5)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[1],
                    amount=1500,
                    type=Transaction.TransactionType.INCOME,
                    category=categories[("Business Income", Category.Kind.INCOME)],
                    is_business=True,
                    date=business_income_date,
                    merchant="Client",
                )
            )

            rent_date = month_date.replace(day=3)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[0],
                    amount=1800,
                    type=Transaction.TransactionType.EXPENSE,
                    category=categories[("Housing", Category.Kind.EXPENSE)],
                    is_business=False,
                    date=rent_date,
                    merchant="Landlord",
                )
            )

            for merchant, amount, day, account, is_business in subscriptions:
                safe_day = max(1, min(28, day))
                txns.append(
                    Transaction(
                        user=user,
                        account=account,
                        amount=amount,
                        type=Transaction.TransactionType.EXPENSE,
                        category=categories[("Subscriptions & Services", Category.Kind.EXPENSE)],
                        is_business=is_business,
                        date=month_date.replace(day=safe_day),
                        merchant=merchant,
                    )
                )

            insurance_date = month_date.replace(day=6)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[1],
                    amount=210.0,
                    type=Transaction.TransactionType.EXPENSE,
                    category=categories[("Finance", Category.Kind.EXPENSE)],
                    is_business=True,
                    date=insurance_date,
                    merchant="Business Insurance",
                )
            )

            software_date = month_date.replace(day=7)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[1],
                    amount=35.0,
                    type=Transaction.TransactionType.EXPENSE,
                    category=categories[("Subscriptions & Services", Category.Kind.EXPENSE)],
                    is_business=True,
                    date=software_date,
                    merchant="QuickBooks",
                )
            )

            ads_date = month_date.replace(day=9)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[1],
                    amount=150.0,
                    type=Transaction.TransactionType.EXPENSE,
                    category=categories[("Finance", Category.Kind.EXPENSE)],
                    is_business=True,
                    date=ads_date,
                    merchant="Local Ads",
                )
            )

            for i in range(2):
                d = month_date.replace(day=max(1, min(28, 12 + i * 7 + random.randint(-2, 2))))
                amt = round(random.uniform(90, 420), 2)
                txns.append(
                    Transaction(
                        user=user,
                        account=accounts[1],
                        amount=amt,
                        type=Transaction.TransactionType.EXPENSE,
                        category=categories[("Shopping", Category.Kind.EXPENSE)],
                        is_business=True,
                        date=d,
                        merchant=random.choice(["Home Depot", "Lowe's", "Plumbing Supply"]),
                    )
                )

            for week in range(4):
                d = month_date.replace(day=max(1, min(28, 4 + week * 7 + random.randint(-1, 1))))
                amt = round(random.uniform(45, 85), 2)
                txns.append(
                    Transaction(
                        user=user,
                        account=accounts[1],
                        amount=amt,
                        type=Transaction.TransactionType.EXPENSE,
                        category=categories[("Transport", Category.Kind.EXPENSE)],
                        is_business=True,
                        date=d,
                        merchant="Gas Station",
                    )
                )

            office_date = month_date.replace(day=15)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[1],
                    amount=120.0,
                    type=Transaction.TransactionType.EXPENSE,
                    category=categories[("Shopping", Category.Kind.EXPENSE)],
                    is_business=True,
                    date=office_date,
                    merchant="Office Depot",
                )
            )

            fees_date = month_date.replace(day=20)
            txns.append(
                Transaction(
                    user=user,
                    account=accounts[2],
                    amount=9.99,
                    type=Transaction.TransactionType.EXPENSE,
                    category=categories[("Finance", Category.Kind.EXPENSE)],
                    is_business=False,
                    date=fees_date,
                    merchant="Bank Fee",
                )
            )

            for _ in range(12):
                d = month_date.replace(day=random.randint(1, 28))
                amt = round(random.uniform(8, 120), 2)
                txns.append(
                    Transaction(
                        user=user,
                        account=random.choice(accounts),
                        amount=amt,
                        type=Transaction.TransactionType.EXPENSE,
                        category=random.choice(
                            [
                                categories[("Food", Category.Kind.EXPENSE)],
                                categories[("Transport", Category.Kind.EXPENSE)],
                                categories[("Shopping", Category.Kind.EXPENSE)],
                                categories[("Entertainment", Category.Kind.EXPENSE)],
                                categories[("Health", Category.Kind.EXPENSE)],
                                categories[("Education", Category.Kind.EXPENSE)],
                                categories[("Subscriptions & Services", Category.Kind.EXPENSE)],
                            ]
                        ),
                        is_business=False,
                        date=d,
                        merchant="",
                    )
                )

        # Ensure balances don't go negative for any account by adding opening deposits
        txns_sorted = sorted(txns, key=lambda t: (t.date, t.id or 0))
        balances = {acc.id: 0.0 for acc in accounts}
        mins = {acc.id: 0.0 for acc in accounts}
        for t in txns_sorted:
            sign = 1.0 if t.type == Transaction.TransactionType.INCOME else -1.0
            balances[t.account_id] = balances[t.account_id] + sign * float(t.amount)
            mins[t.account_id] = min(mins[t.account_id], balances[t.account_id])

        for acc in accounts:
            min_bal = mins.get(acc.id, 0.0)
            if min_bal >= 0:
                continue

            needed = round((-min_bal) + 250.0, 2)
            is_biz = bool(getattr(acc, "default_is_business", False))
            income_cat = categories[("Business Income", Category.Kind.INCOME)] if is_biz else categories[("Salary", Category.Kind.INCOME)]
            txns.append(
                Transaction(
                    user=user,
                    account=acc,
                    amount=needed,
                    type=Transaction.TransactionType.INCOME,
                    category=income_cat,
                    is_business=is_biz,
                    date=first_seed_month,
                    merchant="Opening Deposit",
                )
            )

        Transaction.objects.bulk_create(txns)
        self.stdout.write(self.style.SUCCESS(f"Seeded transactions: {len(txns)}"))
