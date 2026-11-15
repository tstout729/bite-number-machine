/* Number Lab shared helpers: window.NL
   Colors, number words, fair random numbers, sound effects, the recorded voice, place-value blocks,
   confetti, screen wake lock, saved settings. Plain script (no modules) so pages work from any host. */
(() => {
  "use strict";
  const NL = {};

  // ---------- storage (per device; every call survives blocked storage) ----------
  NL.store = {
    get(key, fallback) { try { const v = JSON.parse(localStorage.getItem("nl-" + key)); return v ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem("nl-" + key, JSON.stringify(value)); } catch { /* blocked */ } },
  };
  NL.settings = Object.assign({ sound: true, voice: true, calm: false }, NL.store.get("settings", {}));
  NL.saveSettings = () => NL.store.set("settings", NL.settings);
  NL.calm = () => NL.settings.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- colors: every digit always has the same color ----------
  NL.digitVar = (d) => `var(--d${d})`;
  NL.digitHex = (d) => getComputedStyle(document.documentElement).getPropertyValue(`--d${d}`).trim();
  NL.colorOf = (n) => NL.digitVar(Math.abs(Number(BigInt(n) % 10n)));
  /** Fill el with one colored <span> per digit of n (number, bigint or string). Non-digits stay uncolored. */
  NL.colorDigits = (el, n) => {
    el.classList.add("nl-digits");
    el.textContent = "";
    for (const ch of String(n)) {
      const s = document.createElement("span");
      s.textContent = ch;
      if (ch >= "0" && ch <= "9") s.style.setProperty("--c", NL.digitVar(ch));
      el.appendChild(s);
    }
    return el;
  };
  NL.fmt = (n) => (typeof n === "bigint" ? n : Number(n)).toLocaleString("en-US");

  // ---------- number words (Number or BigInt, any size up to centillion-ish) ----------
  const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  NL.BIG_NAMES = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion",
    "octillion", "nonillion", "decillion", "undecillion", "duodecillion", "tredecillion", "quattuordecillion", "quindecillion",
    "sexdecillion", "septendecillion", "octodecillion", "novemdecillion", "vigintillion"];
  function under1000(n) {
    const out = [];
    if (n >= 100) { out.push(ONES[Math.floor(n / 100)] + " hundred"); n %= 100; }
    if (n >= 20) out.push(TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""));
    else if (n > 0) out.push(ONES[n]);
    return out.join(" ");
  }
  NL.words = (value) => {
    let n = BigInt(value);
    if (n === 0n) return "zero";
    const neg = n < 0n; if (neg) n = -n;
    const parts = [];
    let i = 0;
    while (n > 0n) {
      const chunk = Number(n % 1000n);
      if (chunk) {
        if (i >= NL.BIG_NAMES.length) return (neg ? "negative " : "") + "a number too big to have a name here";
        parts.unshift(under1000(chunk) + (NL.BIG_NAMES[i] ? " " + NL.BIG_NAMES[i] : ""));
      }
      n /= 1000n; i++;
    }
    return (neg ? "negative " : "") + parts.join(" ");
  };

  // ---------- fair random numbers ----------
  /** Uniform whole number from 1 to max (inclusive), no modulo bias. */
  NL.randInt = (max) => {
    const lim = Math.floor(0x100000000 / max) * max;
    const a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return (a[0] % max) + 1;
  };
  /** Uniform whole number from lo to hi (inclusive). */
  NL.randBetween = (lo, hi) => lo - 1 + NL.randInt(hi - lo + 1);

  // ---------- math facts ----------
  NL.isPrime = (n) => { if (n < 2) return false; if (n % 2 === 0) return n === 2; for (let k = 3; k * k <= n; k += 2) if (n % k === 0) return false; return true; };
  NL.factors = (n) => { const f = []; for (let k = 1; k * k <= n; k++) if (n % k === 0) { f.push(k); if (k * k !== n) f.push(n / k); } return f.sort((a, b) => a - b); };
  NL.primeFactors = (n) => { const f = []; let m = n; for (let p = 2; p * p <= m; p++) while (m % p === 0) { f.push(p); m /= p; } if (m > 1) f.push(m); return f; };

  // ---------- sound ----------
  let ctx = null, master = null;
  const clips = new Map();
  NL.unlock = () => {
    if (!ctx) {
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  };
  document.addEventListener("pointerdown", NL.unlock, { passive: true });
  document.addEventListener("keydown", NL.unlock);

  NL.midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  /** One synthesized note. when = seconds from now. */
  NL.tone = (freq, dur = 0.3, vol = 0.1, type = "sine", when = 0) => {
    if (!NL.settings.sound || !ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
  let lastTick = 0;
  NL.sfx = {
    tick() { const now = performance.now(); if (now - lastTick < 28) return; lastTick = now; NL.tone(2100, 0.02, 0.05, "triangle"); },
    clunk() { NL.tone(190, 0.09, 0.18, "triangle"); NL.tone(95, 0.12, 0.12); },
    pop() { NL.tone(660, 0.08, 0.12, "triangle"); NL.tone(990, 0.06, 0.05, "sine", 0.02); },
    /** i-th note of a rising scale: use for counting things one by one */
    blip(i = 0) { NL.tone(NL.midi(67 + PENTA[i % PENTA.length]), 0.18, 0.08); },
    chime() { [72, 76, 79, 84].forEach((m, i) => { NL.tone(NL.midi(m), 0.6, 0.12, "sine", i * 0.07); NL.tone(NL.midi(m + 12), 0.25, 0.03, "sine", i * 0.07); }); },
    yay() { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => NL.tone(NL.midi(m), 0.5, 0.09, "sine", i * 0.08)); },
    /** gentle "not that one" sound: soft, low, never a buzzer */
    soft() { NL.tone(NL.midi(64), 0.25, 0.07); NL.tone(NL.midi(60), 0.35, 0.07, "sine", 0.12); },
    whoosh() { [55, 62, 67, 74, 79].forEach((m, i) => NL.tone(NL.midi(m), 0.12, 0.04, "triangle", i * 0.03)); },
  };

  async function clip(key) {
    if (clips.has(key)) return clips.get(key);
    const p = fetch(`voice/${key}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .catch(() => null);
    clips.set(key, p);
    return p;
  }
  NL.preload = (keys) => { if (!ctx) return; let i = 0; const next = () => { if (i < keys.length) clip(keys[i++]).then(next); }; next(); next(); next(); };
  let voiceSrc = null;
  /** Browser speech, used for anything without a recorded clip. */
  NL.sayText = (text) => {
    if (!NL.settings.voice) return Promise.resolve();
    try { voiceSrc && voiceSrc.stop(); } catch { }
    return new Promise((res) => {
      try {
        const u = new SpeechSynthesisUtterance(String(text)); u.rate = 0.95; u.pitch = 1.1;
        u.onend = res; u.onerror = res;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
        setTimeout(res, 1500 + String(text).length * 90);   // some browsers never fire onend
      } catch { res(); }
    });
  };
  /** Play a recorded line by key (see VOICE_KEYS). Falls back to browser speech with fallbackText. */
  NL.say = async (key, fallbackText) => {
    if (!NL.settings.voice) return;
    NL.unlock();
    if (!ctx) { if (fallbackText) NL.sayText(fallbackText); return; }
    const buf = await clip(key);
    if (!buf) { if (fallbackText) NL.sayText(fallbackText); return; }
    try { voiceSrc && voiceSrc.stop(); } catch { }
    try { speechSynthesis.cancel(); } catch { }
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(master); s.start(); voiceSrc = s;
    return new Promise((res) => { s.onended = res; });
  };
  /** Say a number: recorded voice for 0-100, browser speech for anything else. */
  NL.sayNumber = (n) => {
    const v = typeof n === "bigint" ? n : Number(n);
    if (Number.isInteger(Number(v)) && v >= 0 && v <= 100) return NL.say("n" + v, String(v));
    return NL.sayText(typeof v === "bigint" || Number.isInteger(v) ? NL.words(v) : String(v));
  };
  /** Recorded keys: n0..n100, done, hello, ready, welcome, prime, square, found, cracked, tryagain, great,
      even, odd, whoa, roll, predict, winner, skip. */
  NL.VOICE_KEYS = ["done", "hello", "ready", "welcome", "prime", "square", "found", "cracked", "tryagain", "great", "even", "odd", "whoa", "roll", "predict", "winner", "skip"];

  // ---------- place-value blocks ----------
  /** Element showing n (0-9999) as thousands / hundreds flats / tens rods / ones ten-frame.
      opts.animate pops pieces in one by one with rising notes; opts.cube sets ones-cube size in px. */
  NL.blocks = (n, opts = {}) => {
    n = Math.max(0, Math.min(9999, Math.floor(n)));
    const wrap = document.createElement("div"); wrap.className = "nl-blocks";
    const Th = Math.floor(n / 1000), H = Math.floor((n % 1000) / 100), T = Math.floor((n % 100) / 10), O = n % 10;
    const units = [];
    const group = (cap, d, body) => {
      const g = document.createElement("div"); g.className = "nl-bgroup"; g.appendChild(body);
      const c = document.createElement("div"); c.className = "nl-bcap"; c.textContent = cap; c.style.color = NL.digitVar(d);
      g.appendChild(c); wrap.appendChild(g);
    };
    const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    if (Th) {
      const box = document.createElement("div"); box.className = "nl-flats";
      for (let i = 0; i < Th; i++) {
        const x = document.createElement("div"); x.className = "nl-flat"; x.style.setProperty("--c", NL.digitVar(Th));
        x.style.width = x.style.height = "44px"; x.style.boxShadow = "4px -4px 0 rgba(0,0,0,.18), inset 0 -3px 0 rgba(0,0,0,.18)";
        box.appendChild(x); units.push(x);
      }
      group(plural(Th, "thousand", "thousands"), Th, box);
    }
    if (H || Th) {
      const box = document.createElement("div"); box.className = "nl-flats";
      for (let i = 0; i < H; i++) { const x = document.createElement("div"); x.className = "nl-flat"; x.style.setProperty("--c", NL.digitVar(H)); box.appendChild(x); units.push(x); }
      group(plural(H, "hundred", "hundreds"), H, box);
    }
    if (T || H || Th) {
      const rods = document.createElement("div"); rods.className = "nl-rods";
      for (let i = 0; i < T; i++) {
        const rod = document.createElement("div"); rod.className = "nl-rod"; rod.style.setProperty("--c", NL.digitVar(T));
        for (let k = 0; k < 10; k++) rod.appendChild(document.createElement("i"));
        rods.appendChild(rod); units.push(rod);
      }
      group(plural(T, "ten", "tens"), T, rods);
    }
    const fr = document.createElement("div"); fr.className = "nl-frame";
    if (opts.cube) fr.style.setProperty("--cube", opts.cube + "px");
    for (let i = 0; i < 10; i++) {
      const sl = document.createElement("div"); sl.className = "nl-slot";
      if (i < O) { sl.classList.add("on"); sl.style.setProperty("--c", NL.digitVar(O)); units.push(sl); }
      fr.appendChild(sl);
    }
    group(plural(O, "one", "ones"), O, fr);
    if (opts.animate && !NL.calm()) {
      const step = units.length > 12 ? 60 : 110;
      units.forEach((u, i) => {
        u.style.opacity = "0";
        setTimeout(() => {
          u.style.opacity = "";
          u.animate([{ transform: "scale(0.2)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: 0.7 }, { transform: "scale(1)" }], { duration: 260, easing: "ease-out" });
          NL.sfx.blip(i);
        }, 200 + i * step);
      });
    }
    return wrap;
  };

  // ---------- confetti ----------
  NL.confetti = (ms = 3500) => {
    if (NL.calm()) return;
    const cv = document.createElement("canvas"); cv.className = "nl-confetti"; document.body.appendChild(cv);
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const g = cv.getContext("2d"); g.scale(dpr, dpr);
    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(NL.digitHex);
    const ps = Array.from({ length: 110 }, (_, i) => ({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6, vx: (Math.random() - 0.5) * 1.2, vy: 1.6 + Math.random() * 2.2,
      s: 7 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.15, c: cols[i % cols.length],
    }));
    const t0 = performance.now();
    const frame = (now) => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); g.restore(); }
      if (now - t0 < ms) requestAnimationFrame(frame); else cv.remove();
    };
    requestAnimationFrame(frame);
  };

  // ---------- keep the screen on while a game is open ----------
  let lock = null;
  NL.wake = async () => { try { if ("wakeLock" in navigator && !lock && document.visibilityState === "visible") { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } } catch { } };
  document.addEventListener("pointerdown", NL.wake, { passive: true });
  document.addEventListener("visibilitychange", NL.wake);

  // ---------- top bar sound button: <button class="nl-round nl-sound"> ----------
  const SPEAKER_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const SPEAKER_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
  NL.initTop = () => {
    document.querySelectorAll(".nl-sound").forEach((b) => {
      const paint = () => {
        const on = NL.settings.sound || NL.settings.voice;
        b.innerHTML = on ? SPEAKER_ON : SPEAKER_OFF;
        b.setAttribute("aria-pressed", String(on));
        b.setAttribute("aria-label", on ? "Sound is on. Tap to turn it off." : "Sound is off. Tap to turn it on.");
      };
      b.addEventListener("click", () => {
        const on = !(NL.settings.sound || NL.settings.voice);
        NL.settings.sound = on; NL.settings.voice = on; NL.saveSettings(); paint();
        if (on) { NL.unlock(); NL.sfx.pop(); }
      });
      paint();
    });
  };
  document.addEventListener("DOMContentLoaded", NL.initTop);

  window.NL = NL;
})();
