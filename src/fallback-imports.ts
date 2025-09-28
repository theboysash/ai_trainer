// src/fallback-imports.ts - Fallback implementations for missing dependencies

// Enhanced Exercise System Fallback
export type ExerciseType = 'shoulder_press' | 'lateral_raise' | 'front_raise' | 'rear_delt_fly' | 
                          'chest_press' | 'push_ups' | 'bicep_curl' | 'tricep_extension' | 'rows' | 'squats';

export interface ExerciseConfig {
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  landmarks: {
    primary: number[];
    secondary?: number[];
  };
  thresholds: {
    startAngle: number;
    endAngle: number;
    minROM: number;
    maxVelocity: number;
    stabilityThresh: number;
  };
  voiceCues: {
    formTips: string[];
    encouragement: string[];
    warnings: string[];
  };
}

export const ENHANCED_EXERCISE_CONFIGS: Record<ExerciseType, ExerciseConfig> = {
  shoulder_press: {
    name: 'Shoulder Press',
    type: 'shoulder_press',
    muscleGroup: 'shoulders',
    landmarks: { primary: [12, 14, 16] },
    thresholds: { startAngle: 90, endAngle: 160, minROM: 60, maxVelocity: 180, stabilityThresh: 0.05 },
    voiceCues: {
      formTips: ['Keep your core tight', 'Press straight up', 'Control the negative'],
      encouragement: ['Great form!', 'Keep it controlled'],
      warnings: ['Slow down', 'Don\'t arch your back']
    }
  },
  lateral_raise: {
    name: 'Lateral Raise',
    type: 'lateral_raise',
    muscleGroup: 'shoulders',
    landmarks: { primary: [12, 14] },
    thresholds: { startAngle: 10, endAngle: 85, minROM: 60, maxVelocity: 120, stabilityThresh: 0.04 },
    voiceCues: {
      formTips: ['Lead with pinkies', 'Stop at shoulder height'],
      encouragement: ['Perfect form', 'Feel those side delts'],
      warnings: ['Don\'t swing', 'Stop at shoulder height']
    }
  },
  front_raise: {
    name: 'Front Raise',
    type: 'front_raise',
    muscleGroup: 'shoulders',
    landmarks: { primary: [12, 14] },
    thresholds: { startAngle: 10, endAngle: 85, minROM: 60, maxVelocity: 110, stabilityThresh: 0.04 },
    voiceCues: {
      formTips: ['Keep arms straight', 'Raise to shoulder height'],
      encouragement: ['Smooth front raise', 'Great front delt activation'],
      warnings: ['Too much swing', 'Don\'t go above shoulder height']
    }
  },
  rear_delt_fly: {
    name: 'Rear Delt Fly',
    type: 'rear_delt_fly',
    muscleGroup: 'shoulders',
    landmarks: { primary: [12, 14] },
    thresholds: { startAngle: 20, endAngle: 85, minROM: 50, maxVelocity: 100, stabilityThresh: 0.05 },
    voiceCues: {
      formTips: ['Squeeze shoulder blades', 'Keep chest up'],
      encouragement: ['Perfect rear delt activation', 'Great squeeze'],
      warnings: ['Don\'t use your back', 'Slower tempo']
    }
  },
  chest_press: {
    name: 'Chest Press',
    type: 'chest_press',
    muscleGroup: 'chest',
    landmarks: { primary: [12, 14, 16] },
    thresholds: { startAngle: 90, endAngle: 170, minROM: 70, maxVelocity: 200, stabilityThresh: 0.06 },
    voiceCues: {
      formTips: ['Shoulders back', 'Press from chest', 'Control the weight'],
      encouragement: ['Powerful chest press', 'Great range of motion'],
      warnings: ['Don\'t let shoulders roll forward', 'Full range of motion']
    }
  },
  push_ups: {
    name: 'Push-ups',
    type: 'push_ups',
    muscleGroup: 'chest',
    landmarks: { primary: [12, 14, 16] },
    thresholds: { startAngle: 70, endAngle: 160, minROM: 80, maxVelocity: 150, stabilityThresh: 0.04 },
    voiceCues: {
      formTips: ['Keep body straight', 'Lower chest to ground', 'Push through whole hand'],
      encouragement: ['Solid push-up form', 'Great chest activation'],
      warnings: ['Don\'t let hips sag', 'Full range of motion']
    }
  },
  bicep_curl: {
    name: 'Bicep Curl',
    type: 'bicep_curl',
    muscleGroup: 'arms',
    landmarks: { primary: [12, 14, 16] },
    thresholds: { startAngle: 155, endAngle: 40, minROM: 90, maxVelocity: 200, stabilityThresh: 0.06 },
    voiceCues: {
      formTips: ['Keep elbows by sides', 'Full range of motion', 'Control the negative'],
      encouragement: ['Perfect curl form', 'Great range of motion'],
      warnings: ['Don\'t swing body', 'Keep elbows still']
    }
  },
  tricep_extension: {
    name: 'Tricep Extension',
    type: 'tricep_extension',
    muscleGroup: 'arms',
    landmarks: { primary: [12, 14, 16] },
    thresholds: { startAngle: 45, endAngle: 160, minROM: 100, maxVelocity: 180, stabilityThresh: 0.05 },
    voiceCues: {
      formTips: ['Keep elbows pointing forward', 'Only forearms move', 'Full extension'],
      encouragement: ['Great tricep isolation', 'Perfect elbow position'],
      warnings: ['Don\'t let elbows flare', 'Control the weight']
    }
  },
  rows: {
    name: 'Rows',
    type: 'rows',
    muscleGroup: 'back',
    landmarks: { primary: [12, 14, 16] },
    thresholds: { startAngle: 160, endAngle: 80, minROM: 70, maxVelocity: 160, stabilityThresh: 0.05 },
    voiceCues: {
      formTips: ['Pull with back', 'Squeeze shoulder blades', 'Keep chest up'],
      encouragement: ['Powerful row', 'Great posture'],
      warnings: ['Don\'t round back', 'Lead with elbows']
    }
  },
  squats: {
    name: 'Squats',
    type: 'squats',
    muscleGroup: 'legs',
    landmarks: { primary: [24, 26, 28] },
    thresholds: { startAngle: 170, endAngle: 90, minROM: 70, maxVelocity: 120, stabilityThresh: 0.04 },
    voiceCues: {
      formTips: ['Keep chest up', 'Sit back into heels', 'Knees track over toes'],
      encouragement: ['Powerful squat', 'Great depth'],
      warnings: ['Don\'t let knees cave', 'Weight on heels']
    }
  }
};

export function getExerciseConfig(type: ExerciseType): ExerciseConfig {
  return ENHANCED_EXERCISE_CONFIGS[type];
}

export function getAllExerciseTypes(): ExerciseType[] {
  return Object.keys(ENHANCED_EXERCISE_CONFIGS) as ExerciseType[];
}

export class EnhancedExerciseDetector {
  constructor(private config: ExerciseConfig) {}
  
  step(landmarks: any[], timestamp: number) {
    return {
      reps: 0,
      angle: 0,
      velocity: 0,
      state: 'idle',
      formScore: 100,
      isNewRep: false
    };
  }
  
  reset() {}
  getStats() {
    return { reps: 0, velocityLoss: 0, avgVelocity: 0, peakVelocity: 0, formScore: 100 };
  }
}

// Improved Voice Agent Fallback
export class ImprovedVoiceAgent {
  private isEnabled = true;
  
  updateIntensity(intensity: 'light' | 'moderate' | 'intense'): void {
    console.log(`Voice intensity set to ${intensity}`);
  }
  
  onExerciseStart(exerciseType: ExerciseType): void {
    console.log(`Starting ${exerciseType}`);
  }
  
  analyzeWorkoutStep(stepData: any): void {
    // Voice analysis logic
  }
  
  onSetComplete(exerciseType: ExerciseType, setData: any): void {
    console.log(`Set complete: ${exerciseType}`);
  }
  
  onExerciseComplete(exerciseType: ExerciseType): void {
    console.log(`Exercise complete: ${exerciseType}`);
  }
  
  onWorkoutComplete(): void {
    console.log('Workout complete');
  }
  
  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }
  
  clearQueue(): void {
    console.log('Voice queue cleared');
  }
}

// Enhanced Visual Dashboard Fallback
export class EnhancedVisualDashboard {
  updateDashboard(stepData: any): void {
    // Dashboard update logic
  }
  
  onSetComplete(exerciseType: ExerciseType, setData: any): void {
    console.log(`Dashboard: Set complete`);
  }
  
  onExerciseSwitch(exerciseType: ExerciseType): void {
    console.log(`Dashboard: Switched to ${exerciseType}`);
  }
  
  onRestStart(): void {
    console.log('Dashboard: Rest started');
  }
  
  reset(): void {
    console.log('Dashboard reset');
  }
}

// Smart Progress Tracker Fallback
export interface ExerciseProgress {
  exerciseType: ExerciseType;
  currentSet: number;
  targetSets: number;
  targetReps: number;
  completedSets: any[];
  isCompleted: boolean;
  isActive: boolean;
  restStartTime?: number;
  restDuration: number;
}

export class SmartProgressTracker {
  private exercises = new Map<ExerciseType, ExerciseProgress>();
  private currentExercise: ExerciseType = 'shoulder_press';
  
  constructor() {
    // Initialize with sample data
    const exerciseConfigs = [
      { type: 'shoulder_press' as ExerciseType, sets: 4, reps: 8, rest: 120 },
      { type: 'lateral_raise' as ExerciseType, sets: 3, reps: 12, rest: 60 },
      { type: 'front_raise' as ExerciseType, sets: 3, reps: 12, rest: 60 },
      { type: 'rear_delt_fly' as ExerciseType, sets: 3, reps: 15, rest: 45 },
      { type: 'bicep_curl' as ExerciseType, sets: 3, reps: 10, rest: 60 },
      { type: 'tricep_extension' as ExerciseType, sets: 3, reps: 10, rest: 60 },
      { type: 'chest_press' as ExerciseType, sets: 3, reps: 8, rest: 90 },
      { type: 'push_ups' as ExerciseType, sets: 3, reps: 15, rest: 60 },
      { type: 'rows' as ExerciseType, sets: 3, reps: 10, rest: 60 },
      { type: 'squats' as ExerciseType, sets: 4, reps: 12, rest: 90 }
    ];

    exerciseConfigs.forEach(config => {
      this.exercises.set(config.type, {
        exerciseType: config.type,
        currentSet: 1,
        targetSets: config.sets,
        targetReps: config.reps,
        completedSets: [],
        isCompleted: false,
        isActive: config.type === 'shoulder_press',
        restDuration: config.rest
      });
    });
  }
  
  switchToExercise(exerciseType: ExerciseType): boolean {
    const currentProgress = this.exercises.get(this.currentExercise);
    if (currentProgress) currentProgress.isActive = false;
    
    const newProgress = this.exercises.get(exerciseType);
    if (newProgress && !newProgress.isCompleted) {
      newProgress.isActive = true;
      this.currentExercise = exerciseType;
      return true;
    }
    return false;
  }
  
  completeSet(exerciseType: ExerciseType, setData: any): boolean {
    const progress = this.exercises.get(exerciseType);
    if (!progress || !progress.isActive) return false;
    
    progress.completedSets.push(setData);
    
    if (progress.completedSets.length >= progress.targetSets) {
      progress.isCompleted = true;
      progress.isActive = false;
    } else {
      progress.currentSet = progress.completedSets.length + 1;
      progress.restStartTime = Date.now();
    }
    
    return true;
  }
  
  getCurrentExerciseProgress(): ExerciseProgress | null {
    return this.exercises.get(this.currentExercise) || null;
  }
  
  getExerciseProgress(exerciseType: ExerciseType): ExerciseProgress | null {
    return this.exercises.get(exerciseType) || null;
  }
  
  getWorkoutStats() {
    let totalSets = 0;
    let completedSets = 0;
    
    this.exercises.forEach(progress => {
      totalSets += progress.targetSets;
      completedSets += progress.completedSets.length;
    });
    
    return {
      totalSets,
      completedSets,
      totalReps: 0,
      workoutDuration: 0,
      progressPercentage: totalSets > 0 ? (completedSets / totalSets) * 100 : 0,
      currentExercise: this.currentExercise,
      isComplete: completedSets >= totalSets
    };
  }
  
  reset(): void {
    this.exercises.clear();
    this.currentExercise = 'shoulder_press';
  }
}

// Visual Insights System Fallback
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
  
  update(stepData: any): VisualInsight[] {
    this.insights = [];
    
    // Generate sample insights
    if (stepData.formScore < 70) {
      this.insights.push({
        type: 'form',
        severity: 'warning',
        message: `Form score: ${Math.round(stepData.formScore)}% - Room for improvement`,
        value: stepData.formScore,
        recommendation: 'Focus on controlled movement',
        trend: 'stable'
      });
    }
    
    if (stepData.velocityLoss > 0.25) {
      this.insights.push({
        type: 'velocity',
        severity: 'critical',
        message: `High velocity loss: ${Math.round(stepData.velocityLoss * 100)}%`,
        value: stepData.velocityLoss,
        recommendation: 'Consider ending this set',
        trend: 'declining'
      });
    }
    
    return this.insights;
  }
  
  reset(): void {
    this.insights = [];
  }
}