#!/usr/bin/env python3
"""Composes the four captured states into one storyboard image."""
import pathlib
from PIL import Image, ImageDraw, ImageFont

FR = pathlib.Path("/home/ubuntu/projects/cekdulu/demo/frames")
OUT = pathlib.Path("/home/ubuntu/projects/cekdulu/demo/cekdulu-ui-flow.png")

BG = (11, 13, 16)
CARD = (20, 23, 28)
BORDER = (35, 38, 44)
TXT = (233, 234, 238)
MUTED = (152, 160, 171)
DIM = (110, 117, 127)
DANGER = (224, 82, 82)
WARN = (217, 154, 43)
OK = (63, 164, 106)
ACCENT = (74, 132, 224)

FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu/",
    "/usr/share/fonts/truetype/liberation/",
    "/usr/share/fonts/TTF/",
]

def font(size, bold=False):
    names = (["DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"] if bold
             else ["DejaVuSans.ttf", "LiberationSans-Regular.ttf"])
    for d in FONT_DIRS:
        for n in names:
            p = pathlib.Path(d) / n
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()

W = 1630
M = 42
COL = 762
GUT = 24
ROWS_Y = [150, 726]
CELL_H = 476
CAP_H = 62

header = 150
footer = 208
H = ROWS_Y[1] + CELL_H + CAP_H + footer

canvas = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(canvas)

# subtle top glow
for i in range(header):
    a = int(26 * (1 - i / header))
    d.line([(0, i), (W, i)], fill=(11 + a, 13 + a, 16 + a))

# ---------------------------------------------------------------- header ---
d.text((M, 40), "CekDulu", font=font(34, True), fill=TXT)
d.text((M + 168, 52), "alur UI", font=font(22), fill=DIM)

sub = "Empat keadaan yang dilihat pengguna. Semua diambil dari kode yang berjalan, bukan mock-up."
d.text((M, 88), sub, font=font(17), fill=MUTED)

# little legend chips, top-right
chips = [("tidak ada sinyal", OK), ("mencurigakan", WARN), ("berbahaya", DANGER)]
cx = W - M
for label, col in reversed(chips):
    f = font(14)
    tw = d.textlength(label, font=f)
    bw = tw + 34
    cx -= bw
    d.rounded_rectangle([cx, 44, cx + bw, 72], radius=14, outline=col, width=2)
    d.ellipse([cx + 11, 53, cx + 21, 63], fill=col)
    d.text((cx + 28, 51), label, font=f, fill=MUTED)
    cx -= 12


# ------------------------------------------------------------------ cells ---
def place(img_path, cell_x, cell_y, cell_w, cell_h):
    im = Image.open(img_path).convert("RGB")
    scale = min(cell_w / im.width, cell_h / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    x = cell_x + (cell_w - nw) // 2
    y = cell_y
    canvas.paste(im, (x, y))
    d.rounded_rectangle([x - 1, y - 1, x + nw, y + nh], radius=8, outline=BORDER, width=1)
    return x, y, nw, nh


def caption(x, y, num, title, body, color):
    cy = y + CELL_H + 14
    r = 13
    d.ellipse([x, cy + 2, x + r * 2, cy + 2 + r * 2], fill=color)
    f = font(15, True)
    tw = d.textlength(str(num), font=f)
    d.text((x + r - tw / 2, cy + 7), str(num), font=f, fill=(12, 13, 15))
    d.text((x + 36, cy), title, font=font(17, True), fill=TXT)
    d.text((x + 36, cy + 26), body, font=font(14), fill=MUTED)


a = place(FR / "01-hover.png", M, ROWS_Y[0], COL, CELL_H)
caption(M, ROWS_Y[0], 1, "Hover — verdict sebelum klik",
        "Kursor berhenti di link, pill muncul. Tidak ada yang dibuka, tidak ada yang dikirim.",
        DANGER)

b = place(FR / "02-block.png", M + COL + GUT, ROWS_Y[0], COL, CELL_H)
caption(M + COL + GUT, ROWS_Y[0], 2, "Klik — ditahan kalau berbahaya",
        "Kartu menyebut alasannya. “Tetap buka” selalu ada; ini alat bantu, bukan sensor.",
        DANGER)

c = place(FR / "03-warn.png", M, ROWS_Y[1], COL, CELL_H)
caption(M, ROWS_Y[1], 3, "Situs apa pun, bukan cuma chat",
        "Amber = ada sinyal janggal tapi belum cukup untuk memblokir. Ini band tengahnya.",
        WARN)

popup_w = 380
px = M + COL + GUT + (COL - popup_w) // 2
apply_im = Image.open(FR / "04-popup.png")
pop_h = int(apply_im.height * (popup_w / apply_im.width))
place(FR / "04-popup.png", px, ROWS_Y[1] + (CELL_H - pop_h) // 2, popup_w, CELL_H)
caption(M + COL + GUT, ROWS_Y[1], 4, "Link dari HP — tempel di popup",
        "Untuk link yang masuk ke WhatsApp aplikasi, bukan WhatsApp Web.",
        ACCENT)

# ----------------------------------------------------------------- footer ---
fy = ROWS_Y[1] + CELL_H + CAP_H + 34
d.line([(M, fy), (W - M, fy)], fill=BORDER, width=1)

d.text((M, fy + 20), "Jalur keputusan saat klik", font=font(15, True), fill=MUTED)

steps = [
    ("klik", "event ditangkap", DIM),
    ("cek lokal", "0 ms · offline", OK),
    ("cache?", "domain, 6 jam", OK),
    ("database", "≤ 140 ms", WARN),
    ("lanjut / tahan", "timeout = lanjut", ACCENT),
]

bx = M
by = fy + 56
bw, bh = 268, 56
for i, (t, s, col) in enumerate(steps):
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=9, fill=CARD, outline=col, width=2)
    d.text((bx + 14, by + 9), t, font=font(15, True), fill=TXT)
    d.text((bx + 14, by + 31), s, font=font(13), fill=MUTED)
    bx += bw
    if i < len(steps) - 1:
        ax = bx + 10
        ay = by + bh / 2
        d.line([(ax, ay), (ax + 18, ay)], fill=DIM, width=2)
        d.polygon([(ax + 18, ay - 5), (ax + 26, ay), (ax + 18, ay + 5)], fill=DIM)
        bx += 36

canvas.save(OUT, optimize=True)
print("wrote", OUT, canvas.size, round(OUT.stat().st_size / 1024, 1), "KB")
