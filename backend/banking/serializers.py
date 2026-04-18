from rest_framework import serializers

from .models import Account


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    def get_balance(self, obj):
        v = getattr(obj, "balance", None)
        return v if v is not None else "0.00"

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
