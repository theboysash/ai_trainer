# core/urls.py
from django.urls import path
from .views import latest_session

app_name = "core"

urlpatterns = [
    path("sessions/latest/<int:user_id>/", latest_session, name="latest_session"),
]
