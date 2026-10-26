# Art pipeline

The game is fully playable with **zero image files** — every visual element has a
hand-coded canvas fallback (gradients, vector shapes, procedural bubbles). Dropping
PNGs into `art/gpt/` upgrades those elements automatically; nothing missing will
ever break the game or show a broken-image icon.

## How it works

`game.js` declares a fixed list of `(key, path)` pairs near the top of the file and
loads each as an `Image()`:

```js
loadArt('bubble_0', 'art/gpt/bubble_0.png');
```

Every draw call that can use art checks `artReady(key)` first (true only once the
image has actually finished loading *and* has real pixels) and falls back to the
original procedural drawing if it's not ready — including the normal "file not
found" case when you haven't added any art yet. This works over `file://` in
Chrome/Chromium with no server and no build step, which is required for
`tools/shots.js` / `tools/balance.js` to keep working.

## Generating images

1. Open `art/gpt_prompts.tsv`. Each row is `filename  size  prompt`.
2. Feed the `prompt` column to ChatGPT image generation (or any image model).
   Generate at whatever resolution the tool gives you — the exact source
   resolution doesn't matter, the game always draws into a fixed-size
   destination rectangle, so the image will be scaled to fit.
3. Export/crop to a transparent PNG (required for bubbles, emblems, characters,
   portraits, and the launcher — anything that isn't a full rectangular panel)
   and save it at the exact `filename` path from the TSV, e.g.
   `art/gpt/bubble_0.png`.
4. Reload `index.html` — no build step, no restart needed. Missing files keep
   using the procedural fallback; present files are used immediately.

## Notes

- **Character art is illustrated, not photorealistic.** Caricature likeness is
  allowed (that's the point), but it must stay cartoon/chibi — N64 Puzzle
  Bobble mascot style (chunky proportions, bold outlines, flat toy shading),
  never semi-realistic or photo-like. Keep traits to light hints (hairstyle,
  glasses) plus faction color and the name plate the game draws near them;
  don't chase a photo-accurate face.
- **Bubble colors must match `COLORS` in `game.js`:** index 0=green, 1=blue,
  2=red, 3=yellow, 4=purple, 5=orange. Keep a consistent glossy/glass look
  across all six so the board doesn't look mismatched mid-game.
- **Sizes in the TSV are destination sizes**, i.e. exactly what the code draws
  (`FW`/`FH`/bubble diameter/etc. from `game.js`), not necessarily the
  resolution you should generate at.
- You do not need to provide every file — the pipeline is designed so you can
  add art incrementally (e.g. just the 6 bubble sprites first) and everything
  else keeps using its fallback.
