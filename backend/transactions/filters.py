import django_filters

from .models import Transaction


class TransactionFilter(django_filters.FilterSet):
    from_date = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    to_date = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Transaction
        fields = {
            "type": ["exact"],
            "category": ["exact"],
            "is_business": ["exact"],
            "merchant": ["icontains"],
            "account": ["exact"],
        }
