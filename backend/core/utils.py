from .models import Set

def recompute_set_metrics(workout_set: Set) -> Set:
    reps = list(workout_set.rep_entries.order_by("rep_number"))
    if not reps:
        workout_set.avg_velocity_set = None
        workout_set.velocity_loss_pct = None
        workout_set.save(update_fields=["avg_velocity_set", "velocity_loss_pct"])
        return workout_set

    velocities = [r.mean_velocity for r in reps if r.mean_velocity is not None]
    if velocities:
        workout_set.avg_velocity_set = sum(velocities) / len(velocities)
        first, last = velocities[0], velocities[-1]
        workout_set.velocity_loss_pct = (1 - (last / first)) * 100 if first and first > 0 else None
    else:
        workout_set.avg_velocity_set = None
        workout_set.velocity_loss_pct = None

    workout_set.save(update_fields=["avg_velocity_set", "velocity_loss_pct"])
    return workout_set
