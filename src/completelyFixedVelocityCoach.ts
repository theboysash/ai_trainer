// src/completelyFixedVelocityCoach.ts - SERIOUS FIX for all issues
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { ExerciseType } from './exerciseSystem';
import { ImprovedVoiceAgent } from './improvedVoiceAgent';

interface WorkoutConfig {
  sets: number;
  targetReps: number;
  restDuration: number;
  exerciseRestDuration: number; // Rest between exercises
}

interface SetData {
  exercise: ExerciseType;
  setNumber: number;
  reps: number;
  startTime: number;
  endTime: number;
  avgVelocity: number;
  peakVelocity: number;
  velocityLoss: number;
  formScore: number;
}

interface ExerciseProgress {
  currentSet: number;
  completedSets: SetData[];
  isCompleted: boolean;
  config: WorkoutConfig;
}

export class VelocityCoachAI {
  private landmarker?: PoseLandmarker;
  private voiceAgent = new ImprovedVoiceAgent();
  
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream?: MediaStream;
  private running = false;

  // Workout state management
  private currentExercise: ExerciseType = 'shoulder_press';
  private isResting = false;
  private isExerciseTransition = false; // NEW: Track exercise transitions
  private restStartTime = 0;
  private setStartTime = 0; // Track when set actually starts
  private restTimer?: number;
  private lastRepTime = 0; // Prevent rep spam
  
  // Exercise tracking
  private exerciseProgress = new Map<ExerciseType, ExerciseProgress>();
  private exerciseState = new Map<ExerciseType, any>();
  private totalSetsCompleted = 0;
  private totalRepsCompleted = 0;
  private workoutStartTime = 0;
  
  // Intensity-based configs
  private intensityConfigs = {
    light: { vlThreshold: 0.15, restMultiplier: 0.8 },
    moderate: { vlThreshold: 0.25, restMultiplier: 1.0 },
    intense: { vlThreshold: 0.40, restMultiplier: 1.2 }
  };
  private currentIntensity: 'light' | 'moderate' | 'intense' = 'moderate';

  constructor() {
    this.video = document.getElementById("video") as HTMLVideoElement;
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
    this.initializeWorkout();
    this.setupEventHandlers();
    this.setupIntensityControls();
    this.startProgressUpdates(); // NEW: Regular UI updates
  }

  private initializeWorkout(): void {
    // Define workout configs with exercise transition rest
    const workoutConfigs: Record<ExerciseType, WorkoutConfig> = {
      shoulder_press: { sets: 4, targetReps: 8, restDuration: 120, exerciseRestDuration: 180 },
      lateral_raise: { sets: 3, targetReps: 12, restDuration: 60, exerciseRestDuration: 120 },
      front_raise: { sets: 3, targetReps: 12, restDuration: 60, exerciseRestDuration: 120 },
      rear_delt_fly: { sets: 3, targetReps: 15, restDuration: 45, exerciseRestDuration: 90 },
      bicep_curl: { sets: 3, targetReps: 10, restDuration: 90, exerciseRestDuration: 120 }
    };

    // Initialize progress for each exercise
    Object.entries(workoutConfigs).forEach(([exercise, config]) => {
      this.exerciseProgress.set(exercise as ExerciseType, {
        currentSet: 1,
        completedSets: [],
        isCompleted: false,
        config
      });
      
      // Initialize exercise state for SERIOUS lateral raise fix
      this.exerciseState.set(exercise as ExerciseType, {
        reps: 0,
        angle: 0,
        velocity: 0,
        state: 'idle',
        lastAngle: 0,
        lastTime: 0,
        angleHistory: [],
        velocityHistory: [],
        // LATERAL RAISE SPECIFIC - Multiple detection methods
        armElevation: 0,
        shoulderAngle: 0,
        isRaising: false,
        peakAngleThisRep: 0,
        minAngleThisRep: 90,
        stateChangeTime: 0
      });
    });
  }

  private setupIntensityControls(): void {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="background: #162031; padding: 15px; border-radius: 8px; margin: 10px 0;">
        <h4 style="color: #50d7ff; margin: 0 0 10px 0;">Training Intensity</h4>
        <select id="intensitySelect" style="background: #1b2a3a; color: white; border: 1px solid #2d3b4e; padding: 8px; border-radius: 4px; width: 100%;">
          <option value="light">Light (Endurance Focus)</option>
          <option value="moderate" selected>Moderate (Balanced)</option>
          <option value="intense">Intense (Strength Focus)</option>
        </select>
      </div>
    `;
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.insertBefore(container, sidebar.firstChild);
      
      document.getElementById('intensitySelect')!.addEventListener('change', (e) => {
        this.currentIntensity = (e.target as HTMLSelectElement).value as any;
        this.adjustWorkoutForIntensity();
      });
    }
  }

  private adjustWorkoutForIntensity(): void {
    const config = this.intensityConfigs[this.currentIntensity];
    
    this.exerciseProgress.forEach((progress, exercise) => {
      const baseRest = progress.config.restDuration;
      const baseExerciseRest = progress.config.exerciseRestDuration;
      progress.config.restDuration = Math.round(baseRest * config.restMultiplier);
      progress.config.exerciseRestDuration = Math.round(baseExerciseRest * config.restMultiplier);
    });
  }

  private setupEventHandlers(): void {
    document.querySelectorAll('.exercise-card').forEach(card => {
      card.addEventListener('click', () => {
        const exerciseType = (card as HTMLElement).dataset.exercise as ExerciseType;
        if (exerciseType && this.running) {
          this.switchExercise(exerciseType);
        }
      });
    });

    document.getElementById('btnStart')?.addEventListener('click', () => this.start());
    document.getElementById('btnStop')?.addEventListener('click', () => this.stop());
    document.getElementById('btnToggleVoice')?.addEventListener('click', () => this.toggleVoice());
    document.getElementById('btnSkipRest')?.addEventListener('click', () => this.skipRest());
    document.getElementById('btnCompleteSet')?.addEventListener('click', () => this.completeCurrentSet());
    document.getElementById('btnNextExercise')?.addEventListener('click', () => this.nextExercise());
  }

  private startProgressUpdates(): void {
    // Update UI every second
    setInterval(() => {
      if (this.running) {
        this.updateSessionProgress();
      }
    }, 1000);
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();

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
      this.workoutStartTime = Date.now();
      this.setStartTime = Date.now() / 1000;
      this.updateUI();
      this.loop();
      
    } catch (error) {
      console.error('Failed to start:', error);
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
      
      if (!this.isResting && !this.isExerciseTransition) {
        const stepData = this.processExercise(landmarks, nowMs / 1000);
        this.updateMetrics(stepData);
        this.checkAutoSetCompletion(stepData);
      }
      
    } else {
      this.drawNoPersonMessage();
    }

    if (this.isResting || this.isExerciseTransition) {
      this.updateRestDisplay();
    }

    if (this.running) {
      requestAnimationFrame(() => this.loop());
    }
  }

  private processExercise(landmarks: any[], timestamp: number): any {
    const state = this.exerciseState.get(this.currentExercise)!;
    
    let result;
    switch (this.currentExercise) {
      case 'lateral_raise':
        result = this.processLateralRaise_SERIOUS_FIX(landmarks, timestamp, state);
        break;
      case 'shoulder_press':
        result = this.processShoulderPress(landmarks, timestamp, state);
        break;
      case 'front_raise':
        result = this.processFrontRaise(landmarks, timestamp, state);
        break;
      case 'rear_delt_fly':
        result = this.processRearDeltFly(landmarks, timestamp, state);
        break;
      default:
        result = this.processShoulderPress(landmarks, timestamp, state);
    }

    this.exerciseState.set(this.currentExercise, result);
    
    return {
      ...result,
      exercise: this.currentExercise,
      formScore: this.calculateFormScore(result),
      velocityLoss: this.calculateVelocityLoss(result.velocity, state)
    };
  }

  // SERIOUS LATERAL RAISE FIX - Multi-method detection
  private processLateralRaise_SERIOUS_FIX(landmarks: any[], timestamp: number, state: any): any {
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    
    // Use both arms - take the one with better visibility or higher elevation
    let shoulder, elbow, wrist;
    const rightVisibility = (rightShoulder?.visibility || 0) * (rightElbow?.visibility || 0);
    const leftVisibility = (leftShoulder?.visibility || 0) * (leftElbow?.visibility || 0);
    
    if (rightVisibility > leftVisibility) {
      shoulder = rightShoulder;
      elbow = rightElbow;
      wrist = rightWrist;
    } else {
      shoulder = leftShoulder;
      elbow = leftElbow;
      wrist = leftWrist;
    }
    
    if (!shoulder || !elbow || !wrist) {
      return { ...state, valid: false };
    }

    // METHOD 1: Arm elevation angle (primary)
    const armVector = [elbow.x - shoulder.x, elbow.y - shoulder.y];
    let armElevation = Math.atan2(-armVector[1], Math.abs(armVector[0])) * (180 / Math.PI);
    armElevation = Math.max(0, Math.min(90, armElevation));
    
    // METHOD 2: Shoulder abduction angle (secondary validation)
    const shoulderToElbow = Math.sqrt(armVector[0]**2 + armVector[1]**2);
    let shoulderAngle = Math.asin(Math.abs(armVector[0]) / shoulderToElbow) * (180 / Math.PI);
    shoulderAngle = Math.max(0, Math.min(90, shoulderAngle));
    
    // METHOD 3: Wrist elevation for full ROM validation
    const wristElevation = wrist.y < shoulder.y ? (shoulder.y - wrist.y) * 100 : 0;
    
    // Combine methods with weighted average
    let combinedAngle = (armElevation * 0.7) + (shoulderAngle * 0.3);
    
    // Additional validation using wrist position
    if (wristElevation > 20) {
      combinedAngle = Math.max(combinedAngle, 45); // Boost angle if wrist is clearly elevated
    }
    
    // Aggressive smoothing for lateral raises
    state.angleHistory = state.angleHistory || [];
    state.angleHistory.push(combinedAngle);
    if (state.angleHistory.length > 7) state.angleHistory.shift();
    
    const smoothedAngle = state.angleHistory.reduce((sum: number, a: number) => sum + a, 0) / state.angleHistory.length;
    
    // Calculate velocity
    const dt = Math.max(0.016, timestamp - state.lastTime); // Minimum 16ms
    const velocity = (smoothedAngle - state.lastAngle) / dt;
    
    // AGGRESSIVE REP DETECTION - Multiple trigger points
    let isNewRep = false;
    const MIN_TOP_ANGLE = 50;  // Lowered threshold
    const MIN_BOTTOM_ANGLE = 10; // Lowered threshold
    const HYSTERESIS = 5;
    const MIN_REP_DURATION = 0.8; // Minimum time between reps
    
    // Track peak and minimum angles for this movement
    if (smoothedAngle > state.peakAngleThisRep) {
      state.peakAngleThisRep = smoothedAngle;
    }
    if (smoothedAngle < state.minAngleThisRep) {
      state.minAngleThisRep = smoothedAngle;
    }
    
    // Enhanced state machine with time validation
    const now = timestamp;
    
    switch (state.state) {
      case 'idle':
        if (smoothedAngle > MIN_BOTTOM_ANGLE + 5) {
          state.state = 'raising';
          state.isRaising = true;
          state.stateChangeTime = now;
          state.peakAngleThisRep = smoothedAngle;
          state.minAngleThisRep = smoothedAngle;
        }
        break;
        
      case 'raising':
        if (smoothedAngle >= MIN_TOP_ANGLE) {
          state.state = 'top';
          state.stateChangeTime = now;
        } else if (smoothedAngle < MIN_BOTTOM_ANGLE && (now - state.stateChangeTime) > 0.5) {
          // Didn't reach top, reset
          state.state = 'idle';
          state.isRaising = false;
        }
        break;
        
      case 'top':
        if (smoothedAngle < MIN_TOP_ANGLE - HYSTERESIS) {
          state.state = 'lowering';
          state.isRaising = false;
          state.stateChangeTime = now;
        }
        break;
        
      case 'lowering':
        if (smoothedAngle <= MIN_BOTTOM_ANGLE + HYSTERESIS) {
          // Check if this was a valid rep
          const repDuration = now - (state.lastRepTime || 0);
          const romAchieved = state.peakAngleThisRep - state.minAngleThisRep;
          
          if (repDuration > MIN_REP_DURATION && romAchieved > 25) {
            state.reps++;
            isNewRep = true;
            state.lastRepTime = now;
            
            // Voice feedback for successful rep
            console.log(`LATERAL RAISE REP ${state.reps}: Peak=${state.peakAngleThisRep.toFixed(1)}°, ROM=${romAchieved.toFixed(1)}°`);
          }
          
          state.state = 'idle';
          state.peakAngleThisRep = smoothedAngle;
          state.minAngleThisRep = 90;
        } else if (smoothedAngle > MIN_TOP_ANGLE - HYSTERESIS) {
          // Went back up
          state.state = 'top';
        }
        break;
    }
    
    // Store values
    state.lastAngle = smoothedAngle;
    state.lastTime = timestamp;
    state.angle = smoothedAngle;
    state.velocity = velocity;
    state.armElevation = armElevation;
    state.shoulderAngle = shoulderAngle;
    
    // Add velocity to history for VBT calculations
    if (Math.abs(velocity) > 5) {
      state.velocityHistory = state.velocityHistory || [];
      state.velocityHistory.push(Math.abs(velocity));
      if (state.velocityHistory.length > 15) state.velocityHistory.shift();
    }
    
    return { ...state, isNewRep, valid: true };
  }

  private processShoulderPress(landmarks: any[], timestamp: number, state: any): any {
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    
    if (!rightShoulder || !rightElbow || !rightWrist) {
      return { ...state, valid: false };
    }

    const upperArm = [rightElbow.x - rightShoulder.x, rightElbow.y - rightShoulder.y];
    let angle = Math.atan2(Math.abs(upperArm[0]), -upperArm[1]) * (180 / Math.PI);
    angle = Math.max(0, Math.min(180, angle));
    
    const velocity = timestamp > state.lastTime ? 
      (angle - state.lastAngle) / (timestamp - state.lastTime) : 0;
    
    let isNewRep = false;
    const MIN_TOP_ANGLE = 150;
    const MIN_BOTTOM_ANGLE = 45;
    
    switch (state.state) {
      case 'idle':
        if (angle > MIN_BOTTOM_ANGLE + 10) {
          state.state = 'pressing';
        }
        break;
      case 'pressing':
        if (angle >= MIN_TOP_ANGLE) {
          state.state = 'top';
        }
        break;
      case 'top':
        if (angle < MIN_TOP_ANGLE - 10) {
          state.state = 'lowering';
        }
        break;
      case 'lowering':
        if (angle <= MIN_BOTTOM_ANGLE) {
          const repTime = timestamp - (state.lastRepTime || 0);
          if (repTime > 0.8) {
            state.reps++;
            isNewRep = true;
            state.lastRepTime = timestamp;
          }
          state.state = 'idle';
        }
        break;
    }
    
    state.lastAngle = angle;
    state.lastTime = timestamp;
    state.angle = angle;
    state.velocity = velocity;
    
    if (Math.abs(velocity) > 5) {
      state.velocityHistory = state.velocityHistory || [];
      state.velocityHistory.push(Math.abs(velocity));
      if (state.velocityHistory.length > 15) state.velocityHistory.shift();
    }
    
    return { ...state, isNewRep, valid: true };
  }

  private processFrontRaise(landmarks: any[], timestamp: number, state: any): any {
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    
    if (!rightShoulder || !rightElbow) {
      return { ...state, valid: false };
    }

    const armVector = [rightElbow.x - rightShoulder.x, rightElbow.y - rightShoulder.y];
    let angle = Math.atan2(-armVector[1], armVector[0]) * (180 / Math.PI);
    if (angle < 0) angle += 180;
    angle = Math.max(0, Math.min(180, angle));
    
    const velocity = timestamp > state.lastTime ? 
      (angle - state.lastAngle) / (timestamp - state.lastTime) : 0;
    
    let isNewRep = false;
    const MIN_TOP_ANGLE = 80;
    const MIN_BOTTOM_ANGLE = 20;
    
    switch (state.state) {
      case 'idle':
        if (angle > MIN_BOTTOM_ANGLE + 10) state.state = 'raising';
        break;
      case 'raising':
        if (angle >= MIN_TOP_ANGLE) state.state = 'top';
        break;
      case 'top':
        if (angle < MIN_TOP_ANGLE - 10) state.state = 'lowering';
        break;
      case 'lowering':
        if (angle <= MIN_BOTTOM_ANGLE) {
          const repTime = timestamp - (state.lastRepTime || 0);
          if (repTime > 0.8) {
            state.reps++;
            isNewRep = true;
            state.lastRepTime = timestamp;
          }
          state.state = 'idle';
        }
        break;
    }
    
    state.lastAngle = angle;
    state.lastTime = timestamp;
    state.angle = angle;
    state.velocity = velocity;
    
    return { ...state, isNewRep, valid: true };
  }

  private processRearDeltFly(landmarks: any[], timestamp: number, state: any): any {
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    
    if (!rightShoulder || !rightElbow) {
      return { ...state, valid: false };
    }

    const armVector = [rightElbow.x - rightShoulder.x, rightElbow.y - rightShoulder.y];
    let angle = Math.atan2(Math.abs(armVector[1]), Math.abs(armVector[0])) * (180 / Math.PI);
    angle = Math.max(0, Math.min(90, angle));
    
    const velocity = timestamp > state.lastTime ? 
      (angle - state.lastAngle) / (timestamp - state.lastTime) : 0;
    
    let isNewRep = false;
    const MIN_TOP_ANGLE = 50;
    const MIN_BOTTOM_ANGLE = 10;
    
    switch (state.state) {
      case 'idle':
        if (angle > MIN_BOTTOM_ANGLE + 5) state.state = 'raising';
        break;
      case 'raising':
        if (angle >= MIN_TOP_ANGLE) state.state = 'top';
        break;
      case 'top':
        if (angle < MIN_TOP_ANGLE - 5) state.state = 'lowering';
        break;
      case 'lowering':
        if (angle <= MIN_BOTTOM_ANGLE) {
          const repTime = timestamp - (state.lastRepTime || 0);
          if (repTime > 0.6) {
            state.reps++;
            isNewRep = true;
            state.lastRepTime = timestamp;
          }
          state.state = 'idle';
        }
        break;
    }
    
    state.lastAngle = angle;
    state.lastTime = timestamp;
    state.angle = angle;
    state.velocity = velocity;
    
    return { ...state, isNewRep, valid: true };
  }

  private calculateFormScore(result: any): number {
    if (!result.valid) return 0;
    
    let score = 100;
    if (Math.abs(result.velocity) > 120) score -= 20;
    if (Math.abs(result.velocity) > 200) score -= 40;
    if (result.angle < 30) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateVelocityLoss(currentVelocity: number, state: any): number {
    if (!state.velocityHistory || state.velocityHistory.length < 5) return 0;
    
    const baseline = state.velocityHistory.slice(0, 3).reduce((sum: number, v: number) => sum + v, 0) / 3;
    const recent = state.velocityHistory.slice(-3).reduce((sum: number, v: number) => sum + v, 0) / 3;
    
    return Math.max(0, (baseline - recent) / baseline);
  }

  private checkAutoSetCompletion(stepData: any): void {
    const progress = this.exerciseProgress.get(this.currentExercise)!;
    const targetReps = progress.config.targetReps;
    
    if (stepData.reps >= targetReps) {
      this.completeCurrentSet();
    }
  }

  private completeCurrentSet(): void {
    const progress = this.exerciseProgress.get(this.currentExercise)!;
    const state = this.exerciseState.get(this.currentExercise)!;
    
    const setData: SetData = {
      exercise: this.currentExercise,
      setNumber: progress.currentSet,
      reps: state.reps,
      startTime: this.setStartTime,
      endTime: Date.now() / 1000,
      avgVelocity: state.velocityHistory?.length > 0 ? 
        state.velocityHistory.reduce((sum: number, v: number) => sum + v, 0) / state.velocityHistory.length : 0,
      peakVelocity: state.velocityHistory?.length > 0 ? 
        Math.max(...state.velocityHistory) : 0,
      velocityLoss: this.calculateVelocityLoss(state.velocity, state),
      formScore: this.calculateFormScore(state)
    };
    
    progress.completedSets.push(setData);
    this.totalSetsCompleted++;
    this.totalRepsCompleted += state.reps;
    
    // Reset exercise state for next set
    state.reps = 0;
    state.state = 'idle';
    state.velocityHistory = [];
    
    // Voice feedback
    this.voiceAgent.onSetComplete?.(this.currentExercise, setData);
    
    // Check if exercise is complete
    if (progress.completedSets.length >= progress.config.sets) {
      progress.isCompleted = true;
      this.autoAdvanceExercise();
    } else {
      // Start regular rest period
      this.startRest(false);
    }
    
    this.updateUI();
  }

  private startRest(isExerciseTransition: boolean): void {
    const progress = this.exerciseProgress.get(this.currentExercise)!;
    
    this.isResting = true;
    this.isExerciseTransition = isExerciseTransition;
    this.restStartTime = Date.now() / 1000;
    
    const restDuration = isExerciseTransition ? 
      progress.config.exerciseRestDuration : 
      progress.config.restDuration;
    
    // Show rest timer
    const restTimer = document.getElementById('restTimer');
    if (restTimer) {
      restTimer.classList.add('active');
      const title = restTimer.querySelector('.rest-timer-title');
      if (title) {
        title.textContent = isExerciseTransition ? 'Exercise Transition' : 'Rest Period';
      }
    }
    
    // Auto-end rest after duration
    this.restTimer = window.setTimeout(() => {
      this.endRest();
    }, restDuration * 1000);
    
    // Voice feedback
    const message = isExerciseTransition ? 
      `Exercise complete. Taking ${Math.round(restDuration/60)} minute break before next exercise.` :
      `Set complete. Rest for ${restDuration} seconds.`;
      
    this.voiceAgent.analyzeWorkoutStep({
      exercise: this.currentExercise,
      state: 'resting',
      restDuration: restDuration,
      reps: 0,
      angle: 0,
      velocity: 0,
      formScore: 0,
      velocityLoss: 0,
      isResting: true,
      restTimeRemaining: restDuration,
      message: message
    });
  }

  private endRest(): void {
    this.isResting = false;
    this.isExerciseTransition = false;
    this.restStartTime = 0;
    this.setStartTime = Date.now() / 1000; // Reset set start time
    
    if (this.restTimer) {
      clearTimeout(this.restTimer);
      this.restTimer = undefined;
    }
    
    // Hide rest timer
    const restTimer = document.getElementById('restTimer');
    if (restTimer) {
      restTimer.classList.remove('active');
    }
    
    // Move to next set if not switching exercises
    if (!this.isExerciseTransition) {
      const progress = this.exerciseProgress.get(this.currentExercise)!;
      progress.currentSet++;
    }
    
    this.updateUI();
    
    this.voiceAgent.analyzeWorkoutStep({
      exercise: this.currentExercise,
      state: 'ready',
      reps: 0,
      angle: 0,
      velocity: 0,
      formScore: 0,
      velocityLoss: 0,
      isResting: false,
      restTimeRemaining: 0,
      message: 'Rest complete, ready for next set'
    });
  }

  private skipRest(): void {
    if (this.isResting) {
      this.endRest();
    }
  }

  private autoAdvanceExercise(): void {
    const exercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
    const currentIndex = exercises.indexOf(this.currentExercise);
    
    // Find next incomplete exercise
    for (let i = currentIndex + 1; i < exercises.length; i++) {
      const nextExercise = exercises[i];
      const progress = this.exerciseProgress.get(nextExercise)!;
      
      if (!progress.isCompleted) {
        // Start exercise transition rest period
        this.startRest(true);
        
        // Schedule exercise switch after rest
        setTimeout(() => {
          this.switchExercise(nextExercise);
        }, this.exerciseProgress.get(this.currentExercise)!.config.exerciseRestDuration * 1000 + 1000);
        
        return;
      }
    }
    
    // If all exercises complete
    this.completeWorkout();
  }

  private nextExercise(): void {
    const exercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
    const currentIndex = exercises.indexOf(this.currentExercise);
    
    if (currentIndex < exercises.length - 1) {
      this.switchExercise(exercises[currentIndex + 1]);
    }
  }

  private switchExercise(exercise: ExerciseType): void {
    if (this.isResting) {
      this.endRest();
    }
    
    this.currentExercise = exercise;
    this.setStartTime = Date.now() / 1000;
    
    // Reset exercise state
    const state = this.exerciseState.get(exercise)!;
    state.reps = 0;
    state.state = 'idle';
    state.velocityHistory = [];
    
    this.updateUI();
    
    // Voice feedback
    const exerciseNames = {
      shoulder_press: 'Shoulder Press',
      lateral_raise: 'Lateral Raise',
      front_raise: 'Front Raise',
      rear_delt_fly: 'Rear Delt Fly',
      bicep_curl: 'Bicep Curl'
    };
    
    this.voiceAgent.analyzeWorkoutStep({
      exercise: exercise,
      state: 'ready',
      reps: 0,
      angle: 0,
      velocity: 0,
      formScore: 0,
      velocityLoss: 0,
      isResting: false,
      restTimeRemaining: 0,
      message: `Starting ${exerciseNames[exercise]}`
    });
  }

  private completeWorkout(): void {
    this.running = false;
    
    this.voiceAgent.analyzeWorkoutStep({
      exercise: this.currentExercise,
      state: 'complete',
      reps: 0,
      angle: 0,
      velocity: 0,
      formScore: 0,
      velocityLoss: 0,
      isResting: false,
      restTimeRemaining: 0,
      message: 'Workout complete! Excellent work!'
    });
    
    setTimeout(() => {
      alert("Workout Complete! Outstanding effort!");
    }, 1000);
  }

  private updateRestDisplay(): void {
    if (!this.isResting && !this.isExerciseTransition) return;
    
    const progress = this.exerciseProgress.get(this.currentExercise)!;
    const elapsed = (Date.now() / 1000) - this.restStartTime;
    const duration = this.isExerciseTransition ? 
      progress.config.exerciseRestDuration : 
      progress.config.restDuration;
    const remaining = Math.max(0, duration - elapsed);
    
    const restTimeEl = document.getElementById('restTime');
    if (restTimeEl) {
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      restTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private updateSessionProgress(): void {
    const workoutDuration = Math.floor((Date.now() - this.workoutStartTime) / 1000);
    
    // Update session progress display
    const totalSetsEl = document.getElementById('totalSets');
    const totalRepsEl = document.getElementById('totalReps');
    const workoutDurationEl = document.getElementById('workoutDuration');
    const estimatedTimeEl = document.getElementById('estimatedTime');
    
    if (totalSetsEl) totalSetsEl.textContent = this.totalSetsCompleted.toString();
    if (totalRepsEl) totalRepsEl.textContent = this.totalRepsCompleted.toString();
    
    if (workoutDurationEl) {
      const minutes = Math.floor(workoutDuration / 60);
      const seconds = workoutDuration % 60;
      workoutDurationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (estimatedTimeEl) {
      const remainingTime = this.estimateRemainingTime();
      if (remainingTime > 0) {
        const estMinutes = Math.floor(remainingTime / 60);
        const estSeconds = remainingTime % 60;
        estimatedTimeEl.textContent = `${estMinutes}:${estSeconds.toString().padStart(2, '0')}`;
      } else {
        estimatedTimeEl.textContent = "—";
      }
    }
  }

  private estimateRemainingTime(): number {
    let remainingTime = 0;
    
    this.exerciseProgress.forEach((progress, exercise) => {
      if (!progress.isCompleted) {
        const remainingSets = progress.config.sets - progress.completedSets.length;
        const setTime = 60; // Average set duration
        const restTime = progress.config.restDuration;
        remainingTime += remainingSets * (setTime + restTime);
        
        // Add exercise transition time if not the last exercise
        const exercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
        const exerciseIndex = exercises.indexOf(exercise);
        if (exerciseIndex < exercises.length - 1) {
          remainingTime += progress.config.exerciseRestDuration;
        }
      }
    });
    
    return Math.max(0, remainingTime);
  }

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
    if (elements.form) elements.form.textContent = Math.round(stepData.formScore).toString();
    
    if (elements.vl) {
      const vlPercent = Math.round(stepData.velocityLoss * 100);
      elements.vl.textContent = `${vlPercent}%`;
      
      const threshold = this.intensityConfigs[this.currentIntensity].vlThreshold;
      if (stepData.velocityLoss > threshold) {
        elements.vl.style.color = '#ef4444';
      } else if (stepData.velocityLoss > threshold * 0.8) {
        elements.vl.style.color = '#f59e0b';
      } else {
        elements.vl.style.color = '#22c55e';
      }
    }
  }

  private updateUI(): void {
    // Update exercise selection cards
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
      
      // Update progress bar and text
      const progressBar = card.querySelector('.progress-fill') as HTMLElement;
      const progressText = card.querySelector('.exercise-progress div') as HTMLElement;
      
      if (progressBar && progressText && progress) {
        const completedSets = progress.completedSets.length;
        const totalSets = progress.config.sets;
        const progressPercent = (completedSets / totalSets) * 100;
        
        progressBar.style.width = `${progressPercent}%`;
        progressText.textContent = `Set ${progress.currentSet} of ${totalSets}`;
      }
    });

    // Update current exercise display
    const exerciseNames = {
      shoulder_press: 'Shoulder Press',
      lateral_raise: 'Lateral Raise',
      front_raise: 'Front Raise',
      rear_delt_fly: 'Rear Delt Fly',
      bicep_curl: 'Bicep Curl'
    };

    const currentExerciseEl = document.getElementById('currentExercise');
    const currentSetEl = document.getElementById('currentSet');
    const targetRepsEl = document.getElementById('targetReps');
    const setStatusEl = document.getElementById('setStatus');
    
    if (currentExerciseEl) {
      currentExerciseEl.textContent = exerciseNames[this.currentExercise];
    }
    
    const progress = this.exerciseProgress.get(this.currentExercise)!;
    if (currentSetEl) currentSetEl.textContent = `${progress.currentSet} of ${progress.config.sets}`;
    if (targetRepsEl) targetRepsEl.textContent = progress.config.targetReps.toString();
    
    if (setStatusEl) {
      if (this.isResting || this.isExerciseTransition) {
        setStatusEl.textContent = this.isExerciseTransition ? "Exercise Transition" : "Resting";
        setStatusEl.className = "stat-value warning";
      } else if (!this.running) {
        setStatusEl.textContent = "Ready";
        setStatusEl.className = "stat-value";
      } else {
        setStatusEl.textContent = "Active";
        setStatusEl.className = "stat-value good";
      }
    }
  }

  private drawPoseSkeleton(landmarks: any[], w: number, h: number): void {
    const connections = [
      [11, 12], [11, 23], [12, 24], [23, 24],
      [11, 13], [13, 15], [12, 14], [14, 16],
      [23, 25], [25, 27], [24, 26], [26, 28],
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

    // Highlight active exercise joints
    this.highlightActiveJoints(landmarks, w, h);
  }

  private highlightActiveJoints(landmarks: any[], w: number, h: number): void {
    const jointMappings: Record<ExerciseType, number[]> = {
      shoulder_press: [12, 14, 16], // Right arm
      lateral_raise: [12, 14, 16],
      front_raise: [12, 14, 16],
      rear_delt_fly: [12, 14, 16],
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

    // Highlight joints with larger circles
    this.ctx.fillStyle = "rgba(50, 255, 170, 0.8)";
    joints.forEach(jointIdx => {
      const joint = landmarks[jointIdx];
      if (joint) {
        this.ctx.beginPath();
        this.ctx.arc(joint.x * w, joint.y * h, 8, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
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
    
    if (this.restTimer) {
      clearTimeout(this.restTimer);
      this.restTimer = undefined;
    }
    
    this.landmarker = undefined;
    this.voiceAgent.clearQueue();
    this.updateUI();
  }

  private toggleVoice(): void {
    const enabled = this.voiceAgent.toggle();
    const btn = document.getElementById('btnToggleVoice');
    if (btn) {
      btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
    }
  }

  getCurrentExercise(): ExerciseType {
    return this.currentExercise;
  }

  destroy(): void {
    this.stop();
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new VelocityCoachAI();
  (window as any).velocityCoachAI = app;
});