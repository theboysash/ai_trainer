export interface VisualInsight {
    type: 'form' | 'velocity' | 'range' | 'tempo' | 'fatigue';
    severity: 'good' | 'warning' | 'critical';
    message: string;
    value: number;
    recommendation: string;
    trend: 'improving' | 'stable' | 'declining';
}
export declare class VisualInsightSystem {
    private insights;
    private historicalData;
    private lastUpdate;
    private readonly UPDATE_INTERVAL;
    update(stepData: any): VisualInsight[];
    private trackHistoricalData;
    private analyzeFormQuality;
    private analyzeVelocityTrends;
    private analyzeRangeOfMotion;
    private analyzeTempo;
    private analyzeFatigueLevel;
    private calculateTrend;
    private calculateVariance;
    private calculateDecline;
    getInsights(): VisualInsight[];
    reset(): void;
}
//# sourceMappingURL=visualInsights.d.ts.map