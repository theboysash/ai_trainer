// src/exerciseSystem.ts
import { angleBetween, euclid2d } from "./curlCounter";

export type ExerciseType = 'bicep_curl' | 'shoulder_press' | 'lateral_raise' | 'front_raise' | 'rear_delt_fly';

export interface ExerciseConfig {
  name: string;
  type: ExerciseType;
  landmarks: {
    primary: number[];  // Main joints to track
    secondary?: number[]; // Additional reference points
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

export interface SetData {
  exercise: ExerciseType;
  setNumber: number;
  reps: number;
  startTime: number;
  endTime: number;
  avgVelocity: number;
  peakVelocity: number;
  velocityLoss: number;
  formScore: number;
  restTime?: number;
}

export interface WorkoutSession {
  sessionId: string;
  startTime: number;
  exercises: Map<ExerciseType, SetData[]>;
  currentExercise: ExerciseType;
  currentSet: number;
  totalVolume: number;
  sessionDuration: number;
}

export class ExerciseDetector {
  private config: ExerciseConfig;
  private velocityHistory: number[] = [];
  private angleHistory: number[] = [];
  private state: 'idle' | 'eccentric' | 'bottom' | 'concentric' | 'top' = 'idle';
  private repStartTime: number = 0;
  private currentAngle: number = 0;
  private baselineVelocity: number | null = null;
  
  // Rep counting
  private reps: number = 0;
  private lastAngle?: number;
  private lastTime?: number;
  private velocity: number = 0;

  constructor(config: ExerciseConfig) {
    this.config = config;
  }

  step(landmarks: any[], timestamp: number): {
    reps: number;
    angle: number;
    velocity: number;
    state: string;
    formScore: number;
    isNewRep: boolean;
  } {
    const metrics = this.computeMetrics(landmarks);
    if (!metrics.valid) {
      return {
        reps: this.reps,
        angle: this.currentAngle,
        velocity: this.velocity,
        state: this.state,
        formScore: 0,
        isNewRep: false
      };
    }

    this.currentAngle = metrics.angle;
    const isNewRep = this.updateState(metrics.angle, timestamp);
    const formScore = this.calculateFormScore(metrics);

    return {
      reps: this.reps,
      angle: this.currentAngle,
      velocity: this.velocity,
      state: this.state,
      formScore,
      isNewRep
    };
  }

  private computeMetrics(landmarks: any[]) {
    const { primary } = this.config.landmarks;
    
    switch (this.config.type) {
      case 'shoulder_press':
        return this.computeShoulderPressMetrics(landmarks, primary);
      case 'lateral_raise':
        return this.computeLateralRaiseMetrics(landmarks, primary);
      case 'front_raise':
        return this.computeFrontRaiseMetrics(landmarks, primary);
      case 'bicep_curl':
        return this.computeBicepCurlMetrics(landmarks, primary);
      default:
        return { angle: 0, valid: false };
    }
  }

  private computeShoulderPressMetrics(landmarks: any[], joints: number[]) {
    // Shoulder Press: Track shoulder-elbow-wrist angle
    const [shoulderIdx, elbowIdx, wristIdx] = joints;
    
    if (!this.jointsVisible(landmarks, joints)) {
      return { angle: 0, valid: false };
    }

    const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y, landmarks[shoulderIdx].z];
    const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y, landmarks[elbowIdx].z];
    const wrist = [landmarks[wristIdx].x, landmarks[wristIdx].y, landmarks[wristIdx].z];

    // Calculate arm elevation angle (angle from horizontal)
    const armVector = [elbow[0] - shoulder[0], elbow[1] - shoulder[1]];
    const horizontalVector = [1, 0];
    
    const dotProduct = armVector[0] * horizontalVector[0] + armVector[1] * horizontalVector[1];
    const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
    
    let elevationAngle = Math.acos(dotProduct / armMagnitude) * (180 / Math.PI);
    
    // Adjust for direction (positive for upward movement)
    if (armVector[1] > 0) elevationAngle = -elevationAngle;
    elevationAngle += 90; // Normalize so 0° = arms at sides, 180° = arms overhead

    return { angle: Math.max(0, Math.min(180, elevationAngle)), valid: true };
  }

  private computeLateralRaiseMetrics(landmarks: any[], joints: number[]) {
    // Lateral Raise: Track arm abduction from torso
    const [shoulderIdx, elbowIdx] = joints;
    
    if (!this.jointsVisible(landmarks, joints.slice(0, 2))) {
      return { angle: 0, valid: false };
    }

    const leftShoulder = [landmarks[11].x, landmarks[11].y];
    const rightShoulder = [landmarks[12].x, landmarks[12].y];
    const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y];
    const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y];

    // Vector from shoulder to elbow
    const armVector = [elbow[0] - shoulder[0], elbow[1] - shoulder[1]];
    
    // Reference vector (shoulder line)
    const shoulderLine = [rightShoulder[0] - leftShoulder[0], rightShoulder[1] - leftShoulder[1]];
    
    // Calculate angle between arm and shoulder line
    const dotProduct = armVector[0] * shoulderLine[0] + armVector[1] * shoulderLine[1];
    const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
    const shoulderMagnitude = Math.sqrt(shoulderLine[0] ** 2 + shoulderLine[1] ** 2);
    
    let abductionAngle = Math.acos(Math.abs(dotProduct) / (armMagnitude * shoulderMagnitude)) * (180 / Math.PI);
    
    return { angle: Math.max(0, Math.min(90, abductionAngle)), valid: true };
  }

  private computeFrontRaiseMetrics(landmarks: any[], joints: number[]) {
    // Front Raise: Track forward arm elevation
    const [shoulderIdx, elbowIdx] = joints;
    
    if (!this.jointsVisible(landmarks, joints.slice(0, 2))) {
      return { angle: 0, valid: false };
    }

    const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y];
    const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y];

    // Calculate elevation angle from vertical
    const armVector = [elbow[0] - shoulder[0], elbow[1] - shoulder[1]];
    const verticalVector = [0, 1];
    
    const dotProduct = armVector[0] * verticalVector[0] + armVector[1] * verticalVector[1];
    const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
    
    let elevationAngle = Math.acos(Math.abs(dotProduct) / armMagnitude) * (180 / Math.PI);
    
    return { angle: Math.max(0, Math.min(90, elevationAngle)), valid: true };
  }

  private computeBicepCurlMetrics(landmarks: any[], joints: number[]) {
    // Existing bicep curl logic
    const [shoulderIdx, elbowIdx, wristIdx] = joints;
    
    if (!this.jointsVisible(landmarks, joints)) {
      return { angle: 0, valid: false };
    }

    const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y, landmarks[shoulderIdx].z];
    const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y, landmarks[elbowIdx].z];
    const wrist = [landmarks[wristIdx].x, landmarks[wristIdx].y, landmarks[wristIdx].z];

    const angle = angleBetween(shoulder, elbow, wrist);
    return { angle: Math.max(0, Math.min(180, angle)), valid: true };
  }

  private jointsVisible(landmarks: any[], joints: number[]): boolean {
    return joints.every(idx => (landmarks[idx]?.visibility ?? 0) > 0.5);
  }

  private updateState(angle: number, timestamp: number): boolean {
    if (this.lastAngle == null || this.lastTime == null) {
      this.lastAngle = angle;
      this.lastTime = timestamp;
      return false;
    }

    const dt = Math.max(1e-3, timestamp - this.lastTime);
    this.velocity = (angle - this.lastAngle) / dt;
    this.lastAngle = angle;
    this.lastTime = timestamp;

    // Track velocity for baseline
    if (this.velocity !== 0) {
      this.velocityHistory.push(Math.abs(this.velocity));
      if (this.velocityHistory.length > 10) {
        this.velocityHistory = this.velocityHistory.slice(-8);
      }
      
      if (!this.baselineVelocity && this.velocityHistory.length >= 3) {
        this.baselineVelocity = this.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
      }
    }

    return this.detectRep(angle, timestamp);
  }

  private detectRep(angle: number, timestamp: number): boolean {
    const { startAngle, endAngle, minROM } = this.config.thresholds;
    let isNewRep = false;

    switch (this.state) {
      case 'idle':
        if (angle >= startAngle) {
          this.state = 'eccentric';
          this.repStartTime = timestamp;
        }
        break;

      case 'eccentric':
        if (angle <= endAngle) {
          this.state = 'bottom';
        }
        break;

      case 'bottom':
        if (angle > endAngle + 5) { // Small hysteresis
          this.state = 'concentric';
        }
        break;

      case 'concentric':
        if (angle >= startAngle) {
          // Check if rep meets quality criteria
          const rom = Math.abs(startAngle - endAngle);
          const repTime = timestamp - this.repStartTime;
          
          if (rom >= minROM && repTime >= 0.5 && repTime <= 5.0) {
            this.reps++;
            isNewRep = true;
          }
          
          this.state = 'top';
        }
        break;

      case 'top':
        if (angle < startAngle - 5) {
          this.state = 'eccentric';
          this.repStartTime = timestamp;
        } else if (timestamp - this.repStartTime > 2.0) {
          this.state = 'idle';
        }
        break;
    }

    return isNewRep;
  }

  private calculateFormScore(metrics: any): number {
    let score = 100;
    
    // ROM penalty/bonus
    const currentROM = Math.abs(this.currentAngle - this.config.thresholds.endAngle);
    const targetROM = this.config.thresholds.minROM;
    
    if (currentROM < targetROM * 0.8) {
      score -= 20; // Insufficient ROM
    } else if (currentROM > targetROM * 1.2) {
      score += 10; // Excellent ROM
    }

    // Velocity consistency
    if (this.velocityHistory.length >= 3) {
      const recentVel = this.velocityHistory.slice(-3);
      const variance = this.calculateVariance(recentVel);
      
      if (variance > 1000) score -= 15; // Inconsistent tempo
      if (variance < 200) score += 5; // Consistent tempo
    }

    // Speed control
    if (Math.abs(this.velocity) > this.config.thresholds.maxVelocity) {
      score -= 15; // Too fast
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateVariance(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const squareDiffs = arr.map(x => Math.pow(x - mean, 2));
    return squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
  }

  getCurrentVelocityLoss(): number {
    if (!this.baselineVelocity || this.velocityHistory.length < 3) return 0;
    
    const recent = this.velocityHistory.slice(-3);
    const currentAvg = recent.reduce((a, b) => a + b) / recent.length;
    return Math.max(0, (this.baselineVelocity - currentAvg) / this.baselineVelocity);
  }

  reset(): void {
    this.reps = 0;
    this.state = 'idle';
    this.velocityHistory = [];
    this.angleHistory = [];
    this.baselineVelocity = null;
    this.lastAngle = undefined;
    this.lastTime = undefined;
  }

  getStats() {
    return {
      reps: this.reps,
      velocityLoss: this.getCurrentVelocityLoss(),
      avgVelocity: this.velocityHistory.length ? 
        this.velocityHistory.reduce((a, b) => a + b) / this.velocityHistory.length : 0,
      peakVelocity: this.velocityHistory.length ? Math.max(...this.velocityHistory) : 0
    };
  }
}