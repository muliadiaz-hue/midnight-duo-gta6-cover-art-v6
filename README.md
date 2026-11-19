# Midnight Duo — GTA 6-style cover maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/muliadiaz-hue/midnight-duo-gta6-cover-art-v6/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/muliadiaz-hue/midnight-duo-gta6-cover-art-v6/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A web app that turns your photos into GTA 6-style cover art: a big hero
photo beside (or above) a 2×2 grid of scene photos, with a one-line
gradient title, a city line, a tagline and a corner sash — exported as a
PNG to share. Fully offline: every script, font and sample photo is a
file under `app/`, and your photos are read on your own machine, never
uploaded.

Built for the make.fun bounty: https://make.fun/bounty/gta6-cover-art-01

## What it does

- **Band layout** — hero photo (the duo) large on the left for wide
  covers, on top for square / portrait / story, plus a 2×2 grid of scene
  photos (car, helicopter, DJ, boat), each a different photo.
- **Any photo** — click a panel to select it, upload your own photo for
  it, drag to pan, scroll to zoom.
- **Editable words** — title (one line, Passion One, sunset gradient
  with an ink outline), city (Anton, flanked by drawn stars), tagline
  and the magenta "ONE NIGHT ONLY" sash, which you can hide.
- **Three grades** — Photographic (photos untouched, the default),
  Sunset (warm Vice City glow) and Neon (saturated night magenta).
- **Four export sizes** — Wide 1920×1080, Square 1080×1080, Portrait
  1080×1350, Story 1080×1920, all as PNG, plus undo/redo for every
  caption and framing change.

## Run it

```sh
node serve.ts          # serves app/ on http://localhost:8080
```

Open the page, pick a size and a grade, edit the caption, drag any
panel to reframe its photo, then **Export PNG**.

## Hand it in (make.fun)

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` into the output directory
and writes `dossier.json` with the vendored make.fun library
(`vendor/makefun-app.ts`, unchanged from the kit). Run it twice into
two folders and `diff -r` them: the output is byte-identical.

## Screenshots

`screenshots/1-cover.jpg` is the wide cover, `2-editor.jpg` the editor
with a photo loaded, `3-cover-portrait.jpg` the portrait cover and
`4-cover-story.jpg` the story cover.

## Fonts

Passion One and Anton, both under the SIL Open Font License
(`app/fonts/OFL.txt`). No Rockstar logo, artwork or font is used
anywhere in this app.
