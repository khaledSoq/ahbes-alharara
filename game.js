(() => {
  "use strict";

  const NAVY = "#123A6B";
  const RED = "#E31B23";
  const FOAM = "#F3E6C4";
  const FOAM_D = "#e4cc96";
  const DURATION = 8;
  const FILL_RATE = 100 / 5.55;
  const BILL_START = 480;
  const BILL_MAX = 580;
  const BILL_WIN = 310;
  const BILL_RISE = 22;
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
  let drips = [];
  let nozzleAng = -0.6;
  let winBill = BILL_WIN;
  let winBillFrom = BILL_MAX;

  const CRACKS = [
    { pts: [[0.42,0.28],[0.48,0.40],[0.50,0.55],[0.47,0.68]], w: 7, seal: 0 },
    { pts: [[0.28,0.36],[0.34,0.44],[0.38,0.52]], w: 6, seal: 0 },
    { pts: [[0.58,0.34],[0.66,0.42],[0.70,0.50]], w: 6, seal: 0 },
    { pts: [[0.32,0.58],[0.40,0.64],[0.46,0.70]], w: 8, seal: 0 },
    { pts: [[0.60,0.58],[0.68,0.62],[0.74,0.70]], w: 6, seal: 0 },
    { pts: [[0.50,0.24],[0.56,0.30],[0.60,0.38]], w: 5, seal: 0 }
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

  function resetPlay() {
    tLeft = DURATION;
    fill = 0;
    bill = BILL_START;
    holding = false;
    didHold = false;
    particles.length = 0;
    burst.length = 0;
    CRACKS.forEach((c) => (c.seal = 0));
    foamCtx.clearRect(0, 0, W, H);
    holdHint.classList.remove("hide");
    timerEl.classList.remove("warn");
    fillBar.style.width = "0%";
    fillNum.textContent = "0%";
    billNum.textContent = String(Math.round(bill));
    seedDrips();
  }

  function setScreen(name) {
    screen = name;
    stage.dataset.state = name;
    screenStart.hidden = name !== "start";
    screenPlay.hidden = name !== "play";
    screenEnd.hidden = name !== "win" && name !== "lose";
  }

  function seedDrips() {
    drips = CRACKS.map((c) => {
      const p = c.pts[c.pts.length - 1];
      return { x: p[0], y: p[1], ph: Math.random() * 6, on: true };
    });
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
      const dx = nx - (ax + abx * t);
      const dy = ny - (ay + aby * t);
      min = Math.min(min, Math.hypot(dx, dy));
    }
    return min;
  }

  function stampFoam(x, y, r) {
    const g = foamCtx.createRadialGradient(x, y, r * 0.12, x, y, r);
    g.addColorStop(0, "rgba(255,248,220,0.82)");
    g.addColorStop(0.45, "rgba(243,230,196,0.70)");
    g.addColorStop(0.82, "rgba(228,204,150,0.38)");
    g.addColorStop(1, "rgba(228,204,150,0)");
    foamCtx.fillStyle = g;
    foamCtx.beginPath();
    foamCtx.arc(x, y, r, 0, Math.PI * 2);
    foamCtx.fill();
    foamCtx.fillStyle = "rgba(255,255,240,0.35)";
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = r * (0.15 + Math.random() * 0.25);
      foamCtx.beginPath();
      foamCtx.arc(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.28, rr, 0, Math.PI * 2);
      foamCtx.fill();
    }
  }

  function spawnSpray(x, y) {
    const n = 5;
    for (let i = 0; i < n && particles.length < 90; i++) {
      const a = nozzleAng + (Math.random() - 0.5) * 0.7;
      const sp = 90 + Math.random() * 140;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + 30,
        r: 2.5 + Math.random() * 4.5,
        life: 0.22 + Math.random() * 0.2
      });
    }
  }

  function spawnBurst() {
    burst = [];
    for (let i = 0; i < 42; i++) {
      burst.push({
        x: W * (0.25 + Math.random() * 0.5),
        y: H * (0.35 + Math.random() * 0.25),
        vx: (Math.random() - 0.5) * 40,
        vy: -40 - Math.random() * 90,
        r: 2 + Math.random() * 3,
        life: 0.7 + Math.random() * 0.5,
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
    winBillFrom = Math.round(bill);
    winBill = BILL_WIN;
    document.getElementById("bill-from").textContent = String(winBillFrom);
    billTo.textContent = String(BILL_WIN);
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
    const p = roofToPx(pointer.x, pointer.y);
    stampFoam(p.x, p.y, 36);
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

  function drawSky(hot) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (hot) {
      g.addColorStop(0, "#f3e2c4");
      g.addColorStop(0.45, "#e8c48a");
      g.addColorStop(1, "#c48a52");
    } else {
      g.addColorStop(0, "#d7eef0");
      g.addColorStop(0.5, "#c5ddd8");
      g.addColorStop(1, "#b7d0c4");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPalm(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(-s * 0.06, 0, s * 0.12, s * 1.15);
    ctx.strokeStyle = "#2f6b3a";
    ctx.fillStyle = "#3e8a49";
    ctx.lineWidth = s * 0.04;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.32;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.35 - s * 0.1, Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVilla() {
    drawSky(true);
    ctx.fillStyle = "#d7c3a1";
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.fillStyle = "#c9b089";
    ctx.fillRect(0, H * 0.70, W, H * 0.03);

    const hx = W * 0.18, hy = H * 0.32, hw = W * 0.52, hh = H * 0.40;
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = "#e4d6c0";
    ctx.fillRect(hx + hw * 0.72, hy + hh * 0.08, hw * 0.38, hh * 0.92);

    ctx.fillStyle = "#d9cbb6";
    ctx.fillRect(hx - 4, hy - H * 0.035, hw + 8, H * 0.04);
    ctx.fillStyle = "#cfd8dd";
    roundRect(hx + hw * 0.28, hy - H * 0.10, hw * 0.22, H * 0.09, 6);
    ctx.fill();
    ctx.fillStyle = "#c5cdd0";
    ctx.fillRect(hx + hw * 0.55, hy - H * 0.075, hw * 0.12, H * 0.06);
    ctx.fillRect(hx + hw * 0.69, hy - H * 0.075, hw * 0.12, H * 0.06);

    ctx.fillStyle = "#2b3a44";
    const win = (x, y, w, h) => { ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#d7c7ae"; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); };
    win(hx + hw * 0.10, hy + hh * 0.16, hw * 0.16, hh * 0.18);
    win(hx + hw * 0.38, hy + hh * 0.16, hw * 0.16, hh * 0.18);
    win(hx + hw * 0.10, hy + hh * 0.48, hw * 0.16, hh * 0.22);
    win(hx + hw * 0.38, hy + hh * 0.48, hw * 0.16, hh * 0.22);
    win(hx + hw * 0.78, hy + hh * 0.20, hw * 0.14, hh * 0.16);
    win(hx + hw * 0.78, hy + hh * 0.50, hw * 0.14, hh * 0.16);

    ctx.fillStyle = "#3a2a22";
    ctx.fillRect(hx + hw * 0.12, hy + hh * 0.78, hw * 0.12, hh * 0.22);
    ctx.fillStyle = "#1b242c";
    ctx.fillRect(hx + hw * 0.08, hy + hh * 0.42, hw * 0.42, 4);

    ctx.fillStyle = "#ebe3d4";
    ctx.fillRect(W * 0.12, H * 0.64, W * 0.76, H * 0.08);
    ctx.fillStyle = "#3a2a22";
    ctx.fillRect(W * 0.28, H * 0.66, W * 0.07, H * 0.06);

    drawPalm(W * 0.84, H * 0.42, W * 0.22);

    const t = performance.now() / 400;
    ctx.strokeStyle = "rgba(255,160,60,0.18)";
    ctx.lineWidth = 10;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      for (let x = 0; x < W; x += 8) {
        const y = H * 0.25 + i * 28 + Math.sin(x * 0.02 + t + i) * 6;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawRoofScene(sealed) {
    drawSky(!sealed);
    ctx.fillStyle = sealed ? "#dfe9e6" : "#c9a882";
    ctx.fillRect(0, H * 0.78, W, H * 0.22);

    const x0 = W * 0.08, y0 = H * 0.16, x1 = W * 0.92, y1 = H * 0.78;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(W * 0.16, y0);
    ctx.lineTo(x1, y0 + H * 0.04);
    ctx.lineTo(x1 - W * 0.02, y1);
    ctx.lineTo(W * 0.08, y1 - H * 0.04);
    ctx.closePath();
    ctx.clip();

    const deck = ctx.createLinearGradient(0, y0, 0, y1);
    if (sealed) {
      deck.addColorStop(0, "#f4f7f6");
      deck.addColorStop(1, "#e4eeea");
    } else {
      deck.addColorStop(0, "#cbb89a");
      deck.addColorStop(1, "#9e8364");
    }
    ctx.fillStyle = deck;
    ctx.fillRect(0, 0, W, H);

    if (!sealed) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#3a2a22";
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.ellipse((i * 97) % W, (i * 53) % H, 18, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(40,40,50,0.28)";
      roundRect(W * 0.62, H * 0.42, W * 0.16, H * 0.08, 8); ctx.fill();
      roundRect(W * 0.22, H * 0.55, W * 0.18, H * 0.07, 8); ctx.fill();
    } else {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = FOAM;
      for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.arc((i * 73) % W, H * 0.25 + (i * 41) % (H * 0.5), 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.strokeStyle = sealed ? "#e8eeea" : "#d9c8ae";
    ctx.lineWidth = 18;
    ctx.strokeRect(W * 0.10, H * 0.17, W * 0.80, H * 0.58);

    ctx.fillStyle = "#dfe5e8";
    roundRect(W * 0.62, H * 0.18, W * 0.16, H * 0.11, 10); ctx.fill();
    ctx.fillStyle = "#c5ccd0";
    ctx.fillRect(W * 0.64, H * 0.20, W * 0.05, H * 0.05);
    ctx.fillRect(W * 0.71, H * 0.20, W * 0.05, H * 0.05);
    ctx.beginPath();
    ctx.arc(W * 0.22, H * 0.24, 16, 0, Math.PI * 2);
    ctx.fillStyle = "#d8dde0";
    ctx.fill();

    ctx.fillStyle = sealed ? "#e8eeea" : "#cfc3b0";
    ctx.fillRect(W * 0.08, H * 0.72, W * 0.84, H * 0.08);
    ctx.fillStyle = "#2b3a44";
    ctx.fillRect(W * 0.18, H * 0.78, W * 0.08, H * 0.06);
    ctx.fillRect(W * 0.70, H * 0.78, W * 0.08, H * 0.06);
  }

  function drawCracks() {
    CRACKS.forEach((c, idx) => {
      const sealed = c.seal >= 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      c.pts.forEach((p, i) => {
        const pt = roofToPx(p[0], p[1]);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      });
      if (!sealed) {
        ctx.strokeStyle = "rgba(25,20,18,0.78)";
        ctx.lineWidth = c.w;
        ctx.stroke();
        ctx.strokeStyle = "rgba(70,140,170," + (0.22 + 0.18 * Math.sin(performance.now() / 280 + idx)) + ")";
        ctx.lineWidth = c.w + 5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = FOAM_D;
        ctx.lineWidth = c.w + 6;
        ctx.stroke();
      }
    });
    if (screen === "play") {
      drips.forEach((d, i) => {
        if (CRACKS[i].seal >= 1) return;
        const p = roofToPx(d.x, d.y + (Math.sin(performance.now() / 400 + d.ph) * 0.01));
        ctx.fillStyle = "rgba(50,80,100,0.45)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 8, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function drawNozzle(x, y) {
    ctx.save();
    ctx.translate(x, y - 54);
    ctx.rotate(nozzleAng + 0.2);
    ctx.fillStyle = NAVY;
    roundRect(-10, -14, 54, 20, 8); ctx.fill();
    ctx.fillStyle = RED;
    roundRect(6, 4, 8, 16, 3); ctx.fill();
    ctx.fillStyle = NAVY;
    roundRect(-6, 6, 14, 28, 6); ctx.fill();
    ctx.fillStyle = FOAM;
    ctx.beginPath(); ctx.arc(44, -4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life * 4);
      ctx.fillStyle = FOAM;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 50 * dt;
      if (p.life <= 0) { burst.splice(i, 1); continue; }
      ctx.fillStyle = p.c + (Math.max(0, p.life)) + ")";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!last) last = now;
    let dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (paused) return;

    if (screen === "play") {
      tLeft -= dt;
      if (tLeft < 0) tLeft = 0;
      if (holding) {
        fill = Math.min(100, fill + FILL_RATE * dt);
        const p = roofToPx(pointer.x, pointer.y);
        stampFoam(p.x, p.y, 28 + Math.sin(now / 80) * 4);
        spawnSpray(p.x, p.y);
        CRACKS.forEach((c) => {
          if (c.seal < 1 && distToCrack(pointer.x, pointer.y, c) < 0.07) {
            c.seal = Math.min(1, c.seal + dt * 1.7);
          }
        });
        nozzleAng = -0.9 + (pointer.x - 0.5) * 0.4;
      } else {
        bill = Math.min(BILL_MAX, bill + BILL_RISE * dt);
      }
      const heat = 0.25 + 0.55 * (1 - fill / 100) * (holding ? 0.65 : 1);
      heatEl.style.opacity = String(heat);
      timerEl.textContent = tLeft.toFixed(1);
      timerEl.classList.toggle("warn", tLeft <= 2);
      billNum.textContent = String(Math.round(bill));
      fillNum.textContent = Math.round(fill) + "%";
      fillBar.style.width = fill + "%";
      if (fill >= 100 || allSealed()) goWin();
      else if (tLeft <= 0) goLose();
    } else if (screen === "win") {
      const cur = Number(billTo.textContent);
      if (cur > BILL_WIN) billTo.textContent = String(Math.max(BILL_WIN, cur - 6));
    }

    if (screen === "start") drawVilla();
    else drawRoofScene(screen === "win" || (screen === "play" && fill > 92));

    if (screen === "play" || screen === "lose") drawCracks();
    if (screen === "play" || screen === "win") {
      ctx.drawImage(foamCanvas, 0, 0, W, H);
    }
    if (screen === "play" && holding) {
      const p = roofToPx(pointer.x, pointer.y);
      drawNozzle(p.x, p.y);
    }
    drawParticles(dt);
  }

  window.addEventListener("resize", resize);
  resize();
  seedDrips();
  setScreen("start");
  requestAnimationFrame(tick);
})();
