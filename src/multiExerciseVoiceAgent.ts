// src/multiExerciseVoiceAgent.ts
import { VoiceMessage, WorkoutIntensity } from './voiceAgent';
import { ExerciseType, SetData } from './exerciseSystem';
import { getExerciseConfig } from './exerciseConfigs';

export class MultiExerciseVoiceAgent {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private isEnabled: boolean = true;
  private messageQueue: VoiceMessage[] = [];
  private lastSpoken: number = 0;
  private readonly MIN_SPEAK_INTERVAL = 2500;
  
  // Exercise-specific tracking
  private currentExercise: ExerciseType = 'shoulder_press';
  private exerciseVelocityHistory: Map<ExerciseType, number[]> = new Map();
  private exerciseBaselines: Map<ExerciseType, number> = new Map();
  private lastFormWarning: Map<ExerciseType, number> = new Map();
  private lastVLWarning: Map<ExerciseType, number> = new Map();
  
  // Workout progression tracking
  private workoutStartTime: number = Date.now();
  private totalSetsCompleted: number = 0;
  private workoutIntensity: 'light' | 'moderate' | 'intense' = 'moderate';

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeVoice();
    this.startMessageProcessor();
  }

  private initializeVoice() {
    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
      this.voice = voices.find(v => 
        v.name.includes('Google') || 
        v.name.includes('Microsoft') || 
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

  // Main analysis method for workout session
  analyzeWorkoutStep(stepData: any): void {
    this.currentExercise = stepData.exercise;
    
    // Handle rest periods
    if (stepData.isResting) {
      this.handleRestPeriod(stepData);
      return;
    }

    // Track exercise progression
    if (stepData.velocity !== 0) {
      this.trackExerciseVelocity(stepData.exercise, Math.abs(stepData.velocity));
    }

    // Analyze current exercise performance
    if (stepData.state !== 'idle') {
      this.analyzeExerciseForm(stepData);
      this.checkVelocityLoss(stepData);
    }

    // Rep completion feedback
    if (stepData.isNewRep) {
      this.handleRepCompletion(stepData);
    }
  }

  private trackExerciseVelocity(exercise: ExerciseType, velocity: number): void {
    if (!this.exerciseVelocityHistory.has(exercise)) {
      this.exerciseVelocityHistory.set(exercise, []);
    }
    
    const history = this.exerciseVelocityHistory.get(exercise)!;
    history.push(velocity);
    
    // Set baseline from first few movements
    if (!this.exerciseBaselines.has(exercise) && history.length >= 3) {
      const baseline = history.slice(0, 3).reduce((a, b) => a + b) / 3;
      this.exerciseBaselines.set(exercise, baseline);
    }
    
    // Keep history manageable
    if (history.length > 12) {
      history.splice(0, history.length - 10);
    }
  }

  private analyzeExerciseForm(stepData: any): void {
    const config = getExerciseConfig(stepData.exercise);
    const now = Date.now();
    const lastWarning = this.lastFormWarning.get(stepData.exercise) || 0;
    
    // Throttle form warnings to avoid spam
    if (now - lastWarning < 8000) return;
    
    let formMessage: VoiceMessage | null = null;

    // Exercise-specific form analysis
    switch (stepData.exercise) {
      case 'shoulder_press':
        formMessage = this.analyzeShoulderPressForm(stepData, config);
        break;
      case 'lateral_raise':
        formMessage = this.analyzeLateralRaiseForm(stepData, config);
        break;
      case 'front_raise':
        formMessage = this.analyzeFrontRaiseForm(stepData, config);
        break;
      case 'rear_delt_fly':
        formMessage = this.analyzeRearDeltForm(stepData, config);
        break;
      case 'bicep_curl':
        formMessage = this.analyzeBicepCurlForm(stepData, config);
        break;
    }

    if (formMessage) {
      this.queueMessage(formMessage);
      this.lastFormWarning.set(stepData.exercise, now);
    }
  }

  private analyzeShoulderPressForm(stepData: any, config: any): VoiceMessage | null {
    // Check for common shoulder press errors
    if (stepData.formScore < 70) {
      if (Math.abs(stepData.velocity) > config.thresholds.maxVelocity) {
        return {
          type: 'instruction',
          message: 'Slow down the press. Control the weight up and down.',
          priority: 'medium',
          timestamp: Date.now()
        };
      }
      
      if (stepData.angle < config.thresholds.startAngle * 0.8) {
        return {
          type: 'instruction',
          message: 'Press higher. Get full overhead extension.',
          priority: 'medium',
          timestamp: Date.now()
        };
      }
    }
    
    return null;
  }

  private analyzeLateralRaiseForm(stepData: any, config: any): VoiceMessage | null {
    if (stepData.formScore < 75) {
      if (Math.abs(stepData.velocity) > config.thresholds.maxVelocity) {
        return {
          type: 'instruction',
          message: 'Less swinging, more control. Feel those side delts working.',
          priority: 'medium',
          timestamp: Date.now()
        };
      }
      
      if (stepData.angle > config.thresholds.endAngle + 10) {
        return {
          type: 'instruction',
          message: 'Stop at shoulder height. Protect your shoulder joints.',
          priority: 'medium',
          timestamp: Date.now()
        };
      }
    }
    
    return null;
  }

  private analyzeFrontRaiseForm(stepData: any, config: any): VoiceMessage | null {
    if (stepData.formScore < 75 && Math.abs(stepData.velocity) > config.thresholds.maxVelocity) {
      return {
        type: 'instruction',
        message: 'Control the front raise. No momentum, pure muscle.',
        priority: 'medium',
        timestamp: Date.now()
      };
    }
    
    return null;
  }

  private analyzeRearDeltForm(stepData: any, config: any): VoiceMessage | null {
    if (stepData.formScore < 70) {
      return {
        type: 'instruction',
        message: 'Squeeze those shoulder blades. Lead with your pinkies.',
        priority: 'medium',
        timestamp: Date.now()
      };
    }
    
    return null;
  }

  private analyzeBicepCurlForm(stepData: any, config: any): VoiceMessage | null {
    if (stepData.formScore < 70) {
      if (Math.abs(stepData.velocity) > config.thresholds.maxVelocity) {
        return {
          type: 'instruction',
          message: 'Keep your elbows still. Isolate those biceps.',
          priority: 'medium',
          timestamp: Date.now()
        };
      }
    }
    
    return null;
  }

  private checkVelocityLoss(stepData: any): void {
    const history = this.exerciseVelocityHistory.get(stepData.exercise);
    const baseline = this.exerciseBaselines.get(stepData.exercise);
    
    if (!history || !baseline || history.length < 4) return;
    
    const recent = history.slice(-3);
    const currentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const velocityLoss = (baseline - currentAvg) / baseline;
    
    // Exercise-specific VL thresholds
    const vlThreshold = this.getVLThreshold(stepData.exercise);
    const now = Date.now();
    const lastWarning = this.lastVLWarning.get(stepData.exercise) || 0;
    
    if (velocityLoss >= vlThreshold && now - lastWarning > 6000) {
      this.queueMessage({
        type: 'warning',
        message: this.getVLWarningMessage(stepData.exercise, velocityLoss, vlThreshold),
        priority: 'high',
        timestamp: now
      });
      this.lastVLWarning.set(stepData.exercise, now);
    }
  }

  private getVLThreshold(exercise: ExerciseType): number {
    // Different VL thresholds based on exercise type and training goals
    const thresholds = {
      shoulder_press: 0.25,    // Compound movement, allow more VL
      lateral_raise: 0.20,     // Isolation, stricter VL
      front_raise: 0.20,
      rear_delt_fly: 0.18,     // Light weight, very strict VL
      bicep_curl: 0.22
    };
    
    return thresholds[exercise] || 0.20;
  }

  private getVLWarningMessage(exercise: ExerciseType, vl: number, threshold: number): string {
    const exerciseName = getExerciseConfig(exercise).name;
    const vlPercent = Math.round(vl * 100);
    const thresholdPercent = Math.round(threshold * 100);
    
    if (vl >= 0.35) {
      return `Stop the ${exerciseName} set! Velocity loss at ${vlPercent}%, well above your ${thresholdPercent}% limit.`;
    } else {
      return `Velocity dropping on ${exerciseName}. At ${vlPercent}% loss, approaching your ${thresholdPercent}% threshold.`;
    }
  }

  private handleRepCompletion(stepData: any): void {
    const config = getExerciseConfig(stepData.exercise);
    const encouragements = config.voiceCues.encouragement;
    
    // Give rep-specific encouragement occasionally
    if (stepData.reps % 3 === 0 || stepData.reps === stepData.targetReps) {
      const message = encouragements[Math.floor(Math.random() * encouragements.length)];
      
      this.queueMessage({
        type: 'encouragement',
        message: `${stepData.reps} reps down. ${message}`,
        priority: 'low',
        timestamp: Date.now()
      });
    }
  }

  private handleRestPeriod(stepData: any): void {
    // Rest period coaching
    if (stepData.restTimeRemaining > 0) {
      const remaining = Math.ceil(stepData.restTimeRemaining);
      
      if (remaining === 30) {
        this.queueMessage({
          type: 'instruction',
          message: '30 seconds left. Start mentally preparing for your next set.',
          priority: 'low',
          timestamp: Date.now()
        });
      } else if (remaining === 10) {
        this.queueMessage({
          type: 'instruction',
          message: '10 seconds. Get ready to go again.',
          priority: 'medium',
          timestamp: Date.now()
        });
      }
    }
  }

  // Workout progression callbacks
  onExerciseStart(exercise: ExerciseType): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'instruction',
      message: `Starting ${config.name}. ${config.voiceCues.formTips[0]}`,
      priority: 'medium',
      timestamp: Date.now()
    });
  }

  onSetComplete(exercise: ExerciseType, setData: SetData): void {
    const config = getExerciseConfig(exercise);
    this.totalSetsCompleted++;
    
    // Analyze set performance
    let performanceMessage = '';
    if (setData.formScore > 85) {
      performanceMessage = 'Excellent form on that set!';
    } else if (setData.velocityLoss < 0.15) {
      performanceMessage = 'Great power output maintained!';
    } else {
      performanceMessage = 'Good work pushing through!';
    }

    this.queueMessage({
      type: 'celebration',
      message: `${config.name} set ${setData.setNumber} complete. ${setData.reps} reps. ${performanceMessage}`,
      priority: 'medium',
      timestamp: Date.now()
    });

    // Weight adjustment recommendation
    setTimeout(() => {
      const adjustment = this.getWeightAdjustment(setData);
      if (adjustment) {
        this.queueMessage({
          type: 'adjustment',
          message: adjustment,
          priority: 'low',
          timestamp: Date.now()
        });
      }
    }, 3000);
  }

  onExerciseComplete(exercise: ExerciseType): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'celebration',
      message: `${config.name} complete! Outstanding work on all sets.`,
      priority: 'medium',
      timestamp: Date.now()
    });
  }

  onWorkoutComplete(): void {
    const workoutTime = Math.round((Date.now() - this.workoutStartTime) / 60000);
    
    this.queueMessage({
      type: 'celebration',
      message: `Workout complete! ${this.totalSetsCompleted} sets in ${workoutTime} minutes. Incredible dedication!`,
      priority: 'high',
      timestamp: Date.now()
    });
  }

  private getWeightAdjustment(setData: SetData): string | null {
    const threshold = this.getVLThreshold(setData.exercise);
    
    if (setData.velocityLoss < threshold - 0.05) {
      return `Low velocity loss at ${Math.round(setData.velocityLoss * 100)}%. Consider adding weight next set.`;
    } else if (setData.velocityLoss > threshold + 0.05) {
      return `High velocity loss at ${Math.round(setData.velocityLoss * 100)}%. Consider reducing weight or extending rest.`;
    }
    
    return null;
  }

  // Message queue management
  private queueMessage(message: VoiceMessage): void {
    if (this.messageQueue.some(m => m.message === message.message)) return;
    
    if (message.priority === 'high') {
      this.messageQueue.unshift(message);
    } else {
      this.messageQueue.push(message);
    }

    if (this.messageQueue.length > 6) {
      this.messageQueue = this.messageQueue.slice(-6);
    }
  }

  private speakImmediate(message: VoiceMessage): void {
    if (!this.isEnabled || !this.voice) return;
    
    const utterance = new SpeechSynthesisUtterance(message.message);
    utterance.voice = this.voice;
    utterance.rate = message.priority === 'high' ? 1.0 : 0.9;
    utterance.pitch = message.type === 'celebration' ? 1.1 : 1.0;
    utterance.volume = 0.8;
    
    this.synthesis.speak(utterance);
    this.lastSpoken = Date.now();
  }

  // Public controls
  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  clearQueue(): void {
    this.messageQueue = [];
    this.synthesis.cancel();
  }

  testExerciseMessage(exercise: ExerciseType): void {
    const config = getExerciseConfig(exercise);
    const tip = config.voiceCues.formTips[Math.floor(Math.random() * config.voiceCues.formTips.length)];
    
    this.queueMessage({
      type: 'instruction',
      message: `${config.name}: ${tip}`,
      priority: 'medium',
      timestamp: Date.now()
    });
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      currentExercise: this.currentExercise,
      queueLength: this.messageQueue.length,
      totalSetsCompleted: this.totalSetsCompleted,
      workoutDuration: Math.round((Date.now() - this.workoutStartTime) / 60000)
    };
  }

  reset(): void {
    this.exerciseVelocityHistory.clear();
    this.exerciseBaselines.clear();
    this.lastFormWarning.clear();
    this.lastVLWarning.clear();
    this.totalSetsCompleted = 0;
    this.workoutStartTime = Date.now();
    this.clearQueue();
  }
}