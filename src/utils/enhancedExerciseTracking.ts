// src/utils/enhancedExerciseTracking.ts - Enhanced exercise tracking with Flask system logic
import { 
  calculateAngle, 
  calculateArmElevationAngle, 
  calculateRowingDistance,
  areLandmarksVisible,
  landmarkToPoint2D,
  smoothAngle,
  Point2D 
} from './angleCalculation';

export type ExerciseType = 'shoulder_press' | 'lateral_raise' | 'front_raise' | 'rear_delt_fly' | 
                          'bicep_curl' | 'tricep_extension' | 'chest_press' | 'push_ups' | 'rows' | 'squats';

export type ExerciseStage = 'initial' | 'starting_position' | 'descent' | 'ascent' | 'up' | 'down' | 
                           'flex' | 'top' | 'bottom' | 'moving' | 'returning';

export interface ExerciseResult {
  reps: number;
  angle: number;
  velocity: number;
  stage: ExerciseStage;
  isNewRep: boolean;
  formScore: number;
  velocityLoss: number;
  warnings: string[];
}

// Enhanced Squat Tracker
export class EnhancedSquatTracker {
  private counter = 0;
  private stage: ExerciseStage = 'initial';
  private lastAngle = 0;
  private lastTime = 0;
  private velocity = 0;
  private angleHistory: number[] = [];
  private velocityHistory: number[] = [];
  private baseline: number | null = null;

  step(landmarks: any[], timestamp: number, frameWidth: number, frameHeight: number): ExerciseResult {
    if (!areLandmarksVisible(landmarks, [11, 23, 25, 12, 24, 26])) {
      return this.getDefaultResult();
    }

    // Get landmarks for both legs
    const shoulderLeft = landmarkToPoint2D(landmarks[11], frameWidth, frameHeight);
    const hipLeft = landmarkToPoint2D(landmarks[23], frameWidth, frameHeight);
    const kneeLeft = landmarkToPoint2D(landmarks[25], frameWidth, frameHeight);
    
    const shoulderRight = landmarkToPoint2D(landmarks[12], frameWidth, frameHeight);
    const hipRight = landmarkToPoint2D(landmarks[24], frameWidth, frameHeight);
    const kneeRight = landmarkToPoint2D(landmarks[26], frameWidth, frameHeight);

    // Calculate angles for both legs
    const angleLeft = calculateAngle(shoulderLeft, hipLeft, kneeLeft);
    const angleRight = calculateAngle(shoulderRight, hipRight, kneeRight);
    
    // Use average of both legs
    const currentAngle = (angleLeft + angleRight) / 2;
    const smoothedAngle = smoothAngle(currentAngle, this.angleHistory);

    // Calculate velocity
    if (this.lastTime > 0) {
      const dt = Math.max(1e-3, timestamp - this.lastTime);
      this.velocity = (smoothedAngle - this.lastAngle) / dt;
      
      if (Math.abs(this.velocity) > 5) {
        this.velocityHistory.push(Math.abs(this.velocity));
        if (this.velocityHistory.length > 15) this.velocityHistory.shift();
        
        if (!this.baseline && this.velocityHistory.length >= 3) {
          this.baseline = this.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
        }
      }
    }

    const isNewRep = this.updateSquatState(smoothedAngle);
    const formScore = this.calculateSquatFormScore(smoothedAngle, this.velocity);
    const velocityLoss = this.calculateVelocityLoss();
    const warnings = this.generateSquatWarnings(smoothedAngle, angleLeft, angleRight);

    this.lastAngle = smoothedAngle;
    this.lastTime = timestamp;

    return {
      reps: this.counter,
      angle: smoothedAngle,
      velocity: this.velocity,
      stage: this.stage,
      isNewRep,
      formScore,
      velocityLoss,
      warnings
    };
  }

  private updateSquatState(angle: number): boolean {
    let isNewRep = false;

    switch (this.stage) {
      case 'initial':
      case 'starting_position':
        if (angle > 170) {
          this.stage = 'starting_position';
        } else if (angle > 90 && angle <= 170) {
          this.stage = 'descent';
        }
        break;
      
      case 'descent':
        if (angle < 90) {
          this.stage = 'ascent';
          this.counter++;
          isNewRep = true;
        }
        break;
      
      case 'ascent':
        if (angle > 170) {
          this.stage = 'starting_position';
        }
        break;
    }

    return isNewRep;
  }

  private calculateSquatFormScore(angle: number, velocity: number): number {
    let score = 100;
    
    // Penalize excessive velocity
    if (Math.abs(velocity) > 150) score -= 20;
    else if (Math.abs(velocity) > 100) score -= 10;
    
    // Reward good depth
    if (angle < 90) score += 10;
    else if (angle > 150) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private generateSquatWarnings(angle: number, angleLeft: number, angleRight: number): string[] {
    const warnings: string[] = [];
    
    // Check for imbalance between legs
    const angleDifference = Math.abs(angleLeft - angleRight);
    if (angleDifference > 15) {
      warnings.push(`Leg imbalance detected: ${angleDifference.toFixed(1)}° difference`);
    }
    
    // Check depth
    if (this.stage === 'descent' && angle > 110) {
      warnings.push('Go deeper for better squat form');
    }
    
    return warnings;
  }

  private calculateVelocityLoss(): number {
    if (!this.baseline || this.velocityHistory.length < 5) return 0;
    const recent = this.velocityHistory.slice(-3).reduce((a, b) => a + b) / 3;
    return Math.max(0, (this.baseline - recent) / this.baseline);
  }

  private getDefaultResult(): ExerciseResult {
    return {
      reps: this.counter,
      angle: this.lastAngle,
      velocity: 0,
      stage: this.stage,
      isNewRep: false,
      formScore: 0,
      velocityLoss: 0,
      warnings: ['Position yourself in frame']
    };
  }

  reset() {
    this.counter = 0;
    this.stage = 'initial';
    this.angleHistory = [];
    this.velocityHistory = [];
    this.baseline = null;
  }
}

// Enhanced Push-up Tracker
export class EnhancedPushUpTracker {
  private counter = 0;
  private stage: ExerciseStage = 'initial';
  private lastAngle = 0;
  private lastTime = 0;
  private velocity = 0;
  private angleHistory: number[] = [];
  private velocityHistory: number[] = [];
  private baseline: number | null = null;
  private lastCounterUpdate = 0;

  private readonly ANGLE_THRESHOLD_UP = 150;
  private readonly ANGLE_THRESHOLD_DOWN = 70;

  step(landmarks: any[], timestamp: number, frameWidth: number, frameHeight: number): ExerciseResult {
    if (!areLandmarksVisible(landmarks, [11, 13, 15, 12, 14, 16])) {
      return this.getDefaultResult();
    }

    // Get landmarks for both arms
    const shoulderLeft = landmarkToPoint2D(landmarks[11], frameWidth, frameHeight);
    const elbowLeft = landmarkToPoint2D(landmarks[13], frameWidth, frameHeight);
    const wristLeft = landmarkToPoint2D(landmarks[15], frameWidth, frameHeight);
    
    const shoulderRight = landmarkToPoint2D(landmarks[12], frameWidth, frameHeight);
    const elbowRight = landmarkToPoint2D(landmarks[14], frameWidth, frameHeight);
    const wristRight = landmarkToPoint2D(landmarks[16], frameWidth, frameHeight);

    // Calculate angles for both arms
    const angleLeft = calculateAngle(shoulderLeft, elbowLeft, wristLeft);
    const angleRight = calculateAngle(shoulderRight, elbowRight, wristRight);
    
    // Use average of both arms
    const currentAngle = (angleLeft + angleRight) / 2;
    const smoothedAngle = smoothAngle(currentAngle, this.angleHistory);

    // Calculate velocity
    if (this.lastTime > 0) {
      const dt = Math.max(1e-3, timestamp - this.lastTime);
      this.velocity = (smoothedAngle - this.lastAngle) / dt;
      
      if (Math.abs(this.velocity) > 5) {
        this.velocityHistory.push(Math.abs(this.velocity));
        if (this.velocityHistory.length > 15) this.velocityHistory.shift();
        
        if (!this.baseline && this.velocityHistory.length >= 3) {
          this.baseline = this.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
        }
      }
    }

    const isNewRep = this.updatePushUpState(smoothedAngle, timestamp);
    const formScore = this.calculatePushUpFormScore(smoothedAngle, this.velocity);
    const velocityLoss = this.calculateVelocityLoss();
    const warnings = this.generatePushUpWarnings(smoothedAngle, angleLeft, angleRight);

    this.lastAngle = smoothedAngle;
    this.lastTime = timestamp;

    return {
      reps: this.counter,
      angle: smoothedAngle,
      velocity: this.velocity,
      stage: this.stage,
      isNewRep,
      formScore,
      velocityLoss,
      warnings
    };
  }

  private updatePushUpState(angle: number, timestamp: number): boolean {
    let isNewRep = false;

    switch (this.stage) {
      case 'initial':
      case 'starting_position':
        if (angle > this.ANGLE_THRESHOLD_UP) {
          this.stage = 'starting_position';
        } else if (angle > this.ANGLE_THRESHOLD_DOWN && angle < this.ANGLE_THRESHOLD_UP) {
          this.stage = 'descent';
        }
        break;
      
      case 'descent':
        if (angle < this.ANGLE_THRESHOLD_DOWN) {
          this.stage = 'ascent';
          // Increment counter only if enough time has passed since last update
          if (timestamp - this.lastCounterUpdate > 1000) { // 1 second threshold
            this.counter++;
            this.lastCounterUpdate = timestamp;
            isNewRep = true;
          }
        }
        break;
      
      case 'ascent':
        if (angle > this.ANGLE_THRESHOLD_UP) {
          this.stage = 'starting_position';
        }
        break;
    }

    return isNewRep;
  }

  private calculatePushUpFormScore(angle: number, velocity: number): number {
    let score = 100;
    
    // Penalize excessive velocity
    if (Math.abs(velocity) > 200) score -= 25;
    else if (Math.abs(velocity) > 150) score -= 15;
    
    // Reward good range of motion
    if (angle < this.ANGLE_THRESHOLD_DOWN) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private generatePushUpWarnings(angle: number, angleLeft: number, angleRight: number): string[] {
    const warnings: string[] = [];
    
    // Check for imbalance between arms
    const angleDifference = Math.abs(angleLeft - angleRight);
    if (angleDifference > 20) {
      warnings.push(`Arm imbalance detected: ${angleDifference.toFixed(1)}° difference`);
    }
    
    // Check depth
    if (this.stage === 'descent' && angle > 90) {
      warnings.push('Lower your chest closer to the ground');
    }
    
    return warnings;
  }

  private calculateVelocityLoss(): number {
    if (!this.baseline || this.velocityHistory.length < 5) return 0;
    const recent = this.velocityHistory.slice(-3).reduce((a, b) => a + b) / 3;
    return Math.max(0, (this.baseline - recent) / this.baseline);
  }

  private getDefaultResult(): ExerciseResult {
    return {
      reps: this.counter,
      angle: this.lastAngle,
      velocity: 0,
      stage: this.stage,
      isNewRep: false,
      formScore: 0,
      velocityLoss: 0,
      warnings: ['Position yourself in frame']
    };
  }

  reset() {
    this.counter = 0;
    this.stage = 'initial';
    this.angleHistory = [];
    this.velocityHistory = [];
    this.baseline = null;
    this.lastCounterUpdate = 0;
  }
}

// Enhanced Hammer Curl Tracker
export class EnhancedHammerCurlTracker {
  private counterRight = 0;
  private counterLeft = 0;
  private stageRight: ExerciseStage = 'initial';
  private stageLeft: ExerciseStage = 'initial';
  
  private readonly ANGLE_THRESHOLD = 40; // Misalignment threshold
  private readonly FLEXION_ANGLE_UP = 155;
  private readonly FLEXION_ANGLE_DOWN = 35;
  private readonly ANGLE_THRESHOLD_UP = 155;
  private readonly ANGLE_THRESHOLD_DOWN = 47;

  step(landmarks: any[], timestamp: number, frameWidth: number, frameHeight: number): ExerciseResult {
    if (!areLandmarksVisible(landmarks, [11, 13, 15, 12, 14, 16, 23, 24])) {
      return this.getDefaultResult();
    }

    // Right arm landmarks
    const shoulderRight = landmarkToPoint2D(landmarks[11], frameWidth, frameHeight);
    const elbowRight = landmarkToPoint2D(landmarks[13], frameWidth, frameHeight);
    const wristRight = landmarkToPoint2D(landmarks[15], frameWidth, frameHeight);
    const hipRight = landmarkToPoint2D(landmarks[23], frameWidth, frameHeight);

    // Left arm landmarks
    const shoulderLeft = landmarkToPoint2D(landmarks[12], frameWidth, frameHeight);
    const elbowLeft = landmarkToPoint2D(landmarks[14], frameWidth, frameHeight);
    const wristLeft = landmarkToPoint2D(landmarks[16], frameWidth, frameHeight);
    const hipLeft = landmarkToPoint2D(landmarks[24], frameWidth, frameHeight);

    // Calculate angles for counting (elbow flexion angle)
    const angleRightCounter = calculateAngle(shoulderRight, elbowRight, wristRight);
    const angleLeftCounter = calculateAngle(shoulderLeft, elbowLeft, wristLeft);

    // Calculate angles for form checking (shoulder-elbow-hip)
    const angleRightForm = calculateAngle(shoulderRight, elbowRight, hipRight);
    const angleLeftForm = calculateAngle(shoulderLeft, elbowLeft, hipLeft);

    // Update rep counting for both arms
    const isNewRepRight = this.updateCurlState('right', angleRightCounter);
    const isNewRepLeft = this.updateCurlState('left', angleLeftCounter);

    // Generate warnings for form
    const warnings = this.generateCurlWarnings(angleRightForm, angleLeftForm);

    // Use the dominant arm's angle for primary tracking
    const primaryAngle = Math.max(angleRightCounter, angleLeftCounter);
    const totalReps = Math.max(this.counterRight, this.counterLeft);

    return {
      reps: totalReps,
      angle: primaryAngle,
      velocity: 0, // TODO: Implement velocity calculation
      stage: this.stageRight, // Use right arm stage as primary
      isNewRep: isNewRepRight || isNewRepLeft,
      formScore: this.calculateCurlFormScore(angleRightForm, angleLeftForm),
      velocityLoss: 0, // TODO: Implement velocity loss calculation
      warnings
    };
  }

  private updateCurlState(arm: 'right' | 'left', angle: number): boolean {
    const isRight = arm === 'right';
    let counter = isRight ? this.counterRight : this.counterLeft;
    let stage = isRight ? this.stageRight : this.stageLeft;
    let isNewRep = false;

    if (angle > this.ANGLE_THRESHOLD_UP) {
      stage = 'flex';
    } else if (this.ANGLE_THRESHOLD_DOWN < angle && angle < this.ANGLE_THRESHOLD_UP && stage === 'flex') {
      stage = 'up';
    } else if (angle < this.ANGLE_THRESHOLD_DOWN && stage === 'up') {
      stage = 'down';
      counter++;
      isNewRep = true;
    }

    // Update the appropriate arm's state
    if (isRight) {
      this.counterRight = counter;
      this.stageRight = stage;
    } else {
      this.counterLeft = counter;
      this.stageLeft = stage;
    }

    return isNewRep;
  }

  private calculateCurlFormScore(angleRightForm: number, angleLeftForm: number): number {
    let score = 100;
    
    // Check for misalignment based on shoulder-elbow-hip angle
    if (Math.abs(angleRightForm) > this.ANGLE_THRESHOLD) {
      score -= 25;
    }
    if (Math.abs(angleLeftForm) > this.ANGLE_THRESHOLD) {
      score -= 25;
    }
    
    return Math.max(0, score);
  }

  private generateCurlWarnings(angleRightForm: number, angleLeftForm: number): string[] {
    const warnings: string[] = [];
    
    if (Math.abs(angleRightForm) > this.ANGLE_THRESHOLD) {
      warnings.push(`Right shoulder-elbow-hip misalignment: ${angleRightForm.toFixed(1)}°`);
    }
    if (Math.abs(angleLeftForm) > this.ANGLE_THRESHOLD) {
      warnings.push(`Left shoulder-elbow-hip misalignment: ${angleLeftForm.toFixed(1)}°`);
    }
    
    return warnings;
  }

  private getDefaultResult(): ExerciseResult {
    return {
      reps: Math.max(this.counterRight, this.counterLeft),
      angle: 0,
      velocity: 0,
      stage: this.stageRight,
      isNewRep: false,
      formScore: 0,
      velocityLoss: 0,
      warnings: ['Position yourself in frame']
    };
  }

  reset() {
    this.counterRight = 0;
    this.counterLeft = 0;
    this.stageRight = 'initial';
    this.stageLeft = 'initial';
  }

  // Additional getters for detailed hammer curl data
  getRightArmData() {
    return { counter: this.counterRight, stage: this.stageRight };
  }

  getLeftArmData() {
    return { counter: this.counterLeft, stage: this.stageLeft };
  }
}

// Exercise Tracker Factory
export class EnhancedExerciseTrackerFactory {
  static createTracker(exerciseType: ExerciseType) {
    switch (exerciseType) {
      case 'squats':
        return new EnhancedSquatTracker();
      case 'push_ups':
        return new EnhancedPushUpTracker();
      case 'bicep_curl':
        return new EnhancedHammerCurlTracker();
      default:
        throw new Error(`Unsupported exercise type: ${exerciseType}`);
    }
  }
}