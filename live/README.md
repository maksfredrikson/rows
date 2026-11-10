# The room weaves (live)

**Live since 10 Nov 2026:** https://maksfredrikson.github.io/rows/live/ on phones,
https://maksfredrikson.github.io/rows/live/display.html on the projector (GitHub Pages, public repository
`maksfredrikson/rows`; the band is still Netlify's function, which the pages call across sites). Publish
with `../publish.sh "what changed"`. The Netlify copy of the pages is frozen while its credits are out. Form only: no line, block or figure is given a meaning.

## The contributor's page (`index.html`, `sketch.js`), as of 10 Nov 2026

- **One column.** The common band above, lines running across, newest at the bottom. Under it a raised
  module holding the person's block and, at its bottom, the line being drawn, cells scaled to fit, with a
  chevron at each end of the line. Below: the option's source, then **Accept** (primary) and **Post**
  (secondary) side by side.
- **A block of up to nine lines, built one line at a time.** Drag along the dark line to ink cells (a
  drag that starts on an inked cell erases). **Accept accepts the line** into the block. **Post posts
  the whole block** to the common band; at nine lines it posts itself. Tap a line of the block to take
  it back. Nine lines is the dictionary's own unit, the end, and the smallest that holds a figure, so
  twenty people's blocks stack without cutting each other up.
- **Options, one at a time.** From the printer's dictionary (the 120 ends, `pool.txt`) cut into its
  lines. Nothing drawn: the lines that follow the line before (the block's last, else the band's last)
  in the dictionary. Cells drawn: the lines that contain them, fewest added cells first; else the nearest
  by cells. The chevrons swap the option; the last in the cycle is the line exactly as drawn.
- On the band a person's own lines are brightest, dictionary-exact lines darkest.
- Keys on a laptop: `h` `l` ink and move, space, `,` `.` swap, enter accept, `p` post.

## The store (`netlify/functions/ends.mjs`)

Every contribution is its own blob in Netlify Blobs (store `ornament-rows`, key `e/<time>-<rand>`,
strong consistency), so simultaneous posts cannot overwrite each other: 20 posts fired at the same
instant on 10 Nov all arrived. `GET ?since=<t>` lists the keys and fetches only the newer ones (last 300).
`POST {rows, ex, exact, by}` takes 1 to 9 rows of 23 cells; `ex` marks which rows are exactly a
dictionary line. `DELETE ?key=…` clears the band, `DELETE ?key=…&by=MARK` removes one maker's
contributions (for test posts). The key is the `ADMIN_KEY` environment variable of the Netlify project;
its value is in `.admin_key.local` beside `.gitignore`, kept out of the repository:

    curl -X DELETE "https://ornament-rows.netlify.app/.netlify/functions/ends?key=$(cat .admin_key.local)"

## The playing record (`display.html`, `display.js`)

The common display after the Ornament Table Sequencer, in two columns: the composed ornament on the left,
every control on the right (play, sound, the four voices, tempo, swing, the legend, and the join address
as a QR code that enlarges on a click, with the address in text under it; qrcodejs from cdnjs).
The ornament is turned as on the phones: every line runs across, 23 cells wide, and the band moves upward
past a horizon in the middle, one line per eighth note, with tempo and swing; when the band has been
played through it comes round again. Soot = a line that is exactly the dictionary's, madder red = a line
someone made. Sound is four synthesised folk voices, approximations and not recordings, each with a toggle:
**цымбалы** (every inked cell: a struck pair of strings, strummed), **жалейка** (the highest cell of a
made line: a reed with a grace note and a late vibrato), **дуда** (a drone on tonic and fifth), **бубен**
(a thump on the beat, jingles off it); Dorian on D, low at the left like the dulcimer's courses, each cell
sounding from its own place between the speakers. Keys: space play, `m` sound, `,` `.` tempo, `[` `]`
swing. The browser needs one click on Sound first.

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
