export interface VoiceMessage {
    type: 'encouragement' | 'warning' | 'instruction' | 'celebration' | 'adjustment';
    message: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: number;
}
export interface WorkoutIntensity {
    name: 'light' | 'moderate' | 'intense';
    vlThreshold: number;
    sets: [number, number];
    reps: [number, number];
    velocityRange: [number, number];
    oneRMRange: [number, number];
}
export declare class VoiceAgent {
    private synthesis;
    private voice;
    private isEnabled;
    private messageQueue;
    private lastSpoken;
    private readonly MIN_SPEAK_INTERVAL;
    private intensities;
    private currentIntensity;
    private velocityHistory;
    private setVelocities;
    private lastVLWarning;
    private baselineVelocity;
    constructor();
    private initializeVoice;
    private startMessageProcessor;
    setIntensity(intensity: 'light' | 'moderate' | 'intense'): void;
    analyzeStep(stepInfo: any, setNumber: number): void;
    private checkVelocityLoss;
    private getVelocityLossMessage;
    private checkFormQuality;
    private onSetComplete;
    private getRestRecommendation;
    private getWeightAdjustment;
    private giveEncouragement;
    private queueMessage;
    private speakImmediate;
    testMessage(type: VoiceMessage['type']): void;
    toggle(): boolean;
    clearQueue(): void;
    getStatus(): {
        enabled: boolean;
        intensity: "light" | "moderate" | "intense";
        queueLength: number;
        velocityHistory: number;
        threshold: number;
    };
}
//# sourceMappingURL=voiceAgent.d.ts.map