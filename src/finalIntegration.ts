// src/finalIntegration.ts
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { ExerciseType } from './exerciseSystem';
import { ImprovedVoiceAgent } from './improvedVoiceAgent';
import { EnhancedVisualDashboard } from './enhancedVisualDashboard';
import { ImprovedLateralRaiseDetector } from './improvedLateralRaiseDetection';

// Main Application Class
export class VelocityCoachAI {
  // Core components
  private landmarker?: PoseLandmarker;
  private voiceAgent = new ImprovedVoiceAgent();
  private visualDashboard = new EnhancedVisualDashboard();
  
  // Exercise-specific detectors
  private exerciseDetectors = new Map<ExerciseType, any>();
  private currentExercise: ExerciseType = 'shoulder_press';
  
  // Camera and rendering
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream?: MediaStream;
  private running = false;

  constructor() {
    // Initialize DOM elements
    this.video = document.getElementById("video") as HTMLVideoElement;
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
    // Initialize exercise-specific detectors
    this.initializeDetectors();
    this.setupEventHandlers();
  }

  private initializeDetectors(): void {
    // Use improved lateral raise detector for lateral raise
    this.exerciseDetectors.set('lateral_raise', new ImprovedLateralRaiseDetector());
    
    // Use standard exercise detector for others (from previous exerciseSystem.ts)
    // This would be expanded with specific detectors for each exercise
  }

  private setupEventHandlers(): void {
    // Exercise selection
    document.querySelectorAll('.exercise-card').forEach(card => {
      card.addEventListener('click', () => {
        const exerciseType = (card as HTMLElement).dataset.exercise as ExerciseType;
        if (exerciseType) {
          this.switchExercise(exerciseType);
        }
      });
    });

    // Control buttons
    document.getElementById('btnStart')?.addEventListener('click', () => this.start());
    document.getElementById('btnStop')?.addEventListener('click', () => this.stop());
    document.getElementById('btnToggleVoice')?.addEventListener('click', () => this.toggleVoice());
    document.getElementById('btnSkipRest')?.addEventListener('click', () => this.skipRest());
    document.getElementById('btnCompleteSet')?.addEventListener('click', () => this.completeCurrentSet());
  }

  async start(): Promise<void> {
    try {
      // Initialize camera
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      // Initialize MediaPipe
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPoseTrackingConfidence: 0.5
      } as any);

      this.running = true;
      this.updateUI('running');
      this.loop();
      
    } catch (error) {
      console.error('Failed to start:', error);
      this.updateUI('error');
    }
  }

  stop(): void {
    this.running = false;
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = undefined;
    }
    
    this.landmarker = undefined;
    this.voiceAgent.clearQueue();
    this.updateUI('stopped');
  }

  private loop(): void {
    if (!this.running || !this.landmarker) return;

    const w = this.video.videoWidth || 640;
    const h = this.video.videoHeight || 480;
    this.canvas.width = w;
    this.canvas.height = h;

    const nowMs = performance.now();
    const result = this.landmarker.detectForVideo(this.video, nowMs);

    // Clear canvas
    this.ctx.clearRect(0, 0, w, h);
    
    // Draw video frame
    try {
      this.ctx.drawImage(this.video, 0, 0, w, h);
    } catch {}

    if (result.landmarks && result.landmarks[0]) {
      const landmarks = result.landmarks[0];
      
      // Draw pose skeleton
      this.drawPoseSkeleton(landmarks, w, h);
      
      // Process current exercise
      const stepData = this.processCurrentExercise(landmarks, nowMs / 1000);
      
      // Update systems
      this.voiceAgent.analyzeWorkoutStep(stepData);
      this.visualDashboard.updateDashboard(stepData);
      
      // Highlight active exercise joints
      this.highlightActiveExercise(landmarks, w, h);
      
    } else {
      // No person detected
      this.drawNoPersonMessage();
    }

    if (this.running) {
      requestAnimationFrame(() => this.loop());
    }
  }

  private processCurrentExercise(landmarks: any[], timestamp: number): any {
    const detector = this.exerciseDetectors.get(this.currentExercise);
    
    if (detector) {
      const result = detector.step(landmarks, timestamp);
      
      // Enhance step data with additional metrics
      return {
        ...result,
        exercise: this.currentExercise,
        timestamp,
        // Add form quality calculations
        formScore: this.calculateFormScore(result, landmarks),
        // Add velocity loss if detector supports it
        velocityLoss: detector.getCurrentVelocityLoss ? detector.getCurrentVelocityLoss() : 0
      };
    }
    
    return {
      exercise: this.currentExercise,
      reps: 0,
      angle: 0,
      velocity: 0,
      state: 'idle',
      formScore: 0,
      isNewRep: false,
      timestamp
    };
  }

  private calculateFormScore(result: any, landmarks: any[]): number {
    // Exercise-specific form scoring
    let score = 100;
    
    switch (this.currentExercise) {
      case 'lateral_raise':
        // Check for common lateral raise form issues
        if (Math.abs(result.velocity) > 150) score -= 20; // Too fast
        if (result.angle > 90) score -= 15; // Too high
        break;
        
      case 'shoulder_press':
        // Shoulder press form checks
        if (Math.abs(result.velocity) > 180) score -= 20;
        break;
        
      // Add other exercises...
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private drawPoseSkeleton(landmarks: any[], w: number, h: number): void {
    const connections = [
      [11, 12], [11, 23], [12, 24], [23, 24], // torso
      [11, 13], [13, 15], [12, 14], [14, 16], // arms
      [23, 25], [25, 27], [24, 26], [26, 28], // legs
    ];

    // Draw connections
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = "rgba(0, 200, 255, 0.7)";
    this.ctx.beginPath();
    
    connections.forEach(([a, b]) => {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (pa && pb) {
        this.ctx.moveTo(pa.x * w, pa.y * h);
        this.ctx.lineTo(pb.x * w, pb.y * h);
      }
    });
    this.ctx.stroke();

    // Draw joints
    this.ctx.fillStyle = "rgba(255, 180, 0, 0.8)";
    landmarks.forEach((point: any) => {
      this.ctx.beginPath();
      this.ctx.arc(point.x * w, point.y * h, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private highlightActiveExercise(landmarks: any[], w: number, h: number): void {
    const jointMappings: Record<ExerciseType, number[]> = {
      shoulder_press: [12, 14, 16], // Right arm
      lateral_raise: [12, 14],      // Right shoulder-elbow
      front_raise: [12, 14],
      rear_delt_fly: [12, 14],
      bicep_curl: [12, 14, 16]      // Added bicep_curl
    };
    
    const joints = jointMappings[this.currentExercise] || [];
    
    this.ctx.strokeStyle = "rgba(50, 255, 170, 1)";
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    
    for (let i = 0; i < joints.length - 1; i++) {
      const p1 = landmarks[joints[i]];
      const p2 = landmarks[joints[i + 1]];
      if (p1 && p2) {
        this.ctx.moveTo(p1.x * w, p1.y * h);
        this.ctx.lineTo(p2.x * w, p2.y * h);
      }
    }
    this.ctx.stroke();
  }

  private drawNoPersonMessage(): void {
    this.ctx.fillStyle = "rgba(255, 80, 80, 1)";
    this.ctx.font = "24px system-ui";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "Position yourself in frame to begin",
      this.canvas.width / 2,
      this.canvas.height / 2
    );
    this.ctx.textAlign = "left";
  }

  private switchExercise(exerciseType: ExerciseType): void {
    if (this.currentExercise !== exerciseType) {
      this.currentExercise = exerciseType;
      this.visualDashboard.onExerciseSwitch(exerciseType);
      
      // Reset the detector for the new exercise
      const detector = this.exerciseDetectors.get(exerciseType);
      if (detector && detector.reset) {
        detector.reset();
      }
    }
  }

  private toggleVoice(): void {
    const enabled = this.voiceAgent.toggle();
    const btn = document.getElementById('btnToggleVoice');
    if (btn) {
      btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
    }
  }

  private skipRest(): void {
    const tracker = this.visualDashboard.getProgressTracker();
    tracker.skipRest(this.currentExercise);
  }

  private completeCurrentSet(): void {
    // Force complete the current set
    const tracker = this.visualDashboard.getProgressTracker();
    const mockSetData = {
      exercise: this.currentExercise,
      setNumber: tracker.getCurrentExerciseProgress()?.currentSet || 1,
      reps: tracker.getCurrentExerciseProgress()?.targetReps || 8,
      startTime: Date.now() / 1000 - 60,
      endTime: Date.now() / 1000,
      avgVelocity: 100,
      peakVelocity: 150,
      velocityLoss: 0.15,
      formScore: 85
    };
    
    this.visualDashboard.onSetComplete(this.currentExercise, mockSetData);
    this.voiceAgent.onSetComplete(this.currentExercise, mockSetData);
  }

  private updateUI(state: 'running' | 'stopped' | 'error'): void {
    const statusEl = document.getElementById('setStatus');
    const startBtn = document.getElementById('btnStart') as HTMLButtonElement;
    const stopBtn = document.getElementById('btnStop') as HTMLButtonElement;
    
    if (statusEl) {
      statusEl.textContent = state.charAt(0).toUpperCase() + state.slice(1);
    }
    
    if (startBtn && stopBtn) {
      startBtn.disabled = state === 'running';
      stopBtn.disabled = state !== 'running';
    }
  }

  // Public API for testing
  getCurrentExercise(): ExerciseType {
    return this.currentExercise;
  }

  getVoiceStatus(): any {
    return this.voiceAgent.getStatus();
  }

  // Cleanup
  destroy(): void {
    this.stop();
    this.visualDashboard.reset();
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new VelocityCoachAI();
  
  // Make available for browser console testing
  (window as any).velocityCoachAI = app;
});

// Export for module usage
export default VelocityCoachAI;