import { ExerciseType, SetData, WorkoutSession } from './exerciseSystem';
export interface ExerciseProgress {
    currentSet: number;
    targetSets: number;
    targetReps: number;
    completedSets: SetData[];
    isCompleted: boolean;
    restStartTime?: number;
    restDuration: number;
}
export declare class WorkoutManager {
    private session;
    private detectors;
    private exerciseProgress;
    private currentDetector?;
    private isResting;
    private setStartTime;
    private restTimer?;
    onExerciseComplete?: (exercise: ExerciseType, setData: SetData) => void;
    onSetComplete?: (exercise: ExerciseType, setData: SetData) => void;
    onRepComplete?: (exercise: ExerciseType, reps: number) => void;
    onRestStart?: (exercise: ExerciseType, restTime: number) => void;
    onRestEnd?: (exercise: ExerciseType) => void;
    onWorkoutComplete?: (session: WorkoutSession) => void;
    constructor();
    private generateSessionId;
    private initializeDetectors;
    private getTargetSets;
    private getTargetReps;
    private getRestDuration;
    switchToExercise(exercise: ExerciseType): void;
    step(landmarks: any[], timestamp: number): {
        reps: number;
        angle: number;
        velocity: number;
        state: string;
        formScore: number;
        isNewRep: boolean;
        exercise: ExerciseType;
        setNumber: number;
        targetReps: number;
        targetSets: number;
        completedSets: number;
        isResting: boolean;
        restTimeRemaining: number;
    };
    private completeSet;
    private startRest;
    private endRest;
    private getRestTimeRemaining;
    private isWorkoutComplete;
    private finishWorkout;
    private getIdleState;
    skipRest(): void;
    forceCompleteSet(): void;
    nextExercise(): ExerciseType | null;
    getCurrentExerciseProgress(): ExerciseProgress;
    getSessionSummary(): {
        sessionId: string;
        exercisesCompleted: number;
        totalExercises: number;
        currentDuration: number;
        estimatedTimeRemaining: number;
        totalVolume: number;
    };
    private estimateTimeRemaining;
    private calculateCurrentVolume;
    exportSessionData(): string;
}
//# sourceMappingURL=workoutManager.d.ts.map