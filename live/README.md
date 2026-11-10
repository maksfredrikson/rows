# The room weaves (live)

**Live since 10 Nov 2026:** https://maksfredrikson.github.io/rows/live/ on phones,
https://maksfredrikson.github.io/rows/live/display.html on the projector (GitHub Pages, public repository
`maksfredrikson/rows`; the band is still Netlify's function, which the pages call across sites). Publish
with `../publish.sh "what changed"`. The Netlify copy of the pages is frozen while its credits are out. Form only: no line, block or figure is given a meaning.

## The simplest form, since the night of 10 Nov 2026

**One symbol each.** A person draws one symbol on the flag's own grid, 23 cells across and 61 down,
and posts it. The wall shows the room's symbols as a grid that forms as people submit. No dictionary, no
suggestions, no lines or blocks: the form is the person's.

- **`index.html`, `sketch.js` (phones).** Plain canvas, no libraries. Drag to draw; a drag that starts on
  an inked cell erases; fast strokes are joined. **Mirror** (on by default) draws on both sides of the
  middle column and is only a drawing aid. **Clear**, **Post**. The draft survives a reload. After
  posting: "Draw another".
- **`display.html`, `display.js` (the wall).** Two columns. Left: every symbol as a tile, the grid
  re-fitting itself so all stay on screen (forty fit); a new symbol forms row by row behind a red line,
  with the maker's four-letter mark under it. Right: the count, Sound, and the join code (QR, enlarges on
  a click) with the address. With Sound on, each forming row is strummed on a synthesised цымбалы.
- **How a symbol travels.** The store takes pieces of at most nine rows, so a symbol is posted as up to
  seven pieces, each tagged `s:<symbol id>:<piece>:<which pieces exist>` in its `exact` field; blank
  pieces are not sent. The wall shows a symbol once all its pieces are in, or after 12 s with what came.
  Posts from before the symbol version (`SINCE` in `display.js`) are never fetched.
- The line-by-line version (blocks, Accept, Post, the playing record with four voices) is kept at
  `lines/`.

## The store (`netlify/functions/ends.mjs`)

Every contribution is its own blob in Netlify Blobs (store `ornament-rows`, key `e/<time>-<rand>`,
strong consistency), so simultaneous posts cannot overwrite each other: 20 posts fired at the same
instant on 10 Nov all arrived. `GET ?since=<t>` lists the keys and fetches only the newer ones (last 300).
`POST {rows, ex, exact, by}` takes 1 to 9 rows of 23 cells; `ex` marks which rows are exactly a
dictionary line. `DELETE ?key=…` clears the band, `DELETE ?key=…&by=MARK` removes one maker's
contributions (for test posts). The key is the `ADMIN_KEY` environment variable of the Netlify project;
its value is in `.admin_key.local` beside `.gitignore`, kept out of the repository:

    curl -X DELETE "https://ornament-rows.netlify.app/.netlify/functions/ends?key=$(cat .admin_key.local)"

## Running it from the laptop, no cloud (`../relay.py`)

    cd ~/Git/ornament-rows && python3 relay.py

Standard library only. It serves these pages and answers the same API path as the Netlify function, so
nothing in the pages changes; the band is `runs/band.jsonl`, one contribution per line, appended under a
lock (20 simultaneous posts verified). It prints the address phones on the same Wi-Fi or hotspot open,
and the display shows that address. `curl -X DELETE http://127.0.0.1:4380/.netlify/functions/ends`
clears the band, from the laptop only. Run it from `~/Git/ornament-rows`, not from iCloud.

**Netlify, 10 Nov 2026:** production deploys are paused because the team's credits for the billing cycle
are used up; the hosted site keeps serving the version of 19:32 that day (commit 7859f0e) until credits
return. Each production deploy costs credits: batch changes and test through `relay.py` first.

The nine-row typewriter without a band stays at `../ends/`. 
