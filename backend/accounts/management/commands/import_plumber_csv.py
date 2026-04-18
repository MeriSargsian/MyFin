import csv
from datetime import datetime
from decimal import Decimal
import re

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from banking.models import Account
from catalog.models import Category
from transactions.models import Transaction


def _parse_date(s: str):
    s = (s or "").strip()
    if not s:
        raise ValueError("missing date")
    return datetime.strptime(s, "%Y-%m-%d").date()


def _parse_amount(s: str) -> Decimal:
    s = (s or "").strip().replace("$", "").replace(",", "")
    if not s:
        return Decimal("0")
    return abs(Decimal(s))


def _parse_last4(card_name: str) -> str:
    card_name = card_name or ""
    m = re.search(r"\*(\d{4})\b", card_name)
    if m:
        return m.group(1)
    m = re.search(r"(\d{4})\b", card_name)
    if m:
        return m.group(1)
    return ""


def _account_type(card_name: str) -> str:
    s = (card_name or "").lower()
    if "checking" in s:
        return Account.AccountType.CHECKING
    if "cash" in s:
        return Account.AccountType.CASH
    return Account.AccountType.CARD


def _txn_type(s: str) -> str:
    t = (s or "").strip().lower()
    if t in {"deposit", "income", "inflow", "credit"}:
        return Transaction.TransactionType.INCOME
    if t in {"expense", "withdrawal", "debit", "outflow"}:
        return Transaction.TransactionType.EXPENSE
    if t.startswith("dep"):
        return Transaction.TransactionType.INCOME
    return Transaction.TransactionType.EXPENSE


class Command(BaseCommand):
    help = "Import plumber_2y_full_categories.csv for user 'test' (overwrites user's transactions)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=r"D:\\hacMesa\\MyFin\\plumber_2y_full_categories.csv",
            help="Path to CSV file",
        )
        parser.add_argument(
            "--username",
            default="test",
            help="Username to import into (created if missing)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing transactions for user before importing",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        path = options["path"]
        username = options["username"]
        force = bool(options.get("force"))

        User = get_user_model()
        user, created = User.objects.get_or_create(username=username, defaults={"email": f"{username}@example.com"})
        if created:
            user.set_password("1234")
            user.save(update_fields=["password"])

        self.stdout.write(self.style.SUCCESS(f"User: {user.username} (created={created})"))

        if force:
            deleted, _ = Transaction.objects.filter(user=user).delete()
            self.stdout.write(self.style.WARNING(f"Deleted existing transactions: {deleted}"))
        else:
            existing = Transaction.objects.filter(user=user).count()
            if existing:
                raise RuntimeError(
                    f"User '{username}' already has {existing} transactions. Re-run with --force to overwrite."
                )

        account_cache: dict[tuple[str, str, str], Account] = {}
        category_cache: dict[tuple[str, str], Category] = {}

        def get_or_create_category(name: str, kind: str) -> Category:
            key = (name, kind)
            c = category_cache.get(key)
            if c:
                return c
            c, _ = Category.objects.get_or_create(name=name, kind=kind)
            category_cache[key] = c
            return c

        def get_or_create_account(name: str, acc_type: str, last4: str, is_business: bool) -> Account:
            key = (name, acc_type, last4)
            a = account_cache.get(key)
            if a:
                return a

            defaults = {
                "type": acc_type,
                "last4": last4,
                "brand": "",
                "default_is_business": bool(is_business),
                "is_active": True,
            }

            a, _ = Account.objects.get_or_create(user=user, name=name, defaults=defaults)
            account_cache[key] = a
            return a

        to_create: list[Transaction] = []
        created_count = 0

        with open(path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            required = {"Date", "Type", "Description", "Account_Type", "Card_Name", "Amount", "Category"}
            missing = required - set(reader.fieldnames or [])
            if missing:
                raise RuntimeError(f"CSV is missing columns: {', '.join(sorted(missing))}")

            for row in reader:
                d = _parse_date(row.get("Date") or "")
                typ = _txn_type(row.get("Type") or "")
                amount = _parse_amount(row.get("Amount") or "")
                cat_name = (row.get("Category") or "Uncategorized").strip() or "Uncategorized"

                kind = Category.Kind.INCOME if typ == Transaction.TransactionType.INCOME else Category.Kind.EXPENSE
                category = get_or_create_category(cat_name, kind)

                acct_scope = (row.get("Account_Type") or "").strip().lower()
                is_business = acct_scope == "business"

                card_name = (row.get("Card_Name") or "").strip() or ("Business" if is_business else "Personal")
                last4 = _parse_last4(card_name)
                acc_type = _account_type(card_name)
                account = get_or_create_account(card_name, acc_type, last4, is_business)

                merchant = (row.get("Description") or "").strip()

                to_create.append(
                    Transaction(
                        user=user,
                        account=account,
                        amount=amount,
                        type=typ,
                        category=category,
                        is_business=is_business,
                        date=d,
                        merchant=merchant,
                    )
                )

                if len(to_create) >= 2000:
                    Transaction.objects.bulk_create(to_create, batch_size=2000)
                    created_count += len(to_create)
                    to_create = []

        if to_create:
            Transaction.objects.bulk_create(to_create, batch_size=2000)
            created_count += len(to_create)

        self.stdout.write(self.style.SUCCESS(f"Imported transactions: {created_count}"))
