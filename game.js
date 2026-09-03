(() => {
  "use strict";

  const NAVY = "#123A6B";
  const RED = "#E31B23";
  const FOAM = "#F7F2E6";
  const FOAM2 = "#EFE6D0";
  const FOAM3 = "#E4D8BE";
  const WALL = "#F0E6D4";
  const WALL2 = "#E4D5BE";
  const DECK = "#E8DCC4";
  const DECK2 = "#DDD0B6";
  const WINCOL = "#1E2A38";
  const DURATION = 15;
  const FLY_DUR = 1.75;
  const BILL_START = 480;
  const BILL_MAX = 580;
  const BILL_WIN = 310;
  const BILL_RISE = 22;
  const SEAL_RADIUS = 0.035;
  const SEAL_RATE = 1.55;
  const WA_TEXT = "السلام عليكم، أبغى فحص مجاني للعزل الحراري/المائي من إعلان احبس الحرارة — Al-Tamaize";
  const WA_URL = "https://wa.me/966542178038?text=" + encodeURIComponent(WA_TEXT);

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d", { alpha: true });
  const heatEl = document.getElementById("heat");
  const timerEl = document.getElementById("timer");
  const billNum = document.getElementById("bill-num");
  const fillNum = document.getElementById("fill-num");
  const fillBar = document.getElementById("fill-bar");
  const holdHint = document.getElementById("hold-hint");
  const endCopy = document.getElementById("end-copy");
  const endSub = document.getElementById("end-sub");
  const endBill = document.getElementById("end-bill");
  const billTo = document.getElementById("bill-to");
  const badge = document.getElementById("badge");
  const btnWa = document.getElementById("btn-wa");
  const screenStart = document.getElementById("screen-start");
  const screenPlay = document.getElementById("screen-play");
  const screenEnd = document.getElementById("screen-end");

  btnWa.href = WA_URL;

  document.querySelectorAll(".logo-img").forEach((img) => {
    const fb = img.parentNode && img.parentNode.querySelector(".logo-fallback");
    const ok = () => {
      if (img.naturalWidth > 16) {
        img.classList.add("is-loaded");
        img.classList.remove("is-broken");
        if (fb) fb.classList.add("is-replaced");
      } else fail();
    };
    const fail = () => {
      img.classList.add("is-broken");
      img.classList.remove("is-loaded");
      img.removeAttribute("src");
      if (fb) fb.classList.remove("is-replaced");
    };
    img.addEventListener("load", ok);
    img.addEventListener("error", fail);
    if (img.complete) {
      if (img.naturalWidth > 16) ok();
      else fail();
    }
  });

  const foamCanvas = document.createElement("canvas");
  const foamCtx = foamCanvas.getContext("2d");

  let W = 1, H = 1, dpr = 1;
  let screen = "start";
  let tLeft = DURATION;
  let fill = 0;
  let bill = BILL_START;
  let holding = false;
  let pointer = { x: 0.5, y: 0.5 };
  let didHold = false;
  let last = 0;
  let paused = false;
  let particles = [];
  let burst = [];
  let nozzleAng = -0.85;
  let lastStamp = { x: -99, y: -99, t: 0 };
  let flyT = 0;

  const DECK_BOX = { x: 0.13, y: 0.18, w: 0.74, h: 0.52 };

  const CRACKS = [
    { pts: [[0.22, 0.36], [0.28, 0.42], [0.34, 0.50]], w: 5, seal: 0 },
    { pts: [[0.46, 0.30], [0.48, 0.40], [0.47, 0.52]], w: 6, seal: 0 },
    { pts: [[0.58, 0.34], [0.68, 0.40], [0.78, 0.46]], w: 5, seal: 0 },
    { pts: [[0.20, 0.54], [0.28, 0.60], [0.36, 0.66]], w: 6, seal: 0 },
    { pts: [[0.56, 0.54], [0.66, 0.58], [0.78, 0.64]], w: 5, seal: 0 },
    { pts: [[0.40, 0.56], [0.48, 0.62], [0.52, 0.68]], w: 7, seal: 0 }
  ];

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    foamCanvas.width = canvas.width;
    foamCanvas.height = canvas.height;
    foamCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function crackFill() {
    return (CRACKS.reduce((s, c) => s + Math.min(1, c.seal), 0) / CRACKS.length) * 100;
  }

  function resetPlay() {
    tLeft = DURATION;
    fill = 0;
    bill = BILL_START;
    holding = false;
    didHold = false;
    particles.length = 0;
    burst.length = 0;
    lastStamp = { x: -99, y: -99, t: 0 };
    CRACKS.forEach((c) => (c.seal = 0));
    foamCtx.setTransform(1, 0, 0, 1, 0, 0);
    foamCtx.clearRect(0, 0, foamCanvas.width, foamCanvas.height);
    foamCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    holdHint.classList.remove("hide");
    timerEl.classList.remove("warn");
    timerEl.textContent = DURATION.toFixed(1);
    fillBar.style.width = "0%";
    fillNum.textContent = "0%";
    billNum.textContent = String(Math.round(bill));
  }

  function setScreen(name) {
    screen = name;
    stage.dataset.state = name;
    screenStart.hidden = name !== "start";
    screenPlay.hidden = name !== "play";
    screenEnd.hidden = name !== "win" && name !== "lose";
  }

  function roofToPx(nx, ny) {
    return { x: nx * W, y: ny * H };
  }

  function inDeck(nx, ny) {
    return nx > DECK_BOX.x && nx < DECK_BOX.x + DECK_BOX.w &&
      ny > DECK_BOX.y && ny < DECK_BOX.y + DECK_BOX.h;
  }

  function distToCrack(nx, ny, crack) {
    let min = 1e9;
    for (let i = 0; i < crack.pts.length - 1; i++) {
      const ax = crack.pts[i][0], ay = crack.pts[i][1];
      const bx = crack.pts[i + 1][0], by = crack.pts[i + 1][1];
      const abx = bx - ax, aby = by - ay;
      const t = Math.max(0, Math.min(1, ((nx - ax) * abx + (ny - ay) * aby) / (abx * abx + aby * aby + 1e-6)));
      min = Math.min(min, Math.hypot(nx - (ax + abx * t), ny - (ay + aby * t)));
    }
    return min;
  }

  function stampFoam(x, y, r, strong) {
    foamCtx.save();
    foamCtx.beginPath();
    foamCtx.rect(DECK_BOX.x * W, DECK_BOX.y * H, DECK_BOX.w * W, DECK_BOX.h * H);
    foamCtx.clip();
    const g = foamCtx.createRadialGradient(x, y, r * 0.12, x, y, r);
    if (strong) {
      g.addColorStop(0, "rgba(255,252,245,0.95)");
      g.addColorStop(0.35, "rgba(247,242,230,0.88)");
      g.addColorStop(0.7, "rgba(239,230,208,0.55)");
      g.addColorStop(1, "rgba(228,216,190,0)");
    } else {
      g.addColorStop(0, "rgba(247,242,230,0.22)");
      g.addColorStop(0.65, "rgba(239,230,208,0.08)");
      g.addColorStop(1, "rgba(239,230,208,0)");
    }
    foamCtx.fillStyle = g;
    foamCtx.beginPath();
    foamCtx.arc(x, y, r, 0, Math.PI * 2);
    foamCtx.fill();
    if (strong) {
      foamCtx.fillStyle = "rgba(255,255,250,0.40)";
      foamCtx.beginPath();
      foamCtx.arc(x - r * 0.22, y - r * 0.22, r * 0.30, 0, Math.PI * 2);
      foamCtx.fill();
    }
    foamCtx.restore();
  }

  function maybeStamp(x, y, on, now) {
    const minD = on ? W * 0.018 : W * 0.032;
    const d = Math.hypot(x - lastStamp.x, y - lastStamp.y);
    const elapsed = now - lastStamp.t;
    if (d < minD && elapsed < 90) return;
    lastStamp = { x, y, t: now };
    const jx = x + (Math.random() - 0.5) * 4;
    const jy = y + (Math.random() - 0.5) * 4;
    const r = on ? Math.max(8, W * 0.024) : Math.max(5, W * 0.014);
    stampFoam(jx, jy, r, on);
  }

  function spawnSpray(x, y, onCrack) {
    const n = onCrack ? 5 : 2;
    for (let i = 0; i < n && particles.length < 80; i++) {
      const a = nozzleAng + (Math.random() - 0.5) * 0.5;
      const sp = 40 + Math.random() * 80;
      particles.push({
        x: x + Math.cos(a) * 6,
        y: y + Math.sin(a) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + 16,
        r: onCrack ? 1.4 + Math.random() * 1.8 : 1.0 + Math.random() * 1.2,
        life: 0.14 + Math.random() * 0.10
      });
    }
  }

  function spawnBurst() {
    burst = [];
    for (let i = 0; i < 36; i++) {
      burst.push({
        x: W * (0.28 + Math.random() * 0.44),
        y: H * (0.32 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 36,
        vy: -50 - Math.random() * 80,
        r: 2 + Math.random() * 2.5,
        life: 0.6 + Math.random() * 0.45,
        c: Math.random() > 0.5 ? "rgba(180,235,230," : "rgba(255,255,255,"
      });
    }
  }

  function allSealed() {
    return CRACKS.every((c) => c.seal >= 1);
  }

  function goWin() {
    if (screen !== "play") return;
    holding = false;
    fill = 100;
    const from = Math.round(bill);
    document.getElementById("bill-from").textContent = String(from);
    billTo.textContent = String(from);
    endBill.hidden = false;
    endCopy.textContent = "العزل الصح يوفّر على التكييف";
    endSub.textContent = "يقلل انتقال الحرارة ويحمي من التسريب";
    badge.classList.remove("trust");
    setScreen("win");
    spawnBurst();
    CRACKS.forEach((c) => (c.seal = 1));
    fillBar.style.width = "100%";
    fillNum.textContent = "100%";
    foamCtx.save();
    foamCtx.globalAlpha = 0.62;
    foamCtx.fillStyle = FOAM;
    foamCtx.fillRect(DECK_BOX.x * W, DECK_BOX.y * H, DECK_BOX.w * W, DECK_BOX.h * H);
    foamCtx.restore();
  }

  function goLose() {
    if (screen !== "play") return;
    holding = false;
    endBill.hidden = true;
    endCopy.textContent = "الحرارة لسا داخلة — عالج السطح قبل الصيف";
    endSub.textContent = "التسريب يزيد مع كل يوم حر";
    badge.classList.add("trust");
    setScreen("lose");
  }

  function startPlay() {
    if (screen !== "start") return;
    resetPlay();
    flyT = 0;
    setScreen("fly");
  }
  function replay() {
    resetPlay();
    flyT = 0;
    setScreen("start");
  }

  function localXY(e) {
    const r = stage.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - r.left) / r.width,
      y: (src.clientY - r.top) / r.height
    };
  }

  function onDown(e) {
    if (screen !== "play") return;
    if (e.target.closest && e.target.closest("a,button")) return;
    e.preventDefault();
    holding = true;
    pointer = localXY(e);
    if (!didHold) {
      didHold = true;
      holdHint.classList.add("hide");
      if (navigator.vibrate) navigator.vibrate(10);
    }
  }
  function onMove(e) {
    if (!holding || screen !== "play") return;
    e.preventDefault();
    pointer = localXY(e);
  }
  function onUp(e) {
    if (!holding) return;
    holding = false;
    if (e && e.preventDefault) e.preventDefault();
  }

  stage.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  stage.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);
  document.getElementById("btn-start").addEventListener("click", startPlay);
  document.getElementById("btn-replay").addEventListener("click", replay);
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    if (!document.hidden) last = performance.now();
  });

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSky(hot) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (hot) {
      g.addColorStop(0, "#8ec8e6");
      g.addColorStop(0.18, "#c8e0ee");
      g.addColorStop(0.38, "#f2d7a4");
      g.addColorStop(1, "#e0c08a");
    } else {
      g.addColorStop(0, "#b9dce0");
      g.addColorStop(0.4, "#cfe8e4");
      g.addColorStop(1, "#c5d8cc");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = hot ? "rgba(255,236,170,0.7)" : "rgba(255,255,240,0.45)";
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.08, W * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPalm(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#6b4a2b";
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, s * 1.25);
    ctx.lineTo(s * 0.05, s * 1.25);
    ctx.lineTo(s * 0.035, 0);
    ctx.lineTo(-s * 0.035, 0);
    ctx.fill();
    ctx.strokeStyle = "#2f6a38";
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.3 - s * 0.08, Math.cos(a) * s * 0.88, Math.sin(a) * s * 0.52);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWindow(x, y, w, h) {
    ctx.fillStyle = WINCOL;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = WALL2;
    ctx.lineWidth = Math.max(2, w * 0.08);
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.stroke();
  }

  function drawTank(x, y, w, h) {
    const rx = w / 2;
    const ry = Math.max(6, w * 0.18);
    ctx.fillStyle = "#d8dde0";
    roundRect(x - 6, y + h - 6, w + 12, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#E8EEF0";
    ctx.fillRect(x, y + ry, w, h - ry);
    ctx.fillStyle = "#c5ced2";
    ctx.beginPath();
    ctx.ellipse(x + rx, y + h, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F7FAFB";
    ctx.beginPath();
    ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b7c2c6";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#d5dde0";
    ctx.fillRect(x + 2, y + h * 0.48, w - 4, 6);
    ctx.fillStyle = "#b7c2c6";
    ctx.beginPath();
    ctx.arc(x + rx, y + ry, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAC(x, y, s) {
    ctx.fillStyle = "#e8eef0";
    roundRect(x, y, s, s * 0.72, 4);
    ctx.fill();
    ctx.strokeStyle = "#9aa3a8";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#c5ced2";
    ctx.fillRect(x + s * 0.1, y + s * 0.08, s * 0.8, 3);
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.38, s * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = "#7d868c";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.38, s * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y + s * 0.38);
      ctx.lineTo(x + s * 0.5 + Math.cos(a) * s * 0.18, y + s * 0.38 + Math.sin(a) * s * 0.18);
      ctx.stroke();
    }
  }

  function drawSand(y0) {
    ctx.fillStyle = "#d7c19a";
    ctx.fillRect(0, y0, W, H - y0);
    ctx.fillStyle = "#c9b089";
    ctx.fillRect(0, y0, W, 4);
    ctx.fillStyle = "rgba(160,130,90,0.18)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % W;
      const y = y0 + 8 + ((i * 53) % (H - y0 - 10));
      ctx.fillRect(x, y, 3, 2);
    }
  }

  function drawVilla() {
    drawSky(true);
    drawSand(H * 0.70);
    const hx = W * 0.14, hy = H * 0.28, hw = W * 0.56, hh = H * 0.44;
    ctx.fillStyle = WALL;
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = WALL2;
    ctx.fillRect(hx + hw * 0.68, hy + hh * 0.05, hw * 0.40, hh * 0.95);
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(hx - 4, hy - H * 0.03, hw + 10, H * 0.034);
    drawTank(hx + hw * 0.26, hy - H * 0.12, hw * 0.22, H * 0.105);
    drawAC(hx + hw * 0.54, hy - H * 0.078, hw * 0.14);
    drawAC(hx + hw * 0.70, hy - H * 0.078, hw * 0.14);
    drawWindow(hx + hw * 0.09, hy + hh * 0.14, hw * 0.16, hh * 0.18);
    drawWindow(hx + hw * 0.36, hy + hh * 0.14, hw * 0.16, hh * 0.18);
    drawWindow(hx + hw * 0.09, hy + hh * 0.44, hw * 0.16, hh * 0.22);
    drawWindow(hx + hw * 0.36, hy + hh * 0.44, hw * 0.16, hh * 0.22);
    drawWindow(hx + hw * 0.76, hy + hh * 0.18, hw * 0.15, hh * 0.16);
    drawWindow(hx + hw * 0.76, hy + hh * 0.46, hw * 0.15, hh * 0.16);
    ctx.fillStyle = WINCOL;
    ctx.fillRect(hx + hw * 0.12, hy + hh * 0.78, hw * 0.12, hh * 0.22);
    ctx.fillStyle = WALL;
    ctx.fillRect(W * 0.08, H * 0.62, W * 0.80, H * 0.09);
    ctx.fillStyle = "#3a2a22";
    ctx.fillRect(W * 0.26, H * 0.645, W * 0.08, H * 0.065);
    drawPalm(W * 0.86, H * 0.38, W * 0.22);
    const t = performance.now() / 420;
    ctx.strokeStyle = "rgba(255,150,50,0.10)";
    ctx.lineWidth = 7;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let x = 0; x < W; x += 10) {
        const y = H * 0.16 + i * 24 + Math.sin(x * 0.02 + t + i) * 4;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawRoof(sealed) {
    drawSky(!sealed);
    drawSand(H * 0.82);
    ctx.fillStyle = WALL;
    ctx.fillRect(W * 0.07, H * 0.68, W * 0.86, H * 0.18);
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(W * 0.07, H * 0.68, W * 0.86, 7);
    drawWindow(W * 0.18, H * 0.76, W * 0.12, H * 0.09);
    drawWindow(W * 0.36, H * 0.76, W * 0.12, H * 0.09);
    drawWindow(W * 0.66, H * 0.76, W * 0.12, H * 0.09);
    const px = W * 0.07, py = H * 0.14, pw = W * 0.86, ph = H * 0.56;
    ctx.fillStyle = WALL;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "#f6eee0";
    ctx.fillRect(px, py, pw, 12);
    ctx.fillStyle = WALL2;
    ctx.fillRect(px, py + ph - 10, pw, 10);
    const dx = DECK_BOX.x * W, dy = DECK_BOX.y * H, dw = DECK_BOX.w * W, dh = DECK_BOX.h * H;
    ctx.fillStyle = sealed ? "#EFECE4" : DECK;
    ctx.fillRect(dx, dy, dw, dh);
    const shade = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    shade.addColorStop(0, sealed ? "rgba(247,242,230,0.35)" : "rgba(255,255,255,0.18)");
    shade.addColorStop(1, sealed ? "rgba(228,216,190,0.45)" : "rgba(180,160,120,0.16)");
    ctx.fillStyle = shade;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    ctx.strokeStyle = sealed ? "rgba(180,190,185,0.32)" : "rgba(130,110,80,0.22)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      const y = dy + (dh * i) / 6;
      ctx.beginPath(); ctx.moveTo(dx, y); ctx.lineTo(dx + dw, y); ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const x = dx + (dw * i) / 4;
      ctx.beginPath(); ctx.moveTo(x, dy); ctx.lineTo(x, dy + dh); ctx.stroke();
    }
    if (!sealed) {
      ctx.fillStyle = "rgba(80,110,125,0.20)";
      ctx.beginPath(); ctx.ellipse(W * 0.32, H * 0.58, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.68, H * 0.44, 18, 9, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.50, H * 0.64, 14, 7, -0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = WALL;
    ctx.fillRect(px, py, pw, dy - py);
    ctx.fillRect(px, py, dx - px, ph);
    ctx.fillRect(dx + dw, py, px + pw - (dx + dw), ph);
    ctx.fillRect(px, dy + dh, pw, py + ph - (dy + dh));
    ctx.fillStyle = "#f7f0e4";
    ctx.fillRect(dx - 6, dy - 6, dw + 12, 8);
    ctx.fillRect(dx - 6, dy - 6, 8, dh + 12);
    ctx.fillRect(dx + dw - 2, dy - 6, 8, dh + 12);
    ctx.fillRect(dx - 6, dy + dh - 2, dw + 12, 8);
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(dx, dy, dw, 7);
    ctx.fillRect(dx, dy, 7, dh);
    drawAC(W * 0.17, H * 0.21, W * 0.13);
    drawAC(W * 0.32, H * 0.21, W * 0.13);
    drawTank(W * 0.64, H * 0.165, W * 0.17, H * 0.12);
    if (!sealed) {
      const t = performance.now() / 380;
      ctx.strokeStyle = "rgba(255,160,60,0.09)";
      ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = dx; x < dx + dw; x += 8) {
          const y = dy + 18 + i * 26 + Math.sin(x * 0.03 + t + i) * 3;
          if (x === dx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function project3(px, py, pz, cam) {
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch);
    let x = px * cy + pz * sy;
    let z = -px * sy + pz * cy;
    let y = py;
    const y2 = y * cp - z * sp;
    const z2 = cam.dist - (y * sp + z * cp);
    const f = cam.fl / Math.max(0.45, z2);
    return { x: W * 0.52 + x * f, y: H * 0.50 - y2 * f, d: z2 };
  }

  function face3(pts, fill) {
    if (pts.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(80,60,40,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function avgD(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += pts[i].d;
    return s / pts.length;
  }

  function drawFly(t) {
    const e = smooth(Math.max(0, Math.min(1, t)));
    const cam = {
      yaw: Math.sin(Math.PI * e) * 0.78,
      pitch: 0.08 + e * e * 1.28,
      dist: 16.5 - e * 7.2,
      fl: Math.min(W, H) * (1.05 + e * 0.35)
    };
    drawSky(true);

    const ground = [];
    const grid = 5;
    for (let i = -grid; i <= grid; i++) {
      for (let j = -grid; j <= grid; j++) {
        const a = project3(i * 4, 0, j * 4, cam);
        const b = project3((i + 1) * 4, 0, j * 4, cam);
        const c = project3((i + 1) * 4, 0, (j + 1) * 4, cam);
        const d = project3(i * 4, 0, (j + 1) * 4, cam);
        ground.push({ pts: [a, b, c, d], fill: ((i + j) & 1) ? "#d4be96" : "#cbb089", d: avgD([a, b, c, d]) });
      }
    }
    ground.sort((a, b) => b.d - a.d);
    ground.forEach((g) => face3(g.pts, g.fill));

    const x0 = -4.6, x1 = 4.8, z0 = -3.3, z1 = 3.3, y0 = 0, y1 = 4.9;
    const P = (x, y, z) => project3(x, y, z, cam);
    const faces = [];
    function add(pts, fill) {
      faces.push({ pts, fill, d: avgD(pts) });
    }
    add([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], "#e8dcc8");
    add([P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], WALL2);
    add([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], WALL);
    add([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], "#e6d8c4");
    add([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], DECK);

    const ins = 0.55, yt = y1 + 0.12;
    add([P(x0 + ins, yt, z1 - ins), P(x1 - ins, yt, z1 - ins), P(x1 - ins, yt, z0 + ins), P(x0 + ins, yt, z0 + ins)], "#efe4d0");
    add([P(x0, y1, z1), P(x1, y1, z1), P(x1 - ins, yt, z1 - ins), P(x0 + ins, yt, z1 - ins)], "#f6eee0");
    add([P(x1, y1, z1), P(x1, y1, z0), P(x1 - ins, yt, z0 + ins), P(x1 - ins, yt, z1 - ins)], "#e4d5be");
    add([P(x0, y1, z0), P(x0, y1, z1), P(x0 + ins, yt, z1 - ins), P(x0 + ins, yt, z0 + ins)], "#efe6d6");
    add([P(x0, y1, z0), P(x1, y1, z0), P(x1 - ins, yt, z0 + ins), P(x0 + ins, yt, z0 + ins)], "#d9ccb6");

    const wx = [[-3.2, 2.6, 1.2, 1.4], [-0.8, 2.6, 1.2, 1.4], [-3.2, 0.7, 1.2, 1.6], [-0.8, 0.7, 1.2, 1.6], [2.5, 2.4, 1.1, 1.2], [2.5, 0.8, 1.1, 1.3]];
    wx.forEach((w) => {
      add([P(w[0], w[1], z1 + 0.02), P(w[0] + w[2], w[1], z1 + 0.02), P(w[0] + w[2], w[1] + w[3], z1 + 0.02), P(w[0], w[1] + w[3], z1 + 0.02)], WINCOL);
    });
    add([P(-3.1, 0, z1 + 0.03), P(-1.7, 0, z1 + 0.03), P(-1.7, 1.6, z1 + 0.03), P(-3.1, 1.6, z1 + 0.03)], WINCOL);

    const tx0 = 1.6, tx1 = 3.4, tz0 = -1.6, tz1 = 0.3, ty0 = yt, ty1 = yt + 1.35;
    add([P(tx0, ty0, tz1), P(tx1, ty0, tz1), P(tx1, ty1, tz1), P(tx0, ty1, tz1)], "#F7FAFB");
    add([P(tx1, ty0, tz1), P(tx1, ty0, tz0), P(tx1, ty1, tz0), P(tx1, ty1, tz1)], "#c5ced2");
    add([P(tx0, ty1, tz1), P(tx1, ty1, tz1), P(tx1, ty1, tz0), P(tx0, ty1, tz0)], "#ffffff");

    function acBox(ax, az) {
      const s = 0.85, d = 0.7, h = 0.55;
      add([P(ax, yt, az + d), P(ax + s, yt, az + d), P(ax + s, yt + h, az + d), P(ax, yt + h, az + d)], "#e8eef0");
      add([P(ax + s, yt, az + d), P(ax + s, yt, az), P(ax + s, yt + h, az), P(ax + s, yt + h, az + d)], "#c5ced2");
      add([P(ax, yt + h, az + d), P(ax + s, yt + h, az + d), P(ax + s, yt + h, az), P(ax, yt + h, az)], "#f4f7f8");
    }
    acBox(-3.4, 0.6);
    acBox(-2.2, 0.6);

    faces.sort((a, b) => b.d - a.d);
    faces.forEach((f) => face3(f.pts, f.fill));

    const palmFade = 1 - e;
    if (palmFade > 0.05) {
      ctx.globalAlpha = palmFade;
      const tip = project3(7.2, 5.4, 1.2, cam);
      const base = project3(7.2, 0, 1.2, cam);
      ctx.strokeStyle = "#6b4a2b";
      ctx.lineWidth = 6 * palmFade;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.strokeStyle = "#2f6a38";
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + i * 0.3;
        const leaf = project3(7.2 + Math.cos(a) * 1.8, 5.4 + Math.sin(a) * 0.4, 1.2 + Math.sin(a) * 1.2, cam);
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(leaf.x, leaf.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (e > 0.82) {
      ctx.globalAlpha = (e - 0.82) / 0.18;
      drawRoof(false);
      ctx.globalAlpha = 1;
    }
  }

  function drawCracks() {
    CRACKS.forEach((c, idx) => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      c.pts.forEach((p, i) => {
        const pt = roofToPx(p[0], p[1]);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      });
      if (c.seal < 1) {
        ctx.strokeStyle = "rgba(40,32,26,0.86)";
        ctx.lineWidth = c.w;
        ctx.stroke();
        const pulse = 0.16 + 0.14 * Math.sin(performance.now() / 280 + idx);
        ctx.strokeStyle = "rgba(70,130,155," + pulse + ")";
        ctx.lineWidth = c.w + 4;
        ctx.stroke();
        const end = roofToPx(c.pts[c.pts.length - 1][0], c.pts[c.pts.length - 1][1]);
        ctx.fillStyle = "rgba(50,90,110,0.30)";
        ctx.beginPath();
        ctx.ellipse(end.x, end.y + 5, 5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c.seal > 0) {
        ctx.strokeStyle = "rgba(247,242,230," + (0.50 + c.seal * 0.50) + ")";
        ctx.lineWidth = c.w + 6;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,252,245," + (0.35 + c.seal * 0.45) + ")";
        ctx.lineWidth = Math.max(2, c.w - 1);
        ctx.stroke();
      }
    });
  }

  function drawNozzle(x, y) {
    ctx.save();
    ctx.translate(x, y - 52);
    ctx.rotate(nozzleAng + 0.18);
    ctx.fillStyle = "rgba(247,242,230,0.28)";
    ctx.beginPath();
    ctx.moveTo(38, -2);
    ctx.lineTo(78, -16);
    ctx.lineTo(86, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = NAVY;
    roundRect(-10, -12, 52, 18, 8); ctx.fill();
    ctx.fillStyle = RED;
    roundRect(10, 5, 8, 16, 2); ctx.fill();
    ctx.fillStyle = NAVY;
    roundRect(-8, 5, 14, 26, 5); ctx.fill();
    ctx.fillStyle = "#0c2748";
    roundRect(36, -6, 16, 8, 3); ctx.fill();
    ctx.fillStyle = FOAM;
    ctx.beginPath(); ctx.arc(54, -2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 140 * dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life * 5);
      ctx.fillStyle = FOAM;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 48 * dt;
      if (p.life <= 0) { burst.splice(i, 1); continue; }
      ctx.fillStyle = p.c + Math.max(0, p.life) + ")";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!last) last = now;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (paused) return;

    if (screen === "fly") {
      flyT = Math.min(1, flyT + dt / FLY_DUR);
      drawFly(flyT);
      if (flyT >= 1) setScreen("play");
      return;
    }

    if (screen === "play") {
      tLeft = Math.max(0, tLeft - dt);
      if (holding) {
        const p = roofToPx(pointer.x, pointer.y);
        let on = false;
        if (inDeck(pointer.x, pointer.y)) {
          CRACKS.forEach((c) => {
            if (c.seal < 1 && distToCrack(pointer.x, pointer.y, c) < SEAL_RADIUS) {
              c.seal = Math.min(1, c.seal + dt * SEAL_RATE);
              on = true;
            }
          });
        }
        maybeStamp(p.x, p.y, on, now);
        spawnSpray(p.x, p.y, on);
        nozzleAng = -0.95 + (pointer.x - 0.5) * 0.35;
      } else {
        bill = Math.min(BILL_MAX, bill + BILL_RISE * dt);
      }
      fill = crackFill();
      heatEl.style.opacity = String(0.14 + 0.32 * (1 - fill / 100));
      timerEl.textContent = tLeft.toFixed(1);
      timerEl.classList.toggle("warn", tLeft <= 3);
      billNum.textContent = String(Math.round(bill));
      fillNum.textContent = Math.round(fill) + "%";
      fillBar.style.width = fill + "%";
      if (allSealed()) goWin();
      else if (tLeft <= 0) goLose();
    } else if (screen === "win") {
      const cur = Number(billTo.textContent);
      if (cur > BILL_WIN) billTo.textContent = String(Math.max(BILL_WIN, cur - 8));
    }

    if (screen === "start") drawVilla();
    else drawRoof(screen === "win");

    if (screen === "play" || screen === "lose") drawCracks();
    if (screen === "play" || screen === "win") ctx.drawImage(foamCanvas, 0, 0, W, H);
    if (screen === "play" && holding) {
      const p = roofToPx(pointer.x, pointer.y);
      drawNozzle(p.x, p.y);
    }
    drawParticles(dt);
  }

  window.addEventListener("resize", resize);
  resize();
  setScreen("start");
  requestAnimationFrame(tick);
})();
