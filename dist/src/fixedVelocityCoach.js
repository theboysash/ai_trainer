// src/fixedVelocityCoach.ts - Complete workout flow with automatic progression
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { ImprovedVoiceAgent } from './improvedVoiceAgent';
import { EnhancedVisualDashboard } from './enhancedVisualDashboard';
export class VelocityCoachAI {
    landmarker;
    voiceAgent = new ImprovedVoiceAgent();
    visualDashboard = new EnhancedVisualDashboard();
    video;
    canvas;
    ctx;
    stream;
    running = false;
    // Workout state management
    currentExercise = 'shoulder_press';
    isResting = false;
    restStartTime = 0;
    restTimer;
    // Exercise tracking
    exerciseProgress = new Map();
    exerciseState = new Map();
    // Intensity-based configs
    intensityConfigs = {
        light: { vlThreshold: 0.15, restMultiplier: 0.8 },
        moderate: { vlThreshold: 0.25, restMultiplier: 1.0 },
        intense: { vlThreshold: 0.40, restMultiplier: 1.2 }
    };
    currentIntensity = 'moderate';
    constructor() {
        this.video = document.getElementById("video");
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.initializeWorkout();
        this.setupEventHandlers();
        this.setupIntensityControls();
    }
    initializeWorkout() {
        // Define workout configs based on intensity
        const workoutConfigs = {
            shoulder_press: { sets: 4, targetReps: 8, restDuration: 120 },
            lateral_raise: { sets: 3, targetReps: 12, restDuration: 60 },
            front_raise: { sets: 3, targetReps: 12, restDuration: 60 },
            rear_delt_fly: { sets: 3, targetReps: 15, restDuration: 45 },
            bicep_curl: { sets: 3, targetReps: 10, restDuration: 90 }
        };
        // Initialize progress for each exercise
        Object.entries(workoutConfigs).forEach(([exercise, config]) => {
            this.exerciseProgress.set(exercise, {
                currentSet: 1,
                completedSets: [],
                isCompleted: false,
                config
            });
            // Initialize exercise state for rep counting
            this.exerciseState.set(exercise, {
                reps: 0,
                angle: 0,
                velocity: 0,
                state: 'idle',
                lastAngle: 0,
                lastTime: 0,
                angleHistory: [],
                velocityHistory: []
            });
        });
    }
    setupIntensityControls() {
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
            document.getElementById('intensitySelect').addEventListener('change', (e) => {
                this.currentIntensity = e.target.value;
                this.adjustWorkoutForIntensity();
            });
        }
    }
    adjustWorkoutForIntensity() {
        const config = this.intensityConfigs[this.currentIntensity];
        // Adjust rest periods based on intensity
        this.exerciseProgress.forEach((progress, exercise) => {
            const baseRest = progress.config.restDuration;
            progress.config.restDuration = Math.round(baseRest * config.restMultiplier);
        });
    }
    setupEventHandlers() {
        // Exercise selection
        document.querySelectorAll('.exercise-card').forEach(card => {
            card.addEventListener('click', () => {
                const exerciseType = card.dataset.exercise;
                if (exerciseType && this.running) {
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
        document.getElementById('btnNextExercise')?.addEventListener('click', () => this.nextExercise());
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
            const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
            this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPoseTrackingConfidence: 0.5
            });
            this.running = true;
            this.updateUI();
            this.loop();
        }
        catch (error) {
            console.error('Failed to start:', error);
        }
    }
    loop() {
        if (!this.running || !this.landmarker)
            return;
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
        }
        catch { }
        if (result.landmarks && result.landmarks[0]) {
            const landmarks = result.landmarks[0];
            // Draw pose skeleton
            this.drawPoseSkeleton(landmarks, w, h);
            if (!this.isResting) {
                // Process current exercise
                const stepData = this.processExercise(landmarks, nowMs / 1000);
                // Update UI with current data
                this.updateMetrics(stepData);
                // Check for automatic set completion
                this.checkAutoSetCompletion(stepData);
            }
        }
        else {
            this.drawNoPersonMessage();
        }
        // Update rest timer if resting
        if (this.isResting) {
            this.updateRestDisplay();
        }
        if (this.running) {
            requestAnimationFrame(() => this.loop());
        }
    }
    processExercise(landmarks, timestamp) {
        const state = this.exerciseState.get(this.currentExercise);
        // Process different exercises with improved detection
        let result;
        switch (this.currentExercise) {
            case 'lateral_raise':
                result = this.processLateralRaise(landmarks, timestamp, state);
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
        // Update state
        this.exerciseState.set(this.currentExercise, result);
        return {
            ...result,
            exercise: this.currentExercise,
            formScore: this.calculateFormScore(result),
            velocityLoss: this.calculateVelocityLoss(result.velocity, state)
        };
    }
    processLateralRaise(landmarks, timestamp, state) {
        // Improved lateral raise detection
        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        const rightWrist = landmarks[16];
        if (!rightShoulder || !rightElbow || !rightWrist) {
            return { ...state, valid: false };
        }
        // Calculate arm elevation angle
        const armVector = [rightElbow.x - rightShoulder.x, rightElbow.y - rightShoulder.y];
        let angle = Math.atan2(-armVector[1], Math.abs(armVector[0])) * (180 / Math.PI);
        angle = Math.max(0, Math.min(90, angle));
        // Smooth angle
        state.angleHistory.push(angle);
        if (state.angleHistory.length > 5)
            state.angleHistory.shift();
        const smoothedAngle = state.angleHistory.reduce((sum, a) => sum + a, 0) / state.angleHistory.length;
        // Calculate velocity
        const velocity = timestamp > state.lastTime ?
            (smoothedAngle - state.lastAngle) / (timestamp - state.lastTime) : 0;
        // Rep detection with improved state machine
        let isNewRep = false;
        const MIN_TOP_ANGLE = 60;
        const MIN_BOTTOM_ANGLE = 15;
        switch (state.state) {
            case 'idle':
                if (smoothedAngle > MIN_BOTTOM_ANGLE) {
                    state.state = 'raising';
                }
                break;
            case 'raising':
                if (smoothedAngle >= MIN_TOP_ANGLE) {
                    state.state = 'top';
                }
                else if (smoothedAngle < MIN_BOTTOM_ANGLE) {
                    state.state = 'idle';
                }
                break;
            case 'top':
                if (smoothedAngle < MIN_TOP_ANGLE - 5) { // Hysteresis
                    state.state = 'lowering';
                }
                break;
            case 'lowering':
                if (smoothedAngle <= MIN_BOTTOM_ANGLE) {
                    state.reps++;
                    isNewRep = true;
                    state.state = 'idle';
                }
                else if (smoothedAngle > MIN_TOP_ANGLE - 5) {
                    state.state = 'top';
                }
                break;
        }
        state.lastAngle = smoothedAngle;
        state.lastTime = timestamp;
        state.angle = smoothedAngle;
        state.velocity = velocity;
        return { ...state, isNewRep, valid: true };
    }
    processShoulderPress(landmarks, timestamp, state) {
        // Shoulder press detection (existing logic)
        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        const rightWrist = landmarks[16];
        if (!rightShoulder || !rightElbow || !rightWrist) {
            return { ...state, valid: false };
        }
        // Calculate angle between upper arm and vertical
        const upperArm = [rightElbow.x - rightShoulder.x, rightElbow.y - rightShoulder.y];
        let angle = Math.atan2(Math.abs(upperArm[0]), -upperArm[1]) * (180 / Math.PI);
        angle = Math.max(0, Math.min(180, angle));
        const velocity = timestamp > state.lastTime ?
            (angle - state.lastAngle) / (timestamp - state.lastTime) : 0;
        // Rep detection
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
                    state.reps++;
                    isNewRep = true;
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
    processFrontRaise(landmarks, timestamp, state) {
        // Similar to lateral raise but focusing on forward movement
        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        if (!rightShoulder || !rightElbow) {
            return { ...state, valid: false };
        }
        const armVector = [rightElbow.x - rightShoulder.x, rightElbow.y - rightShoulder.y];
        let angle = Math.atan2(-armVector[1], armVector[0]) * (180 / Math.PI);
        if (angle < 0)
            angle += 180;
        angle = Math.max(0, Math.min(180, angle));
        const velocity = timestamp > state.lastTime ?
            (angle - state.lastAngle) / (timestamp - state.lastTime) : 0;
        let isNewRep = false;
        const MIN_TOP_ANGLE = 80;
        const MIN_BOTTOM_ANGLE = 20;
        switch (state.state) {
            case 'idle':
                if (angle > MIN_BOTTOM_ANGLE + 10)
                    state.state = 'raising';
                break;
            case 'raising':
                if (angle >= MIN_TOP_ANGLE)
                    state.state = 'top';
                break;
            case 'top':
                if (angle < MIN_TOP_ANGLE - 10)
                    state.state = 'lowering';
                break;
            case 'lowering':
                if (angle <= MIN_BOTTOM_ANGLE) {
                    state.reps++;
                    isNewRep = true;
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
    processRearDeltFly(landmarks, timestamp, state) {
        // Rear delt fly - measure arm abduction from behind
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
                if (angle > MIN_BOTTOM_ANGLE + 5)
                    state.state = 'raising';
                break;
            case 'raising':
                if (angle >= MIN_TOP_ANGLE)
                    state.state = 'top';
                break;
            case 'top':
                if (angle < MIN_TOP_ANGLE - 5)
                    state.state = 'lowering';
                break;
            case 'lowering':
                if (angle <= MIN_BOTTOM_ANGLE) {
                    state.reps++;
                    isNewRep = true;
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
    calculateFormScore(result) {
        if (!result.valid)
            return 0;
        let score = 100;
        // Penalize for excessive speed
        if (Math.abs(result.velocity) > 120)
            score -= 20;
        if (Math.abs(result.velocity) > 200)
            score -= 40;
        // Penalize for incomplete range of motion
        if (result.angle < 30)
            score -= 15;
        return Math.max(0, Math.min(100, score));
    }
    calculateVelocityLoss(currentVelocity, state) {
        if (!state.velocityHistory)
            state.velocityHistory = [];
        if (Math.abs(currentVelocity) > 10) {
            state.velocityHistory.push(Math.abs(currentVelocity));
            if (state.velocityHistory.length > 20)
                state.velocityHistory.shift();
        }
        if (state.velocityHistory.length < 5)
            return 0;
        const baseline = state.velocityHistory.slice(0, 3).reduce((sum, v) => sum + v, 0) / 3;
        const recent = state.velocityHistory.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
        return Math.max(0, (baseline - recent) / baseline);
    }
    checkAutoSetCompletion(stepData) {
        const progress = this.exerciseProgress.get(this.currentExercise);
        const targetReps = progress.config.targetReps;
        // Auto-complete set when target reps reached
        if (stepData.reps >= targetReps) {
            this.completeCurrentSet();
        }
    }
    completeCurrentSet() {
        const progress = this.exerciseProgress.get(this.currentExercise);
        const state = this.exerciseState.get(this.currentExercise);
        const setStartTime = this.restStartTime || (Date.now() / 1000) - 60; // Fallback if no start time
        const setData = {
            exercise: this.currentExercise,
            setNumber: progress.currentSet,
            reps: state.reps,
            startTime: setStartTime,
            endTime: Date.now() / 1000,
            avgVelocity: state.velocityHistory?.length > 0 ?
                state.velocityHistory.reduce((sum, v) => sum + v, 0) / state.velocityHistory.length : 0,
            peakVelocity: state.velocityHistory?.length > 0 ?
                Math.max(...state.velocityHistory) : 0,
            velocityLoss: this.calculateVelocityLoss(state.velocity, state),
            formScore: this.calculateFormScore(state)
        };
        progress.completedSets.push(setData);
        // Reset exercise state for next set
        state.reps = 0;
        state.state = 'idle';
        state.velocityHistory = [];
        // Check if exercise is complete
        if (progress.completedSets.length >= progress.config.sets) {
            progress.isCompleted = true;
            this.voiceAgent.onSetComplete?.(this.currentExercise, setData);
            this.autoAdvanceExercise();
        }
        else {
            // Start rest period
            this.startRest();
        }
        this.updateUI();
    }
    startRest() {
        const progress = this.exerciseProgress.get(this.currentExercise);
        this.isResting = true;
        this.restStartTime = Date.now() / 1000;
        const restDuration = progress.config.restDuration;
        // Show rest timer
        const restTimer = document.getElementById('restTimer');
        if (restTimer) {
            restTimer.classList.add('active');
        }
        // Auto-end rest after duration
        this.restTimer = window.setTimeout(() => {
            this.endRest();
        }, restDuration * 1000);
        // Voice feedback for rest start (if method exists)
        if ('analyzeWorkoutStep' in this.voiceAgent) {
            this.voiceAgent.analyzeWorkoutStep({
                exercise: this.currentExercise,
                state: 'resting',
                restDuration: restDuration
            });
        }
    }
    endRest() {
        this.isResting = false;
        this.restStartTime = 0;
        if (this.restTimer) {
            clearTimeout(this.restTimer);
            this.restTimer = undefined;
        }
        // Hide rest timer
        const restTimer = document.getElementById('restTimer');
        if (restTimer) {
            restTimer.classList.remove('active');
        }
        // Move to next set
        const progress = this.exerciseProgress.get(this.currentExercise);
        progress.currentSet++;
        this.updateUI();
        // Voice feedback for rest end (if method exists)  
        if ('analyzeWorkoutStep' in this.voiceAgent) {
            this.voiceAgent.analyzeWorkoutStep({
                exercise: this.currentExercise,
                state: 'ready',
                message: 'Rest complete, ready for next set'
            });
        }
    }
    skipRest() {
        if (this.isResting) {
            this.endRest();
        }
    }
    autoAdvanceExercise() {
        const exercises = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
        const currentIndex = exercises.indexOf(this.currentExercise);
        // Find next incomplete exercise
        for (let i = currentIndex + 1; i < exercises.length; i++) {
            const nextExercise = exercises[i];
            const progress = this.exerciseProgress.get(nextExercise);
            if (!progress.isCompleted) {
                this.switchExercise(nextExercise);
                return;
            }
        }
        // If all exercises complete
        this.completeWorkout();
    }
    nextExercise() {
        const exercises = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
        const currentIndex = exercises.indexOf(this.currentExercise);
        if (currentIndex < exercises.length - 1) {
            this.switchExercise(exercises[currentIndex + 1]);
        }
    }
    switchExercise(exercise) {
        if (this.isResting) {
            this.endRest();
        }
        this.currentExercise = exercise;
        this.updateUI();
        this.voiceAgent.onExerciseStart?.(exercise);
    }
    completeWorkout() {
        this.running = false;
        this.voiceAgent.onWorkoutComplete?.();
        // Show completion message
        setTimeout(() => {
            alert("Workout Complete! Excellent work!");
        }, 1000);
    }
    updateRestDisplay() {
        if (!this.isResting)
            return;
        const progress = this.exerciseProgress.get(this.currentExercise);
        const elapsed = (Date.now() / 1000) - this.restStartTime;
        const remaining = Math.max(0, progress.config.restDuration - elapsed);
        const restTimeEl = document.getElementById('restTime');
        if (restTimeEl) {
            const minutes = Math.floor(remaining / 60);
            const seconds = Math.floor(remaining % 60);
            restTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    updateMetrics(stepData) {
        const elements = {
            reps: document.getElementById('metricReps'),
            angle: document.getElementById('metricAngle'),
            velocity: document.getElementById('metricVelocity'),
            form: document.getElementById('metricForm'),
            vl: document.getElementById('metricVL')
        };
        if (elements.reps)
            elements.reps.textContent = stepData.reps.toString();
        if (elements.angle)
            elements.angle.textContent = `${Math.round(stepData.angle)}°`;
        if (elements.velocity)
            elements.velocity.textContent = stepData.velocity !== 0 ? `${Math.round(stepData.velocity)}°/s` : '—';
        if (elements.form)
            elements.form.textContent = Math.round(stepData.formScore).toString();
        if (elements.vl) {
            const vlPercent = Math.round(stepData.velocityLoss * 100);
            elements.vl.textContent = `${vlPercent}%`;
            const threshold = this.intensityConfigs[this.currentIntensity].vlThreshold;
            if (stepData.velocityLoss > threshold) {
                elements.vl.style.color = '#ef4444';
            }
            else if (stepData.velocityLoss > threshold * 0.8) {
                elements.vl.style.color = '#f59e0b';
            }
            else {
                elements.vl.style.color = '#22c55e';
            }
        }
    }
    updateUI() {
        // Update exercise selection
        document.querySelectorAll('.exercise-card').forEach(card => {
            card.classList.remove('active', 'completed');
            const exerciseType = card.dataset.exercise;
            const progress = this.exerciseProgress.get(exerciseType);
            if (exerciseType === this.currentExercise) {
                card.classList.add('active');
            }
            if (progress?.isCompleted) {
                card.classList.add('completed');
            }
            // Update progress bar
            const progressBar = card.querySelector('.progress-fill');
            const progressText = card.querySelector('.exercise-progress div');
            if (progressBar && progressText && progress) {
                const completedSets = progress.completedSets.length;
                const totalSets = progress.config.sets;
                const progressPercent = (completedSets / totalSets) * 100;
                progressBar.style.width = `${progressPercent}%`;
                progressText.textContent = `Set ${progress.currentSet} of ${totalSets}`;
            }
        });
        // Update current exercise display
        const currentExerciseEl = document.getElementById('currentExercise');
        const currentSetEl = document.getElementById('currentSet');
        const targetRepsEl = document.getElementById('targetReps');
        const setStatusEl = document.getElementById('setStatus');
        if (currentExerciseEl) {
            const exerciseNames = {
                shoulder_press: 'Shoulder Press',
                lateral_raise: 'Lateral Raise',
                front_raise: 'Front Raise',
                rear_delt_fly: 'Rear Delt Fly',
                bicep_curl: 'Bicep Curl'
            };
            currentExerciseEl.textContent = exerciseNames[this.currentExercise];
        }
        const progress = this.exerciseProgress.get(this.currentExercise);
        if (currentSetEl)
            currentSetEl.textContent = `${progress.currentSet} of ${progress.config.sets}`;
        if (targetRepsEl)
            targetRepsEl.textContent = progress.config.targetReps.toString();
        if (setStatusEl) {
            if (this.isResting) {
                setStatusEl.textContent = "Resting";
                setStatusEl.className = "stat-value warning";
            }
            else if (!this.running) {
                setStatusEl.textContent = "Ready";
                setStatusEl.className = "stat-value";
            }
            else {
                setStatusEl.textContent = "Active";
                setStatusEl.className = "stat-value good";
            }
        }
    }
    // Drawing methods (simplified for space)
    drawPoseSkeleton(landmarks, w, h) {
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
        landmarks.forEach((point) => {
            this.ctx.beginPath();
            this.ctx.arc(point.x * w, point.y * h, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    drawNoPersonMessage() {
        this.ctx.fillStyle = "rgba(255, 80, 80, 1)";
        this.ctx.font = "24px system-ui";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Position yourself in frame to begin", this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.textAlign = "left";
    }
    stop() {
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
    toggleVoice() {
        const enabled = this.voiceAgent.toggle();
        const btn = document.getElementById('btnToggleVoice');
        if (btn) {
            btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
        }
    }
    getCurrentExercise() {
        return this.currentExercise;
    }
    destroy() {
        this.stop();
        this.visualDashboard.reset();
    }
}
// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new VelocityCoachAI();
    window.velocityCoachAI = app;
});
//# sourceMappingURL=fixedVelocityCoach.js.map