# احبس الحرارة — Al-Tamaize playable ad

Hold-to-spray HTML5 mini-game for **Al-Tamaize** (مؤسسة التميز الفني التجارية), Khobar.
One mechanic: trace the roof cracks with polyurethane spray foam.
Portrait 9:16. Arabic UI, Saudi Gulf tone.

**Live:** [khaledsoq.github.io/ahbes-alharara](https://khaledsoq.github.io/ahbes-alharara/)

Repo: [github.com/khaledSoq/ahbes-alharara](https://github.com/khaledSoq/ahbes-alharara)

WhatsApp CTA: [wa.me/966542178038](https://wa.me/966542178038?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%A8%D8%BA%D9%89%20%D9%81%D8%AD%D8%B5%20%D9%85%D8%AC%D8%A7%D9%86%D9%8A%20%D9%84%D9%84%D8%B9%D8%B2%D9%84%20%D8%A7%D9%84%D8%AD%D8%B1%D8%A7%D8%B1%D9%8A/%D8%A7%D9%84%D9%85%D8%A7%D8%A6%D9%8A%20%D9%85%D9%86%20%D8%A5%D8%B9%D9%84%D8%A7%D9%86%20%D8%A7%D8%AD%D8%A8%D8%B3%20%D8%A7%D9%84%D8%AD%D8%B1%D8%A7%D8%B1%D8%A9%20%E2%80%94%20Al-Tamaize)

## How to run locally

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080
```

## Swap the official logo PNG

`index.html` already points at:

- `assets/logo-al-tamaize.png` — full lockup (symbol + **Al-Tamaize** + COATING & PAINTING)
- `assets/logo-symbol.png` — symbol only, no wordmark, no tagline

If the PNG is missing, the img is **hidden** (no alt-text dump). An inline SVG fallback in the white pill shows instead.

Drop the official attached lockup in as `assets/logo-al-tamaize.png` (do not redraw). Crop the swoosh+T to `assets/logo-symbol.png` on a white square. Never stretch.

Brand name in UI is **Al-Tamaize** only. Arabic near the logo: التميز.

## Game loop

| Screen | Notes |
| --- | --- |
| Start | Street view of the cream Khobar villa + palm + roof tank. احبس الحرارة / وقف التسريب |
| Play | Camera on **that same villa's roof**. 8.0s. Hold to spray cream PU foam. **Win only if all 6 cracks are sealed.** Fill bar is feedback (sealed-crack average), not a win. Holding one spot does not win. |
| Win | Same roof, coated cream/white, cooler light. Bill animates down toward 310. ضمان 10 سنوات. |
| Lose | Same roof, still hot and cracked. Same guarantee + same two buttons. |

Hint during play: **امسك على الشقوق**

Primary CTA: **اطلب فحص مجاني** → WhatsApp prefilled message.
Replay: **العب مرة ثانية**.

Allowed claims only: يقلل انتقال الحرارة، يحمي من التسريب، ضمان مكتوب 10 سنوات.

## Playable-ad export

- `index.html` at zip root. Portrait 9:16. Under 5 MB.
- No fetches during play except WhatsApp on CTA tap.
- Bundle Cairo woff2 from `styles.css` `@font-face` for Snap/TikTok/Meta.
- Titles, timer, CTA sit above the bottom 140px.
- Hold = pointerdown/touchstart. Release = pointerup/touchend/pointercancel.
- Timer pauses when the tab is hidden.
