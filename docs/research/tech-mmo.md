# Research: the Tech build and the MMO developer build

Regular web research (not a deep-research run), 2026-11-13. Question:

> What do two more real ways of running a studio look like, as material for roguelike builds: the **Tech build**
> (chasing cutting-edge graphics, VR, AR and special controllers) and the **MMO developer** (live-service online
> worlds)? What does each gain, what does it cost, and how does it end?

## Summary

Each build pays with a different meter. **Tech** buys hype and platform-holder money by betting on new hardware or
rendering, then pays in hardware demands, a small install base and the risk that the platform dies under it: the
plastic-instrument market went from about $1.6B to under $0.9B in one year, Kinect sold 8M in 60 days and was
discontinued seven years later, and Meta closed several of the VR studios it had bought. **MMO** pays up front in
years and a huge budget, earns a recurring subscription if the launch holds, and then fights decay with expansions;
failures are fast (New World lost most of a ~913K peak within months) and endings are formal (sunset dates, refunds),
while the one big comeback (Final Fantasy XIV) needed a full rebuild.

## Verified findings

### Tech: hype and partner money now, a small or dying platform later
- Confidence: high for events and official figures; medium for estimates (Steam survey models, app-store trackers).
- Evidence:
  - **Graphics showcase.** Crysis (Nov 2007) became the "can it run Crysis" benchmark; Crytek reported about 1M copies
    by February 2008, blamed piracy (claimed 15–20 pirated copies per sale; a critic measured nearer 1:5 in the US) and
    in April 2008 dropped PC exclusivity. Critics also blamed its hardware demands. Cyberpunk 2077's path-traced "RT
    Overdrive" mode was built with Nvidia and shipped as a free PC "technology preview" on 11 Apr 2023; Nvidia
    recommended an RTX 40-series card with DLSS 3, and benchmarks showed it humbling top GPUs. The base game launched
    in Dec 2020 so buggy on last-gen consoles that Sony pulled it from the PlayStation Store (see builds.md).
  - **VR.** Oculus raised ~$2.4M on Kickstarter (goal $250K, 2012); Facebook bought it for ~$2B in March 2014.
    Half-Life: Alyx (Mar 2020) coincided with the largest monthly jump in Steam VR headsets: share of Steam users with
    a headset rose from 1.29% to 1.91% (estimates ~2M to ~2.7M connected headsets, ~950K added in one month); the
    install base was still under 2% of Steam. Beat Saber (Beat Games, Czech, bought by Meta 2019) earned ~$97M in
    2021 alone and >$250M by Oct 2022; a court filing said its 2021 sales beat the next five Quest apps combined.
    Reality Labs has lost over $70B since 2020 (Q3 2025: $470M revenue, $4.43B operating loss). Meta closed Ready At
    Dawn (2024), Downpour and Unit 2 (2025), then Twisted Pixel, Sanzaru and Armature in Jan 2026 with ~1,000–1,500
    Reality Labs layoffs, shifting money to smart glasses. IDC: VR/MR headset shipments fell ~42% in 2025 while smart
    glasses grew.
  - **AR.** Pokémon GO (Niantic, Jul 2016): ~$1.1B gross and ~400M downloads in its first year (Sensor Tower);
    still ~$545M in 2024 (estimate); Scopely bought Niantic's games business for $3.5B in March 2025. The follow-ups
    failed on the same tech: Harry Potter: Wizards Unite (2019) earned ~$40M lifetime and was switched off on 31 Jan
    2022; Minecraft Earth (2019) was announced closed on 5 Jan 2021 and shut on 30 Jun 2021, with Mojang citing the
    pandemic (it was built on free movement and group play).
  - **Peripherals.** Plastic-instrument games peaked at about $1.6B (Guitar Hero + Rock Band, NPD, 2008; ~$2B for the
    whole music genre) and fell under $0.9B in 2009 (genre −46% in 2009, −34% in 2010). Guitar Hero III launched at
    1.5M first-week units, Guitar Hero 5 at ~500K, Warriors of Rock (2010) at 86K; analysts blamed saturation (20+
    SKUs) and cheap hardware. Activision shelved Guitar Hero in Feb 2011 as unprofitable; Viacom sold Harmonix (bought
    for $175M in 2006) in Dec 2010 without disclosing the price. The Wii (Wii Remote, 2006) sold ~101M with Wii Sports
    bundled (~83M copies); motion control pushed Microsoft and Sony to Kinect and Move, and critics describe a flood of
    third-party shovelware. Kinect (Xbox 360) sold 8M in its first 60 days (Guinness record, Nov 2010–Jan 2011); it
    was bundled with every Xbox One in 2013, unbundled in May 2014 to match the PS4's $399 price, and production ended
    in Oct 2017. The Wii U ($299/$349, Nov 2012) was sold below cost because of the GamePad and sold 13.56M lifetime,
    Nintendo's lowest home console. Nintendo Labo (cardboard Toy-Con, 2018): 1.39M units by June 2018, a fraction of
    expectations; the Vehicle Kit opened at ~12K in Japan against ~90K for the first kit.
- Sources: https://gamesradar.com/crytek-crysis-was-most-pirated-project-10,
  https://gamedeveloper.com/game-platforms/-i-crysis-i-developer-puts-piracy-ratio-at-1-20,
  https://www.engadget.com/2008/04/30/crytek-turns-back-on-pc-exclusivity-cites-piracy/,
  https://www.nvidia.com/en-au/geforce/news/cyberpunk-2077-ray-tracing-overdrive-update-launches-april-11/,
  https://www.pcworld.com/article/1782490/cyberpunk-2077-overdrive-mode-benchmarks-nvidia-rtx-path-tracing.html,
  https://qz.com/192147/oculus-is-the-first-billion-dollar-company-to-emerge-from-kickstarter,
  https://techcrunch.com/2014/03/26/a-brief-history-of-oculus/,
  https://uploadvr.com/steam-hardware-survey-2-million/, https://roadtovr.com/?p=169670,
  https://www.roadtovr.com/beat-saber-100m-revenue-2021/,
  https://mixed-news.com/en/beat-saber-generated-five-times-more-revenue-in-2021-than-the-next-five-biggest-apps-combined/,
  https://hitmarker.net/news/meta-closes-multiple-game-studios-including-twisted-pixel-and-sanzaru-games-1619065,
  https://techeconomy.ng/meta-reality-labs-layoffs-vr-game-studios-70bn-losses/,
  https://www.theregister.com/2026/01/02/apple_vision_pro_meta_quest_sales_drop/, https://www.idc.com/promo/arvr,
  https://www.pocketgamer.biz/one-year-on-how-pokemon-go-has-proved-its-more-than-just-a-fad,
  https://sensortower.com/blog/pokemon-go-revenue-year-three,
  https://www.pocketgamer.biz/scopely-acquires-pokmon-go-developer-niantics-games-business-in-35bn-deal,
  https://gameworldobserver.com/2021/11/03/niantic-shutting-down-harry-potter-wizards-unite-as-its-revenue-falls-short-compared-to-pokemon-go,
  https://www.engadget.com/minecraft-earth-shutdown-june-30-181516498.html,
  https://www.gamedeveloper.com/game-platforms/analysis-i-guitar-hero-rock-band-i-retail-sales-down-by-half,
  https://www.hollywoodreporter.com/news/what-killed-guitar-hero-99761,
  https://www.engadget.com/2009-07-22-guitar-hero-rock-band-sales-slide-reminiscent-of-ddr.html,
  https://www.bit-tech.net/news/gaming/2010/10/18/guitar-hero-sales-in-decline/1,
  https://gameinformer.com/b/news/archive/2010/11/11/viacom-planning-to-sell-off-rock-band-s-harmonix,
  https://en.wikipedia.org/wiki/Wii, https://www.mcvuk.com/kinect-sales-hit-8m-in-60-days/,
  https://finance.yahoo.com/news/downfall-kinect-why-microsoft-gave-183900710.html,
  https://windowscentral.com/microsoft-kills-kinect-ending-production-xbox-one,
  https://www.nintendolife.com/news/2012/10/nintendo_confirms_wii_u_will_be_sold_at_a_loss,
  https://www.nintendo.co.jp/ir/en/finance/hard_soft/index.html,
  https://variety.com/2018/gaming/news/nintendo-labo-sales-1202890923,
  https://3ds.nintendolife.com/news/2018/09/nintendo_labo_vehicle_kit_has_disappointing_launch_in_japan_switch_still_best-selling_console

### MMO developer: years and a fortune up front, a subscription if the launch holds, then the treadmill
- Confidence: high for events and official counts; medium for budgets (none is official).
- Evidence:
  - **Long development, huge budgets.** Star Wars: The Old Republic (BioWare/EA, Dec 2011): analysts estimated a
    $150–200M budget; >1M subscribers in the first days, a peak of ~1.7M, under 1M by 31 Jul 2012 when EA announced
    free-to-play (live Nov 2012, levels 1–50 free), citing the subscription as a barrier. Star Citizen: Kickstarter in
    2012 with a $500K goal; passed $1B on 24 May 2026 (~6.5M registered); Squadron 42 targets 2026 with no date and the
    full game is projected for 2027–28, about 15 years after funding began.
  - **Subscription and live ops.** World of Warcraft (2004): Wrath of the Lich King sold 2.8M on day one (Nov 2008,
    then the fastest-selling PC game; The Burning Crusade had done 2.4M in Jan 2007 at ~8M subs). Peak ~12M subscribers
    in Oct 2010; ~10M in Nov 2014 (Warlords of Draenor launch), 5.6M by Aug 2015, 5.5M in Q3 2015, after which
    Blizzard stopped reporting. EVE Online (CCP, 2003): one shard, passed 500K subscribers in Feb 2013 (from 450K in
    Dec 2012), concurrency record >65K in May 2013; Pearl Abyss bought CCP for $425M in Sept 2018, 15 years in.
  - **Launch failures.** Final Fantasy XIV 1.0 (Sept 2010) failed so badly that Square Enix waived fees indefinitely,
    replaced producer Hiromichi Tanaka with Naoki Yoshida in Dec 2010, and its president said it had greatly damaged
    the Final Fantasy brand; fixing it meant remaking the game. 1.0's servers were closed in Nov 2012 with the world
    ending in-story; A Realm Reborn launched 27 Aug 2013 (2M registered within months); the game passed 30M registered
    players (lifetime, includes free trials) in Jan 2024. New World (Amazon, 28 Sept 2021): peak ~913K concurrent on
    Steam with overloaded servers and long queues, ~399K a month later, under 150K by December; new content ended in
    late 2025, it was delisted, and servers close 31 Jan 2027 (about 5.3 years).
  - **Sunsets.** City of Heroes (2004, NCSoft): shut Nov 2012 despite a reportedly healthy player base; a fan server
    (Homecoming) got an official NCSoft licence in Jan 2024. Marvel Heroes (Gazillion, 2013): Disney ended the licence
    in Nov 2017; staff were laid off before Thanksgiving (reportedly without severance) and the game shut before the
    planned 31 Dec 2017, about 4.5 years after launch. WildStar (Carbine/NCSoft, June 2014): NCSoft closed Carbine on
    7 Sept 2018 (~50 jobs) and shut the game in late 2018, about 4.4 years in, with refunds back to 1 Jul 2018.
  - **Content treadmill and decay.** WoW's counts jump at each expansion and sink between them (10M at Warlords' launch
    to 5.6M nine months later). New World lost ~135K players a week in its second month. EVE's concurrency fell about
    20% from 2013 to 2015 (third-party estimate).
- Sources: https://www.gameinformer.com/b/news/archive/2012/07/31/old-republic-subs-drop-below-1-million.aspx?amp,
  https://gamedeveloper.com/business/after-less-than-a-year-i-the-old-republic-i-is-going-free-to-play,
  https://gamedeveloper.com/business/the-burning-of-i-star-wars-the-old-republic-i-,
  https://www.tomshardware.com/video-games/pc-gaming/star-citizen-reaches-usd1-billion-in-lifetime-funding-14-years-after-the-project-was-first-announced-game-still-in-early-access-with-no-release-window-including-squadron-42-campaign,
  https://simulationdaily.com/news/star-citizen-1-billion-dollars/,
  https://investor.activision.com/node/17931, https://www.engadget.com/2008-11-20-wrath-sells-2-8-million-in-the-first-24-hours.html,
  https://gameinformer.com/b/news/archive/2015/08/04/world-of-warcraft-subscriptions-plummet-to-5-6-million.aspx,
  https://www.pcgamer.com/this-is-the-last-world-of-warcraft-subscriber-report-you-will-ever-read,
  https://www.engadget.com/2013/02/28/eve-online-hits-500-000-subscribers-heads-into-second-decade/,
  https://massivelyop.com/2015/04/19/eve-evolved-how-many-subscriptions-does-eve-have/,
  https://gamedeveloper.com/business/pearl-abyss-acquires-i-eve-online-i-creator-ccp-games-for-425-million,
  https://www.siliconera.com/2010/12/10/final-fantasy-xiv-sees-major-staff-changes-free-trial-period-extended-again/,
  https://www.escapistmagazine.com/final-fantasy-xiv-free-trial-extended-indefinitely/,
  https://www.engadget.com/2011/09/27/square-enix-says-ffxiv-greatly-damaged-final-fantasy-brand/,
  https://www.gamedeveloper.com/business/understanding-the-successful-relaunch-of-i-final-fantasy-xiv-i-,
  https://gameinformer.com/b/news/archive/2014/03/19/a-realm-reborn-director-says-too-much-previous-success-and-focus-on-graphics-to-blame-for-troublesome-first-launch,
  https://techraptor.net/gaming/news/final-fantasy-xiv-passes-30-million-players-as-xbox-open-beta-gets-tentative-release,
  https://www.gamesradar.com/new-world-is-seemingly-losing-about-135000-players-a-week,
  https://www.pcgamer.com/games/mmo/new-world-will-join-the-graveyard-of-defunct-mmos-when-it-goes-offline-in-2027/,
  https://www.pcgamer.com/after-five-years-ncsoft-officially-grants-a-licence-to-popular-city-of-heroes-private-server-homecoming-your-accounts-and-characters-are-safe,
  https://gamedeveloper.com/game-platforms/disney-severs-ties-with-i-marvel-heroes-i-dev-gazillion-entertainment,
  https://www.avclub.com/marvel-heroes-shutting-down,
  https://www.pcgamer.com/wildstar-and-developer-carbine-studios-are-shutting-down/,
  https://gameinformer.com/2018/09/06/mmorpg-wildstar-shutting-down-developer-carbine-closed

## Mapping ideas (suggestions only; the director designs)

Tech build:
1. **Tech showcase as a hype multiplier with a hardware gate.** A "cutting-edge" toggle adds hype and review
   expectation but caps weekly sales by a hardware share (Crysis, RT Overdrive); bugs at launch scale with how far
   ahead of the market the tech is.
2. **Platform-holder deals.** A random event offers a hardware maker's money (rent or salaries covered for N weeks) in
   exchange for an exclusive on a new platform with a small install base (Meta's buys, Nvidia's Overdrive). The catch
   shows later: the platform's market share can stall or die.
3. **Platform lifecycle meter.** Each new platform (VR, AR, motion, plastic instruments) has a market-share curve:
   first-mover window with little competition, a rival-studio flood, saturation, then collapse (music games −46% in
   a year, Kinect 2010–2017). Shipping at the right point of the curve is the skill.
4. **Peripheral stock risk.** Peripheral games cost extra up front (hardware in the box) and leave unsold stock or
   debt if the genre crashes; sequels on a saturated peripheral get steeper weekly decay (GH3 1.5M, GH5 500K, WoR 86K).
5. **Platform shutdown event.** A rare event ends a platform (studio closures, Minecraft Earth's pandemic exit),
   zeroing ongoing sales of games tied to it.

MMO developer build:
1. **Long phases, no income until launch.** Development phases run far longer and burn rent and salaries; crowdfunding
   or a publisher can pay for the wait at the price of rising hype and expectation (Star Citizen, SWTOR).
2. **Subscription instead of a sales curve.** After launch, income is weekly subscribers × fee; subscribers decay each
   week, and each expansion is a phase that spikes them (WoW's 2.8M day-one Wrath, 10M → 5.6M after Warlords).
3. **Launch-day server load.** A launch check against code and server capacity: failure means queues, bugs and a
   big first-month drop (New World), or a 1.0-style disaster with a choice: patch, or a costly full relaunch with a
   new lead that can recover the game (FFXIV).
4. **Content treadmill burnout.** Keeping subscribers requires steady content; skipping it raises decay, doing it
   raises team burnout. A free-to-play switch event trades subscription income for a larger, cheaper player base
   (SWTOR 2012).
5. **Sunset.** Under a subscriber floor, or when a licence ends (Marvel Heroes), the game must sunset: refunds and a
   final-weeks phase; a rare later event lets fans revive it (City of Heroes Homecoming).

## Caveats
- Survivor bias again: Pokémon GO, Beat Saber, Wii Sports and WoW are the jackpots; Wizards Unite, Labo, WildStar
  and New World are closer to the typical result.
- Many numbers are estimates: Steam survey models, Sensor Tower revenue, SWTOR's budget, VR market figures from
  aggregators. Treat them as sizes, not exact values.
- FFXIV's 30M and Star Citizen's 6.5M are registered accounts (including free trials), not active players.
- Some tech failures had outside causes (Minecraft Earth and COVID; Marvel Heroes and a licence), so "the tech
  failed" is not always the reason.

## Refuted claims
- "Pokémon GO made $950M in its first year": not found; Sensor Tower says ~$1.1B in the first year, $832M in
  calendar 2016.
- "Quest 2 sold 20M": not confirmed; Meta never published Quest unit sales, only third-party estimates.
- "Half-Life: Alyx sold 2M": that figure is an estimate of Steam-connected headsets, not game sales; Valve did not
  publish sales.
- "Kinect sold 8M on Xbox One": the 8M in 60 days was the Xbox 360 Kinect (some reports say shipped, not sold).
- "Viacom sold Harmonix for $50": price was not disclosed in the reports found; unconfirmed.
- "FFXIV 1.0 subscription was waived until 2012": the waiver was announced as indefinite, with no end date given in
  2010–11 coverage.
