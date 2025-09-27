from django.contrib import admin
from .models import Exercise, Session, SessionExercise, Set, Rep, LoadVelocityPoint
admin.site.register(Exercise)
admin.site.register(Session)
admin.site.register(SessionExercise)
admin.site.register(Set)
admin.site.register(Rep)
admin.site.register(LoadVelocityPoint)
