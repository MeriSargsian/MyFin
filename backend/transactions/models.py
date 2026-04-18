from decimal import Decimal

from django.conf import settings
from django.db import models

from banking.models import Account
from catalog.models import Category


class Transaction(models.Model):
    class TransactionType(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=10, choices=TransactionType.choices)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="transactions")
    is_business = models.BooleanField(default=False)
    date = models.DateField()
    merchant = models.CharField(max_length=120, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "date"], name="txn_user_date"),
            models.Index(fields=["user", "type", "date"], name="txn_user_type_date"),
            models.Index(fields=["user", "category", "date"], name="txn_user_cat_date"),
            models.Index(fields=["user", "account", "date"], name="txn_user_acct_date"),
        ]
        ordering = ["-date", "-id"]

    def clean(self) -> None:
        super().clean()
        if self.amount is None:
            return
        if self.amount < Decimal("0"):
            raise ValueError("amount must be non-negative")


class MonthlySummary(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="monthly_summaries")
    month = models.DateField(help_text="Normalized to the first day of month")
    total_income = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_expenses = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "month"], name="uniq_user_month"),
        ]
        ordering = ["-month"]
