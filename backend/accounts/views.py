from django.contrib.auth import get_user_model

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.data or {}
        username = (body.get("username") or "").strip()
        email = (body.get("email") or "").strip()
        password = body.get("password") or ""
        password2 = body.get("password2") or ""

        if not username:
            return Response({"error": "username is required"}, status=400)
        if not email:
            return Response({"error": "email is required"}, status=400)
        if not password:
            return Response({"error": "password is required"}, status=400)
        if not password2:
            return Response({"error": "password confirmation is required"}, status=400)
        if password != password2:
            return Response({"error": "passwords do not match"}, status=400)
        if len(password) < 6:
            return Response({"error": "password must be at least 6 characters"}, status=400)

        User = get_user_model()
        if User.objects.filter(username=username).exists():
            return Response({"error": "username already exists"}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({"error": "email already exists"}, status=400)

        user = User.objects.create_user(username=username, email=email, password=password)
        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)}, status=201)
