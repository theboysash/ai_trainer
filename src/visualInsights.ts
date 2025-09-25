// src/visualInsights.ts
export interface VisualInsight {
  type: 'form' | 'velocity' | 'range' | 'tempo' | 'fatigue';
  severity: 'good' | 'warning' | 'critical';
  message: string;
  value: number;
  recommendation: string;
  trend: 'improving' | 'stable' | 'declining';
}

export class VisualInsightSystem {
  private insights: VisualInsight[] = [];
  private historicalData: Map<string, number[]> = new Map();
  private lastUpdate: number = 0;
  private readonly UPDATE_INTERVAL = 1000; // Update insights every second

  update(stepData: any): VisualInsight[] {
    const now = Date.now();
    if (now - this.lastUpdate < this.UPDATE_INTERVAL) {
      return this.insights;
    }

    this.insights = [];
    this.trackHistoricalData(stepData);
    
    // Generate insights based on current and historical data
    this.analyzeFormQuality(stepData);
    this.analyzeVelocityTrends(stepData);
    this.analyzeRangeOfMotion(stepData);
    this.analyzeTempo(stepData);
    this.analyzeFatigueLevel(stepData);
    
    this.lastUpdate = now;
    return this.insights;
  }

  private trackHistoricalData(stepData: any): void {
    const metrics = {
      formScore: stepData.formScore,
      velocity: Math.abs(stepData.velocity),
      angle: stepData.angle,
      velocityLoss: stepData.velocityLoss || 0
    };

    Object.entries(metrics).forEach(([key, value]) => {
      if (!this.historicalData.has(key)) {
        this.historicalData.set(key, []);
      }
      
      const history = this.historicalData.get(key)!;
      history.push(value);
      
      // Keep last 30 data points
      if (history.length > 30) {
        history.shift();
      }
    });
  }

  private analyzeFormQuality(stepData: any): void {
    const formScore = stepData.formScore;
    const formHistory = this.historicalData.get('formScore') || [];
    
    let severity: 'good' | 'warning' | 'critical' = 'good';
    let message = '';
    let recommendation = '';
    let trend = this.calculateTrend(formHistory);

    if (formScore < 50) {
      severity = 'critical';
      message = `Form score: ${Math.round(formScore)}% - Needs attention`;
      recommendation = 'Focus on controlled movement, reduce weight if needed';
    } else if (formScore < 75) {
      severity = 'warning';
      message = `Form score: ${Math.round(formScore)}% - Room for improvement`;
      recommendation = 'Slow down the movement, maintain proper posture';
    } else {
      message = `Form score: ${Math.round(formScore)}% - Excellent technique`;
      recommendation = 'Maintain this quality throughout the set';
    }

    this.insights.push({
      type: 'form',
      severity,
      message,
      value: formScore,
      recommendation,
      trend
    });
  }

  private analyzeVelocityTrends(stepData: any): void {
    const velocityHistory = this.historicalData.get('velocity') || [];
    const vlHistory = this.historicalData.get('velocityLoss') || [];
    
    if (velocityHistory.length < 5) return;

    const currentVL = vlHistory[vlHistory.length - 1] || 0;
    const trend = this.calculateTrend(velocityHistory);
    
    let severity: 'good' | 'warning' | 'critical' = 'good';
    let message = '';
    let recommendation = '';

    if (currentVL > 0.30) {
      severity = 'critical';
      message = `Velocity loss: ${Math.round(currentVL * 100)}% - High fatigue`;
      recommendation = 'Consider ending this set, take longer rest';
    } else if (currentVL > 0.20) {
      severity = 'warning';
      message = `Velocity loss: ${Math.round(currentVL * 100)}% - Moderate fatigue`;
      recommendation = 'Monitor closely, prepare to end set';
    } else {
      message = `Velocity loss: ${Math.round(currentVL * 100)}% - Good power output`;
      recommendation = 'Maintain current intensity';
    }

    this.insights.push({
      type: 'velocity',
      severity,
      message,
      value: currentVL,
      recommendation,
      trend
    });
  }

  private analyzeRangeOfMotion(stepData: any): void {
    const angleHistory = this.historicalData.get('angle') || [];
    
    if (angleHistory.length < 5) return;

    const recentAngles = angleHistory.slice(-10);
    const maxAngle = Math.max(...recentAngles);
    const minAngle = Math.min(...recentAngles);
    const currentROM = maxAngle - minAngle;
    
    // Exercise-specific ROM targets
    const romTargets = {
      shoulder_press: 70,
      lateral_raise: 75,
      front_raise: 75,
      rear_delt_fly: 65,
      bicep_curl: 115
    };
    
    const targetROM = romTargets[stepData.exercise as keyof typeof romTargets] || 70;
    const romPercentage = Math.min(100, (currentROM / targetROM) * 100);
    
    let severity: 'good' | 'warning' | 'critical' = 'good';
    let message = '';
    let recommendation = '';

    if (romPercentage < 60) {
      severity = 'critical';
      message = `Range of motion: ${Math.round(romPercentage)}% - Too limited`;
      recommendation = 'Focus on full range, reduce weight if necessary';
    } else if (romPercentage < 80) {
      severity = 'warning';
      message = `Range of motion: ${Math.round(romPercentage)}% - Could be better`;
      recommendation = 'Try to achieve fuller range of motion';
    } else {
      message = `Range of motion: ${Math.round(romPercentage)}% - Excellent range`;
      recommendation = 'Perfect range, maintain throughout set';
    }

    this.insights.push({
      type: 'range',
      severity,
      message,
      value: romPercentage,
      recommendation,
      trend: 'stable'
    });
  }

  private analyzeTempo(stepData: any): void {
    const velocityHistory = this.historicalData.get('velocity') || [];
    
    if (velocityHistory.length < 8) return;

    const recent = velocityHistory.slice(-8);
    const variance = this.calculateVariance(recent);
    const avgVelocity = recent.reduce((a, b) => a + b) / recent.length;
    
    let severity: 'good' | 'warning' | 'critical' = 'good';
    let message = '';
    let recommendation = '';

    if (variance > 2000 || avgVelocity > 200) {
      severity = 'warning';
      message = 'Tempo: Inconsistent - Too much variation';
      recommendation = 'Focus on controlled, consistent movement speed';
    } else if (variance < 200) {
      message = 'Tempo: Excellent - Very consistent';
      recommendation = 'Perfect control, maintain this rhythm';
    } else {
      message = 'Tempo: Good - Reasonably consistent';
      recommendation = 'Good tempo control, keep it steady';
    }

    this.insights.push({
      type: 'tempo',
      severity,
      message,
      value: variance,
      recommendation,
      trend: 'stable'
    });
  }

  private analyzeFatigueLevel(stepData: any): void {
    const formHistory = this.historicalData.get('formScore') || [];
    const velocityHistory = this.historicalData.get('velocity') || [];
    
    if (formHistory.length < 10) return;

    const recentForm = formHistory.slice(-5);
    const recentVelocity = velocityHistory.slice(-5);
    
    const formDecline = this.calculateDecline(recentForm);
    const velocityDecline = this.calculateDecline(recentVelocity);
    
    const fatigueScore = (formDecline + velocityDecline) / 2;
    
    let severity: 'good' | 'warning' | 'critical' = 'good';
    let message = '';
    let recommendation = '';

    if (fatigueScore > 15) {
      severity = 'critical';
      message = 'Fatigue: High - Performance declining rapidly';
      recommendation = 'Consider ending set, take extended rest';
    } else if (fatigueScore > 8) {
      severity = 'warning';
      message = 'Fatigue: Moderate - Some performance decline';
      recommendation = 'Monitor closely, prepare to finish set';
    } else {
      message = 'Fatigue: Low - Maintaining performance well';
      recommendation = 'Good energy levels, continue strong';
    }

    this.insights.push({
      type: 'fatigue',
      severity,
      message,
      value: fatigueScore,
      recommendation,
      trend: fatigueScore > 10 ? 'declining' : 'stable'
    });
  }

  private calculateTrend(data: number[]): 'improving' | 'stable' | 'declining' {
    if (data.length < 5) return 'stable';
    
    const recent = data.slice(-5);
    const earlier = data.slice(-10, -5);
    
    if (earlier.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b) / earlier.length;
    
    const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;
    
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  private calculateVariance(data: number[]): number {
    if (data.length === 0) return 0;
    
    const mean = data.reduce((a, b) => a + b) / data.length;
    const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / squaredDiffs.length;
  }

  private calculateDecline(data: number[]): number {
    if (data.length < 2) return 0;
    
    const first = data[0];
    const last = data[data.length - 1];
    
    return Math.max(0, ((first - last) / first) * 100);
  }

  getInsights(): VisualInsight[] {
    return [...this.insights];
  }

  reset(): void {
    this.insights = [];
    this.historicalData.clear();
  }
}