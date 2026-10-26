#!/usr/bin/env python3
"""Process raw ChatGPT art (art/gpt_raw/) into game-ready assets (art/gpt/).

For each asset: trims transparent padding (alpha-based bbox, small margin kept),
then resizes to the exact pixel size the game draws it at (see art/gpt_prompts.tsv
and game.js). Keeps alpha. Also carries two asset-specific fixes:
  - emblem_blue.png: the raw PNG has a punched-through near-transparent hole in the
    middle of the star (alpha dips to ~0..a dark RGB dip along with it) - this is a
    generation defect, emblem_green has no such hole. We flood-fill the connected
    low-alpha blob touching the center with nearest-neighbor color + full opacity,
    then lightly blur just that patch so it reads as a clean flat fill like the
    green emblem.
  - ceiling_bar.png: the raw PNG is a metal bar texture over the top ~45% of the
    canvas and plain white over the bottom ~55% (not part of the texture). We crop
    the white part off before resizing.

Usage: python3 tools/process_art.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, 'art', 'gpt_raw')
OUT = os.path.join(ROOT, 'art', 'gpt')

# filename -> exact output size (w, h) the game draws it at
TARGETS = {
    'title_logo.png': (640, 150),
    'title_keyart.png': (960, 640),
    'bg_center.png': (960, 640),
    'bg_green.png': (272, 500),
    'bg_blue.png': (272, 500),
    'bubble_0.png': (34, 34), 'bubble_1.png': (34, 34), 'bubble_2.png': (34, 34),
    'bubble_3.png': (34, 34), 'bubble_4.png': (34, 34), 'bubble_5.png': (34, 34),
    'launcher.png': (64, 88),
    'ceiling_bar.png': (272, 30),
    'nameplate_green.png': (272, 48), 'nameplate_blue.png': (272, 48),
    'button_normal.png': (380, 42), 'button_hover.png': (380, 42),
    'meterframe_green.png': (280, 24), 'meterframe_blue.png': (280, 24),
    'emblem_green.png': (96, 96), 'emblem_blue.png': (96, 96),
    'ui_panel_wide.png': (960, 200), 'ui_panel_dialog.png': (820, 580),
    'char_green_full.png': (220, 320), 'char_blue_full.png': (220, 320),
    'portrait_green_normal.png': (160, 160), 'portrait_green_happy.png': (160, 160), 'portrait_green_sad.png': (160, 160),
    'portrait_blue_normal.png': (160, 160), 'portrait_blue_happy.png': (160, 160), 'portrait_blue_sad.png': (160, 160),
    # not in TSV: cut-in banners used by the skill animation, sized for a wide
    # horizontal banner that slides across the 960x640 canvas.
    'cutin_shen.png': (760, 270),
    'cutin_chiang.png': (760, 270),
}

NO_TRIM = {'bg_center.png', 'bg_green.png', 'bg_blue.png', 'title_keyart.png',
           'cutin_shen.png', 'cutin_chiang.png', 'ceiling_bar.png'}


def trim_alpha(im, pad_frac=0.01, thresh=10):
    a = im.split()[-1]
    mask = a.point(lambda p: 255 if p > thresh else 0)
    bbox = mask.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    pad = max(2, round(pad_frac * max(r - l, b - t)))
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def fix_emblem_blue(im):
    """Fill the punched-through hole in the middle of the star."""
    arr = np.array(im.convert('RGBA'))
    alpha = arr[:, :, 3]
    mask = alpha < 250
    lbl, _ = ndimage.label(mask)
    cy, cx = im.height // 2, im.width // 2
    center_lbl = lbl[cy, cx]
    if center_lbl == 0:
        return im  # no hole at center, nothing to fix
    hole = lbl == center_lbl
    dist, inds = ndimage.distance_transform_edt(hole, return_indices=True)
    ys, xs = inds
    filled = arr.copy()
    for c in range(3):
        filled[:, :, c] = np.where(hole, arr[ys, xs, c], arr[:, :, c])
    filled[:, :, 3] = np.where(hole, 255, alpha)
    out = Image.fromarray(filled)
    # smooth the nearest-neighbor fill patch so it reads as a flat gradient
    blurred = out.filter(ImageFilter.GaussianBlur(12))
    hole_mask_img = Image.fromarray((hole * 255).astype('uint8'))
    result = Image.composite(blurred, out, hole_mask_img)
    result.putalpha(Image.fromarray(filled[:, :, 3]))
    return result


def strip_white_bottom(im, bright_thresh=248, consecutive=6):
    """Crop off a plain-white lower portion of a texture strip."""
    gray = im.convert('L')
    w, h = gray.size
    arr = np.array(gray)
    row_avg = arr[:, ::8].mean(axis=1)
    cutoff = h
    run = 0
    for y in range(h):
        if row_avg[y] > bright_thresh:
            run += 1
            if run >= consecutive:
                cutoff = y - consecutive + 1
                break
        else:
            run = 0
    return im.crop((0, 0, w, max(1, cutoff)))


def process(name, size):
    path = os.path.join(RAW, name)
    im = Image.open(path)

    if name == 'ceiling_bar.png':
        im = strip_white_bottom(im.convert('RGB')).convert('RGBA')
    elif name == 'emblem_blue.png':
        im = fix_emblem_blue(im)
    else:
        im = im.convert('RGBA')

    if name not in NO_TRIM:
        im = trim_alpha(im)

    out = im.resize(size, Image.LANCZOS)
    out_path = os.path.join(OUT, name)
    out.save(out_path)
    print(f'{name:28s} -> {size[0]}x{size[1]}')


def main():
    os.makedirs(OUT, exist_ok=True)
    missing = []
    for name, size in TARGETS.items():
        if not os.path.exists(os.path.join(RAW, name)):
            missing.append(name)
            continue
        process(name, size)
    if missing:
        print('MISSING raw files, skipped:', missing)


if __name__ == '__main__':
    main()


# ---------------- v4 assets (art/gpt_raw_v4 -> art/gpt) ----------------
# Output at 2x the in-game draw size for crispness; aspect is never squashed:
# 'contain' = fit inside box with transparent padding, 'cover' = crop to fill,
# 'vtile' = scale to width then tile/crop vertically, 'hslice' = 3-slice stretch middle.
RAW4 = os.path.join(ROOT, 'art', 'gpt_raw_v4')
V4 = {
    'bubble_0.png': ('contain', (68, 68)), 'bubble_1.png': ('contain', (68, 68)),
    'bubble_2.png': ('contain', (68, 68)), 'bubble_3.png': ('contain', (68, 68)),
    'bubble_4.png': ('contain', (68, 68)), 'bubble_5.png': ('contain', (68, 68)),
    'v4_bg_pattern.png': ('cover', (960, 640)),
    'v4_pillar_side.png': ('vslice', (52, 1172)),
    'v4_pillar_center.png': ('vslice', (88, 1172)),
    'v4_topbar.png': ('hslice', (1920, 108)),
    'v4_launcher_base.png': ('contain', (168, 100)),
    'v4_launcher_arrow.png': ('contain', (72, 124)),
    'v4_next_box.png': ('contain', (108, 96)),
    'v4_cutin_shen.png': ('fitw', (760, 0)), 'v4_cutin_chiang.png': ('fitw', (760, 0)),
}
for side in ('green', 'blue'):
    for e in ('normal', 'happy', 'sad'):
        V4[f'v4_char_{side}_stand_{e}.png'] = ('contain_bottom', (124, 248))


def defringe(im, cut=40):
    """Kill faint halo pixels and fake light backgrounds connected to the border."""
    r, g, b, a = im.split()
    a = a.point(lambda p: 0 if p < cut else p)
    im = Image.merge('RGBA', (r, g, b, a))
    # flood-remove near-white, low-saturation pixels touching the edge
    px = im.load(); w, h = im.size
    def bgish(p):
        return p[3] > 0 and min(p[:3]) > 225 and max(p[:3]) - min(p[:3]) < 20
    from collections import deque
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    seen = set()
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        p = px[x, y]
        if p[3] == 0 or bgish(p):
            if p[3]:
                px[x, y] = (0, 0, 0, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def fit(im, box, bottom=False):
    W, H = box; s = min(W / im.width, H / im.height)
    r = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', box, (0, 0, 0, 0))
    out.alpha_composite(r, ((W - r.width) // 2, (H - r.height) if bottom else (H - r.height) // 2))
    return out


def process_v4(name, mode, box):
    im = Image.open(os.path.join(RAW4, name)).convert('RGBA')
    if mode != 'cover':
        im = trim_alpha(defringe(im), pad_frac=0.0)
    W, H = box
    if mode == 'contain':
        out = fit(im, box)
    elif mode == 'contain_bottom':
        out = fit(im, box, bottom=True)
    elif mode == 'cover':
        s = max(W / im.width, H / im.height)
        r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        l, t = (r.width - W) // 2, (r.height - H) // 2
        out = r.crop((l, t, l + W, t + H))
    elif mode == 'fitw':
        out = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    elif mode == 'vtile':
        r = im.resize((W, max(1, round(im.height * W / im.width))), Image.LANCZOS)
        out = Image.new('RGBA', box, (0, 0, 0, 0)); y = 0
        while y < H:
            out.alpha_composite(r, (0, y)); y += r.height
    elif mode == 'vslice':
        # keep top/bottom end caps, tile only an interior segment (no repeated caps)
        r = im.resize((W, max(1, round(im.height * W / im.width))), Image.LANCZOS)
        cap = min(r.height // 5, W * 2)
        mid = r.crop((0, r.height * 2 // 5, W, r.height * 3 // 5))
        out = Image.new('RGBA', box, (0, 0, 0, 0)); y = cap
        while y < H - cap:
            out.alpha_composite(mid, (0, y)); y += mid.height
        out.alpha_composite(r.crop((0, 0, W, cap)), (0, 0))
        out.alpha_composite(r.crop((0, r.height - cap, W, r.height)), (0, H - cap))
    elif mode == 'hslice':
        r = im.resize((max(1, round(im.width * H / im.height)), H), Image.LANCZOS)
        cap = min(r.width // 4, H * 2)
        out = Image.new('RGBA', box, (0, 0, 0, 0))
        out.alpha_composite(r.crop((0, 0, cap, H)), (0, 0))
        out.alpha_composite(r.crop((r.width - cap, 0, r.width, H)), (W - cap, 0))
        mid = r.crop((cap, 0, r.width - cap, H)).resize((W - 2 * cap, H), Image.LANCZOS)
        out.alpha_composite(mid, (cap, 0))
    out.save(os.path.join(OUT, name))
    print(f'v4 {name:32s} {mode:15s} -> {out.width}x{out.height}')


def main_v4():
    for name, (mode, box) in V4.items():
        if os.path.exists(os.path.join(RAW4, name)):
            process_v4(name, mode, box)
        else:
            print('MISSING v4 raw:', name)


if __name__ == '__main__':
    main_v4()
