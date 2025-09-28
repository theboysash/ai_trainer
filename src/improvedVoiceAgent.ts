// src/improvedVoiceAgent.ts - Updated for Vapi Integration
import { VoiceMessage, WorkoutIntensity } from './voiceAgent';
import { ExerciseType, SetData } from './exerciseSystem';
import { getExerciseConfig } from './exerciseConfigs';
import { startCoach, stopCoach, sendCoachSignal } from './vapi-coach';

export class ImprovedVoiceAgent {
  private isEnabled: boolean = true;
  private isVapiActive: boolean = false;
  private messageQueue: VoiceMessage[] = [];
  private lastSpoken: number = 0;
  private readonly MIN_SPEAK_INTERVAL = 8000;
  
  // VBT intensity from your PDF model
  private intensityThresholds = {
    light: 0.20,    // 15-20% VL threshold
    moderate: 0.25, // 20-25% VL threshold  
    intense: 0.40   // 30-40% VL threshold
  };

  private currentIntensity: 'light' | 'moderate' | 'intense' = 'moderate';
  
  // Smarter message throttling
  private messageHistory: Map<string, number> = new Map();
  private readonly MESSAGE_COOLDOWNS = {
    'form_correction': 15000,
    'velocity_warning': 20000,
    'encouragement': 12000,
    'set_complete': 5000,
    'exercise_start': 3000,
    'intensity_update': 2000,
    'weight_adjustment': 5000
  };
  
  // Exercise-specific tracking
  private currentExercise: ExerciseType = 'shoulder_press';
  private exerciseData: Map<ExerciseType, {
    velocityHistory: number[];
    baseline: number | null;
    lastFormWarning: number;
    lastVLWarning: number;
    repCount: number;
  }> = new Map();
  
  // Priority message system
  private readonly MESSAGE_PRIORITIES = {
    'safety_critical': 1,
    'set_milestone': 2,
    'performance': 3,
    'motivation': 4
  };

  constructor() {
    this.initializeExerciseData();
    this.startMessageProcessor();
  }

  private initializeExerciseData() {
    const exercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly', 'bicep_curl'];
    
    exercises.forEach(exercise => {
      this.exerciseData.set(exercise, {
        velocityHistory: [],
        baseline: null,
        lastFormWarning: 0,
        lastVLWarning: 0,
        repCount: 0
      });
    });
  }

  private startMessageProcessor() {
    setInterval(() => {
      if (this.messageQueue.length > 0 && 
          this.isVapiActive && 
          Date.now() - this.lastSpoken > this.MIN_SPEAK_INTERVAL) {
        
        this.messageQueue.sort((a: VoiceMessage, b: VoiceMessage) => {
          const priorityA = this.getMessagePriority(a);
          const priorityB = this.getMessagePriority(b);
          return priorityA - priorityB;
        });
        
        const message = this.messageQueue.shift()!;
        this.sendToVapi(message);
      }
    }, 1000);
  }

  private getMessagePriority(message: VoiceMessage): number {
    if (message.type === 'warning' && message.message.includes('Stop')) {
      return this.MESSAGE_PRIORITIES.safety_critical;
    }
    if (message.type === 'celebration' || message.message.includes('Starting')) {
      return this.MESSAGE_PRIORITIES.set_milestone;
    }
    if (message.type === 'warning' || message.type === 'instruction') {
      return this.MESSAGE_PRIORITIES.performance;
    }
    return this.MESSAGE_PRIORITIES.motivation;
  }

  // Vapi Integration Methods
  async initializeVapi(): Promise<boolean> {
    try {
      await startCoach();
      this.isVapiActive = true;
      this.isEnabled = true;
      console.log('ImprovedVoiceAgent: Vapi initialized');
      
      // Send initial greeting
      await this.sendToVapi({
        type: 'instruction',
        message: 'Voice coaching system activated. Ready to optimize your workout with velocity-based training.',
        priority: 'high',
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('ImprovedVoiceAgent: Failed to initialize Vapi:', error);
      this.isVapiActive = false;
      return false;
    }
  }

  async stopVapi(): Promise<void> {
    try {
      if (this.isVapiActive) {
        stopCoach();
        this.isVapiActive = false;
        this.isEnabled = false;
        this.messageQueue = [];
        console.log('ImprovedVoiceAgent: Vapi stopped');
      }
    } catch (error) {
      console.error('ImprovedVoiceAgent: Error stopping Vapi:', error);
    }
  }

  private async sendToVapi(message: VoiceMessage, role: 'user' | 'system' = 'system'): Promise<void> {
    if (!this.isVapiActive || !this.isEnabled) return;

    try {
      await sendCoachSignal(message.message, role);
      this.lastSpoken = Date.now();
      console.log('ImprovedVoiceAgent sent to Vapi:', message.message);
    } catch (error) {
      console.error('ImprovedVoiceAgent: Error sending to Vapi:', error);
      // Re-queue high priority messages for retry
      if (message.priority === 'high' && this.messageQueue.length < 3) {
        this.messageQueue.unshift(message);
      }
    }
  }

  // Updated intensity method
  updateIntensity(intensity: 'light' | 'moderate' | 'intense'): void {
    this.currentIntensity = intensity;
    
    const thresholds = {
      light: '15-20%',
      moderate: '20-25%', 
      intense: '30-40%'
    };
    
    this.queueMessage({
      type: 'instruction',
      message: `Training intensity updated to ${intensity} level. Your velocity loss threshold is now ${thresholds[intensity]}. I'll monitor your performance and provide guidance accordingly.`,
      priority: 'high',
      timestamp: Date.now(),
      category: 'intensity_update'
    });
  }

  // Updated exercise start method  
  onExerciseStart(exercise: ExerciseType): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'instruction', 
      message: `Starting ${config.name}. ${config.voiceCues.formTips[0]} Remember to maintain control throughout the full range of motion.`,
      priority: 'medium',
      timestamp: Date.now(),
      category: 'exercise_start'
    });
    
    // Reset exercise-specific data
    const exerciseDataToReset = this.exerciseData.get(exercise);
    if (exerciseDataToReset) {
      exerciseDataToReset.velocityHistory = [];
      exerciseDataToReset.baseline = null;
      exerciseDataToReset.repCount = 0;
    }
  }

  // Main analysis method (unchanged logic, but now uses Vapi)
  analyzeWorkoutStep(stepData: any): void {
    if (!this.isVapiActive) return;

    if (stepData.exercise !== this.currentExercise) {
      this.currentExercise = stepData.exercise;
      this.onExerciseSwitch(stepData.exercise);
    }

    const exerciseData = this.exerciseData.get(this.currentExercise);
    if (!exerciseData) return;
    
    if (stepData.isResting) {
      this.handleRestPeriod(stepData);
      return;
    }

    if (stepData.velocity !== 0) {
      this.trackExerciseVelocity(this.currentExercise, Math.abs(stepData.velocity));
    }

    if (stepData.state !== 'idle' && stepData.reps > 0) {
      this.checkCriticalIssues(stepData, exerciseData);
    }

    if (stepData.isNewRep && stepData.reps !== exerciseData.repCount) {
      exerciseData.repCount = stepData.reps;
      this.handleRepMilestone(stepData);
    }
  }

  private onExerciseSwitch(exercise: ExerciseType): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'instruction',
      message: `Switching to ${config.name}. Focus on proper form and controlled movement.`,
      priority: 'high',
      timestamp: Date.now(),
      category: 'exercise_start'
    });
  }

  private trackExerciseVelocity(exercise: ExerciseType, velocity: number): void {
    const exerciseDataToTrack = this.exerciseData.get(exercise);
    if (!exerciseDataToTrack) return;
    
    exerciseDataToTrack.velocityHistory.push(velocity);
    
    if (!exerciseDataToTrack.baseline && exerciseDataToTrack.velocityHistory.length >= 4) {
      exerciseDataToTrack.baseline = exerciseDataToTrack.velocityHistory.slice(0, 4).reduce((a, b) => a + b) / 4;
    }
    
    if (exerciseDataToTrack.velocityHistory.length > 15) {
      exerciseDataToTrack.velocityHistory = exerciseDataToTrack.velocityHistory.slice(-12);
    }
  }

  private checkCriticalIssues(stepData: any, exerciseData: any): void {
    const now = Date.now();
    
    if (exerciseData.baseline && exerciseData.velocityHistory.length >= 6) {
      this.checkVelocityLoss(stepData, exerciseData, now);
    }
    
    if (now - exerciseData.lastFormWarning > this.MESSAGE_COOLDOWNS.form_correction) {
      this.checkFormQuality(stepData, exerciseData, now);
    }
  }

  private checkVelocityLoss(stepData: any, exerciseData: any, now: number): void {
    if (now - exerciseData.lastVLWarning < this.MESSAGE_COOLDOWNS.velocity_warning) {
      return;
    }

    const recent = exerciseData.velocityHistory.slice(-4);
    const currentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
    const velocityLoss = (exerciseData.baseline - currentAvg) / exerciseData.baseline;
    
    const threshold = this.getVLThreshold(stepData.exercise);
    
    if (velocityLoss >= threshold + 0.05) {
      this.queueMessage({
        type: 'warning',
        message: this.getVLWarningMessage(stepData.exercise, velocityLoss, threshold),
        priority: 'high',
        timestamp: now,
        category: 'velocity_warning'
      });
      exerciseData.lastVLWarning = now;
    }
  }

  private checkFormQuality(stepData: any, exerciseData: any, now: number): void {
    if (stepData.formScore < 60) {
      const config = getExerciseConfig(stepData.exercise);
      const warnings = config.voiceCues.warnings;
      const message = warnings[Math.floor(Math.random() * warnings.length)];
      
      this.queueMessage({
        type: 'instruction',
        message,
        priority: 'medium',
        timestamp: now,
        category: 'form_correction'
      });
      exerciseData.lastFormWarning = now;
    }
  }

  private handleRepMilestone(stepData: any): void {
    if (stepData.reps === Math.floor(stepData.targetReps / 2) || stepData.reps === stepData.targetReps) {
      const now = Date.now();
      if (now - (this.messageHistory.get('encouragement') || 0) > this.MESSAGE_COOLDOWNS.encouragement) {
        this.queueMessage({
          type: 'encouragement',
          message: `${stepData.reps} reps completed. Maintain that control and focus.`,
          priority: 'low',
          timestamp: now,
          category: 'encouragement'
        });
        this.messageHistory.set('encouragement', now);
      }
    }
  }

  private handleRestPeriod(stepData: any): void {
    if (stepData.restTimeRemaining === 10) {
      this.queueMessage({
        type: 'instruction',
        message: '10 seconds remaining. Prepare for your next set.',
        priority: 'medium',
        timestamp: Date.now(),
        category: 'rest_timer'
      });
    }
  }

  private getVLThreshold(exercise: ExerciseType): number {
    const baseThreshold = this.intensityThresholds[this.currentIntensity];
    
    const exerciseModifiers = {
      shoulder_press: 1.0,
      lateral_raise: 0.85,
      front_raise: 0.85,
      rear_delt_fly: 0.75,
      bicep_curl: 0.9
    };
    
    const modifier = exerciseModifiers[exercise] || 1.0;
    return baseThreshold * modifier;
  }

  private getVLWarningMessage(exercise: ExerciseType, vl: number, threshold: number): string {
    const exerciseName = getExerciseConfig(exercise).name;
    const vlPercent = Math.round(vl * 100);
    const thresholdPercent = Math.round(threshold * 100);
    
    if (vl >= 0.40 || (this.currentIntensity === 'intense' && vl >= 0.35)) {
      return `Stop the ${exerciseName} set immediately! Velocity loss at ${vlPercent}% is dangerously high and exceeds your ${thresholdPercent}% threshold. End this set now to prevent overtraining.`;
    } else if (vl >= threshold) {
      return `Velocity loss reached ${vlPercent}% on ${exerciseName}. You've exceeded your ${thresholdPercent}% threshold. Consider ending this set to maintain training quality.`;
    } else {
      return `Velocity dropping to ${vlPercent}% on ${exerciseName}. You're approaching your ${thresholdPercent}% threshold. Monitor closely.`;
    }
  }

  private getWeightAdjustmentRecommendation(exercise: ExerciseType, setVL: number): string | null {
    const threshold = this.getVLThreshold(exercise);
    const tolerance = 0.05;
    
    if (setVL < threshold - tolerance) {
      return `Your set velocity loss was ${Math.round(setVL * 100)}%, which is below your target zone. Consider adding 2.5 to 5 pounds next set to reach your ${Math.round(threshold * 100)}% velocity loss target for optimal training stimulus.`;
    } 
    else if (setVL > threshold + tolerance) {
      return `High velocity loss at ${Math.round(setVL * 100)}%. This exceeds your target zone. Consider reducing weight by 2.5 to 5 pounds next set to stay within your ${Math.round(threshold * 100)}% optimal training range.`;
    }
    
    return `Perfect velocity loss at ${Math.round(setVL * 100)}%. You're right in your target training zone. Maintain this load for consistent training stimulus.`;
  }

  // Public methods updated for Vapi
  onSetComplete(exercise: ExerciseType, setData: SetData): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'celebration',
      message: `${config.name} set complete. ${setData.reps || 0} reps completed. Well executed.`,
      priority: 'medium',
      timestamp: Date.now(),
      category: 'set_complete'
    });
    
    // Add weight adjustment recommendation
    const exerciseDataForAdjustment = this.exerciseData.get(exercise);
    if (exerciseDataForAdjustment && exerciseDataForAdjustment.baseline && exerciseDataForAdjustment.velocityHistory.length >= 4) {
      const setVL = setData.velocityLoss || 0;
      const adjustment = this.getWeightAdjustmentRecommendation(exercise, setVL);
      
      if (adjustment) {
        setTimeout(() => {
          this.queueMessage({
            type: 'instruction',
            message: adjustment,
            priority: 'low',
            timestamp: Date.now(),
            category: 'weight_adjustment'
          });
        }, 3000);
      }
    }
    
    // Reset exercise data for next set
    const exerciseDataForReset = this.exerciseData.get(exercise);
    if (exerciseDataForReset) {
      exerciseDataForReset.velocityHistory = [];
      exerciseDataForReset.baseline = null;
      exerciseDataForReset.repCount = 0;
    }
  }

  onExerciseComplete(exercise: ExerciseType): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'celebration',
      message: `${config.name} complete. Excellent work. Moving to the next exercise.`,
      priority: 'medium',
      timestamp: Date.now(),
      category: 'exercise_complete'
    });
  }

  onWorkoutComplete(): void {
    this.queueMessage({
      type: 'celebration',
      message: 'Workout complete. Outstanding effort today. Your velocity-based training data has been recorded. Remember to stretch and hydrate properly.',
      priority: 'high',
      timestamp: Date.now(),
      category: 'workout_complete'
    });

    // Stop Vapi session after a delay
    setTimeout(() => {
      this.stopVapi();
    }, 5000);
  }

  private queueMessage(message: VoiceMessage & { category: string }): void {
    if (!this.isVapiActive) return;

    const lastTime = this.messageHistory.get(message.category) || 0;
    const cooldown = this.MESSAGE_COOLDOWNS[message.category as keyof typeof this.MESSAGE_COOLDOWNS] || 10000;
    
    if (Date.now() - lastTime < cooldown) {
      return;
    }
    
    if (this.messageQueue.some(m => m.message === message.message)) {
      return;
    }
    
    this.messageQueue.push(message);
    this.messageHistory.set(message.category, Date.now());
    
    if (this.messageQueue.length > 3) {
      this.messageQueue = this.messageQueue.slice(-3);
    }
  }

  // Public controls updated for Vapi
  async toggle(): Promise<boolean> {
    if (this.isVapiActive) {
      await this.stopVapi();
      return false;
    } else {
      return await this.initializeVapi();
    }
  }

  clearQueue(): void {
    this.messageQueue = [];
  }

  // Manual message sending for direct interaction
  async sendDirectMessage(message: string, role: 'user' | 'system' = 'user'): Promise<void> {
    if (this.isVapiActive) {
      await this.sendToVapi({
        type: 'instruction',
        message,
        priority: 'high',
        timestamp: Date.now()
      }, role);
    }
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      vapiActive: this.isVapiActive,
      currentExercise: this.currentExercise,
      queueLength: this.messageQueue.length,
      intensity: this.currentIntensity,
      vlThreshold: this.intensityThresholds[this.currentIntensity],
      lastSpoken: Date.now() - this.lastSpoken
    };
  }
}