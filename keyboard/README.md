# Ornament keyboard

A typewriter for ornament, in p5.js, with autocomplete from the 1953 plates. One Mac keyboard at the
table, one band on the big display, 47 cells across like the printer's paper, 23 rows in view (one end).
Strokes are typed cell by cell; after every change the figure under the last stroke is read and
completions are proposed as **crosses** (cells to add) and **dashes** (cells the completion leaves blank).
Nothing is applied until Tab. Every proposal names its source. Form only: no figure is given a meaning.

| Source | What it is | Where it comes from |
|---|---|---|
| **BUILD** | the construction trees: the typed figure is exactly the state after step *i* of how the plates build a figure (an atom, or the figure after a copy step), so step *i + 1* is proposed, named as the tree names it ("fourfold mirror: 4 × bar of 3 → rhombus with centre r2 · step 2 of 4"); or the figure lies inside a step's state and the rest of that step is proposed ("finish …"). Matched under all 8 turns and mirrors. | `build_data.js` from `tools/export_build.py` (the grammar browser's `lexicon.json`, which carries the steps of `data/symbols/composition.json`): 118 figures, 319 steps |
| **WORD** | a whole figure of the plates that contains what is typed, cell for cell, under any of its 8 turns and mirrors; the fewest added cells first, then the most sheets | `spell_data.js` words, figures only (118 core whole figures; colour parts, blobs, bars and other pieces excluded, as in `spell_v2.html`) |
| **RULE** | orbit completion: mirror pair about the figure's own centre column, fourfold mirror; and, generalised from the commonest production rules so that a figure outside the dictionary is still built the plates' way: a mirror pair meeting at the last cell typed (across its column, 89 sheets; across its row, 78), a half turn about it (40); mirror pair beside it; repeat it one cell apart | authored rules from `data/symbols/DESIGN_SYSTEM.md` §10 and the production rules of §4.5, with their sheet counts on the proposal |
| **NEXT** | what the plates put to the right of this figure, at the recorded offset, turned with the figure | `spell_data.js` grammar (right neighbours), `turnPair` from `spell_v2.html` |
| **REPEAT** | the figure next to itself at the offset the plates record | the same, when the neighbour is the figure itself |

Order of the list: the next construction step (BUILD) first, then WORD, then finishing a step, then the rules, then the plates' neighbours. WORD completions are offered even when the figure is already a word (an atom is a word too), after the
plates' neighbours: T9 keeps proposing longer words.

## Keys

`h j k l` stroke left · down · up · right (ink the cell, move) · `y u b n` diagonals · `space` ink or unink,
stay · arrows move · `enter` new row · `⌫` `z` undo · `tab` accept the lit proposal · `1–9` pick ·
`, .` previous, next · `esc` refuse all · `s` save the log (accept / refuse / undo with sources, JSON) ·
`shift+c` clear.

## Run

```bash
python3 -m http.server 4365 --bind 127.0.0.1 --directory "$(dirname "$PWD")"
```

from this folder in a terminal tab, then open http://127.0.0.1:4365/keyboard/ (the page reads
`../spell_data.js`; regenerate it with `tools/export_spell.py` after a dictionary rebuild). p5 loads from
cdnjs: for the lecture room's hotspot, copy `p5.min.js` next to `index.html` and change the script tag.

## What carries over from the plates' geometry, and what does not yet

- Carries: sub-pattern completion over the figure's turns and mirrors (the T9 part); orbit completion by
  the two commonest symmetry groups, with their measured frequencies on the caps; the plates' right-hand
  neighbours and self-repeats at their recorded offsets, turned with the figure.
- Carries since 2 Nov: the construction trees themselves (BUILD), step by step in the order the plates
  build each figure; and the production rules generalised to any typed figure (mirror pair meeting at the
  last cell, half turn), so a figure outside the dictionary is still put together the plates' commonest way.
- Does not yet: closure (three sides of a rhombus → the fourth) and nesting (a centre in a closed
  outline) only arrive through WORD and BUILD matches, not as rules of their own; the trees are matched
  by their states, not by their parts, so a typed bar that is one of a figure's *four* bars is found only
  when it is the first the tree lays down; `attach` and `layer` operations (a dot or block added to a
  molecule) are in the data but not yet generalised; the frieze groups and periods of whole bands belong to the table keys,
  not to this typewriter; one keyboard, one band (the relay in the architecture could carry keystrokes
  from several).
