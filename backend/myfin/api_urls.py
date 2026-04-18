from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from banking.views import MainView, RealEstateAppreciationView, VehicleValueView
from catalog.views import CategoryListView
from transactions.views import TransactionListCreateView, TransactionDetailView

urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("main/", MainView.as_view(), name="main"),
    path("real-estate/appreciation/", RealEstateAppreciationView.as_view(), name="real_estate_appreciation"),
    path("vehicle/value/", VehicleValueView.as_view(), name="vehicle_value"),
    path("categories/", CategoryListView.as_view(), name="category_list"),
    path("transaction/", TransactionListCreateView.as_view(), name="transaction_list"),
    path("transaction/<int:pk>/", TransactionDetailView.as_view(), name="transaction_detail"),
]
