from django.db import models


class Category(models.Model):
    class Kind(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"

    name = models.CharField(max_length=80)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["name", "kind"], name="uniq_category_name_kind"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.kind})"
