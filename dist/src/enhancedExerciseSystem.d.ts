export type ExerciseType = 'bicep_curl' | 'shoulder_press' | 'lateral_raise' | 'front_raise' | 'rear_delt_fly' | 'chest_press' | 'push_ups' | 'tricep_extension' | 'rows' | 'squats';
export interface ExerciseConfig {
    name: string;
    type: ExerciseType;
    muscleGroup: 'shoulders' | 'chest' | 'arms' | 'back' | 'legs';
    landmarks: {
        primary: number[];
        secondary?: number[];
    };
    thresholds: {
        startAngle: number;
        endAngle: number;
        minROM: number;
        maxVelocity: number;
        stabilityThresh: number;
    };
    voiceCues: {
        formTips: string[];
        encouragement: string[];
        warnings: string[];
    };
}
export interface SetData {
    exercise: ExerciseType;
    setNumber: number;
    reps: number;
    startTime: number;
    endTime: number;
    avgVelocity: number;
    peakVelocity: number;
    velocityLoss: number;
    formScore: number;
    restTime?: number;
}
export interface WorkoutSession {
    sessionId: string;
    startTime: number;
    exercises: Map<ExerciseType, SetData[]>;
    currentExercise: ExerciseType;
    currentSet: number;
    totalVolume: number;
    sessionDuration: number;
    userId?: string;
}
export declare const ENHANCED_EXERCISE_CONFIGS: Record<ExerciseType, ExerciseConfig>;
export declare class EnhancedExerciseDetector {
    private config;
    private velocityHistory;
    private angleHistory;
    private state;
    private repStartTime;
    private currentAngle;
    private baselineVelocity;
    private reps;
    private lastAngle?;
    private lastTime?;
    private velocity;
    constructor(config: ExerciseConfig);
    step(landmarks: any[], timestamp: number): {
        reps: number;
        angle: number;
        velocity: number;
        state: string;
        formScore: number;
        isNewRep: boolean;
    };
    private computeMetrics;
    private computeShoulderPressMetrics;
    private computeLateralRaiseMetrics;
    private computeFrontRaiseMetrics;
    private computeRearDeltMetrics;
    private computePushUpMetrics;
    private computeBicepCurlMetrics;
    private computeTricepExtensionMetrics;
    private computeRowMetrics;
    private computeSquatMetrics;
    private jointsVisible;
    private updateState;
    private detectRep;
    private calculateFormScore;
    private calculateVariance;
    getCurrentVelocityLoss(): number;
    reset(): void;
    getStats(): {
        reps: number;
        velocityLoss: number;
        avgVelocity: number;
        peakVelocity: number;
    };
}
export declare function getExerciseConfig(type: ExerciseType): ExerciseConfig;
export declare function getAllExerciseTypes(): ExerciseType[];
export declare function getExercisesByMuscleGroup(muscleGroup: 'shoulders' | 'chest' | 'arms' | 'back' | 'legs'): ExerciseType[];
//# sourceMappingURL=enhancedExerciseSystem.d.ts.map