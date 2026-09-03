# احبس الحرارة — Al-Tamaize playable ad

Hold-to-spray HTML5 mini-game for **Al-Tamaize** (مؤسسة التميز الفني التجارية), Khobar.
One mechanic: trace the roof cracks with polyurethane spray foam.
Portrait 9:16. Arabic UI, Saudi Gulf tone.

**Live:** [khaledsoq.github.io/ahbes-alharara](https://khaledsoq.github.io/ahbes-alharara/)

Repo: [github.com/khaledSoq/ahbes-alharara](https://github.com/khaledSoq/ahbes-alharara)

WhatsApp CTA: [wa.me/966542178038](https://wa.me/966542178038?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%A8%D8%BA%D9%89%20%D9%81%D8%AD%D8%B5%20%D9%85%D8%AC%D8%A7%D9%86%D9%8A%20%D9%84%D9%84%D8%B9%D8%B2%D9%84%20%D8%A7%D9%84%D8%AD%D8%B1%D8%A7%D8%B1%D9%8A/%D8%A7%D9%84%D9%85%D8%A7%D8%A6%D9%8A%20%D9%85%D9%86%20%D8%A5%D8%B9%D9%84%D8%A7%D9%86%20%D8%A7%D8%AD%D8%A8%D8%B3%20%D8%A7%D9%84%D8%AD%D8%B1%D8%A7%D8%B1%D8%A9%20%E2%80%94%20Al-Tamaize)

Site: [altamaize.com](https://altamaize.com/)

Hard-refresh on phone. Open with a trailing slash: `https://khaledsoq.github.io/ahbes-alharara/`

## How to run locally

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080
```

## Logo

Official lockup pixels (not redrawn):

- `assets/logo-al-tamaize.png` — full lockup on white
- `assets/logo-symbol.png` — swoosh + T only (HUD)

`index.html` loads the PNG first. Empty `alt`. If the PNG is missing, the `<img>` is hidden and an inline SVG fallback with `viewBox` stays in the white pill.

Brand name in UI is **Al-Tamaize** only. Arabic near the logo: التميز.

## Game loop

Villa and roof are **drawn in canvas** (cream Gulf villa, dark navy windows, palm, noon sun, sand street). No stock photos.

Start → cinematic 2D→3D→2D fly-up onto the same villa's roof (tap to skip) → 15s spray.

| Screen | Notes |
| --- | --- |
| Start | Street view of the cream Khobar villa + palm + roof tank + ACs. احبس الحرارة / وقف التسريب |
| Play | Camera on **that same villa's roof** (cream parapet, cylindrical tank top-right, two ACs top-left, facade windows below). **15.0s**. Hold to spray cream PU foam as circular blotches. **Win only if all 6 cracks are sealed.** Fill bar is feedback (sealed-crack average), not a win. Holding empty concrete does not win. |
| Win | Same roof, coated cream, cooler light. Bill animates down toward 310. ضمان 10 سنوات. |
| Lose | Same roof, still hot and cracked. Same guarantee + same three buttons. |

Hint during play: **امسك على الشقوق**

End-card buttons (win and lose):

1. **اطلب فحص مجاني** → WhatsApp prefilled message
2. **زيارة موقعنا** → https://altamaize.com/
3. **العب مرة ثانية**

Allowed claims only: يقلل انتقال الحرارة، يحمي من التسريب، ضمان مكتوب 10 سنوات.

## Playable-ad export

- `index.html` at zip root. Portrait 9:16. Under 5 MB.
- No fetches during play except WhatsApp / site on CTA tap.
- Bundle Cairo woff2 from `styles.css` `@font-face` for Snap/TikTok/Meta.
- Titles, timer, CTA sit above the bottom 140px.
- Hold = pointerdown/touchstart. Release = pointerup/touchend/pointercancel.
- Timer pauses when the tab is hidden.
