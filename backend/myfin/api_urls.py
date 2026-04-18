from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import RegisterView
from banking.views import (
    AccountDeactivateView,
    AccountListCreateView,
    MainView,
    RealEstateAppreciationView,
    RealEstateValuationView,
    TechValuationView,
    VehicleValuationView,
    VehicleValueView,
)
from catalog.views import CategoryListView
from transactions.views import TransactionListCreateView, TransactionDetailView

urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("main/", MainView.as_view(), name="main"),
    path("accounts/", AccountListCreateView.as_view(), name="account_create"),
    path("accounts/<int:pk>/deactivate/", AccountDeactivateView.as_view(), name="account_deactivate"),
    path("real-estate/appreciation/", RealEstateAppreciationView.as_view(), name="real_estate_appreciation"),
    path("real-estate/valuation/", RealEstateValuationView.as_view(), name="real_estate_valuation"),
    path("vehicle/value/", VehicleValueView.as_view(), name="vehicle_value"),
    path("vehicle/valuation/", VehicleValuationView.as_view(), name="vehicle_valuation"),
    path("tech/valuation/", TechValuationView.as_view(), name="tech_valuation"),
    path("categories/", CategoryListView.as_view(), name="category_list"),
    path("transaction/", TransactionListCreateView.as_view(), name="transaction_list"),
    path("transaction/<int:pk>/", TransactionDetailView.as_view(), name="transaction_detail"),
]
