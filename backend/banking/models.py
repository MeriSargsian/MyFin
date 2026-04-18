from django.conf import settings
from django.db import models


class Account(models.Model):
    class AccountType(models.TextChoices):
        CARD = "card", "Card"
        CHECKING = "checking", "Checking"
        CASH = "cash", "Cash"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=20, choices=AccountType.choices, default=AccountType.CARD)

    last4 = models.CharField(max_length=4, blank=True)
    brand = models.CharField(max_length=30, blank=True)
    default_is_business = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        tail = f" ••••{self.last4}" if self.last4 else ""
        return f"{self.name}{tail}"
