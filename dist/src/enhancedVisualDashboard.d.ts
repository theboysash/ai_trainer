import { SmartProgressTracker } from './smartProgressTracker';
export declare class EnhancedVisualDashboard {
    private insightSystem;
    private progressTracker;
    private insightsContainer;
    private progressContainer;
    private metricsContainer;
    constructor();
    private createInsightsPanels;
    private injectEnhancedCSS;
    updateDashboard(stepData: any): void;
    private renderInsights;
    private renderProgressCards;
    private updateEnhancedMetrics;
    onSetComplete(exerciseType: any, setData: any): void;
    onExerciseSwitch(exerciseType: any): void;
    onRestStart(): void;
    getProgressTracker(): SmartProgressTracker;
    reset(): void;
    private startRealTimeUpdates;
}
//# sourceMappingURL=enhancedVisualDashboard.d.ts.map