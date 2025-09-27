// src/completeVelocityCoachSystem.ts - Fixed implementation
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { ExerciseType, EnhancedExerciseDetector, getExerciseConfig, getAllExerciseTypes } from './enhancedExerciseSystem';
import { FitnessDatabase, createDatabaseConfig } from './fitnessDatabase';
import dotenv from 'dotenv';
dotenv.config();

// Kinematic calculations from your math images
class KinematicAnalyzer {
  // Three joints calculation for angle (from your notes)
  static calculateJointAngle(joint1: [number, number], joint2: [number, number], joint3: [number, number]): number {
    // Vector from joint2 to joint1
    const v1 = [joint1[0] - joint2[0], joint1[1] - joint2[1]];
    // Vector from joint2 to joint3  
    const v2 = [joint3[0] - joint2[0], joint3[1] - joint2[1]];
    
    // Dot product and magnitudes
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
    const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
    
    // Angle in radians then convert to degrees
    const angleRad = Math.acos(dot / (mag1 * mag2));
    return angleRad * (180 / Math.PI);
  }

  // Angular velocity calculation (from your bicep curl notes)
  static calculateAngularVelocity(currentAngle: number, previousAngle: number, deltaTime: number): number {
    // Convert degrees to radians per second
    const deltaAngleRad = (currentAngle - previousAngle) * (Math.PI / 180);
    return deltaAngleRad / deltaTime; // rad/sec
  }

  // Linear velocity from angular velocity (r × ω)
  static calculateLinearVelocity(angularVelocity: number, radiusOfRotation: number): number {
    return Math.abs(angularVelocity * radiusOfRotation); // m/s
  }

  // Calculate radius of rotation between joints
  static calculateRadius(shoulder: [number, number], elbow: [number, number], wrist: [number, number]): number {
    // Distance from elbow to wrist (forearm length)
    const dx = wrist[0] - elbow[0];
    const dy = wrist[1] - elbow[1]; 
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Movement classification based on your 3 categories
  static classifyMovement(exerciseType: ExerciseType): 'leg_movements' | 'upper_body_movements' | 'core_movements' {
    const classifications: Record<ExerciseType, 'leg_movements' | 'upper_body_movements' | 'core_movements'> = {
      squats: 'leg_movements',
      shoulder_press: 'upper_body_movements',
      lateral_raise: 'upper_body_movements', 
      front_raise: 'upper_body_movements',
      rear_delt_fly: 'upper_body_movements',
      chest_press: 'upper_body_movements',
      push_ups: 'upper_body_movements',
      bicep_curl: 'upper_body_movements',
      tricep_extension: 'upper_body_movements',
      rows: 'upper_body_movements'
    };
    return classifications[exerciseType] || 'upper_body_movements';
  }
}

// Enhanced Voice Agent with VBT Integration
class VBTEnhancedVoiceAgent {
  private synthesis: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private isEnabled: boolean = true;
  private messageQueue: any[] = [];
  private lastSpoken: number = 0;
  private readonly MIN_SPEAK_INTERVAL = 5000;

  // VBT thresholds from your research
  private intensityThresholds = {
    light: 0.20,    // 15-20% VL
    moderate: 0.25, // 20-25% VL  
    intense: 0.40   // 30-40% VL
  };
  
  private currentIntensity: 'light' | 'moderate' | 'intense' = 'moderate';
  private exerciseData = new Map<ExerciseType, any>();

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeVoice();
    this.startMessageProcessor();
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

  private startMessageProcessor() {
    setInterval(() => {
      if (this.messageQueue.length > 0 && Date.now() - this.lastSpoken > this.MIN_SPEAK_INTERVAL) {
        const message = this.messageQueue.shift();
        this.speakMessage(message);
      }
    }, 1000);
  }

  updateIntensity(intensity: 'light' | 'moderate' | 'intense'): void {
    this.currentIntensity = intensity;
    const thresholds = { light: '15-20%', moderate: '20-25%', intense: '30-40%' };
    
    this.queueMessage({
      message: `Training intensity set to ${intensity}. Target velocity loss: ${thresholds[intensity]}.`,
      priority: 'high'
    });
  }

  analyzeWorkoutStep(stepData: any): void {
    if (!this.exerciseData.has(stepData.exercise)) {
      this.exerciseData.set(stepData.exercise, {
        velocityHistory: [],
        baseline: null,
        lastWarning: 0
      });
    }

    const data = this.exerciseData.get(stepData.exercise);
    
    if (stepData.velocity !== 0) {
      this.trackVelocity(stepData.exercise, Math.abs(stepData.velocity));
    }
    
    if (stepData.state !== 'idle' && stepData.reps > 0) {
      this.checkVelocityLoss(stepData);
    }
    
    if (stepData.isNewRep) {
      this.handleNewRep(stepData);
    }
  }

  private trackVelocity(exercise: ExerciseType, velocity: number): void {
    const data = this.exerciseData.get(exercise);
    data.velocityHistory.push(velocity);
    
    if (!data.baseline && data.velocityHistory.length >= 3) {
      data.baseline = data.velocityHistory.slice(0, 3).reduce((a: number, b: number) => a + b) / 3;
    }
    
    if (data.velocityHistory.length > 15) {
      data.velocityHistory = data.velocityHistory.slice(-12);
    }
  }

  private checkVelocityLoss(stepData: any): void {
    const data = this.exerciseData.get(stepData.exercise);
    if (!data.baseline || data.velocityHistory.length < 4) return;
    
    const recent = data.velocityHistory.slice(-3);
    const currentAvg = recent.reduce((a: number, b: number) => a + b) / recent.length;
    const velocityLoss = (data.baseline - currentAvg) / data.baseline;
    
    const threshold = this.getVLThreshold(stepData.exercise);
    const now = Date.now();
    
    if (velocityLoss >= threshold && now - data.lastWarning > 10000) {
      const vlPercent = Math.round(velocityLoss * 100);
      const thresholdPercent = Math.round(threshold * 100);
      
      this.queueMessage({
        message: `Velocity loss at ${vlPercent}% has reached your ${thresholdPercent}% threshold. Consider ending this set.`,
        priority: 'high'
      });
      data.lastWarning = now;
    }
  }

  private getVLThreshold(exercise: ExerciseType): number {
    const baseThreshold = this.intensityThresholds[this.currentIntensity];
    const exerciseModifiers: Record<ExerciseType, number> = {
      shoulder_press: 1.0,
      lateral_raise: 0.85,
      front_raise: 0.85,
      rear_delt_fly: 0.75,
      chest_press: 1.0,
      push_ups: 0.9,
      bicep_curl: 0.9,
      tricep_extension: 0.85,
      rows: 0.95,
      squats: 1.1
    };
    return baseThreshold * (exerciseModifiers[exercise] || 1.0);
  }

  private handleNewRep(stepData: any): void {
    if (stepData.reps % 4 === 0) {
      this.queueMessage({
        message: `${stepData.reps} reps completed. Stay focused on form.`,
        priority: 'low'
      });
    }
  }

  onSetComplete(exercise: ExerciseType, setData: any): void {
    const config = getExerciseConfig(exercise);
    this.queueMessage({
      message: `${config.name} set complete. ${setData.reps} reps. Great work.`,
      priority: 'medium'
    });
  }

  // Made public to fix the access error
  public queueMessage(message: any): void {
    if (this.messageQueue.some(m => m.message === message.message)) return;
    
    this.messageQueue.push(message);
    if (this.messageQueue.length > 4) {
      this.messageQueue = this.messageQueue.slice(-4);
    }
  }

  private speakMessage(message: any): void {
    if (!this.isEnabled || !this.voice) return;
    
    const utterance = new SpeechSynthesisUtterance(message.message);
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

  clearQueue(): void {
    this.messageQueue = [];
    this.synthesis.cancel();
  }
}

// Main VelocityCoach Application with Database Integration
export class VelocityCoachAI {
  private landmarker?: PoseLandmarker;
  private voiceAgent = new VBTEnhancedVoiceAgent();
  private database?: FitnessDatabase;
  
  private exerciseDetectors = new Map<ExerciseType, EnhancedExerciseDetector>();
  private currentExercise: ExerciseType = 'shoulder_press';
  
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream?: MediaStream;
  private running = false;

  // Session tracking
  private currentSession?: any;
  private currentUser?: any;
  private sessionStartTime = 0;
  private totalSetsCompleted = 0;
  private totalRepsCompleted = 0;

  // Exercise progression
  private exerciseProgress = new Map<ExerciseType, any>();
  private exerciseState = new Map<ExerciseType, any>();

  constructor() {
    this.video = document.getElementById("video") as HTMLVideoElement;
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
    this.initializeDatabase();
    this.initializeExercises();
    this.setupEventHandlers();
    this.createUI();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const config = createDatabaseConfig();
      this.database = new FitnessDatabase(config.connectionString, config.databaseName);
      
      const connected = await this.database.connect();
      if (connected) {
        console.log('Database connected successfully');
        await this.createDemoUser();
      } else {
        console.warn('Database connection failed, continuing without persistence');
      }
    } catch (error) {
      console.warn('Database initialization failed:', error);
    }
  }

  private async createDemoUser(): Promise<void> {
    if (!this.database) return;
    
    try {
      this.currentUser = await this.database.createUser({
        name: 'VelocityCoach User',
        age: 25,
        weight: 70,
        height: 175,
        training_experience: 'intermediate'
      });
      console.log('Demo user created:', this.currentUser.name);
    } catch (error) {
      console.warn('Demo user creation failed:', error);
    }
  }

  private initializeExercises(): void {
    const exercises = getAllExerciseTypes();
    
    exercises.forEach(exercise => {
      const config = getExerciseConfig(exercise);
      this.exerciseDetectors.set(exercise, new EnhancedExerciseDetector(config));
      
      this.exerciseProgress.set(exercise, {
        currentSet: 1,
        completedSets: [],
        isCompleted: false,
        targetSets: this.getTargetSets(exercise),
        targetReps: this.getTargetReps(exercise)
      });
      
      this.exerciseState.set(exercise, {
        reps: 0,
        angle: 0,
        velocity: 0,
        state: 'idle',
        lastAngle: 0,
        lastTime: 0,
        velocityHistory: []
      });
    });
  }

  private getTargetSets(exercise: ExerciseType): number {
    const targets: Record<ExerciseType, number> = {
      shoulder_press: 4, lateral_raise: 3, front_raise: 3, rear_delt_fly: 3,
      chest_press: 4, push_ups: 3, bicep_curl: 3, tricep_extension: 3,
      rows: 4, squats: 4
    };
    return targets[exercise] || 3;
  }

  private getTargetReps(exercise: ExerciseType): number {
    const targets: Record<ExerciseType, number> = {
      shoulder_press: 8, lateral_raise: 12, front_raise: 12, rear_delt_fly: 15,
      chest_press: 8, push_ups: 10, bicep_curl: 10, tricep_extension: 12,
      rows: 10, squats: 12
    };
    return targets[exercise] || 10;
  }

  private createUI(): void {
    // Create exercise selection grid with all new exercises
    const exerciseGrid = document.getElementById('exerciseGrid');
    if (exerciseGrid) {
      exerciseGrid.innerHTML = '';
      
      const exercisesByGroup = {
        'Shoulders': ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'] as ExerciseType[],
        'Chest': ['chest_press', 'push_ups'] as ExerciseType[],
        'Arms': ['bicep_curl', 'tricep_extension'] as ExerciseType[],
        'Back': ['rows'] as ExerciseType[],
        'Legs': ['squats'] as ExerciseType[]
      };

      Object.entries(exercisesByGroup).forEach(([group, exercises]) => {
        const groupDiv = document.createElement('div');
        groupDiv.style.marginBottom = '20px';
        
        const groupTitle = document.createElement('h4');
        groupTitle.textContent = group;
        groupTitle.style.cssText = `
          color: #50d7ff;
          margin: 0 0 10px 0;
          font-size: 14px;
        `;
        groupDiv.appendChild(groupTitle);
        
        const exerciseContainer = document.createElement('div');
        exerciseContainer.style.cssText = `
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        `;
        
        exercises.forEach(exerciseType => {
          const config = getExerciseConfig(exerciseType);
          const card = this.createExerciseCard(config);
          exerciseContainer.appendChild(card);
        });
        
        groupDiv.appendChild(exerciseContainer);
        exerciseGrid.appendChild(groupDiv);
      });
    }

    // Create VBT intensity controls
    this.createVBTControls();
  }

  private createExerciseCard(config: any): HTMLElement {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.exercise = config.type;
    
    card.innerHTML = `
      <div class="exercise-name">${config.name}</div>
      <div class="exercise-meta">
        <span>Muscle: ${config.muscleGroup}</span>
        <span>Sets: ${this.getTargetSets(config.type)}</span>
      </div>
      <div class="exercise-progress">
        <div>Set 1 of ${this.getTargetSets(config.type)}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      this.switchExercise(config.type);
    });
    
    return card;
  }

  private createVBTControls(): void {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="background: #162031; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h4 style="color: #50d7ff; margin: 0 0 10px 0;">Velocity-Based Training</h4>
        <select id="vbtIntensitySelect" style="width: 100%; background: #1b2a3a; color: white; border: 1px solid #2d3b4e; padding: 8px; border-radius: 4px;">
          <option value="light">Light (15-20% VL)</option>
          <option value="moderate" selected>Moderate (20-25% VL)</option>
          <option value="intense">Intense (30-40% VL)</option>
        </select>
        <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
          Based on velocity-loss threshold research
        </div>
      </div>
    `;
    
    document.body.insertBefore(container, document.body.firstChild);
    
    const select = document.getElementById('vbtIntensitySelect') as HTMLSelectElement;
    if (select) {
      select.addEventListener('change', (e) => {
        const intensity = (e.target as HTMLSelectElement).value as 'light' | 'moderate' | 'intense';
        this.voiceAgent.updateIntensity(intensity);
      });
    }
  }

  private setupEventHandlers(): void {
    // Fixed stop button handler
    const startBtn = document.getElementById('btnStart') as HTMLButtonElement;
    const stopBtn = document.getElementById('btnStop') as HTMLButtonElement;
    
    if (startBtn) {
      startBtn.addEventListener('click', () => this.start());
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stop());
    }

    // Voice toggle
    const voiceBtn = document.getElementById('btnToggleVoice');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => this.toggleVoice());
    }

    // Exercise selection
    document.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.exercise-card');
      if (card) {
        const exerciseType = (card as HTMLElement).dataset.exercise as ExerciseType;
        if (exerciseType && this.running) {
          this.switchExercise(exerciseType);
        }
      }
    });

    // Manual controls
    const skipRestBtn = document.getElementById('btnSkipRest');
    const completeSetBtn = document.getElementById('btnCompleteSet');
    const nextExerciseBtn = document.getElementById('btnNextExercise');
    
    if (skipRestBtn) skipRestBtn.addEventListener('click', () => this.skipRest());
    if (completeSetBtn) completeSetBtn.addEventListener('click', () => this.completeCurrentSet());
    if (nextExerciseBtn) nextExerciseBtn.addEventListener('click', () => this.nextExercise());
  }

  async start(): Promise<void> {
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
      this.sessionStartTime = Date.now();
      
      // Start database session
      if (this.database && this.currentUser) {
        this.currentSession = await this.database.startSession(this.currentUser._id);
      }
      
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

    this.ctx.clearRect(0, 0, w, h);
    
    try {
      this.ctx.drawImage(this.video, 0, 0, w, h);
    } catch {}

    if (result.landmarks && result.landmarks[0]) {
      const landmarks = result.landmarks[0];
      
      this.drawPoseSkeleton(landmarks, w, h);
      
      const stepData = this.processCurrentExercise(landmarks, nowMs / 1000);
      
      this.voiceAgent.analyzeWorkoutStep(stepData);
      this.updateMetrics(stepData);
      this.highlightActiveJoints(landmarks, w, h);
      
      // Auto-complete set when target reps reached
      if (stepData.reps >= this.getTargetReps(this.currentExercise)) {
        this.completeCurrentSet();
      }
      
    } else {
      this.drawNoPersonMessage();
    }

    if (this.running) {
      requestAnimationFrame(() => this.loop());
    }
  }

  private processCurrentExercise(landmarks: any[], timestamp: number): any {
    const detector = this.exerciseDetectors.get(this.currentExercise);
    
    if (!detector) {
      return this.getDefaultStepData();
    }

    try {
      const result = detector.step(landmarks, timestamp);
      
      // Enhanced with kinematic analysis
      const kinematicData = this.analyzeKinematics(landmarks, this.currentExercise);
      
      return {
        ...result,
        exercise: this.currentExercise,
        timestamp,
        formScore: this.calculateFormScore(result, landmarks),
        velocityLoss: this.getVelocityLoss(detector),
        targetReps: this.getTargetReps(this.currentExercise),
        kinematicData
      };
    } catch (error) {
      console.error(`Error processing ${this.currentExercise}:`, error);
      return this.getDefaultStepData();
    }
  }

  private analyzeKinematics(landmarks: any[], exercise: ExerciseType): any {
    const config = getExerciseConfig(exercise);
    const joints = config.landmarks.primary;
    
    if (joints.length < 3) return null;
    
    // Fixed tuple type assertion
    const joint1: [number, number] = [landmarks[joints[0]].x, landmarks[joints[0]].y];
    const joint2: [number, number] = [landmarks[joints[1]].x, landmarks[joints[1]].y];
    const joint3: [number, number] = [landmarks[joints[2]].x, landmarks[joints[2]].y];
    
    // Apply kinematic calculations from your math notes
    const angle = KinematicAnalyzer.calculateJointAngle(joint1, joint2, joint3);
    const radius = KinematicAnalyzer.calculateRadius(joint1, joint2, joint3);
    
    return {
      angle,
      radius,
      movementType: KinematicAnalyzer.classifyMovement(exercise)
    };
  }

  private completeCurrentSet(): void {
    const progress = this.exerciseProgress.get(this.currentExercise)!;
    const state = this.exerciseState.get(this.currentExercise)!;
    const detector = this.exerciseDetectors.get(this.currentExercise)!;
    
    const setData = {
      exercise: this.currentExercise,
      setNumber: progress.currentSet,
      reps: state.reps,
      startTime: this.sessionStartTime,
      endTime: Date.now() / 1000,
      avgVelocity: detector.getStats().avgVelocity,
      peakVelocity: detector.getStats().peakVelocity,
      velocityLoss: detector.getCurrentVelocityLoss(),
      formScore: 85 // Default form score
    };
    
    progress.completedSets.push(setData);
    this.totalSetsCompleted++;
    this.totalRepsCompleted += state.reps;
    
    // Save to database
    this.saveSetToDatabase(setData);
    
    // Reset for next set
    state.reps = 0;
    state.state = 'idle';
    detector.reset();
    
    this.voiceAgent.onSetComplete(this.currentExercise, setData);
    
    // Check if exercise is complete
    if (progress.completedSets.length >= progress.targetSets) {
      progress.isCompleted = true;
      this.autoAdvanceExercise();
    } else {
      progress.currentSet++;
    }
    
    this.updateUI();
  }

  private async saveSetToDatabase(setData: any): Promise<void> {
    if (!this.database || !this.currentSession) return;
    
    try {
      await this.database.addSet({
        session_exercise_id: this.currentSession._id,
        set_number: setData.setNumber,
        weight: 0, // Would need weight input UI
        reps: setData.reps,
        avg_velocity_set: setData.avgVelocity,
        velocity_loss_pct: setData.velocityLoss,
        stop_reason: 'completed',
        form_score: setData.formScore,
        started_at: new Date(setData.startTime * 1000),
        completed_at: new Date(setData.endTime * 1000)
      });
    } catch (error) {
      console.warn('Failed to save set to database:', error);
    }
  }

  private autoAdvanceExercise(): void {
    // Logic to advance to next exercise based on muscle groups
    const exercises = getAllExerciseTypes();
    const currentIndex = exercises.indexOf(this.currentExercise);
    
    for (let i = currentIndex + 1; i < exercises.length; i++) {
      const nextExercise = exercises[i];
      const progress = this.exerciseProgress.get(nextExercise)!;
      
      if (!progress.isCompleted) {
        this.switchExercise(nextExercise);
        return;
      }
    }
    
    this.completeWorkout();
  }

  private switchExercise(exercise: ExerciseType): void {
    this.currentExercise = exercise;
    
    const detector = this.exerciseDetectors.get(exercise);
    if (detector) {
      detector.reset();
    }
    
    this.updateUI();
  }

  private completeWorkout(): void {
    this.running = false;
    
    if (this.database && this.currentSession) {
      this.database.endSession(this.currentSession._id);
    }
    
    this.voiceAgent.queueMessage({
      message: 'Workout complete! Outstanding effort!',
      priority: 'high'
    });
  }

  stop(): void {
    console.log('Stop button clicked - stopping workout');
    this.running = false;
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped');
      });
      this.stream = undefined;
    }
    
    this.landmarker = undefined;
    this.voiceAgent.clearQueue();
    
    // End database session
    if (this.database && this.currentSession) {
      this.database.endSession(this.currentSession._id);
    }
    
    this.updateUI('stopped');
    console.log('Workout stopped successfully');
  }

  private skipRest(): void {
    // Skip rest implementation
  }

  private nextExercise(): void {
    const exercises = getAllExerciseTypes();
    const currentIndex = exercises.indexOf(this.currentExercise);
    
    if (currentIndex < exercises.length - 1) {
      this.switchExercise(exercises[currentIndex + 1]);
    }
  }

  private toggleVoice(): void {
    const enabled = this.voiceAgent.toggle();
    const btn = document.getElementById('btnToggleVoice');
    if (btn) {
      btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
    }
  }

  // UI Update methods
  private updateMetrics(stepData: any): void {
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
    if (elements.form) elements.form.textContent = Math.round(stepData.formScore || 0).toString();
    if (elements.vl) {
      const vlPercent = Math.round((stepData.velocityLoss || 0) * 100);
      elements.vl.textContent = `${vlPercent}%`;
      
      // Color coding
      if (vlPercent > 25) {
        elements.vl.style.color = '#ef4444';
      } else if (vlPercent > 15) {
        elements.vl.style.color = '#f59e0b';
      } else {
        elements.vl.style.color = '#22c55e';
      }
    }
  }

  private updateUI(state?: 'running' | 'stopped' | 'error'): void {
    // Update exercise cards
    document.querySelectorAll('.exercise-card').forEach(card => {
      card.classList.remove('active', 'completed');
      
      const exerciseType = (card as HTMLElement).dataset.exercise as ExerciseType;
      const progress = this.exerciseProgress.get(exerciseType);
      
      if (exerciseType === this.currentExercise) {
        card.classList.add('active');
      }
      
      if (progress?.isCompleted) {
        card.classList.add('completed');
      }
    });

    // Update button states
    const startBtn = document.getElementById('btnStart') as HTMLButtonElement;
    const stopBtn = document.getElementById('btnStop') as HTMLButtonElement;
    
    if (startBtn && stopBtn) {
      startBtn.disabled = this.running;
      stopBtn.disabled = !this.running;
    }

    // Update current exercise display
    const currentExerciseEl = document.getElementById('currentExercise');
    if (currentExerciseEl) {
      const config = getExerciseConfig(this.currentExercise);
      currentExerciseEl.textContent = config.name;
    }
  }

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
      if (pa && pb && (pa.visibility || 0) > 0.5 && (pb.visibility || 0) > 0.5) {
        this.ctx.moveTo(pa.x * w, pa.y * h);
        this.ctx.lineTo(pb.x * w, pb.y * h);
      }
    });
    this.ctx.stroke();

    this.ctx.fillStyle = "rgba(255, 180, 0, 0.8)";
    landmarks.forEach((point: any) => {
      if ((point.visibility || 0) > 0.5) {
        this.ctx.beginPath();
        this.ctx.arc(point.x * w, point.y * h, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  private highlightActiveJoints(landmarks: any[], w: number, h: number): void {
    const config = getExerciseConfig(this.currentExercise);
    const joints = config.landmarks.primary;
    
    this.ctx.strokeStyle = "rgba(50, 255, 170, 1)";
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    
    for (let i = 0; i < joints.length - 1; i++) {
      const p1 = landmarks[joints[i]];
      const p2 = landmarks[joints[i + 1]];
      if (p1 && p2 && (p1.visibility || 0) > 0.5 && (p2.visibility || 0) > 0.5) {
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
      targetReps: this.getTargetReps(this.currentExercise)
    };
  }

  private calculateFormScore(result: any, landmarks: any[]): number {
    let score = 100;
    
    switch (this.currentExercise) {
      case 'lateral_raise':
        if (Math.abs(result.velocity) > 150) score -= 20;
        if (result.angle > 90) score -= 15;
        break;
      case 'shoulder_press':
        if (Math.abs(result.velocity) > 180) score -= 20;
        break;
      case 'squats':
        // Check knee alignment for squats
        if (result.angle < 90) score += 10; // Good depth
        break;
      case 'push_ups':
        // Check body alignment for push-ups
        if (result.angle < 80) score -= 15; // Too low
        break;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private getVelocityLoss(detector: EnhancedExerciseDetector): number {
    return detector.getCurrentVelocityLoss();
  }

  getCurrentExercise(): ExerciseType {
    return this.currentExercise;
  }

  destroy(): void {
    this.stop();
    if (this.database) {
      this.database.disconnect();
    }
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new VelocityCoachAI();
  (window as any).velocityCoachAI = app;
  
  console.log('VelocityCoach AI - Complete System Initialized');
  console.log('Features: Enhanced Exercise Detection | MongoDB Integration | VBT Analysis | Kinematic Calculations');
  console.log('Available Exercises:');
  getAllExerciseTypes().forEach(exercise => {
    const config = getExerciseConfig(exercise);
    console.log(`- ${config.name} (${config.muscleGroup})`);
  });
});

// Export for use in other modules - removed duplicate export
export { KinematicAnalyzer };