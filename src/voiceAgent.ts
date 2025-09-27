// src/voiceAgent.ts
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
  velocityRange: [number, number]; // m/s
  oneRMRange: [number, number]; // % of 1RM
}

export class VoiceAgent {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private isEnabled: boolean = true;
  private messageQueue: VoiceMessage[] = [];
  private lastSpoken: number = 0;
  private readonly MIN_SPEAK_INTERVAL = 3000; // 3 seconds between messages
  
  // Training intensities from your PDF model
  private intensities: Record<string, WorkoutIntensity> = {
    light: {
      name: 'light',
      vlThreshold: 0.20, // 15-20% VL threshold
      sets: [3, 4],
      reps: [6, 8],
      velocityRange: [0.8, 1.2], // m/s
      oneRMRange: [40, 60] // % of 1RM
    },
    moderate: {
      name: 'moderate',
      vlThreshold: 0.25, // 20-25% VL threshold
      sets: [4, 5],
      reps: [6, 10],
      velocityRange: [0.6, 0.8], // m/s
      oneRMRange: [65, 75] // % of 1RM
    },
    intense: {
      name: 'intense',
      vlThreshold: 0.40, // 30-40% VL threshold
      sets: [3, 5],
      reps: [3, 6],
      velocityRange: [0.4, 0.6], // m/s
      oneRMRange: [80, 90] // % of 1RM
    }
  };

  private currentIntensity: WorkoutIntensity = this.intensities.moderate;
  private velocityHistory: number[] = [];
  private setVelocities: number[][] = []; // Track velocities per set
  private lastVLWarning: number = 0;
  private baselineVelocity: number | null = null;
  
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeVoice();
    this.startMessageProcessor();
  }

  private initializeVoice() {
    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
      // Prefer natural, encouraging voices
      this.voice = voices.find(v => 
        v.name.includes('Google') || 
        v.name.includes('Microsoft') || 
        v.name.includes('Samantha') ||
        v.lang.startsWith('en')
      ) || voices[0];
    };

    loadVoices();
    this.synthesis.onvoiceschanged = loadVoices;
  }

  private startMessageProcessor() {
    setInterval(() => {
      if (this.messageQueue.length > 0 && Date.now() - this.lastSpoken > this.MIN_SPEAK_INTERVAL) {
        const message = this.messageQueue.shift()!;
        this.speakImmediate(message);
      }
    }, 500);
  }

  setIntensity(intensity: 'light' | 'moderate' | 'intense') {
    this.currentIntensity = this.intensities[intensity];
    this.queueMessage({
      type: 'instruction',
      message: `Training intensity set to ${intensity}. Target velocity loss threshold is ${Math.round(this.currentIntensity.vlThreshold * 100)}%.`,
      priority: 'medium',
      timestamp: Date.now()
    });
  }

  // Main integration with your BicepCurlApp
  analyzeStep(stepInfo: any, setNumber: number): void {
    // Track velocities for analysis
    if (stepInfo.vel !== 0) {
      this.velocityHistory.push(Math.abs(stepInfo.vel));
      
      // Set baseline from first few reps
      if (this.baselineVelocity === null && this.velocityHistory.length >= 2) {
        this.baselineVelocity = this.velocityHistory.slice(0, 2).reduce((a, b) => a + b) / 2;
      }
    }

    // Analyze during active reps
    if (stepInfo.state === 'returning' && stepInfo.reps > 0) {
      this.checkVelocityLoss(stepInfo, setNumber);
      this.checkFormQuality(stepInfo);
    }

    // Set completion analysis
    if (stepInfo.setsCompleted > this.setVelocities.length) {
      this.onSetComplete(stepInfo);
    }

    // Rep completion encouragement
    if (stepInfo.state === 'idle' && stepInfo.reps > 0 && stepInfo.reps % 3 === 0) {
      this.giveEncouragement(stepInfo.reps);
    }
  }

  private checkVelocityLoss(stepInfo: any, setNumber: number): void {
    if (!this.baselineVelocity || this.velocityHistory.length < 3) return;

    const recentVelocities = this.velocityHistory.slice(-3);
    const currentAvg = recentVelocities.reduce((a, b) => a + b) / recentVelocities.length;
    const velocityLoss = (this.baselineVelocity - currentAvg) / this.baselineVelocity;

    const threshold = this.currentIntensity.vlThreshold;
    const now = Date.now();

    // Critical VL warning (immediate)
    if (velocityLoss >= threshold && now - this.lastVLWarning > 5000) {
      this.queueMessage({
        type: 'warning',
        message: this.getVelocityLossMessage(velocityLoss, threshold, true),
        priority: 'high',
        timestamp: now
      });
      this.lastVLWarning = now;
    }
    // Approaching threshold warning
    else if (velocityLoss >= threshold - 0.05 && now - this.lastVLWarning > 10000) {
      this.queueMessage({
        type: 'warning',
        message: this.getVelocityLossMessage(velocityLoss, threshold, false),
        priority: 'medium',
        timestamp: now
      });
      this.lastVLWarning = now;
    }
  }

  private getVelocityLossMessage(vl: number, threshold: number, critical: boolean): string {
    const vlPercent = Math.round(vl * 100);
    const thresholdPercent = Math.round(threshold * 100);
    
    if (critical) {
      if (vl >= 0.35) {
        return `Stop the set immediately! Velocity loss is ${vlPercent}%, well above your ${thresholdPercent}% limit. Rest and recover.`;
      } else {
        return `Velocity loss at ${vlPercent}% has reached your ${thresholdPercent}% threshold. Consider ending this set.`;
      }
    } else {
      return `Heads up! Velocity dropping to ${vlPercent}%. You're approaching your ${thresholdPercent}% threshold.`;
    }
  }

  private checkFormQuality(stepInfo: any): void {
    const messages: VoiceMessage[] = [];

    // Range of motion check
    if (stepInfo.angle > 160) {
      messages.push({
        type: 'instruction',
        message: 'Focus on getting a full contraction at the top. Squeeze those biceps.',
        priority: 'medium',
        timestamp: Date.now()
      });
    } else if (stepInfo.angle < 40) {
      messages.push({
        type: 'instruction',
        message: 'Good range of motion. Control the negative portion.',
        priority: 'low',
        timestamp: Date.now()
      });
    }

    // Velocity control check
    if (Math.abs(stepInfo.vel) > 250) {
      messages.push({
        type: 'instruction',
        message: 'Slow down the movement. Focus on control over speed.',
        priority: 'medium',
        timestamp: Date.now()
      });
    }

    // Queue form messages with lower priority
    messages.forEach(msg => {
      if (!this.messageQueue.some(m => m.message === msg.message)) {
        this.queueMessage(msg);
      }
    });
  }

  private onSetComplete(stepInfo: any): void {
    // Store set velocities for analysis
    this.setVelocities.push([...this.velocityHistory]);
    
    const setNum = stepInfo.setsCompleted;
    const reps = stepInfo.reps;
    
    // Celebration message
    this.queueMessage({
      type: 'celebration',
      message: `Great work! Set ${setNum} complete with ${reps} reps. ${this.getRestRecommendation()}`,
      priority: 'medium',
      timestamp: Date.now()
    });

    // Weight adjustment recommendation
    const adjustment = this.getWeightAdjustment();
    if (adjustment) {
      setTimeout(() => {
        this.queueMessage({
          type: 'adjustment',
          message: adjustment,
          priority: 'medium',
          timestamp: Date.now()
        });
      }, 2000);
    }

    // Reset for next set
    this.velocityHistory = [];
    this.baselineVelocity = null;
  }

  private getRestRecommendation(): string {
    switch (this.currentIntensity.name) {
      case 'light': return 'Take 60-90 seconds rest.';
      case 'moderate': return 'Take 90-120 seconds rest.';
      case 'intense': return 'Take 2-3 minutes rest.';
      default: return 'Take adequate rest.';
    }
  }

  private getWeightAdjustment(): string | null {
    if (this.setVelocities.length === 0) return null;

    const lastSetVelocities = this.setVelocities[this.setVelocities.length - 1];
    if (lastSetVelocities.length < 2) return null;

    const setBaseline = lastSetVelocities.slice(0, 2).reduce((a, b) => a + b) / 2;
    const setFinal = lastSetVelocities.slice(-2).reduce((a, b) => a + b) / 2;
    const setVL = (setBaseline - setFinal) / setBaseline;

    const threshold = this.currentIntensity.vlThreshold;

    if (setVL < threshold - 0.05) {
      return `Your velocity loss was only ${Math.round(setVL * 100)}%. Consider adding 2.5 to 5% more weight next set to reach your ${Math.round(threshold * 100)}% target.`;
    } else if (setVL > threshold + 0.05) {
      return `Velocity loss reached ${Math.round(setVL * 100)}%. Consider reducing weight by 2.5 to 5% next set to stay in your target zone.`;
    }

    return `Perfect! Your ${Math.round(setVL * 100)}% velocity loss is right in the target zone.`;
  }

  private giveEncouragement(reps: number): void {
    const encouragements = [
      `${reps} reps down! Keep that form tight.`,
      `Nice work! ${reps} quality reps completed.`,
      `${reps} reps in the books. Stay focused.`,
      `Good pace! ${reps} reps with solid form.`
    ];
    
    const message = encouragements[Math.floor(Math.random() * encouragements.length)];
    
    this.queueMessage({
      type: 'encouragement',
      message,
      priority: 'low',
      timestamp: Date.now()
    });
  }

  private queueMessage(message: VoiceMessage): void {
    // Avoid duplicate messages in queue
    if (this.messageQueue.some(m => m.message === message.message)) return;
    
    // Priority queue - high priority messages go first
    if (message.priority === 'high') {
      this.messageQueue.unshift(message);
    } else {
      this.messageQueue.push(message);
    }

    // Limit queue size
    if (this.messageQueue.length > 5) {
      this.messageQueue = this.messageQueue.slice(-5);
    }
  }

  private speakImmediate(message: VoiceMessage): void {
    if (!this.isEnabled || !this.voice) return;
    
    const utterance = new SpeechSynthesisUtterance(message.message);
    utterance.voice = this.voice;
    utterance.rate = message.priority === 'high' ? 1.0 : 0.9;
    utterance.pitch = message.type === 'celebration' ? 1.1 : 1.0;
    utterance.volume = message.priority === 'high' ? 0.9 : 0.7;
    
    this.synthesis.speak(utterance);
    this.lastSpoken = Date.now();
  }

  // Public methods for manual testing
  testMessage(type: VoiceMessage['type']): void {
    const testMessages = {
      encouragement: "Keep pushing! Your form looks great.",
      warning: "Velocity loss at 25%. You're approaching your threshold.",
      instruction: "Focus on the full range of motion. Control the negative.",
      celebration: "Excellent set! 8 reps completed with perfect form.",
      adjustment: "Consider adding 2.5% more weight next set to hit your target zone."
    };

    this.queueMessage({
      type,
      message: testMessages[type],
      priority: type === 'warning' ? 'high' : 'medium',
      timestamp: Date.now()
    });
  }

  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    if (this.isEnabled) {
      this.queueMessage({
        type: 'instruction',
        message: 'Voice coaching enabled.',
        priority: 'low',
        timestamp: Date.now()
      });
    }
    return this.isEnabled;
  }

  clearQueue(): void {
    this.messageQueue = [];
    this.synthesis.cancel();
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      intensity: this.currentIntensity.name,
      queueLength: this.messageQueue.length,
      velocityHistory: this.velocityHistory.length,
      threshold: this.currentIntensity.vlThreshold
    };
  }
}