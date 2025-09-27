export class SmartProgressTracker {
    exerciseProgress = new Map();
    currentExercise = 'shoulder_press';
    sessionStartTime = Date.now();
    constructor() {
        this.initializeExercises();
    }
    initializeExercises() {
        const exerciseConfigs = [
            { type: 'shoulder_press', sets: 4, reps: 8, rest: 120 },
            { type: 'lateral_raise', sets: 3, reps: 12, rest: 60 },
            { type: 'front_raise', sets: 3, reps: 12, rest: 60 },
            { type: 'rear_delt_fly', sets: 3, reps: 15, rest: 45 }
        ];
        exerciseConfigs.forEach(config => {
            this.exerciseProgress.set(config.type, {
                exerciseType: config.type,
                currentSet: 1,
                targetSets: config.sets,
                targetReps: config.reps,
                completedSets: [],
                isCompleted: false,
                isActive: config.type === 'shoulder_press', // First exercise is active
                restDuration: config.rest
            });
        });
    }
    switchToExercise(exerciseType) {
        // Deactivate current exercise
        const currentProgress = this.exerciseProgress.get(this.currentExercise);
        if (currentProgress) {
            currentProgress.isActive = false;
        }
        // Activate new exercise
        const newProgress = this.exerciseProgress.get(exerciseType);
        if (newProgress && !newProgress.isCompleted) {
            newProgress.isActive = true;
            this.currentExercise = exerciseType;
            return true;
        }
        return false;
    }
    completeSet(exerciseType, setData) {
        const progress = this.exerciseProgress.get(exerciseType);
        if (!progress || !progress.isActive) {
            return false;
        }
        // Add the completed set
        progress.completedSets.push(setData);
        // Check if exercise is complete
        if (progress.completedSets.length >= progress.targetSets) {
            progress.isCompleted = true;
            progress.isActive = false;
            // Auto-advance to next incomplete exercise
            this.autoAdvanceToNextExercise();
        }
        else {
            // Move to next set
            progress.currentSet = progress.completedSets.length + 1;
            // Start rest period
            progress.restStartTime = Date.now();
        }
        return true;
    }
    autoAdvanceToNextExercise() {
        const exerciseOrder = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
        const currentIndex = exerciseOrder.indexOf(this.currentExercise);
        // Find next incomplete exercise
        for (let i = currentIndex + 1; i < exerciseOrder.length; i++) {
            const nextExercise = exerciseOrder[i];
            const progress = this.exerciseProgress.get(nextExercise);
            if (progress && !progress.isCompleted) {
                this.switchToExercise(nextExercise);
                return;
            }
        }
    }
    getCurrentExerciseProgress() {
        return this.exerciseProgress.get(this.currentExercise) || null;
    }
    getExerciseProgress(exerciseType) {
        return this.exerciseProgress.get(exerciseType) || null;
    }
    getAllProgress() {
        return new Map(this.exerciseProgress);
    }
    isResting(exerciseType) {
        const exercise = exerciseType || this.currentExercise;
        const progress = this.exerciseProgress.get(exercise);
        if (!progress || !progress.restStartTime) {
            return false;
        }
        const elapsedRest = (Date.now() - progress.restStartTime) / 1000;
        return elapsedRest < progress.restDuration;
    }
    getRestTimeRemaining(exerciseType) {
        const exercise = exerciseType || this.currentExercise;
        const progress = this.exerciseProgress.get(exercise);
        if (!progress || !progress.restStartTime) {
            return 0;
        }
        const elapsedRest = (Date.now() - progress.restStartTime) / 1000;
        return Math.max(0, progress.restDuration - elapsedRest);
    }
    skipRest(exerciseType) {
        const exercise = exerciseType || this.currentExercise;
        const progress = this.exerciseProgress.get(exercise);
        if (progress) {
            progress.restStartTime = undefined;
        }
    }
    isWorkoutComplete() {
        return Array.from(this.exerciseProgress.values()).every(p => p.isCompleted);
    }
    getWorkoutStats() {
        let totalSets = 0;
        let completedSets = 0;
        let totalReps = 0;
        this.exerciseProgress.forEach(progress => {
            totalSets += progress.targetSets;
            completedSets += progress.completedSets.length;
            totalReps += progress.completedSets.reduce((sum, set) => sum + set.reps, 0);
        });
        const workoutDuration = (Date.now() - this.sessionStartTime) / 1000;
        const progressPercentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
        return {
            totalSets,
            completedSets,
            totalReps,
            workoutDuration: Math.round(workoutDuration),
            progressPercentage: Math.round(progressPercentage),
            currentExercise: this.currentExercise,
            isComplete: this.isWorkoutComplete()
        };
    }
    // Replace the entire getUIUpdateData method in smartProgressTracker.ts:
    getUIUpdateData() {
        const exerciseNames = {
            shoulder_press: 'Shoulder Press',
            lateral_raise: 'Lateral Raise',
            front_raise: 'Front Raise',
            rear_delt_fly: 'Rear Delt Fly',
            bicep_curl: 'Bicep Curl'
        };
        const exercises = [];
        this.exerciseProgress.forEach((progress, type) => {
            exercises.push({
                type,
                name: exerciseNames[type],
                isActive: progress.isActive,
                isCompleted: progress.isCompleted,
                currentSet: progress.currentSet,
                targetSets: progress.targetSets,
                progressPercent: Math.round((progress.completedSets.length / progress.targetSets) * 100)
            });
        });
        const currentProgress = this.getCurrentExerciseProgress();
        const currentExercise = {
            name: exerciseNames[this.currentExercise],
            currentSet: currentProgress.currentSet,
            targetSets: currentProgress.targetSets,
            targetReps: currentProgress.targetReps,
            isResting: this.isResting(),
            restTimeRemaining: Math.round(this.getRestTimeRemaining())
        };
        return {
            exercises,
            currentExercise,
            workoutStats: this.getWorkoutStats()
        };
    }
    exportData() {
        const data = {
            sessionStart: this.sessionStartTime,
            currentExercise: this.currentExercise,
            exercises: {}
        };
        this.exerciseProgress.forEach((progress, exerciseType) => {
            data.exercises[exerciseType] = {
                targetSets: progress.targetSets,
                targetReps: progress.targetReps,
                completedSets: progress.completedSets,
                isCompleted: progress.isCompleted
            };
        });
        return data;
    }
    reset() {
        this.exerciseProgress.clear();
        this.currentExercise = 'shoulder_press';
        this.sessionStartTime = Date.now();
        this.initializeExercises();
    }
}
//# sourceMappingURL=smartProgressTracker.js.map