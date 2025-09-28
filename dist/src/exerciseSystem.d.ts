export type ExerciseType = 'bicep_curl' | 'shoulder_press' | 'lateral_raise' | 'front_raise' | 'rear_delt_fly';
export interface ExerciseConfig {
    name: string;
    type: ExerciseType;
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
}
export declare class ExerciseDetector {
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
    private computeBicepCurlMetrics;
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
//# sourceMappingURL=exerciseSystem.d.ts.map