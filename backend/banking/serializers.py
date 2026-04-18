from rest_framework import serializers

from .models import Account


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Account
        fields = [
            "id",
            "name",
            "type",
            "last4",
            "brand",
            "balance",
            "default_is_business",
            "is_active",
            "created_at",
            "updated_at",
        ]
