# Dev Tycoon Roguelike: Design

Status: draft v1 (2026-11-12). The director decides the vision; this file records it. Research behind each rule is in
`docs/research/` and cited as [T] (tycoon genre) and [R] (management roguelikes).

## 1. Pitch
Run an indie studio through a procedurally generated games market. Your bank account is your health; bankruptcy ends
the run. Each project is a worker-placement puzzle: draft developers with traits, place them in department slots,
and balance **Hype** (what sells) against **Bugs** (what kills reviews). Between runs, reputation unlocks new studio
options for the next attempt.

## 2. Pillars
1. **Studio survival.** Cash is HP, and it is checked at thresholds the player can see coming (Payroll Days), not only
   at zero. Like Balatro's blinds and Luck be a Landlord's rent [R].
2. **The market is the dungeon.** Every run draws a different market (trends, rivals, platform shifts, events).
   Knowledge carries between runs; a solved formula does not.
3. **Placement with readable synergies.** Every number the player is judged by can be previewed before committing and
   explained after. Opaque scoring is the genre's best-documented weakness [T].
4. **Losses you can attribute.** Players return when they feel they "could have done something different" [R].
   The post-mortem screen always names the causes.
5. **Meta adds options, not raw power** (D-1): every unlock is a tradeoff. Difficulty grows through an opt-in ladder [R].

## 3. Run structure
- A run is **3 Eras** (acts). Each Era is **4 Quarters**, and each Quarter is **12 weeks**.
- **Payroll Day** ends each Quarter: the studio must hold `cash >= quarter_threshold` or take a debt strike; 3 strikes
  means bankruptcy. Thresholds rise each Quarter (the visible difficulty ramp).
- **Era Showcase** (the boss) ends each Era: a trade show or platform launch with a demand target, a rival release and
  a modifier (e.g. "only handheld games count"). Missing it is survivable but expensive.
- Target run length: 45–75 min, about 25–40 placement decisions. **No verified genre data exists for this** [R]; set
  it by playtest (M3).
- Win: survive Era 3's Showcase. Score is studio valuation, and it feeds reputation.

## 4. Projects (the core loop)
1. **Pitch:** pick a genre + topic from 3 drawn options. Market trends show demand for each.
2. **Three phases**, Prototype → Production → Polish. Each phase is one **placement round**:
   - The board has department slots: Code, Design, Art, Audio and (unlockable) QA and Marketing.
   - **Hard cap:** 4 slots at the start, 6 max. Synergy needs scarcity (Balatro's 5 Jokers) [R].
   - Drag workers from the roster into slots. A live preview shows ΔHype, ΔBugs, ΔQuality, cost and burnout.
   - End phase: the Resolver applies effects, emits events, and time advances.
3. **Release:** review score, then sales over the following weeks (a decaying curve scaled by Hype and trend demand).

### Scoring (readable by design)
- `quality = Σ dept output × genre weight`. Genre weights are shown on the pitch card, not hidden like GDT's ratios [T].
- `review = f(quality / expectation) − bug penalty`. **Expectation** is the market's bar. It rises with your last
  hit, as GDT's self-relative scoring does [T], but here it is shown as a number on the HUD and becomes a deliberate
  ramp.
- The review screen lists its top 3 positive and top 3 negative contributors.

## 5. Workers
- Stats: `code, design, art, audio` (0–10), `salary`, `burnout` (0–100), and 1–3 traits.
- **Traits** are data (`EffectDef` lists); there is no per-trait code. Each one has a trigger (`always`, `slot:<dept>`,
  `adjacent:<tag>`, `phase:<name>`, `on_release`), a stat, an op (`add` then `mul`, in a fixed order) and a value.
  Examples: Spaghetti Coder (+3 code, +2 bugs), UI Wizard (Design slot: hype ×1.5), Perfectionist (bugs ×0.5,
  phase cost +1 week).
- **Burnout** works like Darkest Dungeon's stress [R]. Crunch and bad fits add it. At 100, roll **Breakdown** (~75%,
  e.g. quits, sabotages bugs, demands a raise) or **Breakthrough** (~25%, a temporary strong trait). The player
  manages and reacts; they do not fully control it.
- Hiring: between projects, draft 1 of 3 candidates (roguelike reward pick). Firing costs severance.

## 6. Market (the dungeon)
- Generated per seed: 6–10 genres with demand curves, 2–4 rival studios, a platform lifecycle per Era, and an event
  deck (engine licence hikes, viral trends, crunch scandals, investor offers).
- The market map shows the next Quarter's trends with fog: the player sees direction, not exact numbers.
- Guard against snowballing: any bonus for beating a threshold early is capped. CloverPit's uncapped early bonuses
  break its economy [R].

## 7. Meta-progression
- **Reputation**, earned per run from valuation and milestones, buys unlocks in the **Studio Hub**:
  - New traits and worker archetypes in the draft pool
  - New departments (QA, Marketing) and genres
  - Starting-studio choices, e.g. **Open-Source Engine**: no licence fee, but −10% tech quality and slower
    Prototype. A tradeoff rather than flat power (D-1).
- **Crunch Levels** (the Ascension equivalent): 15 levels, each adding one stacking constraint. Level N+1 unlocks when
  you win at N, and losing never removes progress [R].

## 8. Technical rules
- `src/sim` is pure TypeScript with no React, DOM or clock. `apply(state, cmd) -> [state, events]`. Seeded with a
  `pure-rand` stream, so a run is reproducible from `seed + commands`.
- Content and balance live in JSON validated by Zod; there are no magic numbers in the sim.
- The UI (React) and studio view (react-three-fiber) only read state and play events; they never decide outcomes.
- Saves: `meta.json` (versioned, with migrations) and the mid-run save (`seed + command log`).
- Telemetry (local, opt-in): pick rates, death causes, win rates per seed, which Mega Crit relied on for balance [R].
  Headless bot sweeps run in CI from M6.

## 9. Decisions (director, 2026-11-12)
- **D-1 Meta = options with tradeoffs.** Every permanent unlock adds a choice that costs something; no flat stat or
  cash boosts.
- **D-2 Bankruptcy = 3 debt strikes.** Each missed Payroll Day adds a strike; the third ends the run.
- **D-3 Time = one turn per phase.** No real-time clock; each placement phase resolves as one turn that advances a
  fixed number of weeks.
