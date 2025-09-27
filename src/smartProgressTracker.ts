// src/smartProgressTracker.ts
import { ExerciseType, SetData } from './exerciseSystem';

export interface ExerciseProgress {
  exerciseType: ExerciseType;
  currentSet: number;
  targetSets: number;
  targetReps: number;
  completedSets: SetData[];
  isCompleted: boolean;
  isActive: boolean;
  restStartTime?: number;
  restDuration: number;
}

export class SmartProgressTracker {
  private exerciseProgress: Map<ExerciseType, ExerciseProgress> = new Map();
  private currentExercise: ExerciseType = 'shoulder_press';
  private sessionStartTime: number = Date.now();

  constructor() {
    this.initializeExercises();
  }

  private initializeExercises(): void {
    const exerciseConfigs = [
      { type: 'shoulder_press' as ExerciseType, sets: 4, reps: 8, rest: 120 },
      { type: 'lateral_raise' as ExerciseType, sets: 3, reps: 12, rest: 60 },
      { type: 'front_raise' as ExerciseType, sets: 3, reps: 12, rest: 60 },
      { type: 'rear_delt_fly' as ExerciseType, sets: 3, reps: 15, rest: 45 }
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

  switchToExercise(exerciseType: ExerciseType): boolean {
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

  completeSet(exerciseType: ExerciseType, setData: SetData): boolean {
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
    } else {
      // Move to next set
      progress.currentSet = progress.completedSets.length + 1;
      
      // Start rest period
      progress.restStartTime = Date.now();
    }
    
    return true;
  }

  private autoAdvanceToNextExercise(): void {
    const exerciseOrder: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
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

  getCurrentExerciseProgress(): ExerciseProgress | null {
    return this.exerciseProgress.get(this.currentExercise) || null;
  }

  getExerciseProgress(exerciseType: ExerciseType): ExerciseProgress | null {
    return this.exerciseProgress.get(exerciseType) || null;
  }

  getAllProgress(): Map<ExerciseType, ExerciseProgress> {
    return new Map(this.exerciseProgress);
  }

  isResting(exerciseType?: ExerciseType): boolean {
    const exercise = exerciseType || this.currentExercise;
    const progress = this.exerciseProgress.get(exercise);
    
    if (!progress || !progress.restStartTime) {
      return false;
    }
    
    const elapsedRest = (Date.now() - progress.restStartTime) / 1000;
    return elapsedRest < progress.restDuration;
  }

  getRestTimeRemaining(exerciseType?: ExerciseType): number {
    const exercise = exerciseType || this.currentExercise;
    const progress = this.exerciseProgress.get(exercise);
    
    if (!progress || !progress.restStartTime) {
      return 0;
    }
    
    const elapsedRest = (Date.now() - progress.restStartTime) / 1000;
    return Math.max(0, progress.restDuration - elapsedRest);
  }

  skipRest(exerciseType?: ExerciseType): void {
    const exercise = exerciseType || this.currentExercise;
    const progress = this.exerciseProgress.get(exercise);
    
    if (progress) {
      progress.restStartTime = undefined;
    }
  }

  isWorkoutComplete(): boolean {
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
  getUIUpdateData(): {
    exercises: Array<{
      type: ExerciseType;
      name: string;
      isActive: boolean;
      isCompleted: boolean;
      currentSet: number;
      targetSets: number;
      progressPercent: number;
    }>;
    currentExercise: {
      name: string;
      currentSet: number;
      targetSets: number;
      targetReps: number;
      isResting: boolean;
      restTimeRemaining: number;
    };
    workoutStats: {
      totalSets: number;
      completedSets: number;
      totalReps: number;
      workoutDuration: number;
      progressPercentage: number;
      currentExercise: ExerciseType;
      isComplete: boolean;
    };
  } {
    const exerciseNames: Record<ExerciseType, string> = {
      shoulder_press: 'Shoulder Press',
      lateral_raise: 'Lateral Raise',
      front_raise: 'Front Raise', 
      rear_delt_fly: 'Rear Delt Fly',
      bicep_curl: 'Bicep Curl'
    };

    const exercises: Array<{
      type: ExerciseType;
      name: string;
      isActive: boolean;
      isCompleted: boolean;
      currentSet: number;
      targetSets: number;
      progressPercent: number;
    }> = [];

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

    const currentProgress = this.getCurrentExerciseProgress()!;
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

  exportData(): any {
    const data: {
      sessionStart: number;
      currentExercise: ExerciseType;
      exercises: Record<ExerciseType, {
        targetSets: number;
        targetReps: number;
        completedSets: SetData[];
        isCompleted: boolean;
      }>;
    } = {
      sessionStart: this.sessionStartTime,
      currentExercise: this.currentExercise,
      exercises: {} as Record<ExerciseType, {
        targetSets: number;
        targetReps: number;
        completedSets: SetData[];
        isCompleted: boolean;
      }>
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

  reset(): void {
    this.exerciseProgress.clear();
    this.currentExercise = 'shoulder_press';
    this.sessionStartTime = Date.now();
    this.initializeExercises();
  }
}