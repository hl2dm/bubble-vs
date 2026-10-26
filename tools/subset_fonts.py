#!/usr/bin/env python3
"""Subset the bundled OFL display fonts down to the glyphs this game actually
needs, and emit them as woff2 next to this repo's HTML/JS.

Method:
  1. Scan game.js + index.html for every literal character that appears in the
     source, then union that with the full ASCII printable range and digits.
     This is the baseline "used" character set.
  2. The two GenSenRounded2TW weights are the only faces used to render
     Traditional Chinese text, so they must cover the *entire* baseline set
     with zero gaps -- any missing glyph would mean broken UI text. We assert
     that and print the missing characters if the assertion would fail.
  3. Bungee and Press Start 2P are Latin/pixel display faces used only for a
     handful of short English/numeral HUD words (BUBBLE VERSUS, VS, ROUND,
     NEXT, score digits). They intentionally do not carry CJK glyphs, so they
     are subset to the ASCII-safe slice of the baseline set, and separately
     asserted against the literal strings the game actually draws with them.

Run: python3 tools/subset_fonts.py
"""
import string
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'fonts' / 'src'
OUT = ROOT / 'fonts'

ASCII_PRINTABLE = {chr(c) for c in range(0x20, 0x7f)}
DIGITS = set(string.digits)

# literal English/number strings actually drawn with the Latin display faces
# (see FONT.arcade / FONT.pixel usage in game.js)
ARCADE_WORDS = 'BUBBLE VERSUS VS ROUND NEXT'
PIXEL_WORDS = '0123456789'


def scan_used_chars():
    chars = set()
    for name in ('game.js', 'index.html'):
        chars |= set((ROOT / name).read_text(encoding='utf-8'))
    return chars


def assert_covers(font_path, required, label):
    f = TTFont(str(font_path), lazy=True)
    cmap = f.getBestCmap()
    missing = sorted({c for c in required if ord(c) not in cmap})
    if missing:
        print(f'[subset_fonts] MISSING {len(missing)} chars in {label} ({font_path.name}): {"".join(missing)}')
    assert not missing, f'{label} ({font_path.name}) is missing {len(missing)} required characters'
    return cmap


def do_subset(src_path, out_path, keep_chars):
    font = TTFont(str(src_path))
    unicodes = sorted(ord(c) for c in keep_chars)
    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.desubroutinize = False
    options.notdef_outline = True
    options.glyph_names = False
    options.legacy_cmap = False
    options.symbol_cmap = False
    options.recalc_bounds = True
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(out_path))
    size_kb = out_path.stat().st_size / 1024
    print(f'[subset_fonts] wrote {out_path.relative_to(ROOT)} ({len(unicodes)} chars, {size_kb:.1f} KB)')


def write_press_start_license():
    # Press Start 2P ships under SIL OFL 1.1 too, but no standalone OFL.txt was
    # bundled with the download -- the license text is embedded in the font's
    # own name table (nameID 0 copyright, nameID 13 license text). Reconstruct
    # the standard OFL.txt from that plus the boilerplate body shared by the
    # other two OFL fonts already vendored here (verified byte-identical below
    # the copyright preamble against OFL_Bungee.txt / OFL_GenSenRounded.txt).
    f = TTFont(str(SRC / 'PressStart2P-Regular.ttf'), lazy=True)
    name = f['name']
    copyright_line = name.getDebugName(0)
    license_url = name.getDebugName(14) or 'http://scripts.sil.org/OFL'
    bungee_text = (SRC / 'OFL_Bungee.txt').read_text(encoding='utf-8')
    body = bungee_text.split('\n\n', 2)[-1]  # drop the Bungee-specific preamble lines
    header = (
        f'{copyright_line}\n\n'
        'This Font Software is licensed under the SIL Open Font License, Version 1.1.\n'
        f'This license is copied below, and is also available with a FAQ at:\n{license_url}\n\n'
    )
    out = OUT / 'OFL_PressStart2P.txt'
    out.write_text(header + body, encoding='utf-8')
    print(f'[subset_fonts] wrote {out.relative_to(ROOT)}')


def main():
    used = scan_used_chars() | ASCII_PRINTABLE | DIGITS

    assert_covers(SRC / 'GenSenRounded2TW-H.otf', used, 'GenSen Heavy TW')
    do_subset(SRC / 'GenSenRounded2TW-H.otf', OUT / 'GenSenHeavyTW.woff2', used)

    assert_covers(SRC / 'GenSenRounded2TW-B.otf', used, 'GenSen Bold TW')
    do_subset(SRC / 'GenSenRounded2TW-B.otf', OUT / 'GenSenBoldTW.woff2', used)

    latin_safe = used & (ASCII_PRINTABLE | DIGITS)
    assert_covers(SRC / 'Bungee-Regular.ttf', set(ARCADE_WORDS), 'Bungee')
    do_subset(SRC / 'Bungee-Regular.ttf', OUT / 'Bungee.woff2', latin_safe)

    assert_covers(SRC / 'PressStart2P-Regular.ttf', set(PIXEL_WORDS), 'Press Start 2P')
    do_subset(SRC / 'PressStart2P-Regular.ttf', OUT / 'PressStart2P.woff2', latin_safe)

    for lic in ('OFL_Bungee.txt', 'OFL_GenSenRounded.txt'):
        (OUT / lic).write_text((SRC / lic).read_text(encoding='utf-8'), encoding='utf-8')
        print(f'[subset_fonts] wrote {(OUT / lic).relative_to(ROOT)}')
    write_press_start_license()

    print('[subset_fonts] done, no missing glyphs.')


if __name__ == '__main__':
    sys.exit(main())
