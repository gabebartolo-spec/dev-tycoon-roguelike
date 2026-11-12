# Roadmap

Each milestone has a goal, its work items, and **exit criteria** that must be proven (tests, a playtest note or a
capture) before the next one starts. Every new rule ships with an on/off test fixture in `src/sim/*.test.ts`.

## M0: Scaffold (done 2026-11-12)
- [x] Vite + React 18 + TS, Zustand, Zod, pure-rand, Vitest, CI
- [x] Pure resolver (add→mul order), run reducer, bankruptcy, seed replay test
- [x] Research notes in `docs/research/`

## M1: Placement MVP (the "is it fun?" gate)
Goal: one project, three phases, a grey-box board. If placing 4 workers into 4 slots with previews isn't interesting
by itself, stop and redesign before building anything else.
- Sim
  - [ ] Phases (Prototype/Production/Polish) as commands; one placement round per phase
  - [ ] Trait triggers: `always`, `slot:`, `adjacent:`, `phase:`; schema + tests per trigger
  - [ ] `Resolver.preview(state, cmd)`: pure, on a cloned state
  - [ ] Quality, genre weights, review formula, bug penalty, contributor breakdown
- Content: 12 workers, 16 traits, 4 genres, 4 departments
- UI
  - [ ] `RunScreen`, `ProjectBoard`, `Slot`, `DraftTray`, `WorkerCard`, `TraitChip` tooltip
  - [ ] dnd-kit drag/drop and keyboard placement (accessibility from day 1)
  - [ ] Hover ghost deltas (ΔHype/ΔBugs/ΔQuality); a review screen with the top-3 ± contributors
  - [ ] Zustand store: `dispatch(cmd)` → sim → events → state; undo within a phase
- Exit: 5 testers each play 5 projects; at least 3 of 5 say the slot choices felt non-obvious. All triggers are
  covered by tests.

## M2: Survival loop (sim + UI done 2026-11-13; exit playtest pending)
Goal: a full run from first project to bankruptcy or win, playable in one sitting.
- [x] Turn per phase (D-3): each phase advances a data-defined number of weeks
- [x] Ledger with tagged lines (salary, rent, licences, sales); "weeks of runway" on the HUD
- [x] Sales curve after release (decay scaled by Hype × trend demand)
- [x] Quarters, Payroll Day thresholds, 3 debt strikes (D-2), bankruptcy on the third
- [x] Hiring draft (1 of 3) between projects; firing with severance
- [x] Burnout meter; Breakdown/Breakthrough roll at 100 (seeded)
- [x] Post-mortem screen: cash graph, top 3 causes of death, best project
- [x] Mid-run save: seed + command log, with a replay test
- Numbers live in `content.json` (`economy`, `sales`, `burnout`, trend `demand`). Win = survive to `winWeek` (104).
  Bot sweep, 60 seeds: greedy placer dies at median week 44 and wins 11/60; idle studio dies by week 36.
- Exit: a seeded full run is replayable bit-for-bit; median tester run is 45–75 min; testers can name why they lost.

## M3: Market dungeon
Goal: two seeds should feel like two different markets.
- [ ] Market generator: genres with demand curves, topic modifiers, a platform lifecycle per Era
- [ ] Rival studios: release schedule, steal demand, react to your hits
- [ ] Event deck (20 events) with choices; Zod schema; seeded draws
- [ ] Expectation bar (self-relative, shown on the HUD)
- [ ] Era structure (3 Eras × 4 Quarters) ending in a Rival Showdown (D-4): 6 rival companies, each with a review target, a preferred genre and a rule twist; win or lose by review score
- [ ] Fogged market map UI: next Quarter's trend directions
- [ ] Snowball caps on early-threshold bonuses, with a fixture test
- Exit: a bot sweep over 1,000 seeds shows win rates spread across seeds (no seed type >90% or <5%); testers rate
  "the market felt different" ≥4/5.

## M4: Meta-progression
Goal: run 5 plays differently from run 1 because of choices, not just bigger numbers.
- [ ] `meta.json` with a version field and migrations; corruption fallback
- [ ] Reputation formula from valuation + milestones
- [ ] Studio Hub screen: an unlock tree (traits, archetypes, departments, genres, starting studios)
- [ ] Starting-studio choice at run start (Open-Source Engine and others; every unlock is a tradeoff, D-1)
- [ ] Crunch Levels 1–15, each one stacking constraint, unlocked by winning
- Exit: tests show unlocks apply only at run start; a new player's first run is identical with an empty meta.

## M5: Content, juice and the studio view
- [ ] Content to 40 workers, 60 traits, 10 genres, 25 topics, 40 events, 6 rival companies
- [ ] Framer Motion: card lift, slot snap, floating deltas, review score reveal with readable steps
- [ ] `<StudioView>` (react-three-fiber): low-poly desks; placed workers sit, bug swarms grow, hype lighting; driven
  only by sim events; `frameloop="demand"`
- [ ] Audio: UI clicks, release sting, payroll tension cue
- [ ] Tutorial run (fixed seed, scripted events)
- Exit: 60 fps on a mid laptop with the studio view on; first-time testers finish the tutorial without help.

## M6: Balance and telemetry
- [ ] Headless bot players (greedy, random, heuristic) in a CI job: 10k seeds per balance PR
- [ ] Local opt-in telemetry: pick rates, death causes, wins per Crunch Level
- [ ] Balance dashboard (HTML report from the sweeps)
- [ ] Tuning pass: no trait picked <2% or >40% by the heuristic bot
- Exit: every Crunch Level has been won by a heuristic bot; win rate on level 0 sits between 30% and 50% for testers.

## M7: Desktop and polish
- [ ] Tauri build (Windows/macOS/Linux); filesystem saves; window and settings
- [ ] Settings: text size, colourblind palette, reduced motion, rebinding
- [ ] Localisation pipeline (strings in JSON)
- [ ] Crash and error reporting to a local log
- Exit: clean install on 3 OSes; save survives a version upgrade (migration test).

## M8: Early Access
- [ ] Steam page, trailer captured from the studio view, capsule art
- [ ] steamworks.js: achievements, cloud saves
- [ ] Feedback channel, public roadmap
- Exit: storefront live; 2 weeks of telemetry reviewed.

## M9: 1.0
- [ ] Content based on Early Access data; a daily seed challenge; an endless mode
- [ ] A final balance sweep; achievements complete

## Known risks
| Risk | Mitigation |
|---|---|
| The core placement isn't fun | M1 gate, before any other system |
| The run solves into one formula | Seeded markets, capped bonuses, bot sweeps (M3, M6) |
| Opaque scoring (the genre's main complaint) | Previews + contributor breakdown are M1 requirements, not polish |
| Meta power trivialises the game | D-1 (options with tradeoffs only); unlocks apply at run start only; Crunch Levels |
| The 3D view costs too much | It arrives in M5, driven by events, and can be turned off |

## M10 (stretch): PvP mode
Runs are deterministic (`seed + commands`), so PvP can start asynchronous and serverless before any netcode.
- [ ] **Seed duel (async):** both players get the same seed; each run's command log is shared as a code or file;
  the sim replays both and compares review scores per project. Cheating is checked by replaying, not trusted.
- [ ] **Ghost rival:** your friend's replayed run becomes the Rival Showdown boss (D-4) in your run.
- [ ] **Weekly seed leaderboard:** a hosted list of command logs, each verified by a headless replay.
- [ ] **Live head-to-head (later):** both studios in one shared market; phases resolve when both lock in, and one
  player's hit release drains demand from the other. Needs a small authoritative server running the same `src/sim`.
- Exit: two machines replay the same duel to identical scores; a tampered log is rejected.
