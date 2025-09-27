import Vapi from '@vapi-ai/web';

// 🔒 TEMP ONLY: hardcode for smoke test (swap back to import.meta.env later)
const PUBLIC_KEY   = '7a381b28-b330-47c8-8c24-ed48b4a477d5';
const ASSISTANT_ID = 'ad349484-eed2-4192-b7e4-caa6cb6f31d0';

const vapi = new Vapi(PUBLIC_KEY);

// ------- DOM -------
const startBtn   = document.getElementById('start') as HTMLButtonElement;
const stopBtn    = document.getElementById('stop') as HTMLButtonElement;
const wakeToggle = document.getElementById('wake-toggle') as HTMLInputElement | null;
const fatigueBtn = document.getElementById('fatigue-btn') as HTMLButtonElement | null;

// NEW: form-correction controls
const formSelect = document.getElementById('form-cue') as HTMLSelectElement | null;
const formBtn    = document.getElementById('form-btn')  as HTMLButtonElement | null;
const repsInput = document.getElementById('reps-left') as HTMLInputElement | null;
const repsBtn   = document.getElementById('reps-btn')  as HTMLButtonElement | null;

const logEl      = document.getElementById('log') as HTMLPreElement;

const log = (m: unknown) => {
  const line = typeof m === 'string' ? m : JSON.stringify(m);
  logEl.textContent += `${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
};

// ------- Call control -------
let isCalling = false;

const startCall = async () => {
  if (isCalling) return;
  isCalling = true;
  try {
    await vapi.start(ASSISTANT_ID);
  } catch (e) {
    isCalling = false;
    log(['start failed', e]);
  }
};

const stopCall = () => vapi.stop();

// ------- Vapi events -------
vapi.on('call-start', () => {
  log('call-start');
  startBtn.disabled = true;
  stopBtn.disabled = false;

  // optional: auto-disable wake listening once in a call
  if (wakeToggle && wakeToggle.checked) {
    wakeToggle.checked = false;
    wakeDisable();
    log('Wake word disabled (in-call).');
  }
});

vapi.on('call-end', () => {
  log('call-end');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  isCalling = false;
});

vapi.on('message', (msg: any) => {
  if (msg?.type === 'transcript') log(`${msg.role}: ${msg.transcript}`);
  else log(msg);
});

vapi.on('error', (e: unknown) => log(['error', e]));

// ------- Buttons -------
startBtn.onclick = startCall;
stopBtn.onclick  = stopCall;

// ------- Coaching signal helper (fatigue) -------
// Uses the correct envelope so Vapi appends a user message and triggers a reply.
async function sendFatigueSignal() {
  try {
    await vapi.send({
      type: 'add-message',
      message: {
        role: 'user', // could be 'system' if you want it to be silent context
        content: 'COACH_SIGNAL: fatigue_detected',
      },
    });
    log('Sent add-message: COACH_SIGNAL: fatigue_detected');
  } catch (err) {
    log(['failed to send fatigue signal', err]);
  }
}
async function signalRepsLeft(n: number) {
  if (!Number.isFinite(n) || n <= 0) {
    log(`Invalid reps_left: ${n}`);
    return;
  }
  try {
    await vapi.send({
      type: 'add-message',
      message: {
        role: 'user',
        content: `COACH_SIGNAL: reps_left | ${JSON.stringify({ remaining: n })}`,
      },
    });
    log(`Sent reps_left: ${n}`);
  } catch (err) {
    log(['failed to send reps_left', err]);
  }
}

repsBtn?.addEventListener('click', async () => {
  const n = parseInt(repsInput?.value || '0', 10);
  if (!isCalling) await startCall();
  await signalRepsLeft(n);
});


// Wire the Fatigue button (optional convenience: start call if not active)
if (fatigueBtn) {
  fatigueBtn.onclick = async () => {
    if (!isCalling) await startCall();
    await sendFatigueSignal();
  };
}

// ------- Form correction helpers -------

type CueId = 'elbow_drift' | 'short_rom' | 'elbow_face_plane' | 'hips_high_pushup';

async function signalFormCue(cue: CueId) {
  try {
    await vapi.send({
      type: 'add-message',
      message: {
        role: 'user',
        content: `COACH_SIGNAL: form_flag | ${JSON.stringify({ cue })}`,
      },
    });
    log(`Sent form cue: ${cue}`);
  } catch (err) {
    log(['failed to send form cue', err]);
  }
}

// Wire the Form button (start call if needed, then send selected cue)
formBtn?.addEventListener('click', async () => {
  if (!formSelect) return;
  const cue = formSelect.value as CueId;
  if (!isCalling) await startCall();
  await signalFormCue(cue);
});

// ------- Wake word (“coach”) using Web Speech API -------
// Minimal TS-safe guards around vendor-prefixed API

type SRClass = new () => any;

declare global {
  interface Window {
    webkitSpeechRecognition?: SRClass;
    SpeechRecognition?: SRClass;
  }
}

// We'll also use `any` for the event to avoid missing DOM types
let srInstance: any = null;
let wakeEnabled = false;
let lastTrigger = 0;
const COOLDOWN_MS = 4000;

const wakeSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

function wakeEnable() {
  if (!wakeSupported || wakeEnabled) return;
  wakeEnabled = true;

  const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as SRClass;
  srInstance = new SR();
  srInstance.continuous = true;
  srInstance.interimResults = true;
  srInstance.lang = 'en-US';

  srInstance.onresult = (e: any) => {
    const now = Date.now();
    // e.results can be non-standard; treat as any[]
    const results: any[] = Array.from(e.results).slice(e.resultIndex);
    const text = results
      .map((r: any) => (r && r[0] ? r[0].transcript : ''))
      .join(' ')
      .toLowerCase();

    if (!text) return;

    if (/\bcoach\b/.test(text) && now - lastTrigger > COOLDOWN_MS) {
      lastTrigger = now;
      log('Wake word detected: “coach”');
      startCall();
    }
  };

  srInstance.onend = () => {
    if (wakeEnabled) {
      try { srInstance?.start(); } catch {}
    }
  };

  srInstance.onerror = (_e: any) => {
    if (wakeEnabled) setTimeout(() => { try { srInstance?.start(); } catch {} }, 500);
  };

  try {
    srInstance.start();
    log('Wake word listening… say “coach”.');
  } catch (e) {
    log(['speech start error', e]);
  }
}

function wakeDisable() {
  wakeEnabled = false;
  try { srInstance?.stop(); } catch {}
  srInstance = null;
  log('Wake word disabled.');
}

// Wire the checkbox if present
if (wakeToggle) {
  wakeToggle.addEventListener('change', () => {
    if (!wakeSupported) {
      log('Wake word not supported in this browser. Try Chrome or Edge.');
      wakeToggle.checked = false;
      return;
    }
    if (wakeToggle.checked) wakeEnable();
    else wakeDisable();
  });
}

// Optional: keyboard fallback (press "c" to start)
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'c') startCall();
});
