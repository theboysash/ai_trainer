// src/main.ts - FIXED with Voice Agent
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { BicepCurlApp } from "./app";
import { VoiceAgent } from "./voiceAgent";
import { VoiceTestingUI } from "./voiceTestingUI";

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const btnStart = document.getElementById("btnStart") as HTMLButtonElement;
const btnStop = document.getElementById("btnStop") as HTMLButtonElement;
const btnDownload = document.getElementById("btnDownload") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;
const hudSet = document.getElementById("hudSet")!;
const hudSetsDone = document.getElementById("hudSetsDone")!;
const hudReps = document.getElementById("hudReps")!;
const hudAngle = document.getElementById("hudAngle")!;
const hudVel = document.getElementById("hudVel")!;
const hudState = document.getElementById("hudState")!;
const hudClap = document.getElementById("hudClap")!;

let landmarker: PoseLandmarker | undefined;
let stream: MediaStream | undefined;
let running = false;

const app = new BicepCurlApp();

// Voice Agent initialization
const voiceAgent = new VoiceAgent();
const testingUI = new VoiceTestingUI(voiceAgent);

// Add voice agent controls to existing UI
const voiceControls = createVoiceControls();
document.querySelector('.wrap')?.appendChild(voiceControls);

// Keyboard shortcut for testing UI toggle
document.addEventListener('keydown', (e) => {
  if (e.key === 'v' && e.ctrlKey) {
    e.preventDefault();
    testingUI.toggle();
  }
});

function createVoiceControls(): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 10px;
    padding: 12px;
    background: #162031;
    border-radius: 8px;
  `;

  const voiceToggle = document.createElement('button');
  voiceToggle.textContent = 'Voice Coach ON';
  voiceToggle.style.cssText = `
    background: #22c55e;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  `;

  voiceToggle.onclick = () => {
    const enabled = voiceAgent.toggle();
    voiceToggle.textContent = enabled ? 'Voice Coach ON' : 'Voice Coach OFF';
    voiceToggle.style.background = enabled ? '#22c55e' : '#ef4444';
  };

  const intensitySelect = document.createElement('select');
  intensitySelect.innerHTML = `
    <option value="light">Light Training (40-60% 1RM)</option>
    <option value="moderate" selected>Moderate Training (65-75% 1RM)</option>
    <option value="intense">Intense Training (80-90% 1RM)</option>
  `;
  intensitySelect.style.cssText = `
    background: #1b2a3a;
    color: white;
    border: 1px solid #2d3b4e;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
  `;

  intensitySelect.onchange = () => {
    voiceAgent.setIntensity(intensitySelect.value as any);
  };

  const testingToggle = document.createElement('button');
  testingToggle.textContent = 'Testing Panel';
  testingToggle.style.cssText = `
    background: #1b2a3a;
    color: #50d7ff;
    border: 1px solid #2d3b4e;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
  `;

  testingToggle.onclick = () => testingUI.toggle();

  const helpText = document.createElement('span');
  helpText.textContent = 'Press Ctrl+V to toggle testing panel';
  helpText.style.cssText = `
    font-size: 12px;
    color: #64748b;
  `;

  container.appendChild(voiceToggle);
  container.appendChild(intensitySelect);
  container.appendChild(testingToggle);
  container.appendChild(helpText);

  return container;
}

// Pose skeleton connections
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24], // torso
  [11, 13], [13, 15], [12, 14], [14, 16], // arms
  [23, 25], [25, 27], [24, 26], [26, 28], // legs
  [27, 29], [29, 31], [28, 30], [30, 32], // feet
];

btnStart.onclick = start;
btnStop.onclick = stopAll;
btnDownload.onclick = () => app.downloadCSVs();

async function start() {
  btnStart.disabled = true;
  statusEl.textContent = "initializing...";

  try {
    // Camera setup
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    video.srcObject = stream;
    await video.play();

    // MediaPipe setup
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPoseTrackingConfidence: 0.5
    } as any);

    running = true;
    btnStop.disabled = false;
    btnDownload.disabled = false;
    statusEl.textContent = "running";
    
    // Voice agent startup message
    voiceAgent.testMessage('instruction');
    
    loop();
  } catch (error) {
    console.error('Startup error:', error);
    statusEl.textContent = "error - check console";
    btnStart.disabled = false;
  }
}

function stopAll() {
  running = false;
  statusEl.textContent = "stopping...";
  
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = undefined;
  }
  
  landmarker = undefined;
  app.endAndSummarize();
  voiceAgent.clearQueue();
  
  statusEl.textContent = "stopped";
  btnStart.disabled = false;
  btnStop.disabled = true;
}

function loop() {
  if (!running || !landmarker) return;

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
  } catch {}

  if (res.landmarks && res.landmarks[0]) {
    const lm = res.landmarks[0];

    // Draw skeleton
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0, 200, 255, 0.9)";
    ctx.beginPath();
    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = lm[a], pb = lm[b];
      if (!pa || !pb) continue;
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
    }
    ctx.stroke();

    // Draw joints
    ctx.fillStyle = "rgba(255, 180, 0, 0.95)";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Core analysis + voice integration
    const info = app.step(lm, nowMs / 1000);
    
    // Voice agent analysis
    voiceAgent.analyzeStep(info, app.counter.set_index);

    // Highlight active arm
    const pts = info.joints.map(i => [lm[i].x * w, lm[i].y * h] as [number, number]);
    ctx.strokeStyle = "rgba(50, 255, 170, 1)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.stroke();

    // Enhanced HUD with voice status
    drawText(`VelocityCoach AI | Set #${app.counter.set_index}`, 20, 32);
    drawText(`Sets completed: ${info.setsCompleted}`, 20, 60);
    drawText(`Reps (this set): ${info.reps}`, 20, 88);
    drawText(`Angle: ${info.angle.toFixed(0)}° | Velocity: ${formatSigned(info.vel)}°/s`, 20, 116);
    drawText(`State: ${info.state}`, 20, 144);

    // Voice agent status
    const voiceStatus = voiceAgent.getStatus();
    const statusColor = voiceStatus.enabled ? "rgba(34, 197, 94, 1)" : "rgba(239, 68, 68, 1)";
    drawText(`Voice Coach: ${voiceStatus.enabled ? 'ON' : 'OFF'} | ${voiceStatus.intensity.toUpperCase()}`, 20, 172, statusColor);
    
    if (voiceStatus.queueLength > 0) {
      drawText(`Queued: ${voiceStatus.queueLength} messages`, 20, 200, "rgba(245, 158, 11, 1)");
    }

    // Performance metrics
    if (info.pcv_last != null && info.mcv_last != null) {
      drawText(`Last rep - PCV: ${info.pcv_last.toFixed(0)}°/s | MCV: ${info.mcv_last.toFixed(0)}°/s`, 20, 228);
    }
    
    if (info.set_avgs) {
      const [apcv, amcv] = info.set_avgs;
      drawText(`Set avg - PCV: ${apcv.toFixed(0)}°/s | MCV: ${amcv.toFixed(0)}°/s`, 20, 256);
    }

    // Set completion flash
    if (app.counter.should_flash_banner(nowMs / 1000)) {
      drawText(`SET COMPLETED!`, 20, h - 70, "rgba(0,255,0,1)");
    }

    // Clap distance debug
    drawText(`Clap dist: ${info.clapDist.toFixed(3)}`, 20, h - 10, "rgba(180,255,180,1)");

    // Update HUD badges
    hudSet.textContent = `Set #${app.counter.set_index}`;
    hudSetsDone.textContent = `${info.setsCompleted}`;
    hudReps.textContent = `${info.reps}`;
    hudAngle.textContent = `${info.angle.toFixed(0)}°`;
    hudVel.textContent = `${formatSigned(info.vel)}°/s`;
    hudState.textContent = `${info.state}`;
    hudClap.textContent = `${info.clapDist.toFixed(3)}`;
    
  } else {
    drawText("No person detected", 20, 32, "rgba(255,80,80,1)");
  }

  if (running) requestAnimationFrame(loop);
}

function drawText(s: string, x: number, y: number, color = "rgba(255,255,255,1)") {
  ctx.fillStyle = color;
  ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(s, x, y);
}

function formatSigned(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}`;
}

// Cleanup on tab close
window.addEventListener("beforeunload", () => {
  if (running) {
    app.endAndSummarize();
    voiceAgent.clearQueue();
  }
});