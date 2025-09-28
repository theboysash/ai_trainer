export interface VBTIntensity {
    name: 'light' | 'moderate' | 'intense';
    vlThreshold: number;
    velocityRange: [number, number];
    oneRMRange: [number, number];
    sets: [number, number];
    reps: [number, number];
}
export declare class VBTVoiceAgent {
    private synthesis;
    private voice;
    private isEnabled;
    private messageQueue;
    private lastSpoken;
    private readonly MIN_SPEAK_INTERVAL;
    private intensities;
    private currentIntensity;
    private exerciseData;
    constructor();
    private initializeVoice;
    private startMessageProcessor;
    updateIntensity(intensity: 'light' | 'moderate' | 'intense'): void;
    analyzeWorkoutStep(stepData: any): void;
    private trackVelocity;
    private checkVelocityLoss;
    private getVLThreshold;
    private queueVLWarning;
    private checkWeightAdjustment;
    private calculateSetVelocityLoss;
    private getWeightAdjustmentRecommendation;
    private handleRepCompletion;
    onExerciseStart(exercise: string): void;
    onSetComplete(exercise: string, setData: any): void;
    onWorkoutComplete(): void;
    private queueMessage;
    private speakImmediate;
    toggle(): boolean;
    clearQueue(): void;
    getCurrentIntensity(): VBTIntensity;
    getStatus(): {
        enabled: boolean;
        intensity: "light" | "moderate" | "intense";
        vlThreshold: number;
        queueLength: number;
        exerciseCount: number;
    };
}
//# sourceMappingURL=vbtVoiceIntegration.d.ts.map