# End typewriter

The simplified concept (2 Nov 2026): people write, the dictionary suggests, nothing else. The grid is the
ornament printer's own end, **23 × 9 cells**, and the only dictionary is the printer's, the **120 ends** cut
from the 1953 plates in `../../ornament-printer/pool.txt` (the sheet "Ornament printer: the dictionary").
No authored rules, no construction trees, no generation: every proposal is a whole end a weaver made,
found by lookup as `ornament.h` finds it.

- Type cells with `h j k l` and `y u b n` (ink and move), `space` (ink or unink in place), arrows.
- After every change the dictionary proposes the ends that **contain** what is typed, fewest added cells
  first, as crosses (cells the end would add) and dashes (cells it leaves blank inside its box). When no end
  contains the typed cells, the **nearest by cells** (Hamming, as the printer does) is proposed, and a typed
  cell the end lacks is shown as a hollow square; accepting adds the crosses and keeps the person's cells.
- `tab` accepts the lit end; `.` is the printer's next key (refuse, light the next); `esc` refuses all;
  `1–9` pick; `⌫` / `z` undo.
- `enter` finishes the end, typed or accepted or both, and starts the next; finished ends stack above like
  the paper coming out of the printer (lighter when the end is exactly one of the dictionary's, so the
  question "whose is it?" can be asked of the strip).
- `s` saves the log: every accept, next, refuse, undo and finished end, with the dictionary index.

Run from `ornament-rows` in a terminal tab (the page reads `ends_data.js`, from `tools/export_ends.py`;
rerun it after `pool.txt` changes):

```bash
python3 -m http.server 4365 --bind 127.0.0.1 --directory "$(pwd)"
```

then open http://127.0.0.1:4365/ends/. p5 loads from cdnjs; copy `p5.min.js` beside the page for the
hotspot. The earlier, fuller experiment with symbols, rules and construction trees is kept in `../keyboard/`.
