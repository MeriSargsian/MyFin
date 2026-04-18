from rest_framework import serializers

from banking.models import Account
from catalog.models import Category
from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            "id",
            "account",
            "amount",
            "type",
            "category",
            "is_business",
            "date",
            "merchant",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_account(self, account: Account | None):
        request = self.context.get("request")
        if request is None:
            return account
        if account is None:
            return account
        if account.user_id != request.user.id:
            raise serializers.ValidationError("Invalid account")
        return account

    def validate_category(self, category: Category):
        if category.is_active is False:
            raise serializers.ValidationError("Inactive category")
        return category

    def create(self, validated_data):
        request = self.context["request"]
        validated_data["user"] = request.user

        if "is_business" not in validated_data and validated_data.get("account") is not None:
            validated_data["is_business"] = bool(validated_data["account"].default_is_business)

        return super().create(validated_data)
