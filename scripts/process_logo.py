#!/usr/bin/env python3
"""Download official Al-Tamaize lockup pixels, trim, crop symbol, emit PNG/b64/SVG.
Does not redraw. Source: altamaize.com media id 9 title 'لوجو التميز'.
"""
from __future__ import annotations

import base64
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image

OUT = Path("out")
OUT.mkdir(parents=True, exist_ok=True)

WHITE_WEBP = (
    "https://altamaize.com/wp-content/uploads/2026/07/"
    "%D8%AA%D8%B5%D9%85%D9%8A%D9%85-%D8%A8%D8%AF%D9%88%D9%86-%D8%B9%D9%86%D9%88%D8%A7%D9%86.webp"
)
BLACK_PNG = (
    "https://altamaize.com/wp-content/uploads/2026/07/"
    "%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86"
    "-removebg-preview.png"
)
UA = {"User-Agent": "AlTamaizeLogoBot/1.0 (+https://github.com/khaledSoq/ahbes-alharara)"}
THRESH = 248
PAD = 10


def which(name: str) -> str:
    return shutil.which(name) or ""


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def load_rgb(data: bytes) -> Image.Image:
    im = Image.open(__import__("io").BytesIO(data))
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        alpha = im.getchannel("A") if "A" in im.getbands() else None
        if alpha is not None:
            bg.paste(im.convert("RGB"), mask=alpha)
            return bg
    return im.convert("RGB")


def ink_bbox(im: Image.Image, thresh: int = THRESH) -> tuple[int, int, int, int]:
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r < thresh or g < thresh or b < thresh:
                if x < minx:
                    minx = x
                if y < miny:
                    miny = y
                if x > maxx:
                    maxx = x
                if y > maxy:
                    maxy = y
    if maxx < 0:
        return (0, 0, w, h)
    return (minx, miny, maxx + 1, maxy + 1)


def pad_box(box: tuple[int, int, int, int], size: tuple[int, int], pad: int = PAD):
    w, h = size
    x0, y0, x1, y1 = box
    return (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))


def row_ink(im: Image.Image, thresh: int = THRESH) -> list[int]:
    w, h = im.size
    px = im.load()
    counts = []
    for y in range(h):
        c = 0
        for x in range(w):
            r, g, b = px[x, y]
            if r < thresh or g < thresh or b < thresh:
                c += 1
        counts.append(c)
    return counts


def split_symbol_box(im: Image.Image) -> tuple[int, int, int, int]:
    """Upper ink cluster = swoosh+T; skip wordmark/tagline below the gap."""
    counts = row_ink(im)
    h = len(counts)
    min_ink = max(8, int(im.size[0] * 0.01))
    # first ink row
    y0 = next((i for i, c in enumerate(counts) if c >= min_ink), 0)
    # find a valley after the mark (run of near-empty rows) then text resumes
    in_gap = False
    gap_start = None
    split_y = None
    empty_run = 0
    for y in range(y0 + 8, h):
        if counts[y] < min_ink:
            empty_run += 1
            if empty_run >= 4 and not in_gap:
                in_gap = True
                gap_start = y - empty_run + 1
        else:
            if in_gap and empty_run >= 4:
                split_y = gap_start
                break
            empty_run = 0
            in_gap = False
    if split_y is None:
        # fallback: upper 58% of the trimmed lockup
        split_y = y0 + int((h - y0) * 0.58)
    sub = im.crop((0, 0, im.size[0], split_y))
    box = ink_bbox(sub)
    return pad_box(box, sub.size, PAD)


def save_png(im: Image.Image, path: Path, max_kb: int = 80) -> None:
    im = im.convert("RGB")
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True, compress_level=9)
    if path.stat().st_size <= max_kb * 1024:
        return
    # palette reduce while keeping official geometry
    pal = im.quantize(colors=64, method=Image.Quantize.MEDIANCUT)
    pal.convert("RGB").save(path, "PNG", optimize=True, compress_level=9)
    if path.stat().st_size <= max_kb * 1024:
        return
    w, h = im.size
    scale = 0.85
    while path.stat().st_size > max_kb * 1024 and scale > 0.4:
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        im.resize((nw, nh), Image.Resampling.LANCZOS).save(
            path, "PNG", optimize=True, compress_level=9
        )
        scale -= 0.1


def write_b64(src: Path, dest: Path) -> str:
    b64 = base64.b64encode(src.read_bytes()).decode("ascii")
    dest.write_text(b64, encoding="ascii")
    return b64


def write_svg(png: Path, b64: str, dest: Path) -> None:
    w, h = Image.open(png).size
    dest.write_text(
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="Al-Tamaize">\n'
            f'  <image href="data:image/png;base64,{b64}" width="{w}" height="{h}" />\n'
            f'</svg>\n'
        ),
        encoding="ascii",
    )


def tool_report() -> str:
    pil_ver = getattr(Image, "__version__", "unknown")
    lines = [
        f"python3: {sys.version.split()[0]} ({sys.executable})",
        f"PIL/Pillow: yes {pil_ver}",
        f"ImageMagick convert: {which('convert') or 'no'}",
        f"ImageMagick magick: {which('magick') or 'no'}",
        f"identify: {which('identify') or 'no'}",
        f"ffmpeg: {which('ffmpeg') or 'no'}",
        f"node: {which('node') or 'no'}",
        f"pngquant: {which('pngquant') or 'no'}",
        f"optipng: {which('optipng') or 'no'}",
    ]
    try:
        out = subprocess.check_output(["file", "--version"], text=True, stderr=subprocess.STDOUT)
        lines.append(f"file: yes {out.splitlines()[0]}")
    except Exception:
        lines.append(f"file: {which('file') or 'no'}")
    return "\n".join(lines) + "\n"


def main() -> None:
    webp_bytes = fetch(WHITE_WEBP)
    (OUT / "source-official.webp").write_bytes(webp_bytes)
    try:
        png_bytes = fetch(BLACK_PNG)
        (OUT / "source-black.png").write_bytes(png_bytes)
    except Exception as e:
        png_bytes = b""
        print("black png fetch failed", e)

    jpeg_path = OUT / "source-official.jpg"
    im = load_rgb(webp_bytes)
    im.save(jpeg_path, "JPEG", quality=92, optimize=True, subsampling=0)

    # full lockup, white trimmed reasonably
    box = pad_box(ink_bbox(im), im.size, PAD)
    lockup = im.crop(box)
    lockup_path = OUT / "logo-al-tamaize.png"
    save_png(lockup, lockup_path)

    # symbol only: swoosh+T, no wordmark, no tagline, white square canvas
    sx0, sy0, sx1, sy1 = split_symbol_box(im)
    mark = im.crop((sx0, sy0, sx1, sy1))
    mw, mh = mark.size
    side = max(mw, mh) + 8
    square = Image.new("RGB", (side, side), (255, 255, 255))
    square.paste(mark, ((side - mw) // 2, (side - mh) // 2))
    symbol_path = OUT / "logo-symbol.png"
    save_png(square, symbol_path)

    b64_lock = write_b64(lockup_path, OUT / "logo-al-tamaize.b64.txt")
    b64_sym = write_b64(symbol_path, OUT / "logo-symbol.b64.txt")
    write_b64(jpeg_path, OUT / "logo-jpeg.b64.txt")
    write_svg(lockup_path, b64_lock, OUT / "logo-al-tamaize-embed.svg")
    write_svg(symbol_path, b64_sym, OUT / "logo-symbol-embed.svg")

    def info(p: Path) -> str:
        if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            with Image.open(p) as im2:
                return f"{p.name}: {p.stat().st_size} bytes, {im2.size[0]}x{im2.size[1]} {im2.mode} {im2.format}"
        return f"{p.name}: {p.stat().st_size} bytes"

    lines = [
        "Al-Tamaize official logo processing",
        "Source: altamaize.com WP media id=9 title=لوجو التميز",
        f"source webp url: {WHITE_WEBP}",
        f"source webp bytes: {len(webp_bytes)}",
        "NOTE: /home/workdir/attachments/241054.jpg was NOT present in the agent sandbox.",
        "Used official website lockup pixels (no redraw).",
        "",
        tool_report(),
        "",
        "outputs:",
    ]
    for p in sorted(OUT.iterdir()):
        lines.append("  " + info(p))
    # b64 previews
    for name in ("logo-al-tamaize.b64.txt", "logo-symbol.b64.txt", "logo-jpeg.b64.txt"):
        t = (OUT / name).read_text(encoding="ascii").strip()
        lines.append(f"{name} len={len(t)} first80={t[:80]} last40={t[-40:]}")
    (OUT / "logo-info.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print((OUT / "logo-info.txt").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
