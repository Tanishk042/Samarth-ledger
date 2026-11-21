"""Generate the two PWA icons from the original Samarth Ledger mark.

Pure Pillow implementation keeps the build reproducible without a browser or
native image toolchain. Run: python3 scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "brand"
OUT.mkdir(parents=True, exist_ok=True)

INK = (20, 20, 19, 255)
PAPER = (246, 243, 241, 255)
ACCENT = (255, 103, 27, 255)


def draw_icon(size: int) -> Image.Image:
    scale = 4
    s = size * scale
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    radius = int(s * 18 / 64)
    draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=INK)

    width = max(2, int(s * 3.2 / 64))
    # Open ledger frame: cream top-left, accent bottom-right.
    draw.line([(s * 18 / 64, s * 18 / 64), (s * 40 / 64, s * 18 / 64)], fill=PAPER, width=width)
    draw.arc(
        (s * 34 / 64, s * 18 / 64, s * 46 / 64, s * 30 / 64),
        start=270,
        end=360,
        fill=PAPER,
        width=width,
    )
    draw.line([(s * 46 / 64, s * 24 / 64), (s * 46 / 64, s * 40 / 64)], fill=PAPER, width=width)
    draw.arc(
        (s * 34 / 64, s * 34 / 64, s * 46 / 64, s * 46 / 64),
        start=0,
        end=90,
        fill=ACCENT,
        width=width,
    )
    draw.line([(s * 46 / 64, s * 46 / 64), (s * 24 / 64, s * 46 / 64)], fill=ACCENT, width=width)
    draw.arc(
        (s * 18 / 64, s * 34 / 64, s * 30 / 64, s * 46 / 64),
        start=90,
        end=180,
        fill=ACCENT,
        width=width,
    )
    draw.line([(s * 18 / 64, s * 46 / 64), (s * 18 / 64, s * 24 / 64)], fill=ACCENT, width=width)

    r_outer = s * 5.5 / 64
    draw.ellipse(
        (s * 32 / 64 - r_outer, s * 32 / 64 - r_outer, s * 32 / 64 + r_outer, s * 32 / 64 + r_outer),
        fill=PAPER,
    )
    r_inner = s * 2.2 / 64
    draw.ellipse(
        (s * 32 / 64 - r_inner, s * 32 / 64 - r_inner, s * 32 / 64 + r_inner, s * 32 / 64 + r_inner),
        fill=INK,
    )
    return image.resize((size, size), Image.Resampling.LANCZOS)


for size in (192, 512):
    path = OUT / f"icon-{size}.png"
    draw_icon(size).save(path, optimize=True)
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
