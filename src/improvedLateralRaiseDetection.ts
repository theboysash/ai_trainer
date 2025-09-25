// src/improvedLateralRaiseDetection.ts

export class ImprovedLateralRaiseDetector {
  private state: 'idle' | 'raising' | 'top' | 'lowering' = 'idle';
  private reps: number = 0;
  private lastAngle: number = 0;
  private lastTime: number = 0;
  private velocity: number = 0;
  
  // Improved detection parameters
  private readonly START_THRESHOLD = 15;  // Degrees from vertical to start detecting
  private readonly TOP_THRESHOLD = 75;    // Target top position
  private readonly MIN_ROM = 50;          // Minimum range of motion for valid rep
  private readonly HYSTERESIS = 8;        // Prevent oscillation between states
  
  // Smoothing and validation
  private angleHistory: number[] = [];
  private readonly SMOOTHING_WINDOW = 5;
  
  step(landmarks: any[], timestamp: number): {
    angle: number;
    reps: number;
    velocity: number;
    state: string;
    isNewRep: boolean;
  } {
    const metrics = this.computeLateralRaiseMetrics(landmarks);
    
    if (!metrics.valid) {
      return {
        angle: this.lastAngle,
        reps: this.reps,
        velocity: this.velocity,
        state: this.state,
        isNewRep: false
      };
    }

    // Smooth the angle data
    const smoothedAngle = this.smoothAngle(metrics.angle);
    
    // Calculate velocity
    if (this.lastTime > 0) {
      const dt = Math.max(1e-3, timestamp - this.lastTime);
      this.velocity = (smoothedAngle - this.lastAngle) / dt;
    }
    
    const isNewRep = this.updateState(smoothedAngle, timestamp);
    
    this.lastAngle = smoothedAngle;
    this.lastTime = timestamp;
    
    return {
      angle: smoothedAngle,
      reps: this.reps,
      velocity: this.velocity,
      state: this.state,
      isNewRep
    };
  }

  private computeLateralRaiseMetrics(landmarks: any[]): { angle: number; valid: boolean } {
    // Use both arms and choose the more visible one
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];

    // Check visibility and choose best arm
    const leftVisibility = (leftShoulder?.visibility || 0) * (leftElbow?.visibility || 0) * (leftWrist?.visibility || 0);
    const rightVisibility = (rightShoulder?.visibility || 0) * (rightElbow?.visibility || 0) * (rightWrist?.visibility || 0);
    
    if (leftVisibility < 0.125 && rightVisibility < 0.125) {
      return { angle: 0, valid: false };
    }

    // Use the arm with better visibility
    let shoulder, elbow, wrist;
    if (leftVisibility > rightVisibility) {
      shoulder = leftShoulder;
      elbow = leftElbow;
      wrist = leftWrist;
    } else {
      shoulder = rightShoulder;
      elbow = rightElbow;
      wrist = rightWrist;
    }

    // Calculate the lateral raise angle using improved geometry
    const armAngle = this.calculateLateralRaiseAngle(shoulder, elbow, wrist);
    
    return { angle: armAngle, valid: true };
  }

  private calculateLateralRaiseAngle(shoulder: any, elbow: any, wrist: any): number {
    // Method 1: Arm elevation from vertical (gravity vector)
    const armVector = [elbow.x - shoulder.x, elbow.y - shoulder.y];
    
    // Gravity vector points down in screen coordinates (positive Y)
    const gravityVector = [0, 1];
    
    // Calculate angle between arm and gravity
    const dotProduct = armVector[0] * gravityVector[0] + armVector[1] * gravityVector[1];
    const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
    const gravityMagnitude = 1; // Unit vector
    
    if (armMagnitude === 0) return 0;
    
    let elevationAngle = Math.acos(Math.abs(dotProduct) / armMagnitude) * (180 / Math.PI);
    
    // Convert to lateral raise angle (0° = arm down, 90° = arm horizontal)
    // If arm is above horizontal (negative Y difference), it's raising
    if (armVector[1] < 0) {
      elevationAngle = 90 - elevationAngle;
    } else {
      elevationAngle = Math.max(0, 90 - elevationAngle);
    }
    
    // Method 2: Cross-validation using forearm alignment
    const forearmVector = [wrist.x - elbow.x, wrist.y - elbow.y];
    const forearmAngle = Math.atan2(-forearmVector[1], Math.abs(forearmVector[0])) * (180 / Math.PI);
    
    // Combine both measurements with weighting
    const combinedAngle = (elevationAngle * 0.8) + (Math.max(0, forearmAngle) * 0.2);
    
    return Math.max(0, Math.min(90, combinedAngle));
  }

  private smoothAngle(newAngle: number): number {
    this.angleHistory.push(newAngle);
    
    if (this.angleHistory.length > this.SMOOTHING_WINDOW) {
      this.angleHistory.shift();
    }
    
    // Use median filter to remove outliers, then moving average
    const sorted = [...this.angleHistory].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // If new angle is way off from median, use median instead
    if (Math.abs(newAngle - median) > 30) {
      return median;
    }
    
    // Otherwise use weighted average favoring recent data
    let weightedSum = 0;
    let totalWeight = 0;
    
    this.angleHistory.forEach((angle, index) => {
      const weight = index + 1; // More recent = higher weight
      weightedSum += angle * weight;
      totalWeight += weight;
    });
    
    return weightedSum / totalWeight;
  }

  private updateState(angle: number, timestamp: number): boolean {
    let isNewRep = false;
    
    switch (this.state) {
      case 'idle':
        if (angle > this.START_THRESHOLD) {
          this.state = 'raising';
        }
        break;
        
      case 'raising':
        if (angle >= this.TOP_THRESHOLD) {
          this.state = 'top';
        } else if (angle < this.START_THRESHOLD - this.HYSTERESIS) {
          // Went back down without reaching top
          this.state = 'idle';
        }
        break;
        
      case 'top':
        if (angle < this.TOP_THRESHOLD - this.HYSTERESIS) {
          this.state = 'lowering';
        }
        break;
        
      case 'lowering':
        if (angle <= this.START_THRESHOLD) {
          // Check if this was a valid rep
          const rom = this.TOP_THRESHOLD - this.START_THRESHOLD;
          if (rom >= this.MIN_ROM) {
            this.reps++;
            isNewRep = true;
          }
          this.state = 'idle';
        } else if (angle > this.TOP_THRESHOLD - this.HYSTERESIS) {
          // Went back up to top
          this.state = 'top';
        }
        break;
    }
    
    return isNewRep;
  }

  reset(): void {
    this.state = 'idle';
    this.reps = 0;
    this.lastAngle = 0;
    this.lastTime = 0;
    this.velocity = 0;
    this.angleHistory = [];
  }

  getStats() {
    return {
      reps: this.reps,
      currentAngle: this.lastAngle,
      currentState: this.state,
      smoothedData: this.angleHistory.length
    };
  }
}