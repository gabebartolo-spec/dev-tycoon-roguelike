# Dev Tycoon Roguelike

Roguelike studio-survival game: your bank account is your health, the shifting game market is the dungeon,
and you draft developers with traits into department slots to build hype and keep bugs down.

## Stack
React 18 + TypeScript (Vite), Zustand, Zod-validated JSON content, Vitest, react-three-fiber studio view (M5), Tauri for desktop (M6).

## Layout
- `src/sim/` - pure TypeScript simulation (no React). `apply(state, command) -> [state, events]`, seeded and replayable.
- `src/data/` - content JSON + Zod schemas. Balance lives here, not in code.
- `src/ui/`, `src/store/`, `src/studio3d/` - coming in M1+.

## Run
    npm install
    npm test
    npm run dev

## Docs
- [Design](docs/DESIGN.md) · [Roadmap](docs/ROADMAP.md) · [Research](docs/research/)

## Roadmap (summary)
| Phase | Goal |
|---|---|
| M1 | Placement MVP: 4 slots, drag and drop, hover preview of hype and bugs |
| M2 | Survival loop: weeks, payroll, releases and sales, bankruptcy, death report |
| M3 | Market dungeon: seeded trends, rivals, quarter events |
| M4 | Meta-progression: reputation, studio upgrades, versioned save |
| M5 | Content, juice and the 3D studio view |
| M6 | Balance sweeps, Tauri build, Steam |
