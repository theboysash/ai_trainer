// src/index.ts - Clean VelocityCoach AI Application
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Simple exercise types
type ExerciseType = 'shoulder_press' | 'lateral_raise' | 'front_raise' | 'rear_delt_fly' | 'bicep_curl';

// Voice Agent for VBT coaching
class VoiceCoach {
  private synthesis = window.speechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private isEnabled = true;
  private messageQueue: string[] = [];
  private lastSpoken = 0;

  // VBT thresholds from your research
  private intensityThresholds = {
    light: 0.20,    // 15-20% VL
    moderate: 0.25, // 20-25% VL
    intense: 0.40   // 30-40% VL
  };
  private currentIntensity: 'light' | 'moderate' | 'intense' = 'moderate';

  constructor() {
    this.initializeVoice();
    this.startMessageProcessor();
  }

  private initializeVoice() {
    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
      this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    };
    loadVoices();
    this.synthesis.onvoiceschanged = loadVoices;
  }

  private startMessageProcessor() {
    setInterval(() => {
      if (this.messageQueue.length > 0 && Date.now() - this.lastSpoken > 5000) {
        const message = this.messageQueue.shift()!;
        this.speak(message);
      }
    }, 1000);
  }

  updateIntensity(intensity: 'light' | 'moderate' | 'intense') {
    this.currentIntensity = intensity;
    this.queueMessage(`Training intensity set to ${intensity}.`);
  }

  analyzeStep(stepData: any) {
    // VL warning based on your PDF research
    if (stepData.velocityLoss > this.intensityThresholds[this.currentIntensity]) {
      const vlPercent = Math.round(stepData.velocityLoss * 100);
      this.queueMessage(`Velocity loss at ${vlPercent}%. Consider ending this set.`);
    }

    // Form coaching
    if (stepData.formScore < 70 && stepData.reps > 0) {
      this.queueMessage('Focus on form. Control the movement.');
    }

    // Rep milestones
    if (stepData.isNewRep && stepData.reps % 4 === 0) {
      this.queueMessage(`${stepData.reps} reps completed. Good work.`);
    }
  }

  onSetComplete(exercise: ExerciseType, reps: number) {
    const exerciseNames = {
      shoulder_press: 'Shoulder Press',
      lateral_raise: 'Lateral Raise',
      front_raise: 'Front Raise',
      rear_delt_fly: 'Rear Delt Fly',
      bicep_curl: 'Bicep Curl'
    };
    this.queueMessage(`${exerciseNames[exercise]} set complete. ${reps} reps.`);
  }

  private queueMessage(message: string) {
    if (!this.messageQueue.includes(message)) {
      this.messageQueue.push(message);
      if (this.messageQueue.length > 3) this.messageQueue.shift();
    }
  }

  private speak(message: string) {
    if (!this.isEnabled || !this.voice) return;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.voice = this.voice;
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    this.synthesis.speak(utterance);
    this.lastSpoken = Date.now();
  }

  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  clearQueue() {
    this.messageQueue = [];
    this.synthesis.cancel();
  }
}

// Simple exercise detector
class ExerciseDetector {
  private reps = 0;
  private state: 'idle' | 'moving' | 'top' | 'bottom' = 'idle';
  private lastAngle = 0;
  private lastTime = 0;
  private velocityHistory: number[] = [];
  private baseline: number | null = null;

  constructor(private exercise: ExerciseType) {}

  step(landmarks: any[], timestamp: number) {
    const angle = this.calculateAngle(landmarks);
    if (angle === 0) return this.getDefaultResult();

    const velocity = this.lastTime > 0 ? (angle - this.lastAngle) / (timestamp - this.lastTime) : 0;
    
    // Track velocity for VBT
    if (Math.abs(velocity) > 5) {
      this.velocityHistory.push(Math.abs(velocity));
      if (this.velocityHistory.length > 15) this.velocityHistory.shift();
      
      if (!this.baseline && this.velocityHistory.length >= 3) {
        this.baseline = this.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
      }
    }

    const isNewRep = this.detectRep(angle);
    const velocityLoss = this.calculateVelocityLoss();
    const formScore = this.calculateFormScore(angle, velocity);

    this.lastAngle = angle;
    this.lastTime = timestamp;

    return {
      reps: this.reps,
      angle,
      velocity,
      state: this.state,
      isNewRep,
      velocityLoss,
      formScore,
      exercise: this.exercise
    };
  }

  private calculateAngle(landmarks: any[]): number {
    // Use joints based on exercise type
    const jointMappings = {
      shoulder_press: [12, 14, 16], // Right shoulder, elbow, wrist
      lateral_raise: [12, 14],      // Shoulder, elbow (for arm elevation)
      front_raise: [12, 14],
      rear_delt_fly: [12, 14],
      bicep_curl: [12, 14, 16]
    };

    const joints = jointMappings[this.exercise];
    if (joints.length === 2) {
      // Arm elevation angle for raises
      const shoulder = landmarks[joints[0]];
      const elbow = landmarks[joints[1]];
      if (!shoulder || !elbow) return 0;

      const armVector = [elbow.x - shoulder.x, elbow.y - shoulder.y];
      let angle = Math.atan2(-armVector[1], Math.abs(armVector[0])) * (180 / Math.PI);
      return Math.max(0, Math.min(90, angle));
    } else {
      // Three-joint angle for presses/curls
      const [j1, j2, j3] = joints.map(i => landmarks[i]);
      if (!j1 || !j2 || !j3) return 0;

      const v1 = [j1.x - j2.x, j1.y - j2.y];
      const v2 = [j3.x - j2.x, j3.y - j2.y];
      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2);
      const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2);
      
      return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
    }
  }

  private detectRep(angle: number): boolean {
    const thresholds = {
      shoulder_press: { start: 90, end: 160 },
      lateral_raise: { start: 15, end: 75 },
      front_raise: { start: 15, end: 75 },
      rear_delt_fly: { start: 20, end: 70 },
      bicep_curl: { start: 155, end: 40 }
    };

    const { start, end } = thresholds[this.exercise];
    let isNewRep = false;

    switch (this.state) {
      case 'idle':
        if (this.exercise === 'bicep_curl' ? angle <= start : angle >= start) {
          this.state = 'moving';
        }
        break;
      case 'moving':
        if (this.exercise === 'bicep_curl' ? angle <= end : angle >= end) {
          this.state = 'top';
        }
        break;
      case 'top':
        if (this.exercise === 'bicep_curl' ? angle > end + 10 : angle < end - 10) {
          this.state = 'bottom';
        }
        break;
      case 'bottom':
        if (this.exercise === 'bicep_curl' ? angle >= start : angle <= start) {
          this.reps++;
          isNewRep = true;
          this.state = 'idle';
        }
        break;
    }

    return isNewRep;
  }

  private calculateVelocityLoss(): number {
    if (!this.baseline || this.velocityHistory.length < 5) return 0;
    const recent = this.velocityHistory.slice(-3).reduce((a, b) => a + b) / 3;
    return Math.max(0, (this.baseline - recent) / this.baseline);
  }

  private calculateFormScore(angle: number, velocity: number): number {
    let score = 100;
    if (Math.abs(velocity) > 150) score -= 20; // Too fast
    if (angle < 20) score -= 15; // Poor ROM
    return Math.max(0, score);
  }

  private getDefaultResult() {
    return {
      reps: this.reps, angle: 0, velocity: 0, state: this.state,
      isNewRep: false, velocityLoss: 0, formScore: 0, exercise: this.exercise
    };
  }

  reset() {
    this.reps = 0;
    this.state = 'idle';
    this.velocityHistory = [];
    this.baseline = null;
  }
}

// Main Application
class VelocityCoachAI {
  private landmarker?: PoseLandmarker;
  private voiceCoach = new VoiceCoach();
  private currentExercise: ExerciseType = 'shoulder_press';
  private detector = new ExerciseDetector(this.currentExercise);
  
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream?: MediaStream;
  private running = false;

  constructor() {
    this.video = document.getElementById("video") as HTMLVideoElement;
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
    this.setupEventHandlers();
    this.createExerciseSelector();
    this.createIntensitySelector();
  }

  private setupEventHandlers() {
    document.getElementById('btnStart')?.addEventListener('click', () => this.start());
    document.getElementById('btnStop')?.addEventListener('click', () => this.stop());
    document.getElementById('btnToggleVoice')?.addEventListener('click', () => this.toggleVoice());
    document.getElementById('btnCompleteSet')?.addEventListener('click', () => this.completeSet());
  }

  private createExerciseSelector() {
    const container = document.getElementById('exerciseGrid');
    if (!container) return;

    const exercises = {
      shoulder_press: 'Shoulder Press',
      lateral_raise: 'Lateral Raise', 
      front_raise: 'Front Raise',
      rear_delt_fly: 'Rear Delt Fly',
      bicep_curl: 'Bicep Curl'
    };

    container.innerHTML = '';
    Object.entries(exercises).forEach(([type, name]) => {
      const card = document.createElement('div');
      card.className = 'exercise-card';
      card.dataset.exercise = type;
      card.innerHTML = `<div class="exercise-name">${name}</div>`;
      
      card.addEventListener('click', () => {
        if (this.running) this.switchExercise(type as ExerciseType);
      });
      
      container.appendChild(card);
    });
  }

  private createIntensitySelector() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="background: #162031; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h4 style="color: #50d7ff; margin: 0 0 10px 0;">Training Intensity</h4>
        <select id="intensitySelect" style="background: #1b2a3a; color: white; border: 1px solid #2d3b4e; padding: 8px; border-radius: 4px; width: 100%;">
          <option value="light">Light (VL ≤20%)</option>
          <option value="moderate" selected>Moderate (VL ≤25%)</option>
          <option value="intense">Intense (VL ≤40%)</option>
        </select>
      </div>
    `;
    
    document.body.insertBefore(container, document.body.firstChild);
    
    document.getElementById('intensitySelect')!.addEventListener('change', (e) => {
      const intensity = (e.target as HTMLSelectElement).value as 'light' | 'moderate' | 'intense';
      this.voiceCoach.updateIntensity(intensity);
    });
  }

  async start() {
    try {
      // Camera setup
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      // MediaPipe setup
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
      alert('Camera access required. Please allow camera access and try again.');
    }
  }

  private loop() {
    if (!this.running || !this.landmarker) return;

    const w = this.video.videoWidth || 640;
    const h = this.video.videoHeight || 480;
    this.canvas.width = w;
    this.canvas.height = h;

    const nowMs = performance.now();
    const result = this.landmarker.detectForVideo(this.video, nowMs);

    this.ctx.clearRect(0, 0, w, h);
    try {
      this.ctx.drawImage(this.video, 0, 0, w, h);
    } catch {}

    if (result.landmarks && result.landmarks[0]) {
      const landmarks = result.landmarks[0];
      
      this.drawPoseSkeleton(landmarks, w, h);
      
      const stepData = this.detector.step(landmarks, nowMs / 1000);
      
      this.voiceCoach.analyzeStep(stepData);
      this.updateMetrics(stepData);
      this.highlightActiveJoints(landmarks, w, h);
      
    } else {
      this.drawNoPersonMessage();
    }

    if (this.running) {
      requestAnimationFrame(() => this.loop());
    }
  }

  private switchExercise(exercise: ExerciseType) {
    this.currentExercise = exercise;
    this.detector = new ExerciseDetector(exercise);
    
    // Update UI
    document.querySelectorAll('.exercise-card').forEach(card => {
      (card as HTMLElement).classList.remove('active');
      if ((card as HTMLElement).dataset.exercise === exercise) {
        (card as HTMLElement).classList.add('active');
      }
    });
    
    const currentExerciseEl = document.getElementById('currentExercise');
    if (currentExerciseEl) {
      const names = {
        shoulder_press: 'Shoulder Press',
        lateral_raise: 'Lateral Raise',
        front_raise: 'Front Raise', 
        rear_delt_fly: 'Rear Delt Fly',
        bicep_curl: 'Bicep Curl'
      };
      currentExerciseEl.textContent = names[exercise];
    }
  }

  private completeSet() {
    const stepData = this.detector.step([], Date.now() / 1000);
    this.voiceCoach.onSetComplete(this.currentExercise, stepData.reps);
    this.detector.reset();
  }

  private toggleVoice() {
    const enabled = this.voiceCoach.toggle();
    const btn = document.getElementById('btnToggleVoice');
    if (btn) btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
  }

  private updateMetrics(stepData: any) {
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
      elements.vl.style.color = vlPercent > 25 ? '#ef4444' : vlPercent > 15 ? '#f59e0b' : '#22c55e';
    }
  }

  private drawPoseSkeleton(landmarks: any[], w: number, h: number) {
    // Draw skeleton
    const connections = [
      [11, 12], [11, 23], [12, 24], [23, 24], // torso
      [11, 13], [13, 15], [12, 14], [14, 16], // arms
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

    // Draw joints
    this.ctx.fillStyle = "rgba(255, 180, 0, 0.8)";
    landmarks.forEach((point: any) => {
      this.ctx.beginPath();
      this.ctx.arc(point.x * w, point.y * h, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private highlightActiveJoints(landmarks: any[], w: number, h: number) {
    const jointMappings = {
      shoulder_press: [12, 14, 16],
      lateral_raise: [12, 14],
      front_raise: [12, 14],
      rear_delt_fly: [12, 14],
      bicep_curl: [12, 14, 16]
    };
    
    const joints = jointMappings[this.currentExercise];
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

  private drawNoPersonMessage() {
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

  private updateUI(state: 'running' | 'stopped' = 'stopped') {
    const startBtn = document.getElementById('btnStart') as HTMLButtonElement;
    const stopBtn = document.getElementById('btnStop') as HTMLButtonElement;
    
    if (startBtn) startBtn.disabled = state === 'running';
    if (stopBtn) stopBtn.disabled = state !== 'running';
  }

  stop() {
    this.running = false;
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = undefined;
    }
    
    this.landmarker = undefined;
    this.voiceCoach.clearQueue();
    this.updateUI('stopped');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new VelocityCoachAI();
  (window as any).velocityCoachAI = app;
  console.log('🚀 VelocityCoach AI - Clean Version Initialized');
});