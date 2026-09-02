(() => {
  "use strict";

  const NAVY = "#123A6B";
  const RED = "#E31B23";
  const FOAM = "#F7F2E6";
  const FOAM2 = "#EFE6D0";
  const FOAM3 = "#E4D8BE";
  const WALL = "#F0E6D4";
  const WALL2 = "#E4D5BE";
  const DECK = "#D9CCB4";
  const DECK2 = "#C9B89A";
  const DURATION = 8;
  const BILL_START = 480;
  const BILL_MAX = 580;
  const BILL_WIN = 310;
  const BILL_RISE = 22;
  const SEAL_RADIUS = 0.035;
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
    const fail = () => {
      img.classList.add("is-broken");
      img.style.display = "none";
      const fb = img.parentNode.querySelector(".logo-fallback");
      if (fb) fb.hidden = false;
    };
    img.addEventListener("error", fail);
    if (img.complete && img.naturalWidth === 0) fail();
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

  const CRACKS = [
    { pts: [[0.20, 0.30], [0.27, 0.36], [0.33, 0.44]], w: 5, seal: 0 },
    { pts: [[0.46, 0.24], [0.48, 0.34], [0.47, 0.44]], w: 6, seal: 0 },
    { pts: [[0.64, 0.28], [0.71, 0.34], [0.78, 0.42]], w: 5, seal: 0 },
    { pts: [[0.22, 0.52], [0.30, 0.58], [0.36, 0.66]], w: 6, seal: 0 },
    { pts: [[0.58, 0.52], [0.67, 0.58], [0.76, 0.66]], w: 5, seal: 0 },
    { pts: [[0.42, 0.58], [0.50, 0.64], [0.54, 0.73]], w: 7, seal: 0 }
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
    CRACKS.forEach((c) => (c.seal = 0));
    foamCtx.setTransform(1, 0, 0, 1, 0, 0);
    foamCtx.clearRect(0, 0, foamCanvas.width, foamCanvas.height);
    foamCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    holdHint.classList.remove("hide");
    timerEl.classList.remove("warn");
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
    const g = foamCtx.createRadialGradient(x, y, r * 0.15, x, y, r);
    if (strong) {
      g.addColorStop(0, "rgba(247,242,230,0.92)");
      g.addColorStop(0.45, "rgba(239,230,208,0.80)");
      g.addColorStop(0.8, "rgba(228,216,190,0.40)");
      g.addColorStop(1, "rgba(228,216,190,0)");
    } else {
      g.addColorStop(0, "rgba(247,242,230,0.28)");
      g.addColorStop(0.7, "rgba(239,230,208,0.10)");
      g.addColorStop(1, "rgba(239,230,208,0)");
    }
    foamCtx.fillStyle = g;
    foamCtx.beginPath();
    foamCtx.arc(x, y, r, 0, Math.PI * 2);
    foamCtx.fill();
    if (strong) {
      foamCtx.fillStyle = "rgba(255,252,245,0.35)";
      foamCtx.beginPath();
      foamCtx.arc(x - r * 0.2, y - r * 0.2, r * 0.28, 0, Math.PI * 2);
      foamCtx.fill();
    }
  }

  function spawnSpray(x, y, onCrack) {
    const n = onCrack ? 4 : 2;
    for (let i = 0; i < n && particles.length < 70; i++) {
      const a = nozzleAng + (Math.random() - 0.5) * 0.45;
      const sp = 50 + Math.random() * 90;
      particles.push({
        x: x + Math.cos(a) * 8,
        y: y + Math.sin(a) * 8,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + 20,
        r: onCrack ? 1.6 + Math.random() * 2.2 : 1.1 + Math.random() * 1.4,
        life: 0.16 + Math.random() * 0.12
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
    resetPlay();
    setScreen("play");
  }
  function replay() {
    resetPlay();
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
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSky(hot) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (hot) {
      g.addColorStop(0, "#f4e4c6");
      g.addColorStop(0.5, "#e8c790");
      g.addColorStop(1, "#c9a06a");
    } else {
      g.addColorStop(0, "#d8eef0");
      g.addColorStop(0.55, "#c5ddd8");
      g.addColorStop(1, "#b8d2c6");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPalm(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#6b4a2b";
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, s * 1.2);
    ctx.lineTo(s * 0.05, s * 1.2);
    ctx.lineTo(s * 0.035, 0);
    ctx.lineTo(-s * 0.035, 0);
    ctx.fill();
    ctx.strokeStyle = "#2f6a38";
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.3 - s * 0.08, Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWindow(x, y, w, h) {
    ctx.fillStyle = "#2A3842";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = WALL2;
    ctx.lineWidth = Math.max(2, w * 0.08);
    ctx.strokeRect(x, y, w, h);
  }

  function drawTank(x, y, s) {
    ctx.fillStyle = "#c5cdd1";
    ctx.fillRect(x + s * 0.12, y + s * 0.72, s * 0.76, s * 0.12);
    ctx.fillStyle = "#F2F5F6";
    roundRect(x, y, s, s * 0.78, s * 0.12);
    ctx.fill();
    ctx.fillStyle = "#d5dde0";
    ctx.fillRect(x + s * 0.08, y + s * 0.28, s * 0.84, s * 0.08);
    ctx.fillStyle = "#b7c2c6";
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.08, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAC(x, y, s) {
    ctx.fillStyle = "#c9d0d4";
    roundRect(x, y, s, s * 0.72, 4);
    ctx.fill();
    ctx.strokeStyle = "#9aa3a8";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.36, s * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = "#7d868c";
    ctx.stroke();
  }

  function drawVilla() {
    drawSky(true);
    ctx.fillStyle = "#d4c2a3";
    ctx.fillRect(0, H * 0.70, W, H * 0.30);
    ctx.fillStyle = "#c9b089";
    ctx.fillRect(0, H * 0.695, W, H * 0.012);

    const hx = W * 0.16, hy = H * 0.30, hw = W * 0.54, hh = H * 0.42;
    ctx.fillStyle = WALL;
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = WALL2;
    ctx.fillRect(hx + hw * 0.70, hy + hh * 0.06, hw * 0.38, hh * 0.94);
    ctx.fillStyle = "#d9cbb6";
    ctx.fillRect(hx - 3, hy - H * 0.028, hw + 6, H * 0.032);

    drawTank(hx + hw * 0.28, hy - H * 0.105, hw * 0.22);
    drawAC(hx + hw * 0.54, hy - H * 0.072, hw * 0.13);
    drawAC(hx + hw * 0.70, hy - H * 0.072, hw * 0.13);

    drawWindow(hx + hw * 0.10, hy + hh * 0.14, hw * 0.16, hh * 0.18);
    drawWindow(hx + hw * 0.38, hy + hh * 0.14, hw * 0.16, hh * 0.18);
    drawWindow(hx + hw * 0.10, hy + hh * 0.46, hw * 0.16, hh * 0.22);
    drawWindow(hx + hw * 0.38, hy + hh * 0.46, hw * 0.16, hh * 0.22);
    drawWindow(hx + hw * 0.78, hy + hh * 0.18, hw * 0.14, hh * 0.16);
    drawWindow(hx + hw * 0.78, hy + hh * 0.48, hw * 0.14, hh * 0.16);

    ctx.fillStyle = "#2A3842";
    ctx.fillRect(hx + hw * 0.12, hy + hh * 0.78, hw * 0.11, hh * 0.22);
    ctx.fillStyle = WALL;
    ctx.fillRect(W * 0.10, H * 0.63, W * 0.78, H * 0.085);
    ctx.fillStyle = "#3a2a22";
    ctx.fillRect(W * 0.27, H * 0.655, W * 0.07, H * 0.06);

    drawPalm(W * 0.84, H * 0.40, W * 0.20);

    const t = performance.now() / 420;
    ctx.strokeStyle = "rgba(255,150,50,0.14)";
    ctx.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      for (let x = 0; x < W; x += 10) {
        const y = H * 0.22 + i * 26 + Math.sin(x * 0.02 + t + i) * 5;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawRoof(sealed) {
    drawSky(!sealed);
    ctx.fillStyle = sealed ? "#cfd9d4" : "#d4c2a3";
    ctx.fillRect(0, H * 0.78, W, H * 0.22);

    ctx.fillStyle = WALL;
    ctx.fillRect(W * 0.06, H * 0.14, W * 0.88, H * 0.66);
    ctx.fillStyle = sealed ? "#EFECE4" : DECK;
    ctx.fillRect(W * 0.11, H * 0.19, W * 0.78, H * 0.54);

    ctx.save();
    ctx.beginPath();
    ctx.rect(W * 0.11, H * 0.19, W * 0.78, H * 0.54);
    ctx.clip();
    ctx.strokeStyle = sealed ? "rgba(180,190,185,0.35)" : "rgba(90,70,50,0.18)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) {
      const y = H * 0.19 + (H * 0.54 * i) / 6;
      ctx.beginPath(); ctx.moveTo(W * 0.11, y); ctx.lineTo(W * 0.89, y); ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const x = W * 0.11 + (W * 0.78 * i) / 4;
      ctx.beginPath(); ctx.moveTo(x, H * 0.19); ctx.lineTo(x, H * 0.73); ctx.stroke();
    }
    if (!sealed) {
      ctx.fillStyle = "rgba(70,90,100,0.16)";
      ctx.beginPath(); ctx.ellipse(W * 0.30, H * 0.58, 28, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.68, H * 0.40, 22, 12, 0.2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = "rgba(247,242,230,0.55)";
      ctx.fillRect(W * 0.11, H * 0.19, W * 0.78, H * 0.54);
    }
    ctx.restore();

    ctx.strokeStyle = WALL2;
    ctx.lineWidth = 14;
    ctx.strokeRect(W * 0.11, H * 0.19, W * 0.78, H * 0.54);

    drawTank(W * 0.62, H * 0.175, W * 0.16);
    drawAC(W * 0.16, H * 0.22, W * 0.12);
    drawAC(W * 0.72, H * 0.58, W * 0.12);

    ctx.fillStyle = WALL;
    ctx.fillRect(W * 0.08, H * 0.72, W * 0.84, H * 0.08);
    drawWindow(W * 0.20, H * 0.78, W * 0.10, H * 0.07);
    drawWindow(W * 0.70, H * 0.78, W * 0.10, H * 0.07);
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
        ctx.strokeStyle = "rgba(32,26,22,0.82)";
        ctx.lineWidth = c.w;
        ctx.stroke();
        const pulse = 0.18 + 0.16 * Math.sin(performance.now() / 280 + idx);
        ctx.strokeStyle = "rgba(70,130,155," + pulse + ")";
        ctx.lineWidth = c.w + 4;
        ctx.stroke();
        const end = roofToPx(c.pts[c.pts.length - 1][0], c.pts[c.pts.length - 1][1]);
        ctx.fillStyle = "rgba(50,90,110,0.32)";
        ctx.beginPath();
        ctx.ellipse(end.x, end.y + 6, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c.seal > 0) {
        ctx.strokeStyle = "rgba(239,230,208," + (0.45 + c.seal * 0.55) + ")";
        ctx.lineWidth = c.w + 5;
        ctx.stroke();
      }
    });
  }

  function drawNozzle(x, y) {
    ctx.save();
    ctx.translate(x, y - 46);
    ctx.rotate(nozzleAng + 0.15);
    ctx.fillStyle = NAVY;
    roundRect(-8, -11, 48, 16, 7); ctx.fill();
    ctx.fillStyle = RED;
    roundRect(8, 4, 7, 14, 2); ctx.fill();
    ctx.fillStyle = NAVY;
    roundRect(-5, 4, 12, 24, 5); ctx.fill();
    ctx.fillStyle = FOAM2;
    ctx.beginPath(); ctx.arc(40, -3, 5, 0, Math.PI * 2); ctx.fill();
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

    if (screen === "play") {
      tLeft = Math.max(0, tLeft - dt);
      if (holding) {
        const p = roofToPx(pointer.x, pointer.y);
        let on = false;
        CRACKS.forEach((c) => {
          if (c.seal < 1 && distToCrack(pointer.x, pointer.y, c) < SEAL_RADIUS) {
            c.seal = Math.min(1, c.seal + dt * 1.85);
            on = true;
          }
        });
        stampFoam(p.x, p.y, on ? 13 : 8, on);
        spawnSpray(p.x, p.y, on);
        nozzleAng = -0.95 + (pointer.x - 0.5) * 0.35;
      } else {
        bill = Math.min(BILL_MAX, bill + BILL_RISE * dt);
      }
      fill = crackFill();
      heatEl.style.opacity = String(0.22 + 0.45 * (1 - fill / 100));
      timerEl.textContent = tLeft.toFixed(1);
      timerEl.classList.toggle("warn", tLeft <= 2);
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
