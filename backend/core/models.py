from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

# ---------- Master data ----------

class Exercise(models.Model):
    name = models.CharField(max_length=120, unique=True)
    targeted_muscle_group = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


# ---------- Workout logging ----------

class Session(models.Model):
    STATUS = [
        ("in_progress", "In progress"),
        ("completed", "Completed"),
        ("abandoned", "Abandoned"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions"
    )
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS, default="in_progress")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at", "id"]
        indexes = [models.Index(fields=["user", "started_at"])]

    def __str__(self):
        who = (
            getattr(self.user, "get_full_name", lambda: "")()
            or getattr(self.user, "username", str(self.user))
        )
        return f"Session #{self.id} — {who}"


class SessionExercise(models.Model):
    session = models.ForeignKey(
        Session, on_delete=models.CASCADE, related_name="session_exercises"
    )
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    order_index = models.PositiveIntegerField(default=1)

    # Snapshot metrics/notes for this exercise on this day
    predicted_1rm = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])
    notes = models.TextField(blank=True)

    # ---- Coaching targets (optional but useful) ----
    # light / moderate / intense
    target_zone = models.CharField(max_length=16, blank=True)
    target_velocity_min = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])
    target_velocity_max = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])
    target_vl_min = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])  # e.g., 0.20
    target_vl_max = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])  # e.g., 0.25
    planned_sets_min = models.PositiveIntegerField(null=True, blank=True)
    planned_sets_max = models.PositiveIntegerField(null=True, blank=True)
    planned_reps_min = models.PositiveIntegerField(null=True, blank=True)
    planned_reps_max = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["order_index", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "exercise", "order_index"],
                name="unique_exercise_order_per_session",
            ),
        ]
        indexes = [
            models.Index(fields=["session", "order_index"]),
            models.Index(fields=["exercise"]),
        ]

    def __str__(self):
        return f"{self.session} → {self.exercise.name}"


class Set(models.Model):
    session_exercise = models.ForeignKey(
        SessionExercise, on_delete=models.CASCADE, related_name="sets"
    )
    set_number = models.PositiveIntegerField()
    weight = models.FloatField(validators=[MinValueValidator(0.0)])  # kg
    reps = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    # Aggregates (recomputed from reps)
    avg_velocity_set = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])  # m/s
    velocity_loss_pct = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])  # 0.20 == 20%

    stop_reason = models.CharField(
        max_length=32,
        choices=[
            ("vl_threshold", "VL threshold"),
            ("fpi_threshold", "FPI threshold"),
            ("failure", "Failure"),
            ("completed", "Completed"),
        ],
        blank=True,
    )

    class Meta:
        ordering = ["set_number", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session_exercise", "set_number"],
                name="unique_set_number_per_session_exercise",
            )
        ]
        indexes = [
            models.Index(fields=["session_exercise", "set_number"]),
        ]

    def __str__(self):
        return f"Set {self.set_number} @ {self.weight}kg x{self.reps}"


class Rep(models.Model):
    workout_set = models.ForeignKey(
        Set, on_delete=models.CASCADE, related_name="rep_entries"
    )
    rep_number = models.PositiveIntegerField()
    mean_velocity = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])  # m/s
    peak_velocity = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])  # m/s
    rom_degrees = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])
    duration_sec = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])

    class Meta:
        ordering = ["rep_number", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["workout_set", "rep_number"],
                name="unique_rep_number_per_set",
            )
        ]
        indexes = [
            models.Index(fields=["workout_set", "rep_number"]),
        ]

    def __str__(self):
        return f"Rep {self.rep_number} (v={self.mean_velocity} m/s)"


# ---------- Load–velocity profile (historical) ----------

class LoadVelocityPoint(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lvp_points"
    )
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    date = models.DateField()
    load = models.FloatField(validators=[MinValueValidator(0.0)])            # kg
    mean_velocity = models.FloatField(validators=[MinValueValidator(0.0)])   # m/s (mean concentric)
    predicted_1rm_at_time = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0)])  # kg

    # Optional provenance back to source session/set
    source_session = models.ForeignKey(Session, null=True, blank=True, on_delete=models.SET_NULL)
    source_set = models.ForeignKey(Set, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-date", "id"]
        indexes = [
            models.Index(fields=["user", "exercise", "date"]),
        ]

    def __str__(self):
        who = (
            getattr(self.user, "get_full_name", lambda: "")()
            or getattr(self.user, "username", str(self.user))
        )
        return f"LVP {who} {self.exercise.name}: {self.load}kg @ {self.mean_velocity} m/s"
