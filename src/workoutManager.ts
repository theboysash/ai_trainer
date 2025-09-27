// src/workoutManager.ts
import { ExerciseDetector, ExerciseType, SetData, WorkoutSession } from './exerciseSystem';
import { getExerciseConfig } from './exerciseConfigs';

export interface ExerciseProgress {
  currentSet: number;
  targetSets: number;
  targetReps: number;
  completedSets: SetData[];
  isCompleted: boolean;
  restStartTime?: number;
  restDuration: number; // seconds
}

export class WorkoutManager {
  private session: WorkoutSession;
  private detectors: Map<ExerciseType, ExerciseDetector> = new Map();
  private exerciseProgress: Map<ExerciseType, ExerciseProgress> = new Map();
  private currentDetector?: ExerciseDetector;
  
  // Set/rest management
  private isResting: boolean = false;
  private setStartTime: number = 0;
  private restTimer?: NodeJS.Timeout;
  
  // Callbacks for UI updates
  public onExerciseComplete?: (exercise: ExerciseType, setData: SetData) => void;
  public onSetComplete?: (exercise: ExerciseType, setData: SetData) => void;
  public onRepComplete?: (exercise: ExerciseType, reps: number) => void;
  public onRestStart?: (exercise: ExerciseType, restTime: number) => void;
  public onRestEnd?: (exercise: ExerciseType) => void;
  public onWorkoutComplete?: (session: WorkoutSession) => void;

  constructor() {
    this.session = {
      sessionId: this.generateSessionId(),
      startTime: Date.now() / 1000,
      exercises: new Map(),
      currentExercise: 'shoulder_press', // Default start
      currentSet: 1,
      totalVolume: 0,
      sessionDuration: 0
    };
    
    this.initializeDetectors();
    this.switchToExercise('shoulder_press');
  }

  private generateSessionId(): string {
    return `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDetectors(): void {
    const exercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly', 'bicep_curl'];
    
    exercises.forEach(exercise => {
      const config = getExerciseConfig(exercise);
      this.detectors.set(exercise, new ExerciseDetector(config));
      
      // Initialize progress tracking
      this.exerciseProgress.set(exercise, {
        currentSet: 1,
        targetSets: this.getTargetSets(exercise),
        targetReps: this.getTargetReps(exercise),
        completedSets: [],
        isCompleted: false,
        restDuration: this.getRestDuration(exercise)
      });
    });
  }

  private getTargetSets(exercise: ExerciseType): number {
    // Based on your PDF model and exercise type
    const setTargets = {
      shoulder_press: 4,
      lateral_raise: 3,
      front_raise: 3, 
      rear_delt_fly: 3,
      bicep_curl: 3
    };
    return setTargets[exercise] || 3;
  }

  private getTargetReps(exercise: ExerciseType): number {
    // Based on training intensity from PDF
    const repTargets = {
      shoulder_press: 8, // Compound movement, moderate reps
      lateral_raise: 12, // Isolation, higher reps
      front_raise: 12,
      rear_delt_fly: 15, // Light weight, higher reps
      bicep_curl: 10
    };
    return repTargets[exercise] || 10;
  }

  private getRestDuration(exercise: ExerciseType): number {
    // Rest periods based on exercise intensity
    const restTimes = {
      shoulder_press: 120, // 2 minutes for compound
      lateral_raise: 60,   // 1 minute for isolation
      front_raise: 60,
      rear_delt_fly: 45,   // 45 seconds for light isolation
      bicep_curl: 90       // 1.5 minutes
    };
    return restTimes[exercise] || 60;
  }

  switchToExercise(exercise: ExerciseType): void {
    this.session.currentExercise = exercise;
    this.currentDetector = this.detectors.get(exercise);
    
    const progress = this.exerciseProgress.get(exercise)!;
    this.session.currentSet = progress.currentSet;
    
    // Reset detector for new set if needed
    if (!this.isResting) {
      this.currentDetector?.reset();
      this.setStartTime = Date.now() / 1000;
    }
  }

  step(landmarks: any[], timestamp: number) {
    if (!this.currentDetector || this.isResting) {
      return this.getIdleState();
    }

    const result = this.currentDetector.step(landmarks, timestamp);
    const exercise = this.session.currentExercise;
    const progress = this.exerciseProgress.get(exercise)!;

    // Check for new rep
    if (result.isNewRep) {
      this.onRepComplete?.(exercise, result.reps);
      
      // Check if set is complete
      if (result.reps >= progress.targetReps) {
        this.completeSet(result, timestamp);
      }
    }

    return {
      ...result,
      exercise,
      setNumber: progress.currentSet,
      targetReps: progress.targetReps,
      targetSets: progress.targetSets,
      completedSets: progress.completedSets.length,
      isResting: this.isResting,
      restTimeRemaining: this.getRestTimeRemaining()
    };
  }

  private completeSet(result: any, timestamp: number): void {
    const exercise = this.session.currentExercise;
    const progress = this.exerciseProgress.get(exercise)!;
    const detector = this.currentDetector!;
    const stats = detector.getStats();

    const setData: SetData = {
      exercise,
      setNumber: progress.currentSet,
      reps: result.reps,
      startTime: this.setStartTime,
      endTime: timestamp,
      avgVelocity: stats.avgVelocity,
      peakVelocity: stats.peakVelocity,
      velocityLoss: stats.velocityLoss,
      formScore: result.formScore
    };

    progress.completedSets.push(setData);
    
    // Add to session data
    if (!this.session.exercises.has(exercise)) {
      this.session.exercises.set(exercise, []);
    }
    this.session.exercises.get(exercise)!.push(setData);

    this.onSetComplete?.(exercise, setData);

    // Check if exercise is complete
    if (progress.currentSet >= progress.targetSets) {
      progress.isCompleted = true;
      this.onExerciseComplete?.(exercise, setData);
      
      // Check if entire workout is complete
      if (this.isWorkoutComplete()) {
        this.finishWorkout();
        return;
      }
    } else {
      // Start rest period
      this.startRest(exercise);
    }
  }

  private startRest(exercise: ExerciseType): void {
    const progress = this.exerciseProgress.get(exercise)!;
    
    this.isResting = true;
    progress.restStartTime = Date.now() / 1000;
    
    this.onRestStart?.(exercise, progress.restDuration);

    // Auto-advance to next set after rest
    this.restTimer = setTimeout(() => {
      this.endRest(exercise);
    }, progress.restDuration * 1000);
  }

  private endRest(exercise: ExerciseType): void {
    const progress = this.exerciseProgress.get(exercise)!;
    
    this.isResting = false;
    progress.currentSet++;
    progress.restStartTime = undefined;
    
    if (this.restTimer) {
      clearTimeout(this.restTimer);
      this.restTimer = undefined;
    }

    // Reset detector for new set
    this.currentDetector?.reset();
    this.setStartTime = Date.now() / 1000;
    
    this.onRestEnd?.(exercise);
  }

  private getRestTimeRemaining(): number {
    if (!this.isResting) return 0;
    
    const progress = this.exerciseProgress.get(this.session.currentExercise)!;
    if (!progress.restStartTime) return 0;
    
    const elapsed = (Date.now() / 1000) - progress.restStartTime;
    return Math.max(0, progress.restDuration - elapsed);
  }

  private isWorkoutComplete(): boolean {
    return Array.from(this.exerciseProgress.values()).every(p => p.isCompleted);
  }

  private finishWorkout(): void {
    this.session.sessionDuration = (Date.now() / 1000) - this.session.startTime;
    
    // Calculate total volume (sets × reps)
    let totalVolume = 0;
    this.session.exercises.forEach(sets => {
      totalVolume += sets.reduce((sum, set) => sum + set.reps, 0);
    });
    this.session.totalVolume = totalVolume;

    this.onWorkoutComplete?.(this.session);
  }

  private getIdleState() {
    const exercise = this.session.currentExercise;
    const progress = this.exerciseProgress.get(exercise)!;
    
    return {
      reps: 0,
      angle: 0,
      velocity: 0,
      state: this.isResting ? 'resting' : 'idle',
      formScore: 0,
      isNewRep: false,
      exercise,
      setNumber: progress.currentSet,
      targetReps: progress.targetReps,
      targetSets: progress.targetSets,
      completedSets: progress.completedSets.length,
      isResting: this.isResting,
      restTimeRemaining: this.getRestTimeRemaining()
    };
  }

  // Manual controls
  skipRest(): void {
    if (this.isResting) {
      this.endRest(this.session.currentExercise);
    }
  }

  forceCompleteSet(): void {
    if (!this.isResting && this.currentDetector) {
      const timestamp = Date.now() / 1000;
      const stats = this.currentDetector.getStats();
      
      this.completeSet({
        reps: stats.reps,
        formScore: 75, // Default score for manual completion
        isNewRep: false
      }, timestamp);
    }
  }

  nextExercise(): ExerciseType | null {
    const exercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
    const current = exercises.indexOf(this.session.currentExercise);
    
    if (current >= 0 && current < exercises.length - 1) {
      return exercises[current + 1];
    }
    return null;
  }

  // Getters for UI
  getCurrentExerciseProgress(): ExerciseProgress {
    return this.exerciseProgress.get(this.session.currentExercise)!;
  }

  getSessionSummary() {
    const completed = Array.from(this.exerciseProgress.values()).filter(p => p.isCompleted).length;
    const total = this.exerciseProgress.size;
    const currentDuration = (Date.now() / 1000) - this.session.startTime;
    
    return {
      sessionId: this.session.sessionId,
      exercisesCompleted: completed,
      totalExercises: total,
      currentDuration: Math.round(currentDuration),
      estimatedTimeRemaining: this.estimateTimeRemaining(),
      totalVolume: this.calculateCurrentVolume()
    };
  }

  private estimateTimeRemaining(): number {
    // Rough estimate based on remaining sets and average times
    let remainingTime = 0;
    
    this.exerciseProgress.forEach(progress => {
      if (!progress.isCompleted) {
        const remainingSets = progress.targetSets - progress.completedSets.length;
        const setTime = 60; // Assume 60 seconds per set
        const restTime = progress.restDuration;
        remainingTime += remainingSets * (setTime + restTime);
      }
    });
    
    return Math.round(remainingTime);
  }

  private calculateCurrentVolume(): number {
    let volume = 0;
    this.session.exercises.forEach(sets => {
      volume += sets.reduce((sum, set) => sum + set.reps, 0);
    });
    return volume;
  }

  exportSessionData(): string {
    const data = {
      session: this.session,
      progress: Object.fromEntries(this.exerciseProgress),
      summary: this.getSessionSummary()
    };
    
    return JSON.stringify(data, null, 2);
  }
}