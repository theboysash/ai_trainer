# core/urls.py
from django.urls import path
from . import views

app_name = "core"

urlpatterns = [
    # Sessions
    path("sessions/", views.create_session, name="create_session"),
    path("sessions/<int:session_id>/next_set/", views.next_set, name="next_set"),
    path("sessions/<int:session_id>/status/", views.session_status, name="session_status"),
    path("sessions/latest/<int:user_id>/", views.latest_session, name="latest_session"),
    path("exercises/", views.exercise_list, name="exercise_list"),
    # Sets + reps
    path("sets/", views.create_set, name="create_set"),
    path("sets/<int:set_id>/reps/", views.set_reps, name="set_reps"),
    path("sets/<int:set_id>/complete/", views.complete_set, name="complete_set"),
]
