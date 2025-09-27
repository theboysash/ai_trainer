// src/multiExerciseMain.ts
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { WorkoutManager } from "./workoutManager";
import { MultiExerciseVoiceAgent } from "./multiExerciseVoiceAgent";
import { getExerciseConfig } from "./exerciseConfigs";
// DOM Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
// Control buttons
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnExport = document.getElementById("btnExport");
const btnSkipRest = document.getElementById("btnSkipRest");
const btnCompleteSet = document.getElementById("btnCompleteSet");
const btnNextExercise = document.getElementById("btnNextExercise");
const btnToggleVoice = document.getElementById("btnToggleVoice");
// UI Elements
const exerciseGrid = document.getElementById("exerciseGrid");
const metricsBar = document.getElementById("metricsBar");
const restTimer = document.getElementById("restTimer");
const voiceStatus = document.getElementById("voiceStatus");
// Metrics displays
const metricReps = document.getElementById("metricReps");
const metricAngle = document.getElementById("metricAngle");
const metricVelocity = document.getElementById("metricVelocity");
const metricForm = document.getElementById("metricForm");
const metricVL = document.getElementById("metricVL");
// Stats displays
const currentExercise = document.getElementById("currentExercise");
const currentSet = document.getElementById("currentSet");
const targetReps = document.getElementById("targetReps");
const setStatus = document.getElementById("setStatus");
const totalSets = document.getElementById("totalSets");
const totalReps = document.getElementById("totalReps");
const workoutDuration = document.getElementById("workoutDuration");
const estimatedTime = document.getElementById("estimatedTime");
const restTime = document.getElementById("restTime");
// System components
let landmarker;
let stream;
let running = false;
const workoutManager = new WorkoutManager();
const voiceAgent = new MultiExerciseVoiceAgent();
// Pose connections for visualization
const POSE_CONNECTIONS = [
    [11, 12], [11, 23], [12, 24], [23, 24], // torso
    [11, 13], [13, 15], [12, 14], [14, 16], // arms
    [23, 25], [25, 27], [24, 26], [26, 28], // legs
];
// Initialize UI
initializeExerciseGrid();
setupEventListeners();
setupWorkoutManagerCallbacks();
function initializeExerciseGrid() {
    const shoulderExercises = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
    exerciseGrid.innerHTML = '';
    shoulderExercises.forEach(exerciseType => {
        const config = getExerciseConfig(exerciseType);
        const card = createExerciseCard(config);
        exerciseGrid.appendChild(card);
    });
}
function createExerciseCard(config) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.exercise = config.type;
    card.innerHTML = `
    <div class="exercise-name">${config.name}</div>
    <div class="exercise-meta">
      <span>Target: ${config.thresholds.minROM}° ROM</span>
      <span>Sets: ${workoutManager.getCurrentExerciseProgress().targetSets}</span>
    </div>
    <div class="exercise-progress">
      <div>Set 1 of ${workoutManager.getCurrentExerciseProgress().targetSets}</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
    </div>
  `;
    card.addEventListener('click', () => {
        selectExercise(config.type);
    });
    return card;
}
function selectExercise(exerciseType) {
    if (running) {
        workoutManager.switchToExercise(exerciseType);
        voiceAgent.onExerciseStart(exerciseType);
        updateExerciseSelection();
        updateCurrentExerciseDisplay();
    }
}
function updateExerciseSelection() {
    const cards = exerciseGrid.querySelectorAll('.exercise-card');
    cards.forEach(card => {
        card.classList.remove('active', 'completed');
        const exerciseType = card.dataset.exercise;
        const progress = workoutManager.getCurrentExerciseProgress();
        if (exerciseType === workoutManager['session'].currentExercise) {
            card.classList.add('active');
        }
        if (progress.isCompleted) {
            card.classList.add('completed');
        }
        // Update progress within card
        const progressBar = card.querySelector('.progress-fill');
        const progressText = card.querySelector('.exercise-progress div');
        if (progressBar && progressText) {
            const completedSets = progress.completedSets.length;
            const totalSets = progress.targetSets;
            const progressPercent = (completedSets / totalSets) * 100;
            progressBar.style.width = `${progressPercent}%`;
            progressText.textContent = `Set ${progress.currentSet} of ${totalSets}`;
        }
    });
}
function setupEventListeners() {
    btnStart.onclick = start;
    btnStop.onclick = stopWorkout;
    btnExport.onclick = exportData;
    btnSkipRest.onclick = () => workoutManager.skipRest();
    btnCompleteSet.onclick = () => workoutManager.forceCompleteSet();
    btnNextExercise.onclick = switchToNextExercise;
    btnToggleVoice.onclick = toggleVoice;
}
function setupWorkoutManagerCallbacks() {
    workoutManager.onSetComplete = (exercise, setData) => {
        voiceAgent.onSetComplete(exercise, setData);
        updateWorkoutStats();
        updateExerciseSelection();
    };
    workoutManager.onExerciseComplete = (exercise) => {
        voiceAgent.onExerciseComplete(exercise);
        updateExerciseSelection();
    };
    workoutManager.onRepComplete = (exercise, reps) => {
        updateCurrentSetDisplay();
    };
    workoutManager.onRestStart = (exercise, restDuration) => {
        showRestTimer(restDuration);
    };
    workoutManager.onRestEnd = (exercise) => {
        hideRestTimer();
        updateCurrentExerciseDisplay();
    };
    workoutManager.onWorkoutComplete = (session) => {
        voiceAgent.onWorkoutComplete();
        completeWorkout();
    };
}
async function start() {
    btnStart.disabled = true;
    setStatus.textContent = "Initializing...";
    try {
        // Camera setup
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
        });
        video.srcObject = stream;
        await video.play();
        // MediaPipe setup
        const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPoseTrackingConfidence: 0.5
        });
        running = true;
        btnStop.disabled = false;
        btnExport.disabled = false;
        setStatus.textContent = "Active";
        // Initialize first exercise
        voiceAgent.onExerciseStart('shoulder_press');
        updateExerciseSelection();
        updateCurrentExerciseDisplay();
        loop();
    }
    catch (error) {
        console.error('Startup error:', error);
        setStatus.textContent = "Error";
        btnStart.disabled = false;
    }
}
function stopWorkout() {
    running = false;
    setStatus.textContent = "Stopping...";
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = undefined;
    }
    landmarker = undefined;
    voiceAgent.clearQueue();
    setStatus.textContent = "Stopped";
    btnStart.disabled = false;
    btnStop.disabled = true;
}
function loop() {
    if (!running || !landmarker)
        return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const nowMs = performance.now();
    const res = landmarker.detectForVideo(video, nowMs);
    ctx.clearRect(0, 0, w, h);
    // Draw camera frame
    try {
        ctx.drawImage(video, 0, 0, w, h);
    }
    catch { }
    if (res.landmarks && res.landmarks[0]) {
        const lm = res.landmarks[0];
        // Draw skeleton
        drawSkeleton(lm, w, h);
        // Process workout step
        const stepData = workoutManager.step(lm, nowMs / 1000);
        // Voice agent analysis
        voiceAgent.analyzeWorkoutStep(stepData);
        // Highlight active joints for current exercise
        highlightActiveJoints(lm, stepData, w, h);
        // Update UI
        updateRealTimeMetrics(stepData);
        updateCurrentSetDisplay(stepData);
        if (stepData.isResting) {
            updateRestTimer(stepData.restTimeRemaining);
        }
    }
    else {
        // No person detected
        ctx.fillStyle = "rgba(255,80,80,1)";
        ctx.font = "24px system-ui";
        ctx.fillText("No person detected", 20, 50);
    }
    if (running)
        requestAnimationFrame(loop);
}
function drawSkeleton(landmarks, w, h) {
    // Draw connections
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 200, 255, 0.8)";
    ctx.beginPath();
    for (const [a, b] of POSE_CONNECTIONS) {
        const pa = landmarks[a], pb = landmarks[b];
        if (!pa || !pb)
            continue;
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
    }
    ctx.stroke();
    // Draw joints
    ctx.fillStyle = "rgba(255, 180, 0, 0.9)";
    for (const p of landmarks) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
function highlightActiveJoints(landmarks, stepData, w, h) {
    const currentExType = workoutManager['session'].currentExercise;
    const config = getExerciseConfig(currentExType);
    const joints = config.landmarks.primary;
    // Highlight primary joints
    ctx.strokeStyle = "rgba(50, 255, 170, 1)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < joints.length - 1; i++) {
        const p1 = landmarks[joints[i]];
        const p2 = landmarks[joints[i + 1]];
        if (!p1 || !p2)
            continue;
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
    }
    ctx.stroke();
    // Highlight joints with larger circles
    ctx.fillStyle = "rgba(50, 255, 170, 0.8)";
    joints.forEach(jointIdx => {
        const joint = landmarks[jointIdx];
        if (!joint)
            return;
        ctx.beginPath();
        ctx.arc(joint.x * w, joint.y * h, 8, 0, Math.PI * 2);
        ctx.fill();
    });
}
function updateRealTimeMetrics(stepData) {
    metricReps.textContent = stepData.reps.toString();
    metricAngle.textContent = `${Math.round(stepData.angle)}°`;
    metricVelocity.textContent = stepData.velocity !== 0 ? `${Math.round(stepData.velocity)}°/s` : '—';
    metricForm.textContent = stepData.formScore > 0 ? Math.round(stepData.formScore).toString() : '—';
    // Velocity Loss with color coding
    const vlPercent = Math.round(stepData.velocityLoss * 100) || 0;
    metricVL.textContent = `${vlPercent}%`;
    if (vlPercent > 25) {
        metricVL.style.color = '#ef4444';
    }
    else if (vlPercent > 15) {
        metricVL.style.color = '#f59e0b';
    }
    else {
        metricVL.style.color = '#22c55e';
    }
}
function updateCurrentExerciseDisplay() {
    const currentExType = workoutManager['session'].currentExercise;
    const config = getExerciseConfig(currentExType);
    const progress = workoutManager.getCurrentExerciseProgress();
    currentExercise.textContent = config.name;
    currentSet.textContent = `${progress.currentSet} of ${progress.targetSets}`;
    targetReps.textContent = progress.targetReps.toString();
}
function updateCurrentSetDisplay(stepData) {
    if (stepData) {
        if (stepData.isResting) {
            setStatus.textContent = "Resting";
            setStatus.className = "stat-value warning";
        }
        else if (stepData.state === 'idle') {
            setStatus.textContent = "Ready";
            setStatus.className = "stat-value";
        }
        else {
            setStatus.textContent = "Active";
            setStatus.className = "stat-value good";
        }
    }
}
function updateWorkoutStats() {
    const summary = workoutManager.getSessionSummary();
    totalSets.textContent = summary.exercisesCompleted.toString();
    totalReps.textContent = summary.totalVolume.toString();
    const minutes = Math.floor(summary.currentDuration / 60);
    const seconds = summary.currentDuration % 60;
    workoutDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (summary.estimatedTimeRemaining > 0) {
        const estMinutes = Math.floor(summary.estimatedTimeRemaining / 60);
        estimatedTime.textContent = `${estMinutes}:${(summary.estimatedTimeRemaining % 60).toString().padStart(2, '0')}`;
    }
    else {
        estimatedTime.textContent = "—";
    }
}
function showRestTimer(duration) {
    restTimer.style.display = 'block';
    restTimer.classList.add('active');
}
function hideRestTimer() {
    restTimer.style.display = 'none';
    restTimer.classList.remove('active');
}
function updateRestTimer(remaining) {
    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.round(remaining % 60);
        restTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
function switchToNextExercise() {
    const nextExercise = workoutManager.nextExercise();
    if (nextExercise) {
        selectExercise(nextExercise);
    }
}
function toggleVoice() {
    const enabled = voiceAgent.toggle();
    btnToggleVoice.textContent = enabled ? 'Voice: ON' : 'Voice: OFF';
    if (enabled) {
        voiceStatus.classList.remove('voice-disabled');
        voiceStatus.querySelector('span:last-child').textContent = 'Voice Coach Active';
    }
    else {
        voiceStatus.classList.add('voice-disabled');
        voiceStatus.querySelector('span:last-child').textContent = 'Voice Coach Disabled';
    }
}
function completeWorkout() {
    setStatus.textContent = "Complete";
    setStatus.className = "stat-value good";
    btnStop.disabled = true;
    btnStart.disabled = false;
    // Show completion animation or modal
    setTimeout(() => {
        alert("Workout Complete! Great job!");
    }, 2000);
}
function exportData() {
    try {
        const data = workoutManager.exportSessionData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workout_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    catch (error) {
        console.error('Export error:', error);
        alert('Export failed. Check console for details.');
    }
}
// Initialize UI updates
setInterval(() => {
    if (running) {
        updateWorkoutStats();
    }
}, 1000);
// Cleanup
window.addEventListener("beforeunload", () => {
    if (running) {
        stopWorkout();
    }
});
//# sourceMappingURL=multiExerciseMain.js.map