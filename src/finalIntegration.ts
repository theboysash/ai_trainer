// src/fixedFinalIntegration.ts - DASHBOARD INTEGRATION FIX
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { ExerciseType } from './exerciseSystem';
import { ImprovedVoiceAgent } from './improvedVoiceAgent';
import { EnhancedVisualDashboard } from './enhancedVisualDashboard';
import { ImprovedLateralRaiseDetector } from './improvedLateralRaiseDetection';
import { ExerciseDetector } from './exerciseSystem';
import { getExerciseConfig } from './exerciseConfigs';

export class VelocityCoachAI {
  // Core components
  private landmarker?: PoseLandmarker;
  private voiceAgent = new ImprovedVoiceAgent();
  private visualDashboard = new EnhancedVisualDashboard(); // FIXED: Properly instantiate
  
  // Exercise-specific detectors - FIXED: Initialize all exercises
  private exerciseDetectors = new Map<ExerciseType, any>();
  private currentExercise: ExerciseType = 'shoulder_press';
  
  // Camera and rendering
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream?: MediaStream;
  private running = false;

  // VBT Tracking - FIXED: Add your intensity system
  private currentIntensity: 'light' | 'moderate' | 'intense' = 'moderate';
  private velocityBaselines = new Map<ExerciseType, number>();
  private exerciseVelocityHistory = new Map<ExerciseType, number[]>();

  constructor() {
    this.video = document.getElementById("video") as HTMLVideoElement;
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
    this.initializeAllDetectors(); // FIXED: Initialize all exercise detectors
    this.setupEventHandlers();
    this.setupIntensityControls(); // FIXED: Add your VBT intensity controls
  }

  // FIXED: Initialize detectors for all exercises
  private initializeAllDetectors(): void {
    const exercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly', 'bicep_curl'];
    
    exercises.forEach(exercise => {
      if (exercise === 'lateral_raise') {
        // Use your improved lateral raise detector
        this.exerciseDetectors.set(exercise, new ImprovedLateralRaiseDetector());
      } else {
        // Use standard exercise detector for others
        const config = getExerciseConfig(exercise);
        this.exerciseDetectors.set(exercise, new ExerciseDetector(config));
      }
      
      // Initialize VBT tracking
      this.exerciseVelocityHistory.set(exercise, []);
    });
  }

  // FIXED: Add intensity controls from your PDF model
  private setupIntensityControls(): void {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="background: #162031; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h4 style="color: #50d7ff; margin: 0 0 10px 0;">Velocity-Based Training</h4>
        <select id="intensitySelect" style="background: #1b2a3a; color: white; border: 1px solid #2d3b4e; padding: 8px; border-radius: 4px;">
          <option value="light">Light (40-60% 1RM, VL 15-20%)</option>
          <option value="moderate" selected>Moderate (65-75% 1RM, VL 20-25%)</option>
          <option value="intense">Intense (80-90% 1RM, VL 30-40%)</option>
        </select>
      </div>
    `;
    
    const sidebar = document.querySelector('.sidebar') || document.body;
    sidebar.insertBefore(container, sidebar.firstChild);
    
    document.getElementById('intensitySelect')!.addEventListener('change', (e) => {
      this.currentIntensity = (e.target as HTMLSelectElement).value as any;
      this.voiceAgent.updateIntensity(this.currentIntensity); // Pass to voice agent
    });
  }

  private setupEventHandlers(): void {
    // Exercise selection with proper detector switching
    document.querySelectorAll('.exercise-card').forEach(card => {
      card.addEventListener('click', () => {
        const exerciseType = (card as HTMLElement).dataset.exercise as ExerciseType;
        if (exerciseType) {
          this.switchExercise(exerciseType);
        }
      });
    });

    document.getElementById('btnStart')?.addEventListener('click', () => this.start());
    document.getElementById('btnStop')?.addEventListener('click', () => this.stop());
    document.getElementById('btnToggleVoice')?.addEventListener('click', () => this.toggleVoice());
  }

  async start(): Promise<void> {
    try {
      // Camera initialization
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      // MediaPipe initialization
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
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

  private loop(): void {
    if (!this.running || !this.landmarker) return;

    const w = this.video.videoWidth || 640;
    const h = this.video.videoHeight || 480;
    this.canvas.width = w;
    this.canvas.height = h;

    const nowMs = performance.now();
    const result = this.landmarker.detectForVideo(this.video, nowMs);

    // Clear and draw video
    this.ctx.clearRect(0, 0, w, h);
    try {
      this.ctx.drawImage(this.video, 0, 0, w, h);
    } catch {}

    if (result.landmarks && result.landmarks[0]) {
      const landmarks = result.landmarks[0];
      
      // Draw pose skeleton
      this.drawPoseSkeleton(landmarks, w, h);
      
      // FIXED: Process current exercise with proper detector
      const stepData = this.processCurrentExercise(landmarks, nowMs / 1000);
      
      // FIXED: Update all systems with enhanced data
      this.updateAllSystems(stepData);
      
      // Highlight active exercise joints
      this.highlightActiveExercise(landmarks, w, h);
      
    } else {
      this.drawNoPersonMessage();
    }

    if (this.running) {
      requestAnimationFrame(() => this.loop());
    }
  }

  // FIXED: Proper exercise processing with VBT integration
  private processCurrentExercise(landmarks: any[], timestamp: number): any {
    const detector = this.exerciseDetectors.get(this.currentExercise);
    
    if (!detector) {
      return this.getDefaultStepData();
    }

    const result = detector.step(landmarks, timestamp);
    
    // FIXED: Add VBT calculations
    const enhancedData = {
      ...result,
      exercise: this.currentExercise,
      timestamp,
      formScore: this.calculateFormScore(result, landmarks),
      velocityLoss: this.calculateVelocityLoss(result.velocity),
      intensityZone: this.currentIntensity,
      vlThreshold: this.getVLThreshold(),
      isResting: false, // You can enhance this based on rest logic
      restTimeRemaining: 0
    };

    // Track velocity for baseline
    this.trackVelocity(result.velocity);

    return enhancedData;
  }

  // FIXED: VBT calculations from your PDF
  private getVLThreshold(): number {
    const thresholds = {
      light: 0.20,    // 15-20%
      moderate: 0.25, // 20-25%
      intense: 0.40   // 30-40%
    };
    return thresholds[this.currentIntensity];
  }

  private trackVelocity(velocity: number): void {
    if (velocity === 0) return;
    
    const history = this.exerciseVelocityHistory.get(this.currentExercise)!;
    history.push(Math.abs(velocity));
    
    // Set baseline from first few reps
    if (!this.velocityBaselines.has(this.currentExercise) && history.length >= 3) {
      const baseline = history.slice(0, 3).reduce((a, b) => a + b) / 3;
      this.velocityBaselines.set(this.currentExercise, baseline);
    }
    
    // Keep history manageable
    if (history.length > 20) {
      history.splice(0, history.length - 15);
    }
  }

  private calculateVelocityLoss(currentVelocity: number): number {
    const baseline = this.velocityBaselines.get(this.currentExercise);
    if (!baseline || currentVelocity === 0) return 0;
    
    const history = this.exerciseVelocityHistory.get(this.currentExercise)!;
    if (history.length < 5) return 0;
    
    const recentAvg = history.slice(-3).reduce((a, b) => a + b) / 3;
    return Math.max(0, (baseline - recentAvg) / baseline);
  }

  private calculateFormScore(result: any, landmarks: any[]): number {
    // Exercise-specific form scoring
    let score = 100;
    
    switch (this.currentExercise) {
      case 'lateral_raise':
        if (Math.abs(result.velocity) > 120) score -= 20; // Too fast
        if (result.angle > 90) score -= 15; // Too high
        break;
      case 'shoulder_press':
        if (Math.abs(result.velocity) > 180) score -= 20;
        break;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // FIXED: Update all systems properly
  private updateAllSystems(stepData: any): void {
    // Voice agent analysis
    this.voiceAgent.analyzeWorkoutStep(stepData);
    
    // FIXED: Dashboard update with proper data structure
    this.visualDashboard.updateDashboard(stepData);
    
    // Update UI elements if they exist
    this.updateMetricsDisplay(stepData);
  }

  private updateMetricsDisplay(stepData: any): void {
    // Update metrics if elements exist
    const elements = {
      reps: document.getElementById('metricReps'),
      angle: document.getElementById('metricAngle'),
      velocity: document.getElementById('metricVelocity'),
      form: document.getElementById('metricForm'),
      vl: document.getElementById('metricVL')
    };

    if (elements.reps) elements.reps.textContent = stepData.reps.toString();
    if (elements.angle) elements.angle.textContent = `${Math.round(stepData.angle)}°`;
    if (elements.velocity) elements.velocity.textContent = stepData.velocity !== 0 ? `${Math.round(stepData.velocity)}°/s` : '—';
    if (elements.form) elements.form.textContent = Math.round(stepData.formScore).toString();
    if (elements.vl) {
      const vlPercent = Math.round(stepData.velocityLoss * 100);
      elements.vl.textContent = `${vlPercent}%`;
      
      // Color coding based on your thresholds
      const threshold = this.getVLThreshold();
      if (stepData.velocityLoss > threshold) {
        elements.vl.style.color = '#ef4444'; // Red
      } else if (stepData.velocityLoss > threshold * 0.8) {
        elements.vl.style.color = '#f59e0b'; // Yellow
      } else {
        elements.vl.style.color = '#22c55e'; // Green
      }
    }
  }

  private getDefaultStepData(): any {
    return {
      exercise: this.currentExercise,
      reps: 0,
      angle: 0,
      velocity: 0,
      state: 'idle',
      formScore: 0,
      isNewRep: false,
      timestamp: performance.now() / 1000,
      velocityLoss: 0,
      intensityZone: this.currentIntensity,
      vlThreshold: this.getVLThreshold()
    };
  }

  private switchExercise(exerciseType: ExerciseType): void {
    if (this.currentExercise !== exerciseType) {
      this.currentExercise = exerciseType;
      
      // Reset detector for new exercise
      const detector = this.exerciseDetectors.get(exerciseType);
      if (detector && detector.reset) {
        detector.reset();
      }
      
      // Notify systems
      this.visualDashboard.onExerciseSwitch(exerciseType);
      this.voiceAgent.onExerciseStart?.(exerciseType);
    }
  }

  // Rest of your existing methods...
  private drawPoseSkeleton(landmarks: any[], w: number, h: number): void {
    const connections = [
      [11, 12], [11, 23], [12, 24], [23, 24], // torso
      [11, 13], [13, 15], [12, 14], [14, 16], // arms
      [23, 25], [25, 27], [24, 26], [26, 28], // legs
    ];

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

    this.ctx.fillStyle = "rgba(255, 180, 0, 0.8)";
    landmarks.forEach((point: any) => {
      this.ctx.beginPath();
      this.ctx.arc(point.x * w, point.y * h, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private highlightActiveExercise(landmarks: any[], w: number, h: number): void {
    const jointMappings: Record<ExerciseType, number[]> = {
      shoulder_press: [12, 14, 16],
      lateral_raise: [12, 14],
      front_raise: [12, 14],
      rear_delt_fly: [12, 14],
      bicep_curl: [12, 14, 16]
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

  private toggleVoice(): void {
    const enabled = this.voiceAgent.toggle();
    const btn = document.getElementById('btnToggleVoice');
    if (btn) {
      btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
    }
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

  getCurrentExercise(): ExerciseType {
    return this.currentExercise;
  }

  destroy(): void {
    this.stop();
    this.visualDashboard.reset();
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new VelocityCoachAI();
  (window as any).velocityCoachAI = app;
});