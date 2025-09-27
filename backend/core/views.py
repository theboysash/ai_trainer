# views.py
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Exercise, Session, SessionExercise, Set, Rep
from .serializers import (
    ExerciseSerializer,
    SessionDetailSerializer,
    CreateSessionInputSerializer,
)

# -------------------------------
# Training templates (tune as needed)
# -------------------------------
SESSION_TEMPLATES = {
    "light":    {"pct": (0.40, 0.60), "vel": (0.80, 1.20), "sets": (3, 3), "reps": (6, 8), "vl": (0.15, 0.20)},
    "moderate": {"pct": (0.60, 0.80), "vel": (0.60, 0.85), "sets": (4, 5), "reps": (4, 6), "vl": (0.20, 0.25)},
    "intense":  {"pct": (0.80, 0.92), "vel": (0.35, 0.60), "sets": (3, 5), "reps": (2, 4), "vl": (0.25, 0.30)},
}

def round_to(x: float, step: float) -> float:
    return round(x / step) * step if step and step > 0 else x


# =========================================================
# 1) Create session (skeleton)  POST /api/sessions/
# =========================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_session(request):
    """
    Body:
    {
      "session_type": "light" | "moderate" | "intense",
      "exercises": [{"exercise_id": <int>, "predicted_1rm": <float>}, ...],
      "options": { "round_to_kg": 2.5, "allow_auto_1rm": true }
    }
    Returns the created Session with nested skeleton.
    """
    payload = CreateSessionInputSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    data = payload.validated_data

    session_type = data["session_type"]
    tmpl = SESSION_TEMPLATES[session_type]
    opts = data.get("options") or {}
    round_step = float(opts.get("round_to_kg", 2.5))
    allow_auto_1rm = bool(opts.get("allow_auto_1rm", True))

    # Create anchor session
    session = Session.objects.create(
        user=request.user,
        started_at=timezone.now(),
        status="in_progress",
        # notes left blank by design
    )

    # Build skeleton exercises (preserve input order)
    ex_ids = [e["exercise_id"] for e in data["exercises"]]
    ex_map = {e.id: e for e in Exercise.objects.filter(id__in=ex_ids)}
    order_idx = 1

    for item in data["exercises"]:
        ex = ex_map.get(item["exercise_id"])
        if not ex:
            return Response({"detail": f"Exercise {item['exercise_id']} not found."}, status=404)

        predicted_1rm = item.get("predicted_1rm")
        if predicted_1rm is None:
            # optional backfill hook (implement if you want to auto-derive from history)
            if allow_auto_1rm:
                predicted_1rm = None  # TODO: backfill from LoadVelocityPoint
            if predicted_1rm is None:
                return Response({"detail": f"Missing predicted_1rm for exercise {ex.id}."}, status=422)

        pct_min, pct_max = tmpl["pct"]
        vel_min, vel_max = tmpl["vel"]
        sets_min, sets_max = tmpl["sets"]
        reps_min, reps_max = tmpl["reps"]
        vl_min, vl_max = tmpl["vl"]

        SessionExercise.objects.create(
            session=session,
            exercise=ex,
            order_index=order_idx,
            predicted_1rm=predicted_1rm,
            target_zone=session_type,
            target_percent_1rm_min=pct_min,
            target_percent_1rm_max=pct_max,
            target_velocity_min=vel_min,
            target_velocity_max=vel_max,
            planned_sets_min=sets_min,
            planned_sets_max=sets_max,
            planned_reps_min=reps_min,
            planned_reps_max=reps_max,
            target_vl_min=vl_min,
            target_vl_max=vl_max,
        )
        order_idx += 1

    # Return nested session detail with previews (rounding via context)
    context = {"request": request, "round_to_kg": round_step}
    return Response({"session": SessionDetailSerializer(session, context=context).data}, status=201)


# =========================================================
# 2) Next-set suggestion  GET /api/sessions/<id>/next_set/
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def next_set(request, session_id: int):
    """
    Returns the next set suggestion based on plan + progress counters.
    Query param: round_to_kg (default 2.5)
    """
    try:
        session = Session.objects.get(id=session_id, user=request.user)
    except Session.DoesNotExist:
        return Response({"detail": "Session not found."}, status=404)

    round_step = float(request.query_params.get("round_to_kg", 2.5))

    for se in session.session_exercises.select_related("exercise").all().order_by("order_index"):
        planned = se.planned_sets_max or se.planned_sets_min or 0
        if se.completed_sets_count < planned:
            # midpoint %1RM suggestion
            if not se.predicted_1rm or se.target_percent_1rm_min is None or se.target_percent_1rm_max is None:
                continue
            pct_mid = 0.5 * (se.target_percent_1rm_min + se.target_percent_1rm_max)
            suggested = round_to(pct_mid * se.predicted_1rm, round_step)
            return Response({
                "session_exercise_id": se.id,
                "exercise": {"id": se.exercise.id, "name": se.exercise.name},
                "suggested_set_number": se.completed_sets_count + 1,
                "target_weight": suggested,
                "target_reps": se.planned_reps_max,
                "target_velocity_range": [se.target_velocity_min, se.target_velocity_max],
                "vl_threshold": se.target_vl_min,
            })
    return Response({"detail": "All planned sets completed."})


# =========================================================
# 3) Session status  GET /api/sessions/<id>/status/
# =========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_status(request, session_id: int):
    """
    Returns per-exercise summary with remaining sets and last set metrics.
    """
    try:
        session = Session.objects.get(id=session_id, user=request.user)
    except Session.DoesNotExist:
        return Response({"detail": "Session not found."}, status=404)

    items = []
    for se in (
        session.session_exercises
        .select_related("exercise")
        .all()
        .order_by("order_index")
    ):
        planned = se.planned_sets_max or se.planned_sets_min or 0
        items.append({
            "session_exercise_id": se.id,
            "exercise": {"id": se.exercise.id, "name": se.exercise.name},
            "planned_sets": planned,
            "completed_sets": se.completed_sets_count,
            "remaining_sets": max(0, planned - se.completed_sets_count),
            "last_set": {
                "avg_velocity_set": se.last_set_avg_velocity,
                "velocity_loss_pct": se.last_set_velocity_loss_pct,
                "stop_reason": se.last_stop_reason or None,
            }
        })

    # Infer session_type from the first SessionExercise's target_zone
    first_se = session.session_exercises.order_by("order_index").first()
    inferred_type = first_se.target_zone if first_se else None

    return Response({
        "session_id": session.id,
        "session_type": inferred_type,  # was: session.session_type
        "status": session.status,
        "exercises": items,
    }, status=200)








# =========================================================
# 4) Create a set  POST /api/sets/
# =========================================================
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_set(request):
    """
    POST /api/sets/
    {
      "session_exercise": <int>,
      "set_number": <int>,
      "weight": <float>,
      "reps": <int>,

      "rep_entries": [                           # optional
        { "rep_number": 1, "mean_velocity": 0.95, "peak_velocity": 1.12, "rom_degrees": 90, "duration_sec": 1.1 },
        { "rep_number": 2, "mean_velocity": 0.90 }
      ],

      "complete_now": true,                      # optional (default false)
      "stop_reason": "completed"                 # optional; if omitted and VL >= threshold, infer "vl_threshold"
    }
    """
    data = request.data or {}

    # ---- Validate base payload
    try:
        se_id = int(data.get("session_exercise"))
        set_number = int(data.get("set_number"))
        weight = float(data.get("weight"))
        reps_count = int(data.get("reps"))
    except (TypeError, ValueError):
        return Response({"detail": "Invalid payload."}, status=400)

    # ---- Ownership check
    try:
        se = SessionExercise.objects.select_related("session", "exercise").get(
            id=se_id, session__user=request.user
        )
    except SessionExercise.DoesNotExist:
        return Response({"detail": "SessionExercise not found."}, status=404)

    # ---- Create the Set row
    set_obj = Set.objects.create(
        session_exercise=se,
        set_number=set_number,
        weight=weight,
        reps=reps_count,
    )

    # ---- Optional: create reps
    rep_entries = data.get("rep_entries") or []
    created_rep_ids = []
    if rep_entries:
        # simple order validation; skip if you don't care about gaps/dupes
        seen = set()
        for r in rep_entries:
            try:
                rn = int(r.get("rep_number"))
            except (TypeError, ValueError):
                return Response({"detail": "rep_entries: rep_number must be int."}, status=400)
            if rn in seen:
                return Response({"detail": f"Duplicate rep_number {rn}."}, status=400)
            seen.add(rn)

            rep = Rep.objects.create(
                workout_set=set_obj,
                rep_number=rn,
                mean_velocity=r.get("mean_velocity"),
                peak_velocity=r.get("peak_velocity"),
                rom_degrees=r.get("rom_degrees"),
                duration_sec=r.get("duration_sec"),
            )
            created_rep_ids.append(rep.id)

        # compute aggregates from stored reps
        vals = list(
            set_obj.rep_entries.order_by("rep_number").values_list("mean_velocity", flat=True)
        )
        vals = [v for v in vals if v is not None]
        avg_v = sum(vals) / len(vals) if vals else None
        best_v = max(vals) if vals else None
        vl = (1.0 - (avg_v / best_v)) if (avg_v and best_v and best_v > 0) else None

        set_obj.avg_velocity_set = avg_v
        set_obj.velocity_loss_pct = vl
        set_obj.save(update_fields=["avg_velocity_set", "velocity_loss_pct"])
    else:
        avg_v = None
        vl = None

    # ---- Complete now? (optional)
    complete_now = bool(data.get("complete_now", False))
    progress = None

    if complete_now:
        stop_reason = data.get("stop_reason")
        if not stop_reason:
            # infer from VL threshold
            if vl is not None and se.target_vl_min is not None and vl >= se.target_vl_min:
                stop_reason = "vl_threshold"
            else:
                stop_reason = "completed"

        set_obj.stop_reason = stop_reason
        set_obj.save(update_fields=["stop_reason"])

        # bump denormalized counters on parent
        se.completed_sets_count = (se.completed_sets_count or 0) + 1
        # if no explicit rep_entries were sent, add 'reps' as completed volume
        reps_added = len(rep_entries) if rep_entries else (reps_count or 0)
        se.total_reps_completed = (se.total_reps_completed or 0) + reps_added
        se.last_set_avg_velocity = set_obj.avg_velocity_set
        se.last_set_velocity_loss_pct = set_obj.velocity_loss_pct
        se.last_stop_reason = stop_reason
        se.save(update_fields=[
            "completed_sets_count",
            "total_reps_completed",
            "last_set_avg_velocity",
            "last_set_velocity_loss_pct",
            "last_stop_reason",
        ])

        progress = {
            "session_exercise_id": se.id,
            "completed_sets_count": se.completed_sets_count,
            "total_reps_completed": se.total_reps_completed,
            "last_set_avg_velocity": se.last_set_avg_velocity,
            "last_set_velocity_loss_pct": se.last_set_velocity_loss_pct,
            "last_stop_reason": se.last_stop_reason,
        }

    # ---- Response
    resp = {
        "set": {
            "id": set_obj.id,
            "avg_velocity_set": set_obj.avg_velocity_set,
            "velocity_loss_pct": set_obj.velocity_loss_pct,
            "stop_reason": set_obj.stop_reason or None,
        },
        "created_rep_ids": created_rep_ids or None,
    }
    if progress is not None:
        resp["progress"] = progress

    return Response(resp, status=status.HTTP_201_CREATED)

# =========================================================
# 5) Log reps (batch)  POST /api/sets/<id>/reps/
# =========================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_reps(request, set_id: int):
    """
    Body:
    { "reps": [
        {"rep_number": 1, "mean_velocity": 0.92, "peak_velocity":0.0?, "rom_degrees":0.0?, "duration_sec": 1.2?},
        ...
      ]
    }
    Returns live aggregates and should_stop based on VL threshold.
    """
    try:
        set_obj = Set.objects.select_related("session_exercise__session").get(
            id=set_id,
            session_exercise__session__user=request.user
        )
    except Set.DoesNotExist:
        return Response({"detail": "Set not found."}, status=404)

    payload = request.data or {}
    reps_payload = payload.get("reps")
    if not isinstance(reps_payload, list) or not reps_payload:
        return Response({"detail": "reps must be a non-empty list."}, status=400)

    created = []
    for r in reps_payload:
        try:
            rep = Rep.objects.create(
                workout_set=set_obj,
                rep_number=int(r.get("rep_number")),
                mean_velocity=r.get("mean_velocity"),
                peak_velocity=r.get("peak_velocity"),
                rom_degrees=r.get("rom_degrees"),
                duration_sec=r.get("duration_sec"),
            )
            created.append(rep.id)
        except Exception:
            return Response({"detail": "Invalid rep item."}, status=400)

    # Recompute in-flight aggregates
    vals = list(set_obj.rep_entries.order_by("rep_number").values_list("mean_velocity", flat=True))
    vals = [v for v in vals if v is not None]
    avg_v = (sum(vals) / len(vals)) if vals else None
    best_v = (max(vals) if vals else None)
    vl = (1.0 - (avg_v / best_v)) if (avg_v and best_v and best_v > 0) else None

    se = set_obj.session_exercise
    threshold = se.target_vl_min
    should_stop = bool(threshold is not None and vl is not None and vl >= threshold)

    # Optionally persist interim set values (for live dashboards)
    set_obj.avg_velocity_set = avg_v
    set_obj.velocity_loss_pct = vl
    set_obj.save(update_fields=["avg_velocity_set", "velocity_loss_pct"])

    return Response({
        "created_rep_ids": created,
        "set_summary": {
            "avg_velocity_set": avg_v,
            "velocity_loss_pct": vl,
            "should_stop": should_stop,
            "reason": "vl_threshold" if should_stop else None
        }
    }, status=201)


# =========================================================
# 6) Complete set  POST /api/sets/<id>/complete/
# =========================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def complete_set(request, set_id: int):
    """
    Finalizes set aggregates and updates denormalized progress on parent SessionExercise.
    Optional body: { "stop_reason": "failure" | "completed" | "vl_threshold" | "fpi_threshold" }
    """
    try:
        set_obj = Set.objects.select_related("session_exercise__session").get(
            id=set_id,
            session_exercise__session__user=request.user
        )
    except Set.DoesNotExist:
        return Response({"detail": "Set not found."}, status=404)

    se = set_obj.session_exercise

    # Authoritative recompute from stored reps
    vals = list(set_obj.rep_entries.order_by("rep_number").values_list("mean_velocity", flat=True))
    vals = [v for v in vals if v is not None]
    avg_v = (sum(vals) / len(vals)) if vals else None
    best_v = (max(vals) if vals else None)
    vl = (1.0 - (avg_v / best_v)) if (avg_v and best_v and best_v > 0) else None

    stop_reason = (request.data or {}).get("stop_reason")
    if not stop_reason:
        if vl is not None and se.target_vl_min is not None and vl >= se.target_vl_min:
            stop_reason = "vl_threshold"
        else:
            stop_reason = "completed"

    # Persist on Set
    set_obj.avg_velocity_set = avg_v
    set_obj.velocity_loss_pct = vl
    set_obj.stop_reason = stop_reason
    set_obj.save(update_fields=["avg_velocity_set", "velocity_loss_pct", "stop_reason"])

    # Update denormalized counters on parent SessionExercise
    se.completed_sets_count = (se.completed_sets_count or 0) + 1
    se.total_reps_completed = (se.total_reps_completed or 0) + set_obj.rep_entries.count()
    se.last_set_avg_velocity = avg_v
    se.last_set_velocity_loss_pct = vl
    se.last_stop_reason = stop_reason
    se.save(update_fields=[
        "completed_sets_count", "total_reps_completed",
        "last_set_avg_velocity", "last_set_velocity_loss_pct", "last_stop_reason"
    ])

    return Response({
        "set": {
            "id": set_obj.id,
            "avg_velocity_set": avg_v,
            "velocity_loss_pct": vl,
            "stop_reason": stop_reason,
        },
        "progress": {
            "session_exercise_id": se.id,
            "completed_sets_count": se.completed_sets_count,
            "total_reps_completed": se.total_reps_completed,
            "last_set_avg_velocity": se.last_set_avg_velocity,
            "last_set_velocity_loss_pct": se.last_set_velocity_loss_pct,
            "last_stop_reason": se.last_stop_reason,
        }
    }, status=200)


# =========================================================
# 7) Your existing latest_session endpoint (kept)
#    GET /api/sessions/latest/<user_id>/
# =========================================================
@api_view(["GET"])
def exercise_list(request):
    """
    GET /api/exercises/
    Returns all available exercises with IDs and names.
    """
    qs = Exercise.objects.all()
    data = ExerciseSerializer(qs, many=True).data
    return Response(data, status=status.HTTP_200_OK)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def latest_session(request, user_id: int):
    """
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
    return Response(payload, status=200)
