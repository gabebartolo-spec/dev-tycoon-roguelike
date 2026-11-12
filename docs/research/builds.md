# Research: builds and the boss ladder

Regular web research (not a deep-research run), 2026-11-13. Question:

> What do four real ways of making games look like, as material for roguelike builds: **Vibecoding** (AI-written
> code), **Solo dev**, **Shovelware / asset flips**, and the **eccentric overpromiser** (hype and innovation, in the
> style of Peter Molyneux)? What does each gain, what does it cost, and how does it end? Also: how do Hades and Slay
> the Spire structure bosses and an optional superboss, and what do "indie", "AA", "AAA" and "AAAA" mean?

## Summary

Each build pays with a different meter that the sim already has. **Vibecoding** is fast and cheap but leaves bugs
and duplicated code that later work inherits (tech debt), and players and stores push back on disclosed AI use.
**Solo dev** is near-free to run but costs years and health; a few solo games became huge hits with almost no
marketing, while the median Steam game earns about a thousand dollars. **Shovelware** makes money from volume, store
rules and cheap assets, until stores purge it, the genre floods and reputation sinks. **The overpromiser** raises money
and attention with promises, then pays when the game ships short: apologies, refunds, or a long redemption. For
structure, Hades ends each biome in a boss and adds harder boss variants as opt-in heat; Slay the Spire hides an
optional fourth act behind three keys collected at a cost. "AAAA" was coined by Ubisoft's CEO for Skull and Bones,
and the term is mostly used ironically.

## Verified findings

### Vibecoding: speed and access now, bugs and debt later
- Confidence: high for the events and studies; medium for causal claims about debt.
- Evidence: Andrej Karpathy named "vibe coding" on 2 Feb 2025 (accept AI code without reading it; he called it fine
  for throwaway weekend projects); Collins made it its 2025 Word of the Year. Pieter Levels built a browser flight sim
  with Cursor and Three.js in about three hours (22 Feb 2025) and reported ~$87k monthly revenue 17 days later from
  in-game ads and paid planes, helped by a large existing audience. Vibe Jam 2025 had 1,000+ entries and required most
  code to be AI-written. METR's 2025 trial: 16 experienced developers were 19% slower with AI tools while believing
  they were about 20% faster. Veracode 2025: AI-written code had security flaws in 45% of 80 tasks across 100+ models.
  GitClear (211M changed lines, 2020–2024): duplicated blocks rose about eightfold in 2024 and refactoring fell from 25%
  to under 10% of changes. In July 2025 a Replit agent deleted a production database during a code freeze in a
  12-day vibe-coding trial, invented ~4,000 fake users and claimed rollback was impossible. About 20% of 2025 Steam
  releases (7,818 games) disclose generative AI; one estimate says they get ~53% fewer reviews.
- Sources: https://developertoolkit.ai/en/glossary/vibe-coding/, https://levels.io/full-multiplayer-python-websockets-game-ai,
  https://404media.co/this-game-created-by-ai-vibe-coding-makes-50-000-a-month-yours-probably-wont,
  https://vibej.am/2025, https://www.theregister.com/2025/07/11/ai_code_tools_slow_down/,
  https://www.veracode.com/press-release/ai-generated-code-poses-major-security-risks-in-nearly-half-of-all-development-tasks-veracode-research-reveals/,
  https://www.devclass.com/ai-ml/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/1626250,
  https://www.eweek.com/news/replit-ai-coding-assistant-failure/, https://incidentdatabase.ai/cite/1152/,
  https://www.tomshardware.com/video-games/pc-gaming/1-in-5-steam-games-released-in-2025-use-generative-ai-up-nearly-700-percent-year-on-year-7-818-titles-disclose-genai-asset-usage-7-percent-of-entire-steam-library,
  https://www.digitalcitizen.life/steam-games-that-disclose-ai-use-may-sell-far-less-new-study-finds/

### Solo dev: almost no running cost, paid for in years and burnout
- Confidence: high.
- Evidence: Eric Barone made Stardew Valley alone over ~4.5 years of ~70-hour weeks and described burnout. LocalThunk
  started Balatro as a hobby in 2021, expected about ten sales, sold 1M in under a month and 5M by January 2025 with
  almost no marketing. Animal Well took ~7 years solo, with marketing help after year four. Schedule I (one developer)
  peaked at 459K concurrent players in Early Access in March 2025, a record for a solo dev. Vampire Survivors began on a
  bought asset pack, with about £1,100 spent on assets and launched at $3. The typical result is very different: the
  median Steam game's lifetime revenue was about $1,136 (2019 releases), and about 4% pass $1M.
- Sources: https://gamedeveloper.com/business/the-4-years-of-self-imposed-crunch-that-went-into-i-stardew-valley-i-,
  https://gamesradar.com/games/roguelike/solo-dev-behind-roguelike-hit-balatro-expected-to-sell-maybe-10-copies-and-go-back-to-their-it-job-but-they-went-on-to-sell-one-million-copies-instead,
  https://www.gamesradar.com/games/platformer/after-his-excellent-debut-metroidvania-took-7-years-animal-wells-solo-dev-says-his-next-game-shouldnt-take-nearly-as-long,
  https://www.tweaktown.com/news/104474/schedule-i-hits-459k-peak-players-the-most-by-a-solo-developer-in-steam-history/index.html,
  https://www.pcgamer.com/vampire-survivors-didnt-rip-off-castlevania-sprites-after-all,
  https://gameworldobserver.com/2022/11/29/median-indie-game-earnings-steam-barely-over-1000

### Shovelware and asset flips: volume pays until the store or the genre pushes back
- Confidence: high.
- Evidence: Jim Sterling popularised "asset flip" around 2015. Valve removed Digital Homicide's games in September
  2016 after it sued Steam users, and removed 173 trading-card farming "fake games" on 26 September 2017. Data Design
  Interactive reskinned one engine into many Wii titles. The 1983 US crash, blamed partly on a flood of low-quality
  cartridges, led Nintendo to a lockout chip, the Seal of Quality and limits on titles per publisher. Sony banned
  "easy Platinum" spam on the PlayStation Store in 2024 and delisted games; Nintendo changed eShop charts amid clone and
  AI-art "eslop". Steam had 19,112 releases in 2025 and about 49% have fewer than 10 reviews. Voodoo tested almost 60
  hypercasual games in 2017 (12 passed 5M downloads): prototype fast, kill most, clone what works.
- Sources: https://en.wikipedia.org/wiki/Asset_flip, https://www.pcgamer.com/valve-removes-digital-homicides-games-from-steam,
  https://www.pcgamer.com/173-probable-trading-card-farming-games-have-been-removed-from-steam,
  https://giantbomb.com/wiki/Companies/Data_Design_Interactive,
  https://interestingengineering.com/culture/how-nintendos-10nes-chip-saved-console-gaming-from-itself,
  https://www.thegamer.com/sony-remove-shovelware-easy-platinums-playstation-store/,
  https://www.videogameschronicle.com/news/nintendo-has-changed-its-eshop-charts-in-an-apparent-move-to-hide-shovelware,
  https://www.pcgamer.com/gaming-industry/more-than-19-000-games-launched-on-steam-this-year-but-almost-half-have-fewer-than-10-reviews,
  https://naavik.co/deep-dives/hypercasual-past-present-future/

### The overpromiser: hype and money up front, the bill at release
- Confidence: high for events; figures as reported.
- Evidence: Molyneux promised Fable features such as an acorn that would grow into a tree, then apologised publicly
  in 2004 for talking about ideas that did not ship. Curiosity's cube promised its winner would become "god" of Godus;
  the Godus Kickstarter raised about half a million pounds; a February 2015 Rock Paper Shotgun interview opened by
  asking whether he was a pathological liar, and he withdrew from the press. Legacy's land-NFT sales were reported at
  ~$54M before release (he says the figure is exaggerated); the game went offline and the money funds his next game.
  A parody account's fake ideas inspired Molyjam 2012, where ~1,000 people made 260+ games in 48 hours. Counter-cases:
  No Man's Sky shipped short of its promises and earned a long redemption through free updates; The Day Before's studio
  closed four days after launch and refunds followed; Cyberpunk 2077 had 8M pre-orders and was pulled from the
  PlayStation Store with full refunds in December 2020; Star Citizen has crowdfunded since 2012, passed $1B in May
  2026 and is still in alpha.
- Sources: https://kotaku.com/the-man-who-promised-too-much-1537352493,
  https://www.gamespot.com/articles/molyneux-says-talking-to-press-about-early-ideas-i/1100-6426887/,
  https://www.pcgamer.com/curiosity-unboxed-winner-to-become-the-god-of-godus,
  https://www.trustedreviews.com/news/peter-molyneux-reflects-on-one-of-the-most-bruising-moments-of-my-life,
  https://www.timeextension.com/news/2025/10/the-whole-notion-of-crypto-gaming-was-flawed-peter-molyneux-denounces-the-game-that-raised-usd54-million,
  https://www.mcvuk.com/development-news/molyjam-produces-over-260-games,
  https://www.greenmangaming.com/blog/no-mans-sky-at-10-hello-games-redemption-story/,
  https://gamesradar.com/the-day-before-publisher-offers-refunds-for-everyone-regardless-of-playtime,
  https://www.npr.org/2020/12/18/947954910/after-a-swarm-of-bugs-sony-pulls-cyberpunk-2077-from-the-playstation-store,
  https://gamingbolt.com/star-citizen-has-crossed-1-billion-in-crowdfunding

### Boss ladders: a boss per act, then an optional, harder finale
- Confidence: high.
- Evidence: Hades has four regions, each ending in a boss (the first drawn from three Furies). The Extreme Measures
  pact condition gives bosses harder variants, up to rank 4 for the final boss. Slay the Spire's optional Act 4 (the
  Corrupt Heart) opens only if the player collects three keys in Acts 1–3, each taken at a cost (skipping a rest, a
  relic or fighting a burning elite).
- Sources: https://hades.fandom.com/wiki/Chambers_and_Encounters,
  https://primagames.com/gaming/hades-guide-pact-of-punishment-modifiers-heat,
  https://shacknews.com/article/109494/how-to-unlock-act-4-in-slay-the-spire

### Indie, AA, AAA, "AAAA": loose budget tiers, and one ironic superlative
- Confidence: medium for the tiers (industry blogs, no standard); high for AAAA's origin.
- Evidence: rough tiers: indie under ~$1M and 1–10 people; AA ~$2–20M and 20–100; AAA ~$50–300M+ and 200+. Ubisoft's
  CEO called Skull and Bones "AAAA" in February 2024; it began in 2013 as an Assassin's Creed expansion, was rebooted
  repeatedly and shipped on 16 February 2024 (reported budgets $120–200M). Sony's Concord launched on 23 August 2024
  after about eight years of development, went offline on 6 September with full refunds, having sold about 25,000
  copies. "AAAA" became shorthand for huge budgets that do not guarantee a good game.
- Sources: https://www.cubix.co/blog/indie-vs-aa-vs-aaa-games-the-complete-breakdown/,
  https://pcgamer.com/ubisoft-ceo-defends-skull-and-bones-dollar60-price-tag-says-its-a-quadruple-a-game,
  https://kotaku.com/first-it-was-an-assassins-creed-expansion-now-its-ubis-1847326742,
  https://videogameschronicle.com/news/sony-is-taking-concord-offline-ceasing-sales-and-offering-refunds

## Caveats
- Success stories are survivors: Levels had an audience, Balatro and Schedule I are outliers, and the median is the
  realistic outcome. A build should make the median the default and the outlier the jackpot.
- METR is one small study (16 developers); GitClear shows correlation, not cause. The 53% fewer reviews figure for
  AI-disclosed games is an estimate.

## Open questions
- Which tier names the bosses should use in game (real terms, or parody names).
- Whether the superboss is opt-in (keys, like Slay the Spire) or the last fight of every run.

## Refuted claims
- "Legacy raised £40M": not found; reports say ~$42–70M, most often $54M, and Molyneux disputes it.
- "Cyberpunk sold 13M before the refunds": not confirmed; 8M pre-orders is.
- Concord's budget: no official figure (the widely quoted $400M is unconfirmed).
