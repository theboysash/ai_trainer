from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Prefetch

from .models import Session, SessionExercise, Set
from .serializers import SessionDetailSerializer


@api_view(["GET"])
def latest_session(request, user_id: int):
    """
    GET /api/sessions/latest/<user_id>/
    Returns the most recent session for the user with nested exercises->sets->reps
    and a computed summary (total sets, reps, tonnage, avg velocities, etc.).
    """
    qs = (
        Session.objects.filter(user_id=user_id)
        .order_by("-started_at")
        .select_related("user")
        .prefetch_related(
            Prefetch(
                "session_exercises",
                queryset=(
                    SessionExercise.objects.select_related("exercise")
                    .order_by("order_index")
                    .prefetch_related(
                        Prefetch(
                            "sets",
                            queryset=Set.objects.order_by("set_number").prefetch_related("rep_entries")
                        )
                    )
                ),
            )
        )
    )

    session = qs.first()
    if not session:
        return Response({"detail": "No sessions found for this user."}, status=status.HTTP_404_NOT_FOUND)

    # Build summary
    total_sets = 0
    total_reps = 0
    total_tonnage = 0.0
    set_vels = []
    set_vls = []
    exercises_done = []

    for sx in session.session_exercises.all():
        exercises_done.append({"id": sx.exercise_id, "name": sx.exercise.name})
        for st in sx.sets.all():
            total_sets += 1
            total_reps += (st.reps or 0)
            if st.weight is not None and st.reps is not None:
                total_tonnage += float(st.weight) * int(st.reps)
            if st.avg_velocity_set is not None:
                set_vels.append(st.avg_velocity_set)
            if st.velocity_loss_pct is not None:
                set_vls.append(st.velocity_loss_pct)

    avg_velocity_set = (sum(set_vels) / len(set_vels)) if set_vels else None
    avg_vl_pct = (sum(set_vls) / len(set_vls)) if set_vls else None
    duration_min = None
    if session.ended_at and session.started_at:
        duration_min = (session.ended_at - session.started_at).total_seconds() / 60.0

    payload = {
        "summary": {
            "session_id": session.id,
            "date": session.started_at.date().isoformat(),
            "status": session.status,
            "duration_min": duration_min,
            "total_sets": total_sets,
            "total_reps": total_reps,
            "total_tonnage": total_tonnage,
            "avg_velocity_set": avg_velocity_set,
            "avg_vl_pct": avg_vl_pct,
            "exercises_done": exercises_done,
        },
        "data": SessionDetailSerializer(session).data,  # full nested tree
    }
    return Response(payload)
