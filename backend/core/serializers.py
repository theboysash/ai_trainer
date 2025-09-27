from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Exercise, Session, SessionExercise, Set, Rep, LoadVelocityPoint

User = get_user_model()

# ---------- Flat (write-friendly) serializers ----------

class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = "__all__"


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = "__all__"   # includes status, notes, started_at, ended_at, user


class SessionExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionExercise
        fields = "__all__"   # includes targets/plan fields and predicted_1rm


class SetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Set
        fields = "__all__"   # weight, reps, avg_velocity_set, velocity_loss_pct, stop_reason, etc.


class RepSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rep
        fields = "__all__"


class LoadVelocityPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadVelocityPoint
        fields = "__all__"


# ---------- Nested (read-optimized) serializers ----------

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


class SessionExerciseReadSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    sets = SetReadSerializer(many=True, read_only=True)

    class Meta:
        model = SessionExercise
        fields = [
            "id", "exercise", "exercise_name", "order_index",
            "predicted_1rm", "notes",
            # targets/plan (show if present)
            "target_zone", "target_velocity_min", "target_velocity_max",
            "target_vl_min", "target_vl_max",
            "planned_sets_min", "planned_sets_max",
            "planned_reps_min", "planned_reps_max",
            "sets",
        ]


class SessionDetailSerializer(serializers.ModelSerializer):
    session_exercises = SessionExerciseReadSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = [
            "id", "user", "started_at", "ended_at", "status", "notes",
            "session_exercises",
        ]