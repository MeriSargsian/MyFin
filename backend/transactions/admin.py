from django.contrib import admin

from .models import Transaction, MonthlySummary

admin.site.register(Transaction)
admin.site.register(MonthlySummary)
