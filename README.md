# احبس الحرارة — Al-Tamaize playable ad

Hold-to-spray HTML5 mini-game for **Al-Tamaize** (مؤسسة التميز الفني التجارية), Khobar.
One mechanic: hold the roof to spray polyurethane foam, seal cracks, drop the AC bill.
Portrait 9:16. Arabic UI, Saudi Gulf tone.

**Play now (jsDelivr):** [open the game](https://cdn.jsdelivr.net/gh/khaledSoq/ahbes-alharara@main/index.html)

Repo: [github.com/khaledSoq/ahbes-alharara](https://github.com/khaledSoq/ahbes-alharara)

WhatsApp CTA: [wa.me/966542178038](https://wa.me/966542178038?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%A8%D8%BA%D9%89%20%D9%81%D8%AD%D8%B5%20%D9%85%D8%AC%D8%A7%D9%86%D9%8A%20%D9%84%D9%84%D8%B9%D8%B2%D9%84%20%D8%A7%D9%84%D8%AD%D8%B1%D8%A7%D8%B1%D9%8A/%D8%A7%D9%84%D9%85%D8%A7%D8%A6%D9%8A%20%D9%85%D9%86%20%D8%A5%D8%B9%D9%84%D8%A7%D9%86%20%D8%A7%D8%AD%D8%A8%D8%B3%20%D8%A7%D9%84%D8%AD%D8%B1%D8%A7%D8%B1%D8%A9%20%E2%80%94%20Al-Tamaize)

## How to run locally

```bash
# from the repo root
python3 -m http.server 8080
# then open http://127.0.0.1:8080
```

Opening `index.html` as a file also works (no backend). Use a local server if a browser blocks `file://` canvas or fonts.

Phone: same Wi-Fi, visit `http://YOUR-LAN-IP:8080`.

## File structure

```
index.html
styles.css
game.js
assets/logo-al-tamaize.svg   # lockup (swap for official PNG)
assets/logo-symbol.svg       # HUD / play mark
assets/favicon.svg           # symbol on white
README.md
```

Vanilla JS. No build step. No network requests during play except the WhatsApp CTA tap.

## Swap the official logo

The attached Al-Tamaize lockup must be used as pixels, not redrawn.

1. Save the official file as `assets/logo-al-tamaize.png` (full lockup: symbol + **Al-Tamaize** + `COATING & PAINTING`).
2. Crop the symbol-only mark to `assets/logo-symbol.png` (no tagline).
3. In `index.html` the `<img>` tags already prefer PNG and fall back to SVG:
   - `src="assets/logo-al-tamaize.png"`
   - `src="assets/logo-symbol.png"`
4. Favicon / touch icon: symbol only, white background, do not stretch.

Never write Altamaize, Al Tamaize, or AL-TAMAIZE in UI. Brand name is **Al-Tamaize**. Arabic near the logo: التميز.

## Replace placeholder roof art with Khobar job photos

Gameplay currently paints a Khobar-style villa / flat roof in canvas so the package stays tiny and works offline.

To swap in real job photos later:

1. Drop photos into `assets/`:
   - `villa-start.jpg` — 1080×1920, cream Eastern Province villa, noon sun, water tank on the roof.
   - `roof-play.jpg` — overhead 3/4 of a cracked, wet concrete roof.
   - `roof-win.jpg` — same camera, white foam / elastomeric coating, cooler light.
2. In `styles.css` add `.bg-start`, `.bg-play`, `.bg-win` layers with `background-image`.
3. In `game.js`, skip `drawVilla()` / `drawRoofScene()` fills when those images are loaded (`new Image(); img.src = ...`). Keep canvas for foam, cracks, nozzle, and heat.
4. Keep HUD text readable: white chips + text shadow. Do not put navy/red logo on a busy roof without a white pill.

## Playable-ad export notes

- Zip root must contain `index.html` (not nested in a folder).
- Portrait 9:16. Designed 1080×1920, scales to any phone.
- Keep the package under 5 MB.
- No external fetches during play. For Snapchat/TikTok/Meta export:
  - Download the two Cairo woff2 files from `styles.css` `@font-face` into `assets/fonts/` and point `src` at local files.
  - WhatsApp deep link is the only allowed navigation.
- Safe area: titles, timer, CTA sit above the bottom 140px (in-app browser chrome).
- Hold = `pointerdown` / `touchstart`. Release = `pointerup` / `touchend` / `pointercancel`.
- Timer pauses when the tab is hidden.
- Optional 10ms vibrate on first successful hold.

## Game loop

| Screen | Notes |
| --- | --- |
| Start | Logo pill, احبس الحرارة / وقف التسريب, ابدأ |
| Play | 8.0s. Hold anywhere to spray cream foam. Fill 0→100% while held. 6 cracks seal on contact. Bill climbs untreated 480→580 ر.س |
| Win | Fill 100% **or** all cracks sealed. Bill drops toward 310. ضمان 10 سنوات. Cool tint. |
| Lose | Timer hits 0 under 100%. Roof stays hot. Same guarantee + same two buttons. Never dead-ends. |

Primary CTA: **اطلب فحص مجاني** → WhatsApp prefilled message.
Replay: **العب مرة ثانية** resets timer, bill, cracks, foam, heat, HUD.

Allowed claims only: يقلل انتقال الحرارة، يحمي من التسريب، ضمان مكتوب 10 سنوات.
