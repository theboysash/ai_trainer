# serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Exercise,
    Session,
    SessionExercise,
    Set,
    Rep,
    LoadVelocityPoint,
)

User = get_user_model()

# =========================================================
# Flat (write-friendly) serializers
# =========================================================

class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = "__all__"


class SessionSerializer(serializers.ModelSerializer):
    """Flat serializer for Session (CRUD / admin)."""
    class Meta:
        model = Session
        fields = "__all__"   # includes status, notes, started_at, ended_at, user


class SessionExerciseSerializer(serializers.ModelSerializer):
    """Flat serializer for SessionExercise (CRUD / admin)."""
    class Meta:
        model = SessionExercise
        fields = "__all__"   # includes targets/plan fields, predicted_1rm, and progress fields


class SetSerializer(serializers.ModelSerializer):
    """Flat serializer for Set (CRUD / admin)."""
    class Meta:
        model = Set
        fields = "__all__"   # weight, reps, avg_velocity_set, velocity_loss_pct, stop_reason, etc.


class RepSerializer(serializers.ModelSerializer):
    """Flat serializer for Rep (CRUD / admin)."""
    class Meta:
        model = Rep
        fields = "__all__"


class LoadVelocityPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadVelocityPoint
        fields = "__all__"


# =========================================================
# Nested (read-optimized) serializers
# =========================================================

class RepReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rep
        fields = ["id", "rep_number", "mean_velocity", "peak_velocity", "rom_degrees", "duration_sec"]


class SetReadSerializer(serializers.ModelSerializer):
    reps = RepReadSerializer(source="rep_entries", many=True, read_only=True)

    class Meta:
        model = Set
        fields = [
            "id", "set_number", "weight", "reps",
            "avg_velocity_set", "velocity_loss_pct", "stop_reason",
            "reps",
        ]


class SessionExerciseProgressSerializer(serializers.Serializer):
    """Denormalized progress snapshot exposed to clients."""
    completed_sets_count = serializers.IntegerField()
    total_reps_completed = serializers.IntegerField()
    last_set_avg_velocity = serializers.FloatField(allow_null=True)
    last_set_velocity_loss_pct = serializers.FloatField(allow_null=True)
    last_stop_reason = serializers.CharField(allow_blank=True)


class SessionExerciseReadSerializer(serializers.ModelSerializer):
    """Read model for a session exercise with targets, progress, and set details."""
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    sets = SetReadSerializer(many=True, read_only=True)

    # Extras for UX:
    progress = serializers.SerializerMethodField()
    initial_set_preview = serializers.SerializerMethodField()

    class Meta:
        model = SessionExercise
        fields = [
            "id", "exercise", "exercise_name", "order_index",
            "predicted_1rm", "notes",

            # targets/plan (snapshotted in skeleton)
            "target_zone",
            "target_percent_1rm_min", "target_percent_1rm_max",
            "target_velocity_min", "target_velocity_max",
            "target_vl_min", "target_vl_max",
            "planned_sets_min", "planned_sets_max",
            "planned_reps_min", "planned_reps_max",

            # progress + UX
            "progress",
            "initial_set_preview",

            # nested actuals
            "sets",
        ]

    def get_progress(self, obj):
        return SessionExerciseProgressSerializer({
            "completed_sets_count": getattr(obj, "completed_sets_count", 0) or 0,
            "total_reps_completed": getattr(obj, "total_reps_completed", 0) or 0,
            "last_set_avg_velocity": getattr(obj, "last_set_avg_velocity", None),
            "last_set_velocity_loss_pct": getattr(obj, "last_set_velocity_loss_pct", None),
            "last_stop_reason": getattr(obj, "last_stop_reason", "") or "",
        }).data

    def get_initial_set_preview(self, obj):
        """
        Previews first set suggestion (NOT persisted as a Set).
        Uses midpoint of target %1RM and rounds to 'round_to_kg' from serializer context (default 2.5).
        """
        round_to_kg = float(self.context.get("round_to_kg", 2.5))
        pct_min = getattr(obj, "target_percent_1rm_min", None)
        pct_max = getattr(obj, "target_percent_1rm_max", None)

        if not obj.predicted_1rm or pct_min is None or pct_max is None:
            return None

        pct_mid = 0.5 * (pct_min + pct_max)
        suggested = round(pct_mid * obj.predicted_1rm / round_to_kg) * round_to_kg

        return {
            "suggested_weight": suggested,
            "target_reps": obj.planned_reps_max,
            "target_velocity_range": [obj.target_velocity_min, obj.target_velocity_max],
            "vl_threshold": obj.target_vl_min,
        }


class SessionDetailSerializer(serializers.ModelSerializer):
    """Top-level read view for a Session with nested session_exercises."""
    session_exercises = SessionExerciseReadSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = [
            "id", "user", "started_at", "ended_at", "status", "notes",
            "session_exercises",
        ]


# =========================================================
# Create Session (skeleton) - input/response shapes
# =========================================================

class CreateSessionExerciseInput(serializers.Serializer):
    """Input item for creating the skeleton: one exercise + optional predicted_1rm."""
    exercise_id = serializers.IntegerField()
    predicted_1rm = serializers.FloatField(required=False, min_value=0.0)


class CreateSessionInputSerializer(serializers.Serializer):
    """
    Request body for POST /sessions
    Expects a session_type + a list of exercises (with predicted_1rm or allow_auto_1rm in options).
    """
    session_type = serializers.ChoiceField(choices=[("light","light"),("moderate","moderate"),("intense","intense")])
    exercises = CreateSessionExerciseInput(many=True)
    options = serializers.DictField(required=False)

    def validate(self, data):
        if not data.get("exercises"):
            raise serializers.ValidationError("exercises must not be empty.")
        return data


class CreateSessionResponseSerializer(serializers.Serializer):
    """Response wrapper: returns the built Session with nested skeleton."""
    session = SessionDetailSerializer()


# =========================================================
# Helper for GET /sessions/{id}/next_set (optional)
# =========================================================

class NextSetSuggestionSerializer(serializers.Serializer):
    session_exercise_id = serializers.IntegerField()
    exercise = ExerciseSerializer()
    suggested_set_number = serializers.IntegerField()
    target_weight = serializers.FloatField()
    target_reps = serializers.IntegerField()
    target_velocity_range = serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)
    vl_threshold = serializers.FloatField()
