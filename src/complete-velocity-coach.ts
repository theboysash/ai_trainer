// src/complete-velocity-coach.ts - Fixed Complete Hackathon Integration
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { FitnessDatabase, createDatabaseConfig, WorkoutSession, SetData } from './fitnessDatabase';
import { EnhancedExerciseDetector, ExerciseType, getExerciseConfig, ENHANCED_EXERCISE_CONFIGS } from './enhancedExerciseSystem';
import { ImprovedVoiceAgent } from './improvedVoiceAgent';
import { EnhancedVisualDashboard } from './enhancedVisualDashboard';
import { SmartProgressTracker } from './smartProgressTracker';
import { VisualInsightSystem } from './visualInsights';

// VAPI Integration with proper error handling
interface VAPIInstance {
  start(assistantId: string): Promise<void>;
  stop(): void;
  send(message: any): Promise<void>;
  on(event: string, callback: (data: any) => void): void;
}

// VAPI Integration for Real-time Voice Coaching
class VAPIVoiceCoach {
  private vapi: VAPIInstance | null = null;
  private isConnected = false;
  private assistantId = 'ad349484-eed2-4192-b7e4-caa6cb6f31d0';
  private publicKey = '7a381b28-b330-47c8-8c24-ed48b4a477d5';

  constructor() {
    this.initializeVAPI();
  }

  async initializeVAPI() {
    try {
      // Dynamic import for VAPI with proper error handling
      const VapiModule = await import('@vapi-ai/web');
      const Vapi = VapiModule.default || VapiModule;
      this.vapi = new Vapi(this.publicKey) as unknown as VAPIInstance;
      this.setupEventHandlers();
      console.log('🎙️ VAPI Voice Coach initialized');
    } catch (error) {
      console.warn('VAPI not available, falling back to basic voice', error);
      this.vapi = null;
    }
  }

  private setupEventHandlers() {
    if (!this.vapi) return;

    this.vapi.on('call-start', () => {
      this.isConnected = true;
      console.log('🎙️ Voice chat started');
    });

    this.vapi.on('call-end', () => {
      this.isConnected = false;
      console.log('🎙️ Voice chat ended');
    });

    this.vapi.on('message', (msg: any) => {
      if (msg?.type === 'transcript') {
        console.log(`AI Coach: ${msg.transcript}`);
      }
    });

    this.vapi.on('error', (error: any) => {
      console.error('VAPI Error:', error);
    });
  }

  async startVoiceChat(): Promise<boolean> {
    if (!this.vapi) return false;
    
    try {
      await this.vapi.start(this.assistantId);
      return true;
    } catch (error) {
      console.error('Failed to start voice chat:', error);
      return false;
    }
  }

  async stopVoiceChat() {
    if (this.vapi && this.isConnected) {
      this.vapi.stop();
    }
  }

  async sendCoachingSignal(signal: 'fatigue_detected' | 'form_flag' | 'reps_left', data?: any) {
    if (!this.vapi || !this.isConnected) return;

    try {
      await this.vapi.send({
        type: 'add-message',
        message: {
          role: 'user',
          content: `COACH_SIGNAL: ${signal} | ${JSON.stringify(data || {})}`
        }
      });
    } catch (error) {
      console.error('Failed to send coaching signal:', error);
    }
  }

  isActive(): boolean {
    return this.isConnected;
  }
}

// Enhanced exercise detector with form score
class EnhancedExerciseDetectorWithFormScore {
  private reps = 0;
  private state: 'idle' | 'moving' | 'top' | 'bottom' = 'idle';
  private lastAngle = 0;
  private lastTime = 0;
  private velocityHistory: number[] = [];
  private baseline: number | null = null;
  private formScore = 100;
  
  constructor(private exerciseType: ExerciseType) {}
  
  step(landmarks: any[], timestamp: number) {
    const angle = this.calculateAngle(landmarks);
    if (angle === 0) return this.getDefaultResult();
    
    const velocity = this.lastTime > 0 ? (angle - this.lastAngle) / (timestamp - this.lastTime) : 0;
    
    if (Math.abs(velocity) > 5) {
      this.velocityHistory.push(Math.abs(velocity));
      if (this.velocityHistory.length > 15) this.velocityHistory.shift();
      
      if (!this.baseline && this.velocityHistory.length >= 3) {
        this.baseline = this.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
      }
    }
    
    const isNewRep = this.detectRep(angle);
    const velocityLoss = this.calculateVelocityLoss();
    this.formScore = this.calculateFormScore(angle, velocity);
    
    this.lastAngle = angle;
    this.lastTime = timestamp;
    
    return {
      reps: this.reps,
      angle,
      velocity,
      state: this.state,
      isNewRep,
      velocityLoss,
      formScore: this.formScore,
      exercise: this.exerciseType
    };
  }
  
  private calculateAngle(landmarks: any[]): number {
    const jointMappings: Record<ExerciseType, number[]> = {
      shoulder_press: [12, 14, 16],
      lateral_raise: [12, 14],
      front_raise: [12, 14],
      rear_delt_fly: [12, 14],
      bicep_curl: [12, 14, 16],
      tricep_extension: [12, 14, 16],
      chest_press: [12, 14, 16],
      push_ups: [12, 14, 16],
      rows: [12, 14, 16],
      squats: [24, 26, 28]
    };
    
    const joints = jointMappings[this.exerciseType] || [12, 14, 16];
    
    if (joints.length === 2) {
      const shoulder = landmarks[joints[0]];
      const elbow = landmarks[joints[1]];
      if (!shoulder || !elbow || shoulder.visibility < 0.5 || elbow.visibility < 0.5) return 0;
      
      const armVector = [elbow.x - shoulder.x, elbow.y - shoulder.y];
      let angle = Math.atan2(-armVector[1], Math.abs(armVector[0])) * (180 / Math.PI);
      return Math.max(0, Math.min(90, angle));
    } else {
      const [j1, j2, j3] = joints.map(i => landmarks[i]);
      if (!j1 || !j2 || !j3 || j1.visibility < 0.5 || j2.visibility < 0.5 || j3.visibility < 0.5) return 0;
      
      const v1 = [j1.x - j2.x, j1.y - j2.y];
      const v2 = [j3.x - j2.x, j3.y - j2.y];
      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2);
      const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2);
      
      if (mag1 === 0 || mag2 === 0) return 0;
      return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
    }
  }
  
  private detectRep(angle: number): boolean {
    const thresholds: Record<ExerciseType, { start: number; end: number; isReversed: boolean }> = {
      shoulder_press: { start: 90, end: 160, isReversed: false },
      lateral_raise: { start: 15, end: 75, isReversed: false },
      front_raise: { start: 15, end: 75, isReversed: false },
      rear_delt_fly: { start: 20, end: 70, isReversed: false },
      bicep_curl: { start: 155, end: 40, isReversed: true },
      tricep_extension: { start: 45, end: 160, isReversed: false },
      chest_press: { start: 90, end: 170, isReversed: false },
      push_ups: { start: 70, end: 160, isReversed: false },
      rows: { start: 160, end: 80, isReversed: true },
      squats: { start: 170, end: 90, isReversed: true }
    };
    
    const config = thresholds[this.exerciseType] || { start: 90, end: 160, isReversed: false };
    const { start, end, isReversed } = config;
    let isNewRep = false;
    
    switch (this.state) {
      case 'idle':
        if (isReversed ? angle <= start : angle >= start) {
          this.state = 'moving';
        }
        break;
      case 'moving':
        if (isReversed ? angle <= end : angle >= end) {
          this.state = 'top';
        }
        break;
      case 'top':
        if (isReversed ? angle > end + 10 : angle < end - 10) {
          this.state = 'bottom';
        }
        break;
      case 'bottom':
        if (isReversed ? angle >= start : angle <= start) {
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
    if (Math.abs(velocity) > 200) score -= 25;
    else if (Math.abs(velocity) > 150) score -= 15;
    return Math.max(0, Math.min(100, score));
  }
  
  private getDefaultResult() {
    return {
      reps: this.reps, angle: 0, velocity: 0, state: this.state,
      isNewRep: false, velocityLoss: 0, formScore: this.formScore, exercise: this.exerciseType
    };
  }
  
  reset() {
    this.reps = 0;
    this.state = 'idle';
    this.velocityHistory = [];
    this.baseline = null;
    this.formScore = 100;
  }
  
  getStats() {
    return {
      reps: this.reps,
      velocityLoss: this.calculateVelocityLoss(),
      avgVelocity: this.velocityHistory.length ? 
        this.velocityHistory.reduce((a, b) => a + b) / this.velocityHistory.length : 0,
      peakVelocity: this.velocityHistory.length ? Math.max(...this.velocityHistory) : 0,
      formScore: this.formScore // FIXED: Added formScore to getStats
    };
  }
}

// Complete VelocityCoach AI System - FIXED with proper initialization
export class CompleteVelocityCoachAI {
  // Core MediaPipe components
  private landmarker?: PoseLandmarker;
  private video!: HTMLVideoElement; // FIXED: Definite assignment assertion
  private canvas!: HTMLCanvasElement; // FIXED: Definite assignment assertion
  private ctx!: CanvasRenderingContext2D; // FIXED: Definite assignment assertion
  private stream?: MediaStream;
  private running = false;

  // Database & Storage
  private database!: FitnessDatabase; // FIXED: Definite assignment assertion
  private currentSession?: WorkoutSession;
  private currentUserId?: string;

  // Exercise & Training Systems
  private exerciseDetector!: EnhancedExerciseDetectorWithFormScore; // FIXED: Definite assignment assertion
  private progressTracker!: SmartProgressTracker; // FIXED: Definite assignment assertion
  private voiceAgent!: ImprovedVoiceAgent; // FIXED: Definite assignment assertion
  private vapiCoach!: VAPIVoiceCoach; // FIXED: Definite assignment assertion
  private insightSystem!: VisualInsightSystem; // FIXED: Definite assignment assertion
  private dashboard!: EnhancedVisualDashboard; // FIXED: Definite assignment assertion

  // State Management
  private currentExercise: ExerciseType = 'shoulder_press';
  private workoutState: 'idle' | 'active' | 'resting' | 'complete' = 'idle';
  private sessionStartTime: number = 0;
  private lastAnalysisTime = 0;

  // Performance Analytics
  private performanceMetrics = {
    totalReps: 0,
    avgFormScore: 0,
    peakVelocity: 0,
    totalVolume: 0,
    fatigueLevel: 0
  };

  constructor() {
    this.initializeCore();
    this.initializeSystems();
    this.setupEventHandlers();
  }

  private initializeCore() {
    this.video = document.getElementById("video") as HTMLVideoElement;
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;

    // Initialize database
    const dbConfig = createDatabaseConfig();
    this.database = new FitnessDatabase(dbConfig.connectionString, dbConfig.databaseName);
  }

  private initializeSystems() {
    // Exercise detection
    this.exerciseDetector = new EnhancedExerciseDetectorWithFormScore(this.currentExercise);
    
    // Progress tracking
    this.progressTracker = new SmartProgressTracker();
    
    // Voice coaching systems
    this.voiceAgent = new ImprovedVoiceAgent();
    this.vapiCoach = new VAPIVoiceCoach();
    
    // Visual insights
    this.insightSystem = new VisualInsightSystem();
    
    // Enhanced dashboard
    this.dashboard = new EnhancedVisualDashboard();
  }

  private setupEventHandlers() {
    // Control buttons
    document.getElementById('btnStart')?.addEventListener('click', () => this.startWorkout());
    document.getElementById('btnStop')?.addEventListener('click', () => this.stopWorkout());
    document.getElementById('btnCompleteSet')?.addEventListener('click', () => this.completeSet());
    document.getElementById('btnSkipExercise')?.addEventListener('click', () => this.skipExercise());
    document.getElementById('btnToggleVoice')?.addEventListener('click', () => this.toggleVoiceCoaching());
    document.getElementById('btnResetWorkout')?.addEventListener('click', () => this.resetWorkout());

    // Exercise selection
    document.querySelectorAll('.exercise-card').forEach(card => {
      card.addEventListener('click', () => {
        const exerciseType = (card as HTMLElement).dataset.exercise as ExerciseType;
        if (this.running && exerciseType) {
          this.switchExercise(exerciseType);
        }
      });
    });

    // Voice controls
    document.getElementById('voiceToggle')?.addEventListener('click', () => this.toggleVAPIChat());
    document.getElementById('intensitySelect')?.addEventListener('change', (e) => {
      const intensity = (e.target as HTMLSelectElement).value as 'light' | 'moderate' | 'intense';
      this.voiceAgent.updateIntensity(intensity);
    });

    // Keyboard shortcuts for hackathon demo
    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case ' ': // Spacebar - Start/Stop
          e.preventDefault();
          this.running ? this.stopWorkout() : this.startWorkout();
          break;
        case 'c': // C - Complete set
          if (this.running) this.completeSet();
          break;
        case 'v': // V - Toggle voice
          this.toggleVoiceCoaching();
          break;
        case 'r': // R - Reset
          this.resetWorkout();
          break;
      }
    });
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing VelocityCoach AI...');
      
      // Initialize MediaPipe
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
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

      // Connect to database (optional for hackathon)
      try {
        const dbConnected = await this.database.connect();
        if (dbConnected) {
          console.log('📊 Database connected');
          await this.createDemoUser();
        }
      } catch (error) {
        console.log('📊 Database not available, continuing in offline mode');
      }

      // Initialize voice systems
      await this.vapiCoach.initializeVAPI();

      console.log('✅ VelocityCoach AI initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      return false;
    }
  }

  private async createDemoUser() {
    try {
      const demoUser = await this.database.createUser({
        name: 'VelocityCoach Demo User',
        age: 28,
        weight: 75,
        height: 180,
        training_experience: 'intermediate'
      });
      this.currentUserId = demoUser._id!.toString();
      console.log('👤 Demo user created:', demoUser.name);
    } catch (error) {
      console.warn('User creation failed, using offline mode');
    }
  }

  async startWorkout(): Promise<void> {
    try {
      // Get camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user", 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      this.video.srcObject = this.stream;
      await this.video.play();

      // Start database session
      if (this.currentUserId) {
        try {
          this.currentSession = await this.database.startSession(
            this.currentUserId as any, 
            'VelocityCoach AI Session'
          );
          console.log('📊 Database session started');
        } catch (error) {
          console.warn('Database session failed, continuing offline');
        }
      }

      this.running = true;
      this.workoutState = 'active';
      this.sessionStartTime = Date.now();
      
      // Start systems
      this.voiceAgent.onExerciseStart(this.currentExercise);
      this.updateUI('running');
      
      // Start main loop
      this.mainLoop();
      
      console.log('🏋️ Workout started');

    } catch (error) {
      console.error('Failed to start workout:', error);
      alert('Camera access required. Please allow camera access and try again.');
    }
  }

  private mainLoop(): void {
    if (!this.running || !this.landmarker) return;

    const w = this.video.videoWidth || 1920;
    const h = this.video.videoHeight || 1080;
    this.canvas.width = w;
    this.canvas.height = h;

    const nowMs = performance.now();
    const result = this.landmarker.detectForVideo(this.video, nowMs);

    // Clear and draw video
    this.ctx.clearRect(0, 0, w, h);
    try {
      this.ctx.drawImage(this.video, 0, 0, w, h);
    } catch (e) {
      // Video not ready yet
    }

    if (result.landmarks && result.landmarks[0]) {
      const landmarks = result.landmarks[0];
      
      // Draw enhanced pose visualization
      this.drawEnhancedPose(landmarks, w, h);
      
      // Process exercise with advanced detection
      const stepData = this.exerciseDetector.step(landmarks, nowMs / 1000);
      
      // Enhanced analysis (throttled to prevent overload)
      if (nowMs - this.lastAnalysisTime > 100) { // 10 FPS analysis
        this.performAdvancedAnalysis(stepData);
        this.lastAnalysisTime = nowMs;
      }
      
      // Update all systems
      this.updateMetrics(stepData);
      this.dashboard.updateDashboard(stepData);
      
    } else {
      this.drawNoPersonDetected();
    }

    if (this.running) {
      requestAnimationFrame(() => this.mainLoop());
    }
  }

  private performAdvancedAnalysis(stepData: any): void {
    // Voice coaching analysis
    this.voiceAgent.analyzeWorkoutStep({
      ...stepData,
      exercise: this.currentExercise,
      isResting: this.workoutState === 'resting',
      targetReps: this.progressTracker.getCurrentExerciseProgress()?.targetReps || 8
    });

    // Visual insights
    const insights = this.insightSystem.update(stepData);
    
    // VAPI coaching signals
    if (this.vapiCoach.isActive()) {
      // Send fatigue signals
      if (stepData.velocityLoss > 0.25) {
        this.vapiCoach.sendCoachingSignal('fatigue_detected', {
          velocityLoss: stepData.velocityLoss,
          reps: stepData.reps
        });
      }
      
      // Send form warnings
      if (stepData.formScore < 60) {
        this.vapiCoach.sendCoachingSignal('form_flag', {
          formScore: stepData.formScore,
          exercise: this.currentExercise
        });
      }
      
      // Send reps remaining
      const progress = this.progressTracker.getCurrentExerciseProgress();
      if (progress && stepData.reps > 0) {
        const remaining = progress.targetReps - stepData.reps;
        if (remaining > 0 && remaining <= 3) {
          this.vapiCoach.sendCoachingSignal('reps_left', { remaining });
        }
      }
    }

    // Update performance metrics
    this.updatePerformanceMetrics(stepData);
    
    // Check for set completion
    if (stepData.isNewRep) {
      this.checkAutoSetCompletion(stepData);
    }
  }

  private drawEnhancedPose(landmarks: any[], w: number, h: number): void {
    // Draw comprehensive skeleton
    const connections = [
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Arms
      [11, 13], [13, 15], [12, 14], [14, 16],
      // Legs  
      [23, 25], [25, 27], [24, 26], [26, 28],
      // Additional connections for better visualization
      [15, 17], [15, 19], [16, 18], [16, 20], // Hands
      [27, 29], [29, 31], [28, 30], [30, 32], // Feet
    ];

    // Draw skeleton with gradient
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = "rgba(80, 215, 255, 0.9)";
    this.ctx.beginPath();
    
    connections.forEach(([a, b]) => {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (pa && pb && pa.visibility > 0.3 && pb.visibility > 0.3) {
        this.ctx.moveTo(pa.x * w, pa.y * h);
        this.ctx.lineTo(pb.x * w, pb.y * h);
      }
    });
    this.ctx.stroke();

    // Highlight active exercise joints
    this.highlightExerciseJoints(landmarks, w, h);

    // Draw enhanced joint markers
    landmarks.forEach((point: any, index: number) => {
      if (point.visibility > 0.5) {
        const isActiveJoint = this.getActiveJoints().includes(index);
        
        this.ctx.beginPath();
        this.ctx.arc(point.x * w, point.y * h, isActiveJoint ? 6 : 3, 0, Math.PI * 2);
        this.ctx.fillStyle = isActiveJoint ? "rgba(245, 158, 11, 1)" : "rgba(34, 197, 94, 0.8)";
        this.ctx.fill();
        
        if (isActiveJoint) {
          // Add glow effect for active joints
          this.ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
          this.ctx.shadowBlur = 10;
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        }
      }
    });
  }

  private highlightExerciseJoints(landmarks: any[], w: number, h: number): void {
    const activeJoints = this.getActiveJoints();
    
    this.ctx.strokeStyle = "rgba(245, 158, 11, 1)";
    this.ctx.lineWidth = 8;
    this.ctx.beginPath();
    
    for (let i = 0; i < activeJoints.length - 1; i++) {
      const p1 = landmarks[activeJoints[i]];
      const p2 = landmarks[activeJoints[i + 1]];
      if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
        this.ctx.moveTo(p1.x * w, p1.y * h);
        this.ctx.lineTo(p2.x * w, p2.y * h);
      }
    }
    this.ctx.stroke();
  }

  private getActiveJoints(): number[] {
    const jointMappings: Record<ExerciseType, number[]> = {
      shoulder_press: [12, 14, 16],
      lateral_raise: [12, 14],
      front_raise: [12, 14],
      rear_delt_fly: [12, 14],
      bicep_curl: [12, 14, 16],
      tricep_extension: [12, 14, 16],
      chest_press: [12, 14, 16],
      push_ups: [12, 14, 16],
      rows: [12, 14, 16],
      squats: [24, 26, 28]
    };
    return jointMappings[this.currentExercise] || [];
  }

  private drawNoPersonDetected(): void {
    this.ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
    this.ctx.font = "32px system-ui";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "Position yourself in frame",
      this.canvas.width / 2,
      this.canvas.height / 2 - 20
    );
    this.ctx.font = "18px system-ui";
    this.ctx.fillStyle = "rgba(156, 163, 175, 0.8)";
    this.ctx.fillText(
      "Ensure good lighting and full body visibility",
      this.canvas.width / 2,
      this.canvas.height / 2 + 20
    );
    this.ctx.textAlign = "left";
  }

  private updatePerformanceMetrics(stepData: any): void {
    if (stepData.isNewRep) {
      this.performanceMetrics.totalReps++;
    }
    
    this.performanceMetrics.avgFormScore = 
      (this.performanceMetrics.avgFormScore * 0.9) + (stepData.formScore * 0.1);
    
    if (stepData.velocity > this.performanceMetrics.peakVelocity) {
      this.performanceMetrics.peakVelocity = stepData.velocity;
    }
    
    this.performanceMetrics.fatigueLevel = stepData.velocityLoss;
  }

  private checkAutoSetCompletion(stepData: any): void {
    const progress = this.progressTracker.getCurrentExerciseProgress();
    if (!progress) return;

    // Auto-complete set based on target reps or fatigue
    const shouldAutoComplete = 
      stepData.reps >= progress.targetReps || 
      stepData.velocityLoss > 0.4 || // Critical fatigue
      stepData.formScore < 40; // Critical form breakdown

    if (shouldAutoComplete) {
      setTimeout(() => this.completeSet(), 1000); // Slight delay for user awareness
    }
  }

  switchExercise(exerciseType: ExerciseType): void {
    if (this.currentExercise === exerciseType) return;

    this.currentExercise = exerciseType;
    this.exerciseDetector = new EnhancedExerciseDetectorWithFormScore(exerciseType);
    
    // Update progress tracker
    this.progressTracker.switchToExercise(exerciseType);
    
    // Update UI
    this.updateExerciseUI();
    
    // Notify voice systems
    this.voiceAgent.onExerciseStart(exerciseType);
    this.dashboard.onExerciseSwitch(exerciseType);
    
    console.log(`🔄 Switched to ${exerciseType}`);
  }

  async completeSet(): Promise<void> {
    const exerciseStats = this.exerciseDetector.getStats();
    const progress = this.progressTracker.getCurrentExerciseProgress();
    
    if (!progress) return;

    // Create set data
    const setData: SetData = {
      exercise: this.currentExercise,
      setNumber: progress.currentSet,
      reps: exerciseStats.reps,
      startTime: Date.now() - 30000, // Approximate
      endTime: Date.now(),
      avgVelocity: exerciseStats.avgVelocity,
      peakVelocity: exerciseStats.peakVelocity,
      velocityLoss: exerciseStats.velocityLoss,
      formScore: exerciseStats.formScore
    };

    // Save to database
    if (this.currentSession) {
      try {
        await this.saveSetToDatabase(setData);
      } catch (error) {
        console.warn('Failed to save set to database:', error);
      }
    }

    // Update progress
    this.progressTracker.completeSet(this.currentExercise, setData);
    
    // Notify systems
    this.voiceAgent.onSetComplete(this.currentExercise, setData);
    this.dashboard.onSetComplete(this.currentExercise, setData);
    
    // Reset detector for next set
    this.exerciseDetector.reset();
    
    // Check if exercise is complete
    if (progress.completedSets.length + 1 >= progress.targetSets) {
      this.onExerciseComplete();
    } else {
      // Start rest period
      this.startRestPeriod();
    }

    console.log(`✅ Set completed: ${exerciseStats.reps} reps`);
  }

  private async saveSetToDatabase(setData: SetData): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Add session exercise if not exists
      const sessionExercise = await this.database.addSessionExercise(
        this.currentSession._id!,
        this.currentExercise,
        4, // Target sets
        8  // Target reps
      );

      // Save the set
      await this.database.addSet({
        session_exercise_id: sessionExercise._id!,
        set_number: setData.setNumber,
        weight: 0, // Could be input by user
        reps: setData.reps,
        avg_velocity_set: setData.avgVelocity,
        velocity_loss_pct: setData.velocityLoss * 100,
        stop_reason: 'completed',
        form_score: setData.formScore,
        started_at: new Date(setData.startTime),
        completed_at: new Date(setData.endTime)
      });

    } catch (error) {
      console.error('Database save failed:', error);
    }
  }

  private startRestPeriod(): void {
    this.workoutState = 'resting';
    this.dashboard.onRestStart();
    
    // Rest timer would go here
    setTimeout(() => {
      if (this.workoutState === 'resting') {
        this.workoutState = 'active';
      }
    }, 60000); // 1 minute rest
  }

  private onExerciseComplete(): void {
    this.voiceAgent.onExerciseComplete(this.currentExercise);
    
    // Auto-advance to next exercise
    this.autoAdvanceExercise();
  }

  private autoAdvanceExercise(): void {
    const allExercises: ExerciseType[] = [
      'shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly',
      'bicep_curl', 'tricep_extension', 'chest_press', 'push_ups', 'rows', 'squats'
    ];
    
    const currentIndex = allExercises.indexOf(this.currentExercise);
    
    // Find next incomplete exercise
    for (let i = currentIndex + 1; i < allExercises.length; i++) {
      const nextExercise = allExercises[i];
      const progress = this.progressTracker.getExerciseProgress(nextExercise);
      
      if (progress && !progress.isCompleted) {
        this.switchExercise(nextExercise);
        return;
      }
    }

    // All exercises complete
    this.onWorkoutComplete();
  }

  private onWorkoutComplete(): void {
    this.workoutState = 'complete';
    this.voiceAgent.onWorkoutComplete();
    
    // End database session
    if (this.currentSession) {
      this.database.endSession(this.currentSession._id!);
    }
    
    console.log('🎉 Workout completed!');
  }

  skipExercise(): void {
    this.autoAdvanceExercise();
  }

  toggleVoiceCoaching(): boolean {
    const enabled = this.voiceAgent.toggle();
    this.updateVoiceUI(enabled);
    return enabled;
  }

  async toggleVAPIChat(): Promise<void> {
    if (this.vapiCoach.isActive()) {
      await this.vapiCoach.stopVoiceChat();
    } else {
      const started = await this.vapiCoach.startVoiceChat();
      if (started) {
        console.log('🎙️ VAPI voice chat started');
      }
    }
  }

  resetWorkout(): void {
    // Reset all systems
    this.progressTracker.reset();
    this.exerciseDetector.reset();
    this.insightSystem.reset();
    this.dashboard.reset();
    
    // Reset to first exercise
    this.currentExercise = 'shoulder_press';
    this.exerciseDetector = new EnhancedExerciseDetectorWithFormScore(this.currentExercise);
    
    // Reset metrics
    this.performanceMetrics = {
      totalReps: 0,
      avgFormScore: 0,
      peakVelocity: 0,
      totalVolume: 0,
      fatigueLevel: 0
    };

    this.updateExerciseUI();
    console.log('🔄 Workout reset');
  }

  async stopWorkout(): Promise<void> {
    this.running = false;
    this.workoutState = 'idle';
    
    // Stop camera
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = undefined;
    }
    
    // Stop voice systems
    this.voiceAgent.clearQueue();
    await this.vapiCoach.stopVoiceChat();
    
    // End database session
    if (this.currentSession) {
      await this.database.endSession(this.currentSession._id!);
    }
    
    this.updateUI('stopped');
    console.log('🛑 Workout stopped');
  }

  // UI Update Methods
  private updateMetrics(stepData: any): void {
    const repCountEl = document.getElementById('repCount');
    const metricAngleEl = document.getElementById('metricAngle');
    const metricVelocityEl = document.getElementById('metricVelocity');
    const metricFormEl = document.getElementById('metricForm');
    const metricVLEl = document.getElementById('metricVL');

    if (repCountEl) repCountEl.textContent = stepData.reps.toString();
    if (metricAngleEl) metricAngleEl.textContent = `${Math.round(stepData.angle)}°`;
    if (metricVelocityEl) {
      metricVelocityEl.textContent = stepData.velocity !== 0 ? `${Math.round(stepData.velocity)}°/s` : '—';
    }
    if (metricFormEl) metricFormEl.textContent = Math.round(stepData.formScore).toString();
    
    if (metricVLEl) {
      const vlPercent = Math.round(stepData.velocityLoss * 100);
      metricVLEl.textContent = `${vlPercent}%`;
    }
  }

  private updateExerciseUI(): void {
    const progress = this.progressTracker.getCurrentExerciseProgress();
    
    // Update current exercise display
    const currentExerciseNameEl = document.getElementById('currentExerciseName');
    const currentSetInfoEl = document.getElementById('currentSetInfo');
    
    if (currentExerciseNameEl) {
      const exerciseNames: Record<ExerciseType, string> = {
        shoulder_press: 'Shoulder Press',
        lateral_raise: 'Lateral Raise',
        front_raise: 'Front Raise',
        rear_delt_fly: 'Rear Delt Fly',
        bicep_curl: 'Bicep Curl',
        tricep_extension: 'Tricep Extension',
        chest_press: 'Chest Press',
        push_ups: 'Push-ups',
        rows: 'Rows',
        squats: 'Squats'
      };
      currentExerciseNameEl.textContent = exerciseNames[this.currentExercise];
    }
    
    if (currentSetInfoEl && progress) {
      currentSetInfoEl.textContent = 
        `Set ${progress.currentSet} of ${progress.targetSets} • Target: ${progress.targetReps} reps`;
    }

    // Update exercise cards
    document.querySelectorAll('.exercise-card').forEach(card => {
      const cardElement = card as HTMLElement;
      cardElement.classList.remove('active');
      if (cardElement.dataset.exercise === this.currentExercise) {
        cardElement.classList.add('active');
      }
    });
  }

  private updateVoiceUI(enabled: boolean): void {
    const btn = document.getElementById('btnToggleVoice');
    if (btn) btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
  }

  private updateUI(state: 'running' | 'stopped'): void {
    const startBtn = document.getElementById('btnStart') as HTMLButtonElement;
    const stopBtn = document.getElementById('btnStop') as HTMLButtonElement;
    
    if (startBtn) startBtn.disabled = state === 'running';
    if (stopBtn) stopBtn.disabled = state !== 'running';
  }

  // Public getters for hackathon demos
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      currentExercise: this.currentExercise,
      workoutState: this.workoutState,
      isVoiceActive: this.vapiCoach.isActive()
    };
  }

  getWorkoutStats() {
    return this.progressTracker.getWorkoutStats();
  }

  getCurrentExerciseConfig() {
    return {
      name: this.currentExercise,
      type: this.currentExercise
    };
  }

  // Cleanup
  async destroy(): Promise<void> {
    await this.stopWorkout();
    await this.database.disconnect();
    console.log('🧹 VelocityCoach AI cleaned up');
  }
}

// Initialize and export for global access
export async function initializeVelocityCoachAI(): Promise<CompleteVelocityCoachAI> {
  const app = new CompleteVelocityCoachAI();
  
  // Show loading
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }

  // Initialize
  const success = await app.initialize();
  
  // Hide loading
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }

  if (success) {
    console.log('🚀 VelocityCoach AI - Complete Hackathon Version Ready!');
    
    // Add global access for hackathon demos
    (window as any).velocityCoachAI = app;
    
    // Demo keyboard shortcuts info
    console.log('⌨️ Keyboard Shortcuts:');
    console.log('  Spacebar: Start/Stop workout');
    console.log('  C: Complete current set');
    console.log('  V: Toggle voice coaching');
    console.log('  R: Reset workout');
    
    return app;
  } else {
    throw new Error('Failed to initialize VelocityCoach AI');
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeVelocityCoachAI().catch(console.error);
});

export default CompleteVelocityCoachAI;