// src/finalWorkingIntegration.ts - COMPLETE WORKING SOLUTION
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { ExerciseDetector } from './exerciseSystem';
import { getExerciseConfig } from './exerciseConfigs';
import { ImprovedLateralRaiseDetector } from './improvedLateralRaiseDetection';
// Enhanced Voice Agent with VBT Integration
class VBTIntegratedVoiceAgent {
    synthesis;
    voice = null;
    isEnabled = true;
    messageQueue = [];
    lastSpoken = 0;
    MIN_SPEAK_INTERVAL = 5000;
    // VBT from your PDF
    intensityThresholds = {
        light: 0.20, // 15-20%
        moderate: 0.25, // 20-25%
        intense: 0.40 // 30-40%
    };
    currentIntensity = 'moderate';
    exerciseData = new Map();
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.initializeVoice();
        this.startMessageProcessor();
    }
    initializeVoice() {
        const loadVoices = () => {
            const voices = this.synthesis.getVoices();
            this.voice = voices.find(v => v.name.includes('Google') ||
                v.name.includes('Microsoft') ||
                v.lang.startsWith('en')) || voices[0];
        };
        loadVoices();
        this.synthesis.onvoiceschanged = loadVoices;
    }
    startMessageProcessor() {
        setInterval(() => {
            if (this.messageQueue.length > 0 && Date.now() - this.lastSpoken > this.MIN_SPEAK_INTERVAL) {
                const message = this.messageQueue.shift();
                this.speakMessage(message);
            }
        }, 1000);
    }
    updateIntensity(intensity) {
        this.currentIntensity = intensity;
        const thresholds = { light: '15-20%', moderate: '20-25%', intense: '30-40%' };
        this.queueMessage({
            message: `Training intensity set to ${intensity}. Target velocity loss threshold: ${thresholds[intensity]}.`,
            priority: 'high'
        });
    }
    onExerciseStart(exercise) {
        const config = getExerciseConfig(exercise);
        // Reset exercise tracking
        this.exerciseData.set(exercise, {
            velocityHistory: [],
            baseline: null,
            lastWarning: 0
        });
        this.queueMessage({
            message: `Starting ${config.name}. Focus on controlled movement.`,
            priority: 'medium'
        });
    }
    analyzeWorkoutStep(stepData) {
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
    trackVelocity(exercise, velocity) {
        let data = this.exerciseData.get(exercise);
        if (!data) {
            data = { velocityHistory: [], baseline: null, lastWarning: 0 };
            this.exerciseData.set(exercise, data);
        }
        data.velocityHistory.push(velocity);
        if (!data.baseline && data.velocityHistory.length >= 3) {
            data.baseline = data.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
        }
        if (data.velocityHistory.length > 15) {
            data.velocityHistory = data.velocityHistory.slice(-12);
        }
    }
    checkVelocityLoss(stepData) {
        const data = this.exerciseData.get(stepData.exercise);
        if (!data || !data.baseline || data.velocityHistory.length < 4)
            return;
        const recent = data.velocityHistory.slice(-3);
        const currentAvg = recent.reduce((a, b) => a + b) / recent.length;
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
    getVLThreshold(exercise) {
        const baseThreshold = this.intensityThresholds[this.currentIntensity];
        const exerciseModifiers = {
            shoulder_press: 1.0,
            lateral_raise: 0.85,
            front_raise: 0.85,
            rear_delt_fly: 0.75,
            bicep_curl: 0.9
        };
        return baseThreshold * (exerciseModifiers[exercise] || 1.0);
    }
    handleNewRep(stepData) {
        if (stepData.reps % 4 === 0) {
            this.queueMessage({
                message: `${stepData.reps} reps completed. Stay focused on form.`,
                priority: 'low'
            });
        }
    }
    onSetComplete(exercise, setData) {
        const config = getExerciseConfig(exercise);
        this.queueMessage({
            message: `${config.name} set complete. ${setData.reps} reps. Great work.`,
            priority: 'medium'
        });
    }
    queueMessage(message) {
        if (this.messageQueue.some(m => m.message === message.message))
            return;
        this.messageQueue.push(message);
        if (this.messageQueue.length > 4) {
            this.messageQueue = this.messageQueue.slice(-4);
        }
    }
    speakMessage(message) {
        if (!this.isEnabled || !this.voice)
            return;
        const utterance = new SpeechSynthesisUtterance(message.message);
        utterance.voice = this.voice;
        utterance.rate = 0.9;
        utterance.volume = 0.8;
        this.synthesis.speak(utterance);
        this.lastSpoken = Date.now();
    }
    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }
    clearQueue() {
        this.messageQueue = [];
        this.synthesis.cancel();
    }
    getStatus() {
        return {
            enabled: this.isEnabled,
            intensity: this.currentIntensity,
            queueLength: this.messageQueue.length,
            vlThreshold: this.intensityThresholds[this.currentIntensity]
        };
    }
}
// Enhanced Dashboard that actually updates
class WorkingVisualDashboard {
    lastUpdateTime = 0;
    UPDATE_INTERVAL = 500; // Update every 500ms
    updateDashboard(stepData) {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.UPDATE_INTERVAL)
            return;
        this.updateMetrics(stepData);
        this.updateExerciseDisplay(stepData);
        this.updateStatus(stepData);
        this.lastUpdateTime = now;
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
        if (elements.velocity) {
            elements.velocity.textContent = stepData.velocity !== 0 ? `${Math.round(stepData.velocity)}°/s` : '—';
        }
        if (elements.form) {
            elements.form.textContent = Math.round(stepData.formScore || 0).toString();
        }
        if (elements.vl) {
            const vlPercent = Math.round((stepData.velocityLoss || 0) * 100);
            elements.vl.textContent = `${vlPercent}%`;
            // Color coding
            if (vlPercent > 25) {
                elements.vl.style.color = '#ef4444';
            }
            else if (vlPercent > 15) {
                elements.vl.style.color = '#f59e0b';
            }
            else {
                elements.vl.style.color = '#22c55e';
            }
        }
    }
    updateExerciseDisplay(stepData) {
        const currentExercise = document.getElementById('currentExercise');
        const setStatus = document.getElementById('setStatus');
        if (currentExercise) {
            const config = getExerciseConfig(stepData.exercise);
            currentExercise.textContent = config.name;
        }
        if (setStatus) {
            const statusMap = {
                'idle': 'Ready',
                'eccentric': 'Lowering',
                'bottom': 'Bottom',
                'concentric': 'Lifting',
                'top': 'Top'
            };
            setStatus.textContent = statusMap[stepData.state] || stepData.state;
        }
    }
    updateStatus(stepData) {
        // Update exercise cards
        document.querySelectorAll('.exercise-card').forEach(card => {
            card.classList.remove('active');
            if (card.dataset.exercise === stepData.exercise) {
                card.classList.add('active');
            }
        });
    }
    onExerciseSwitch(exerciseType) {
        // Update UI for exercise switch
        console.log(`Switched to: ${exerciseType}`);
    }
    onSetComplete(exercise, setData) {
        console.log(`Set complete: ${exercise}, ${setData.reps} reps`);
    }
    reset() {
        // Reset dashboard state
    }
}
// Main Application - WORKING VERSION
export class VelocityCoachAI {
    landmarker;
    voiceAgent = new VBTIntegratedVoiceAgent();
    visualDashboard = new WorkingVisualDashboard();
    exerciseDetectors = new Map();
    currentExercise = 'shoulder_press';
    video;
    canvas;
    ctx;
    stream;
    running = false;
    constructor() {
        this.video = document.getElementById("video");
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.initializeAllDetectors();
        this.setupEventHandlers();
        this.createVBTControls();
    }
    initializeAllDetectors() {
        const exercises = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly', 'bicep_curl'];
        exercises.forEach(exercise => {
            try {
                if (exercise === 'lateral_raise') {
                    this.exerciseDetectors.set(exercise, new ImprovedLateralRaiseDetector());
                }
                else {
                    const config = getExerciseConfig(exercise);
                    this.exerciseDetectors.set(exercise, new ExerciseDetector(config));
                }
            }
            catch (error) {
                console.error(`Failed to initialize detector for ${exercise}:`, error);
            }
        });
        console.log(`Initialized ${this.exerciseDetectors.size} exercise detectors`);
    }
    createVBTControls() {
        const container = document.createElement('div');
        container.innerHTML = `
      <div style="background: #162031; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #2d3b4e;">
        <h4 style="color: #50d7ff; margin: 0 0 10px 0; font-size: 14px;">Velocity-Based Training</h4>
        <select id="vbtIntensitySelect" style="width: 100%; background: #1b2a3a; color: white; border: 1px solid #2d3b4e; padding: 8px; border-radius: 4px;">
          <option value="light">Light (40-60% 1RM, VL ≤20%)</option>
          <option value="moderate" selected>Moderate (65-75% 1RM, VL ≤25%)</option>
          <option value="intense">Intense (80-90% 1RM, VL ≤40%)</option>
        </select>
        <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
          Based on your velocity-loss research model
        </div>
      </div>
    `;
        document.body.insertBefore(container, document.body.firstChild);
        const select = document.getElementById('vbtIntensitySelect');
        if (select) {
            select.addEventListener('change', (e) => {
                const intensity = e.target.value;
                this.voiceAgent.updateIntensity(intensity);
            });
        }
    }
    setupEventHandlers() {
        document.getElementById('btnStart')?.addEventListener('click', () => this.start());
        document.getElementById('btnStop')?.addEventListener('click', () => this.stop());
        document.getElementById('btnToggleVoice')?.addEventListener('click', () => this.toggleVoice());
        // Exercise selection
        document.querySelectorAll('.exercise-card').forEach(card => {
            card.addEventListener('click', () => {
                const exerciseType = card.dataset.exercise;
                if (exerciseType) {
                    this.switchExercise(exerciseType);
                }
            });
        });
    }
    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false
            });
            this.video.srcObject = this.stream;
            await this.video.play();
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
            this.voiceAgent.onExerciseStart(this.currentExercise);
            this.updateUI('running');
            this.loop();
        }
        catch (error) {
            console.error('Failed to start:', error);
            this.updateUI('error');
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
        this.ctx.clearRect(0, 0, w, h);
        try {
            this.ctx.drawImage(this.video, 0, 0, w, h);
        }
        catch { }
        if (result.landmarks && result.landmarks[0]) {
            const landmarks = result.landmarks[0];
            this.drawPoseSkeleton(landmarks, w, h);
            const stepData = this.processCurrentExercise(landmarks, nowMs / 1000);
            this.voiceAgent.analyzeWorkoutStep(stepData);
            this.visualDashboard.updateDashboard(stepData);
            this.highlightActiveExercise(landmarks, w, h);
            this.drawOverlayInfo(stepData, w, h);
        }
        else {
            this.drawNoPersonMessage();
        }
        if (this.running) {
            requestAnimationFrame(() => this.loop());
        }
    }
    processCurrentExercise(landmarks, timestamp) {
        const detector = this.exerciseDetectors.get(this.currentExercise);
        if (!detector) {
            return this.getDefaultStepData();
        }
        try {
            const result = detector.step(landmarks, timestamp);
            return {
                ...result,
                exercise: this.currentExercise,
                timestamp,
                formScore: this.calculateFormScore(result, landmarks),
                velocityLoss: this.getVelocityLoss(detector),
                targetReps: this.getTargetReps(),
                isResting: false,
                restTimeRemaining: 0
            };
        }
        catch (error) {
            console.error(`Error processing ${this.currentExercise}:`, error);
            return this.getDefaultStepData();
        }
    }
    getDefaultStepData() {
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
            targetReps: this.getTargetReps(),
            isResting: false,
            restTimeRemaining: 0
        };
    }
    getVelocityLoss(detector) {
        if (detector && detector.getCurrentVelocityLoss) {
            return detector.getCurrentVelocityLoss();
        }
        return 0;
    }
    getTargetReps() {
        const repTargets = {
            shoulder_press: 8,
            lateral_raise: 12,
            front_raise: 12,
            rear_delt_fly: 15,
            bicep_curl: 10
        };
        return repTargets[this.currentExercise] || 8;
    }
    calculateFormScore(result, landmarks) {
        let score = 100;
        switch (this.currentExercise) {
            case 'lateral_raise':
                if (Math.abs(result.velocity) > 150)
                    score -= 20;
                if (result.angle > 90)
                    score -= 15;
                break;
            case 'shoulder_press':
                if (Math.abs(result.velocity) > 180)
                    score -= 20;
                break;
        }
        return Math.max(0, Math.min(100, score));
    }
    drawPoseSkeleton(landmarks, w, h) {
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
            if (pa && pb && (pa.visibility || 0) > 0.5 && (pb.visibility || 0) > 0.5) {
                this.ctx.moveTo(pa.x * w, pa.y * h);
                this.ctx.lineTo(pb.x * w, pb.y * h);
            }
        });
        this.ctx.stroke();
        this.ctx.fillStyle = "rgba(255, 180, 0, 0.8)";
        landmarks.forEach((point) => {
            if ((point.visibility || 0) > 0.5) {
                this.ctx.beginPath();
                this.ctx.arc(point.x * w, point.y * h, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }
    highlightActiveExercise(landmarks, w, h) {
        const jointMappings = {
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
            if (p1 && p2 && (p1.visibility || 0) > 0.5 && (p2.visibility || 0) > 0.5) {
                this.ctx.moveTo(p1.x * w, p1.y * h);
                this.ctx.lineTo(p2.x * w, p2.y * h);
            }
        }
        this.ctx.stroke();
    }
    drawOverlayInfo(stepData, w, h) {
        const ctx = this.ctx;
        // Background for text
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(10, 10, 300, 120);
        // Text overlay
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "16px system-ui";
        const lines = [
            `Exercise: ${this.currentExercise.replace('_', ' ').toUpperCase()}`,
            `Reps: ${stepData.reps} | Target: ${stepData.targetReps}`,
            `Angle: ${Math.round(stepData.angle)}° | Velocity: ${Math.round(stepData.velocity)}°/s`,
            `Form: ${Math.round(stepData.formScore)}% | VL: ${Math.round(stepData.velocityLoss * 100)}%`,
            `State: ${stepData.state}`
        ];
        lines.forEach((line, i) => {
            ctx.fillText(line, 20, 35 + i * 20);
        });
    }
    drawNoPersonMessage() {
        this.ctx.fillStyle = "rgba(255, 80, 80, 1)";
        this.ctx.font = "24px system-ui";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Position yourself in frame to begin", this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.textAlign = "left";
    }
    switchExercise(exerciseType) {
        if (this.currentExercise !== exerciseType) {
            this.currentExercise = exerciseType;
            const detector = this.exerciseDetectors.get(exerciseType);
            if (detector && detector.reset) {
                detector.reset();
            }
            this.voiceAgent.onExerciseStart(exerciseType);
            this.visualDashboard.onExerciseSwitch(exerciseType);
        }
    }
    toggleVoice() {
        const enabled = this.voiceAgent.toggle();
        const btn = document.getElementById('btnToggleVoice');
        if (btn) {
            btn.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
        }
    }
    stop() {
        this.running = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = undefined;
        }
        this.landmarker = undefined;
        this.voiceAgent.clearQueue();
        this.updateUI('stopped');
    }
    updateUI(state) {
        const statusEl = document.getElementById('setStatus');
        const startBtn = document.getElementById('btnStart');
        const stopBtn = document.getElementById('btnStop');
        if (statusEl) {
            statusEl.textContent = state.charAt(0).toUpperCase() + state.slice(1);
        }
        if (startBtn && stopBtn) {
            startBtn.disabled = state === 'running';
            stopBtn.disabled = state !== 'running';
        }
    }
    getCurrentExercise() {
        return this.currentExercise;
    }
    getVoiceStatus() {
        return this.voiceAgent.getStatus();
    }
    destroy() {
        this.stop();
        this.visualDashboard.reset();
    }
}
// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new VelocityCoachAI();
    window.velocityCoachAI = app;
    console.log('VelocityCoach AI - Working Version Initialized');
    console.log('Features: Pose Detection ✓ | Rep Counting ✓ | VBT Integration ✓ | Voice Coaching ✓');
});
export default VelocityCoachAI;
//# sourceMappingURL=finalWorkingIntegration.js.map