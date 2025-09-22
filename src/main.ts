// src/main.ts
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { BicepCurlApp } from "./app";

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

// === NEW: simple skeleton connections for a fuller drawing (Python-like) ===
const POSE_CONNECTIONS: [number, number][] = [
  // shoulders / torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // arms
  [11, 13], [13, 15], [12, 14], [14, 16],
  // legs
  [23, 25], [25, 27], [24, 26], [26, 28],
  // feet
  [27, 29], [29, 31], [28, 30], [30, 32],
];

btnStart.onclick = start;
btnStop.onclick = stopAll;
btnDownload.onclick = () => app.downloadCSVs();

async function start() {
  btnStart.disabled = true;
  statusEl.textContent = "initializing…";

  // camera
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });
  video.srcObject = stream;
  await video.play();

  // mediapipe
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      // You can swap to "pose_landmarker_full" for nicer stability (slower):
      // "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPoseTrackingConfidence: 0.5
  } as any); // tasks-vision types vary by version; cast keeps TS happy

  running = true;
  btnStop.disabled = false;
  btnDownload.disabled = false;
  statusEl.textContent = "running";
  loop();
}

function stopAll() {
  running = false;
  statusEl.textContent = "stopping…";
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = undefined;
  }
  landmarker = undefined; // GC handles cleanup
  app.endAndSummarize();
  statusEl.textContent = "stopped";
  btnStart.disabled = false;
  btnStop.disabled = true;
}

function loop() {
  if (!running || !landmarker) return;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w; canvas.height = h;

  const nowMs = performance.now();
  const res = landmarker.detectForVideo(video, nowMs);

  ctx.clearRect(0, 0, w, h);
  // draw camera frame (may be blocked on some iOS modes; HUD still works)
  try { ctx.drawImage(video, 0, 0, w, h); } catch {}

  if (res.landmarks && res.landmarks[0]) {
    const lm = res.landmarks[0];

    // === NEW: draw full skeleton connections + round joints ===
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

    ctx.fillStyle = "rgba(255, 180, 0, 0.95)";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // step logic
    const info = app.step(lm, nowMs / 1000);

    // highlight chosen arm polyline (shoulder–elbow–wrist)
    const pts = info.joints.map(i => [lm[i].x * w, lm[i].y * h] as [number, number]);
    ctx.strokeStyle = "rgba(50, 255, 170, 1)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.stroke();

    // HUD text
    drawText(`Bicep Curls | Set #${app.counter.set_index}`, 20, 32);
    drawText(`Sets completed: ${info.setsCompleted}`, 20, 60);
    drawText(`Reps (this set): ${info.reps}`, 20, 88);
    drawText(`Angle: ${info.angle.toFixed(0)}°   Velocity: ${formatSigned(info.vel)}°/s`, 20, 116);
    drawText(`State: ${info.state}`, 20, 144);

    if (info.pcv_last != null && info.mcv_last != null) {
      drawText(
        `Last rep — PCV: ${info.pcv_last.toFixed(0)}°/s  MCV: ${info.mcv_last.toFixed(0)}°/s`,
        20, 172
      );
    }
    if (info.set_avgs) {
      const [apcv, amcv] = info.set_avgs;
      drawText(`Set avg — PCV: ${apcv.toFixed(0)}°/s  MCV: ${amcv.toFixed(0)}°/s`, 20, 200);
    }

    if (app.counter.should_flash_banner(nowMs / 1000)) {
      drawText(`Set ended!`, 20, h - 70, "rgba(0,255,0,1)");
    }

    drawText(`Clap dist: ${info.clapDist.toFixed(3)}`, 20, h - 10, "rgba(180,255,180,1)");

    // update badges
    hudSet.textContent = `Set #${app.counter.set_index}`;
    hudSetsDone.textContent = `Sets: ${info.setsCompleted}`;
    hudReps.textContent = `Reps: ${info.reps}`;
    hudAngle.textContent = `Angle: ${info.angle.toFixed(0)}°`;
    hudVel.textContent = `Vel: ${formatSigned(info.vel)}°/s`;
    hudState.textContent = `State: ${info.state}`;
    hudClap.textContent = `Clap dist: ${info.clapDist.toFixed(3)}`;
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

// guard: close tab → summarize
window.addEventListener("beforeunload", () => {
  if (running) app.endAndSummarize();
});
