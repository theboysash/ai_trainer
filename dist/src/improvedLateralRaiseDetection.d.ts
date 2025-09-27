export declare class ImprovedLateralRaiseDetector {
    private state;
    private reps;
    private lastAngle;
    private lastTime;
    private velocity;
    private readonly START_THRESHOLD;
    private readonly TOP_THRESHOLD;
    private readonly MIN_ROM;
    private readonly HYSTERESIS;
    private angleHistory;
    private readonly SMOOTHING_WINDOW;
    step(landmarks: any[], timestamp: number): {
        angle: number;
        reps: number;
        velocity: number;
        state: string;
        isNewRep: boolean;
    };
    private computeLateralRaiseMetrics;
    private calculateLateralRaiseAngle;
    private smoothAngle;
    private updateState;
    reset(): void;
    getStats(): {
        reps: number;
        currentAngle: number;
        currentState: "idle" | "top" | "raising" | "lowering";
        smoothedData: number;
    };
}
//# sourceMappingURL=improvedLateralRaiseDetection.d.ts.map