// src/vapiTest.ts
// Minimal Vapi test caller for the browser (Vite).
// Requires .env with:
//   VITE_VAPI_PUBLIC_KEY=...   (Public Key from Vapi dashboard)
//   VITE_VAPI_URL=https://api.vapi.ai/v1/assistants/<assistant-id>/respond

const VAPI_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined;
const VAPI_URL = import.meta.env.VITE_VAPI_URL as string | undefined;

// ---- Small helpers ----
function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05; // a touch energetic
  u.pitch = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

async function playAudioUrl(url: string) {
  const audio = new Audio(url);
  try {
    await audio.play();
  } catch (e) {
    console.warn("Autoplay blocked; user gesture may be required.", e);
  }
}

function assertEnv() {
  if (!VAPI_KEY) throw new Error("Missing VITE_VAPI_PUBLIC_KEY in .env");
  if (!VAPI_URL) throw new Error("Missing VITE_VAPI_URL in .env");
}

// ---- Main test call ----
export async function testVapiAgent() {
  assertEnv();
  console.log("VAPI key prefix:", (VAPI_KEY || "").slice(0, 6));
  console.log("Calling:", VAPI_URL);

  // Example payload. Adjust fields to match your agent’s expected input.
  const payload = {
    input: "Coach, should I add more weight next set?",
    context: {
      exercise: "bicep_curl",
      intensity: "moderate",
      targetPercent1RM: 0.7,
      targetVelocity: 0.7,
      setIndex: 2,
      loadKg: 20,
      reps: 10,
      firstRepMCV: 0.76,
      peakVL: 0.12,
      peakFPI: 0.38,
      avgROM: 136
    },
    // keep costs/latency low
    max_output_seconds: 12
  };

  let res: Response;
  try {
    res = await fetch(VAPI_URL!, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VAPI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (networkErr) {
    console.error("Network error calling Vapi:", networkErr);
    speak("Network error calling the coach.");
    return;
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Vapi HTTP error:", res.status, txt);
    speak(`Vapi error ${res.status}`);
    return;
  }

  const data = await res.json().catch(() => ({} as any));
  console.log("Vapi response:", data);

  // Try common response shapes
  const audioUrl =
    (data && (data.audioUrl || data.audio_url || data.audio)) ?? null;
  const text = (data && (data.text || data.reply || data.message)) ?? null;

  if (audioUrl) {
    await playAudioUrl(audioUrl);
  } else if (text) {
    speak(text);
  } else {
    speak("Coach replied, but I couldn't parse the audio. Check response fields.");
  }
}

// Auto-run once on load for a quick sanity check.
// Comment this out if you only want manual triggering.
testVapiAgent();

// Optional: wire to a button in your page for manual tests:
// document.getElementById("btnVapiTest")?.addEventListener("click", testVapiAgent);
