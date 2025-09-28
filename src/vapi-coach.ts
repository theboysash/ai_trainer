import Vapi from '@vapi-ai/web';

// TEMP hardcoded (swap to env later)
const PUBLIC_KEY   = '7a381b28-b330-47c8-8c24-ed48b4a477d5';
const ASSISTANT_ID = 'ad349484-eed2-4192-b7e4-caa6cb6f31d0';

export const vapi = new Vapi(PUBLIC_KEY);

// Basic start/stop helpers
export async function startCoach() {
  // prompts mic permissions + starts an audio call to your assistant
  await vapi.start(ASSISTANT_ID);
}

export function stopCoach() {
  vapi.stop();
}

// Optional: send in-band messages to the running call
export async function sendCoachSignal(content: string, role: 'user'|'system' = 'user') {
  await vapi.send({
    type: 'add-message',
    message: { role, content },
  });
}

// Hook up some logs (optional)
export function wireVapiLogging(preEl?: HTMLPreElement | null) {
  const log = (m: unknown) => {
    if (!preEl) return;
    const line = typeof m === 'string' ? m : JSON.stringify(m);
    preEl.textContent += `${line}\n`;
    preEl.scrollTop = preEl.scrollHeight;
  };
  vapi.on('call-start', () => log('call-start'));
  vapi.on('call-end',   () => log('call-end'));
  vapi.on('message',    (msg: any) => {
    if (msg?.type === 'transcript') log(`${msg.role}: ${msg.transcript}`);
    else log(msg);
  });
  vapi.on('error',      (e: unknown) => log(['error', e]));
}