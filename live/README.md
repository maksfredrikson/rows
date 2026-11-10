# The room weaves (live)

**Live since 10 Nov 2026:** https://maksfredrikson.github.io/rows/live/ on phones,
https://maksfredrikson.github.io/rows/live/display.html on the projector (GitHub Pages, public repository
`maksfredrikson/rows`; the band is still Netlify's function, which the pages call across sites). Publish
with `../publish.sh "what changed"`. The Netlify copy of the pages is frozen while its credits are out. Form only: no line, block or figure is given a meaning.

## One symbol each, built line by line (night of 10 Nov 2026)

A person builds **one symbol** on the flag's grid, 23 cells across and up to 61 lines down, one line at a
time, with the dictionary suggesting; the wall shows the room's symbols as a grid forming as they post.

- **`index.html`, `draw.js` (phones).** Plain canvas, no libraries. Top: the symbol so far, small, with
  the next line's place marked. Under it the raised module with the line being drawn and a chevron at each
  end; the option's source; then **Accept** (primary) and **Post** (secondary). Drag along the line to ink
  cells (a drag that starts on an inked cell erases). **Accept** takes the shown option as the symbol's
  next line. **Post** sends the whole symbol; at 61 lines it posts itself. Tap the symbol to take the last
  line back. The symbol in progress survives a reload.
- **Suggestions, one at a time.** From the printer's dictionary (the 120 ends, `pool.txt`) cut into its
  lines. Nothing drawn: the lines that follow your last line (for the first line, the lines the ends
  begin with). Cells drawn: the lines that contain them, fewest added cells first; else the nearest by
  cells. The chevrons swap the option; the last in the cycle is the line exactly as drawn.
- **`display.html`, `wall.js` (the wall).** Two columns. Left: every symbol as a tile, the grid re-fitting
  itself so all stay on screen (forty fit); a new symbol forms row by row behind a red line, with the
  maker's four-letter mark under it. Right: the count, Sound, and the join code (QR, enlarges on a click)
  with the address. With Sound on, each forming row is strummed on a synthesised цымбалы.
- **How a symbol travels.** The store takes pieces of at most nine rows, so a symbol is posted as up to
  seven pieces, each tagged `s:<symbol id>:<piece>:<which pieces exist>` in its `exact` field. The wall
  shows a symbol once all its pieces are in, or after 12 s with what came. Posts from before the symbol
  version (`SINCE` in `wall.js`) are never fetched.
- `sketch.js` and `display.js` are only redirects that force a fresh load for phones holding an older
  page; bump `?v=` in the script tags whenever `draw.js` or `wall.js` changes.
- Kept aside: `free/` (draw the whole 23 by 61 freely, no suggestions) and `lines/` (blocks of nine
  lines onto a common band, with the playing record and four voices).

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
