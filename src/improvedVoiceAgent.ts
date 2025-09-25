// src/improvedVoiceAgent.ts
import { VoiceMessage, WorkoutIntensity } from './voiceAgent';
import { ExerciseType, SetData } from './exerciseSystem';
import { getExerciseConfig } from './exerciseConfigs';

export class ImprovedVoiceAgent {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private isEnabled: boolean = true;
  private messageQueue: VoiceMessage[] = [];
  private lastSpoken: number = 0;
  private readonly MIN_SPEAK_INTERVAL = 8000; // Increased to 8 seconds
  
  // Smarter message throttling
  private messageHistory: Map<string, number> = new Map(); // Track when we last said each message type
  private readonly MESSAGE_COOLDOWNS = {
    'form_correction': 15000,     // 15 seconds between form tips
    'velocity_warning': 20000,    // 20 seconds between VL warnings
    'encouragement': 12000,       // 12 seconds between motivational messages
    'set_complete': 5000,         // 5 seconds (always allow set completion)
    'exercise_start': 3000        // 3 seconds (always allow exercise transitions)
  };
  
  // Exercise-specific tracking with better isolation
  private currentExercise: ExerciseType = 'shoulder_press';
  private exerciseData: Map<ExerciseType, {
    velocityHistory: number[];
    baseline: number | null;
    lastFormWarning: number;
    lastVLWarning: number;
    repCount: number;
  }> = new Map();
  
  // Priority message system - only speak the most important things
  private readonly MESSAGE_PRIORITIES = {
    'safety_critical': 1,    // Injury prevention, immediate stops
    'set_milestone': 2,      // Set completions, exercise changes
    'performance': 3,        // VL warnings, form tips
    'motivation': 4          // Encouragement, general tips
  };

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeVoice();
    this.startMessageProcessor();
    this.initializeExerciseData();
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
      if (this.messageQueue.length > 0 && Date.now() - this.lastSpoken > this.MIN_SPEAK_INTERVAL) {
        // Sort by priority (lower number = higher priority)
        this.messageQueue.sort((a: VoiceMessage, b: VoiceMessage) => {
          const priorityA = this.getMessagePriority(a);
          const priorityB = this.getMessagePriority(b);
          return priorityA - priorityB;
        });
        
        const message = this.messageQueue.shift()!;
        this.speakImmediate(message);
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

  // Main analysis - now with better exercise isolation
  analyzeWorkoutStep(stepData: any): void {
    // Only update data for the current exercise
    if (stepData.exercise !== this.currentExercise) {
      this.currentExercise = stepData.exercise;
      this.onExerciseSwitch(stepData.exercise);
    }

    const exerciseData = this.exerciseData.get(this.currentExercise)!;
    
    // Handle rest periods (minimal voice during rest)
    if (stepData.isResting) {
      this.handleRestPeriod(stepData);
      return;
    }

    // Track velocity only for current exercise
    if (stepData.velocity !== 0) {
      this.trackExerciseVelocity(this.currentExercise, Math.abs(stepData.velocity));
    }

    // Critical analysis only during active movement
    if (stepData.state !== 'idle' && stepData.reps > 0) {
      this.checkCriticalIssues(stepData, exerciseData);
    }

    // Rep milestone feedback (less frequent)
    if (stepData.isNewRep && stepData.reps !== exerciseData.repCount) {
      exerciseData.repCount = stepData.reps;
      this.handleRepMilestone(stepData);
    }
  }

  private onExerciseSwitch(exercise: ExerciseType): void {
    // Only announce exercise switches, not every analysis
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'instruction',
      message: `Starting ${config.name}.`,
      priority: 'high',
      timestamp: Date.now(),
      category: 'exercise_start'
    });
  }

  private trackExerciseVelocity(exercise: ExerciseType, velocity: number): void {
    const data = this.exerciseData.get(exercise)!;
    data.velocityHistory.push(velocity);
    
    // Set baseline from first few movements
    if (!data.baseline && data.velocityHistory.length >= 4) {
      data.baseline = data.velocityHistory.slice(0, 4).reduce((a, b) => a + b) / 4;
    }
    
    // Keep history reasonable
    if (data.velocityHistory.length > 15) {
      data.velocityHistory = data.velocityHistory.slice(-12);
    }
  }

  private checkCriticalIssues(stepData: any, exerciseData: any): void {
    const now = Date.now();
    
    // Only check velocity loss if we have enough data
    if (exerciseData.baseline && exerciseData.velocityHistory.length >= 6) {
      this.checkVelocityLoss(stepData, exerciseData, now);
    }
    
    // Form check with much longer cooldown
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
    this.messageQueue.sort((a: VoiceMessage, b: VoiceMessage) => {
          const priorityA = this.getMessagePriority(a);
          const priorityB = this.getMessagePriority(b);
          return priorityA - priorityB;
        });
    const velocityLoss = (exerciseData.baseline - currentAvg) / exerciseData.baseline;
    
    const threshold = this.getVLThreshold(stepData.exercise);
    
    // Only warn on critical velocity loss
    if (velocityLoss >= threshold + 0.05) { // 5% buffer above threshold
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
    // Only warn on really poor form scores
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
    // Only celebrate significant milestones
    if (stepData.reps === Math.floor(stepData.targetReps / 2) || stepData.reps === stepData.targetReps) {
      const now = Date.now();
      if (now - (this.messageHistory.get('encouragement') || 0) > this.MESSAGE_COOLDOWNS.encouragement) {
        this.queueMessage({
          type: 'encouragement',
          message: `${stepData.reps} reps down. Keep it controlled.`,
          priority: 'low',
          timestamp: now,
          category: 'encouragement'
        });
        this.messageHistory.set('encouragement', now);
      }
    }
  }

  private handleRestPeriod(stepData: any): void {
    // Very minimal rest period coaching
    if (stepData.restTimeRemaining === 10) {
      this.queueMessage({
        type: 'instruction',
        message: '10 seconds.',
        priority: 'medium',
        timestamp: Date.now(),
        category: 'rest_timer'
      });
    }
  }

  private getVLThreshold(exercise: ExerciseType): number {
    const thresholds = {
      shoulder_press: 0.30,    // Higher threshold for compound movement
      lateral_raise: 0.25,     
      front_raise: 0.25,
      rear_delt_fly: 0.22,     
      bicep_curl: 0.28
    };
    
    return thresholds[exercise] || 0.25;
  }

  private getVLWarningMessage(exercise: ExerciseType, vl: number, threshold: number): string {
    const exerciseName = getExerciseConfig(exercise).name;
    const vlPercent = Math.round(vl * 100);
    
    if (vl >= 0.40) {
      return `Stop the ${exerciseName} set. That's enough.`;
    } else {
      return `Velocity dropping on ${exerciseName}. Consider wrapping up.`;
    }
  }

  // Simplified public methods
  onSetComplete(exercise: ExerciseType, setData: SetData): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'celebration',
      message: `${config.name} set complete. Good work.`,
      priority: 'medium',
      timestamp: Date.now(),
      category: 'set_complete'
    });
    
    // Reset exercise data for next set
    const data = this.exerciseData.get(exercise)!;
    data.velocityHistory = [];
    data.baseline = null;
    data.repCount = 0;
  }

  onExerciseComplete(exercise: ExerciseType): void {
    const config = getExerciseConfig(exercise);
    
    this.queueMessage({
      type: 'celebration',
      message: `${config.name} complete.`,
      priority: 'medium',
      timestamp: Date.now(),
      category: 'exercise_complete'
    });
  }

  onWorkoutComplete(): void {
    this.queueMessage({
      type: 'celebration',
      message: 'Workout complete. Well done.',
      priority: 'high',
      timestamp: Date.now(),
      category: 'workout_complete'
    });
  }

  private queueMessage(message: VoiceMessage & { category: string }): void {
    // Check message-specific cooldown
    const lastTime = this.messageHistory.get(message.category) || 0;
    const cooldown = this.MESSAGE_COOLDOWNS[message.category as keyof typeof this.MESSAGE_COOLDOWNS] || 10000;
    
    if (Date.now() - lastTime < cooldown) {
      return; // Skip this message
    }
    
    // Avoid duplicate messages
    if (this.messageQueue.some(m => m.message === message.message)) {
      return;
    }
    
    this.messageQueue.push(message);
    this.messageHistory.set(message.category, Date.now());
    
    // Keep queue small - only most important messages
    if (this.messageQueue.length > 3) {
      this.messageQueue = this.messageQueue.slice(-3);
    }
  }

  private speakImmediate(message: VoiceMessage): void {
    if (!this.isEnabled || !this.voice) return;
    
    const utterance = new SpeechSynthesisUtterance(message.message);
    utterance.voice = this.voice;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 0.7;
    
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

  getStatus() {
    return {
      enabled: this.isEnabled,
      currentExercise: this.currentExercise,
      queueLength: this.messageQueue.length,
      lastSpoken: Date.now() - this.lastSpoken
    };
  }
}