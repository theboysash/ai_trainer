import { ExerciseType } from './exerciseSystem';
export declare class VelocityCoachAI {
    private landmarker?;
    private voiceAgent;
    private visualDashboard;
    private exerciseDetectors;
    private currentExercise;
    private video;
    private canvas;
    private ctx;
    private stream?;
    private running;
    constructor();
    private initializeAllDetectors;
    private createVBTControls;
    private setupEventHandlers;
    start(): Promise<void>;
    private loop;
    private processCurrentExercise;
    private getDefaultStepData;
    private getVelocityLoss;
    private getTargetReps;
    private calculateFormScore;
    private drawPoseSkeleton;
    private highlightActiveExercise;
    private drawOverlayInfo;
    private drawNoPersonMessage;
    private switchExercise;
    private toggleVoice;
    stop(): void;
    private updateUI;
    getCurrentExercise(): ExerciseType;
    getVoiceStatus(): any;
    destroy(): void;
}
export default VelocityCoachAI;
//# sourceMappingURL=finalWorkingIntegration.d.ts.map