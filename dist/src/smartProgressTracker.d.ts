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
export declare class SmartProgressTracker {
    private exerciseProgress;
    private currentExercise;
    private sessionStartTime;
    constructor();
    private initializeExercises;
    switchToExercise(exerciseType: ExerciseType): boolean;
    completeSet(exerciseType: ExerciseType, setData: SetData): boolean;
    private autoAdvanceToNextExercise;
    getCurrentExerciseProgress(): ExerciseProgress | null;
    getExerciseProgress(exerciseType: ExerciseType): ExerciseProgress | null;
    getAllProgress(): Map<ExerciseType, ExerciseProgress>;
    isResting(exerciseType?: ExerciseType): boolean;
    getRestTimeRemaining(exerciseType?: ExerciseType): number;
    skipRest(exerciseType?: ExerciseType): void;
    isWorkoutComplete(): boolean;
    getWorkoutStats(): {
        totalSets: number;
        completedSets: number;
        totalReps: number;
        workoutDuration: number;
        progressPercentage: number;
        currentExercise: ExerciseType;
        isComplete: boolean;
    };
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
    };
    exportData(): any;
    reset(): void;
}
//# sourceMappingURL=smartProgressTracker.d.ts.map