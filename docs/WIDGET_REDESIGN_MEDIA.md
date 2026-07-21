# Framerr — Media Widget Redesign
## Radarr · Sonarr · Calendar · Tautulli

> **Authoritative design spec.** Single source of truth for the redesign of all four media widgets.  
> Supersedes: `docs/private/widgets/WIDGET_REDESIGN_SPEC.md` (older, simpler draft)  
> Last updated: 2026-07-18

---

## 0. Design Principles

Three rules that govern every decision in this spec:

| # | Principle | What it means |
|---|---|---|
| 1 | **Cinematic** | Artwork leads, data follows. Fanart and posters are the primary visual element — not decoration. |
| 2 | **Now-first** | The most urgent or current thing occupies the visual center. Upcoming > historical stats. Attention items are visually loud. |
| 3 | **Progressive** | Summary at a glance, detail on demand. Nothing is buried, but nothing overwhelms the primary view. |

---

## 0.1 Shared Color Language

Five semantic colors. Used consistently across all four widgets. Users learn once, recognize everywhere.

| Color | Hex | Token | Meaning | Maps to |
|---|---|---|---|---|
| Amber | `#F59E0B` | `--cinema` | Theatrical release / In cinemas | `inCinemas` |
| Blue | `#3B82F6` | `--digital` | Digital / Streaming / VOD | `digitalRelease` |
| Purple | `#8B5CF6` | `--physical` | Physical / Disc / Blu-ray | `physicalRelease` |
| Teal | `#10B981` | `--tv` | Episode air date (Sonarr) | `airDate` / `airDateUtc` |
| Red | `#EF4444` | `--missing` | Wanted but not grabbed | — |

**Rule:** Color encodes release *type*, not status. A future digital date and a past digital date are both blue — the distinction is in the label/date text, not the color.

---

## 0.2 Shared Components

### `<ReleasePill>`

Shared across Radarr, Sonarr, and Calendar. Single source of truth for release type display.

```tsx
<ReleasePill type="cinema"   date="Jul 25" />   // amber
<ReleasePill type="digital"  date="Sep 12" />   // blue
<ReleasePill type="physical" date="TBA" dimmed /> // purple, 45% opacity
<ReleasePill type="tv"       date="Tonight" />  // teal
<ReleasePill type="missing"  />                 // red, no date
```

Props: `type: 'cinema' | 'digital' | 'physical' | 'tv' | 'missing'`, `date?: string`, `dimmed?: boolean`

TBA pills: shown dimmed (`opacity: 0.45`) when type is known but date is not yet announced. Gives the user awareness that a release type exists without implying a date.

### Progress bars

All progress bars across all widgets use the same gradient:
```css
background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
/* = linear-gradient(90deg, #3b82f6, #06b6d4) */
```
Height: 3px. Never a flat color.

### Cinematic gradient overlay (artwork)

Used on all hero/artwork areas:
```css
background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 55%, transparent 100%);
```

### Artwork fallback

When no image is available via the image proxy, placeholder uses a CSS gradient — never a blank box or broken image icon.
- Cinema/movie content: dark warm gradient (`#1a0c00 → #2a1800`)
- TV content: dark cool gradient (`#0a1020 → #162040`)
- Type-color tint for calendar: amber-tinted for cinema, blue-tinted for digital, purple-tinted for TV

---

## 1. Radarr Widget

### 1.1 Layout — "Hero + Attention"

Two sections with two distinct visual languages. Upcoming = anticipation. Needs Attention = action required. They should feel completely different.

```
┌─────────────────────────────────────────────────────┐
│ 🎬 Radarr                [● 3 cinema] [⚠ 3 miss]   │  ← 36px header
├─────────────────────────────────────────────────────┤
│  [STATS BAR — showStatsBar config]                  │  ← optional row
│  [● 3 cinema]  [● 7 digital]  [● 12 upcoming]       │
├─────────────────────────────────────────────────────┤
│  UPCOMING ─────────────────────────────────────     │
│  ┌───────────────────────────────────────────────┐  │
│  │ [FANART FULL BLEED]                           │  │  ← hero card
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│  │                                               │  │
│  │ ● In Cinemas                     Jul 25       │  │
│  │ Dune: Part Three                              │  │
│  │ Denis Villeneuve · 2025                       │  │
│  └───────────────────────────────────────────────┘  │
│  [poster][poster][poster][poster][poster]  →        │  ← mini scroll
├─────────────────────────────────────────────────────┤
│  NEEDS ATTENTION ──────────────────────────── ⚠ 3  │
│  ▌ [p] The Batman Part II  Missing        [Search]  │  ← red stripe
│  ▌ [p] Oppenheimer         Downloading 68% ████░░  │  ← blue stripe + bar
│  ▌ [p] Interstellar        Cutoff Unmet   [Upgrade] │  ← amber stripe
└─────────────────────────────────────────────────────┘
```

**Narrow/stacked mode:** Sections stack vertically as shown above.  
**Wide/column mode:** Upcoming fills left ~40%, Needs Attention fills right ~60%.  
**Empty upcoming:** Section collapses entirely (existing behavior — `data.upcoming.length > 0` gate). Needs Attention expands to fill space.

---

### 1.2 Header Chips

The 36px widget header always shows:
- **`[● N cinema]`** — amber, shown only when N > 0
- **`[⚠ N missing]`** — red, shown only when N > 0; disappears when 0

These replace the separate stats bar for urgency signalling. The stats bar (if enabled) provides the detailed breakdown.

---

### 1.3 Stats Bar (optional, `showStatsBar` config)

When enabled, a slim row below the header:

```
[● 3 in cinemas]   [● 7 streaming soon]   [● 12 total upcoming]
```

- Cinema count = movies currently in state 3 ("In Cinemas Now") or state 1/2 (upcoming theatrical)
- Digital count = movies in state 5 (digital date is the next milestone)
- Upcoming = total movies with any future date (all states except 4 and 7)

---

### 1.4 Release Date Logic — 7-State Decision Tree

**The core bug in the current code:** `useRadarrData.ts` filters as: if `digitalRelease` exists → hide when past; if `digitalRelease` absent → always show. This causes movies with a past `inCinemas` date and no digital date to appear indefinitely. There is also no explicit sort — order comes from Radarr's calendar API response.

**Replacement logic:**

```
WINDOW = 45   // days — hardcoded theatrical window assumption

For each movie, compute (displayDate, displayType, sortKey):
```

| State | Condition | Badge | Sort |
|---|---|---|---|
| **1** | `IC >= TODAY` | `In Cinemas · [date]` amber | by IC |
| **2** | `IC === TODAY` | `In Cinemas Today` amber + accent | top of list |
| **3** | `IC < TODAY`, `D = TBA`, `(TODAY − IC) ≤ WINDOW` | `In Cinemas Now` amber + pulsing dot | above all dated items; sub-sort: most recently opened first |
| **4** | `IC < TODAY`, `D = TBA`, `(TODAY − IC) > WINDOW` | **HIDE** — stale, theatrical run over | — |
| **5** | `D >= TODAY` (any IC state) | `Streaming · [date]` blue | by D |
| **6** | IC past/TBA, D past/TBA, `P >= TODAY` | `On Disc · [date]` purple | by P |
| **7** | All dates past or all TBA | **HIDE** | — |

IC = `inCinemas`, D = `digitalRelease`, P = `physicalRelease`

**State 3 rationale:** If `digitalRelease` is still TBA, the studio hasn't announced a home release date yet — a reliable signal that the film is still in its theatrical run. No "left theatres" date exists in Radarr's data model, so we infer it from the window.

**WINDOW = 45 days rationale:** Post-COVID theatrical windows have compressed. Traditional studios: 45–90 days. Streaming studios (Apple, Amazon originals): 17–30 days. 45 days covers the majority of studio releases and minimises false "In Cinemas Now" states. Known edge case: a film with a short run (< 45 days) where the digital date hasn't been set in Radarr yet will show "In Cinemas Now" for a few extra days after actually leaving screens. In practice, streaming-studio films (most likely to have short runs) announce theatrical and digital dates simultaneously, so `D` is typically set from day one — making this failure mode rare and accepted.

**Sort order precedence:**
1. State 2 ("In Cinemas Today") — absolute top
2. State 3 ("In Cinemas Now") — sorted by `IC` descending (most recently opened first)
3. States 1, 5, 6 — chronological by their respective `displayDate`

---

### 1.5 Hero Card

Displays the top-sorted upcoming item.

- **Full-width, aspect-ratio 16:7** — same as current vertical stack mode fanart cards
- Fanart image as background (`images` array from the calendar SSE; filter for `coverType === 'fanart'`)
- Cinematic gradient overlay (see §0.2)
- Bottom-left content: release type badge (ReleasePill) + movie title + meta line (director · year)
- If no fanart available: artwork fallback gradient (see §0.2)
- Click opens `MovieDetailModal` (existing behavior preserved)

---

### 1.6 Mini Poster Scroll

Horizontal scroll of remaining upcoming items below the hero. Each card:
- Width: ~60px, aspect-ratio 2:3 (poster orientation)
- Poster image or fallback gradient
- Title truncated below (8px, single line)
- No release pill — date visible only on hover/tap

---

### 1.7 Needs Attention Section

Replaces the current "Missing List." Left-border stripe encodes severity:

| Stripe color | Condition | Right side |
|---|---|---|
| Red | `status = missing` — not found in any indexer | `[Search]` button |
| Blue | `status = downloading` — in queue | Inline progress bar + percentage |
| Amber | `status = cutoffUnmet` — on disk, below target quality | `[Upgrade]` button |

Progress bar: 3px, blue→cyan gradient, fills to `progress` percentage.  
The `progress` field already exists server-side but is currently dropped in the frontend types — see §1.9.

Section header includes a red count badge when N > 0: `NEEDS ATTENTION ──── ⚠ 3`

---

### 1.8 Config Schema Changes

| Key | Type | Default | Choices | Change |
|---|---|---|---|---|
| `viewMode` | buttons | `'auto'` | auto · stacked · column | No change |
| `showStatsBar` | toggle | `true` | show · hide | **Keep as-is** — do not remove user choice |
| `sortBy` | buttons | `'nextDate'` | nextDate · cinema · digital · physical | **NEW** |
| `lookAheadDays` | buttons | `30` | 7 · 30 · 90 · all | **NEW** |
| `showReleasePills` | multiselect | all | cinema · digital · physical | **NEW** |

`sortBy` controls which date field breaks ties when multiple movies share the same `displayDate`. Default `nextDate` = the 7-state logic sort. `cinema` / `digital` / `physical` = sort strictly by that field, hiding movies with no date of that type.

---

### 1.9 Bug Fixes Bundled with Redesign

**Progress field dropped in types:**
1. `radarr.types.ts` → add `progress?: number` and `timeleft?: string` to `QueueItem`
2. `useRadarrData.ts` → map `progress` and `timeleft` when processing SSE queue data
3. `MissingList.tsx` → render progress bar when `progress` is present and `trackedDownloadState === 'downloading'`

---

## 2. Sonarr Widget

Shares the same layout pattern as Radarr. Key differences are episode-specific.

### 2.1 Layout

Identical Hero + Attention structure. Hero shows the next upcoming episode with the series fanart. Mini scroll shows subsequent episodes sorted by `airDateUtc`.

```
┌─────────────────────────────────────────────────────┐
│ 📺 Sonarr                [● 8 airing] [⚠ 5 miss]   │
├─────────────────────────────────────────────────────┤
│  [STATS BAR — optional]                             │
│  [● 8 airing]  [● 2 premiering]  [● 5 missing]      │
├─────────────────────────────────────────────────────┤
│  UPCOMING ──────────────────────────────────────    │
│  [Hero — series fanart + episode title + S##E## + badge] │
│  [ep mini][ep mini][ep mini][ep mini]  →            │
├─────────────────────────────────────────────────────┤
│  NEEDS ATTENTION ──────────────────────────── ⚠ 5  │
│  ▌ [p] Breaking Bad · S03E08  Missing     [Search]  │
│  ▌ [p] Severance · S02E06     Downloading ████░░   │
└─────────────────────────────────────────────────────┘
```

### 2.2 Sonarr Date Logic

Episodes have a single `airDateUtc` — no multi-date complexity. Filter: show episodes where `airDateUtc >= today` and within `lookAheadDays`. Sort by `airDateUtc` ascending. Hero = first result.

### 2.3 Premiere Badges

Pure client-side logic — no server changes needed:
- `episodeNumber === 1 && seasonNumber === 1` → `SERIES PREMIERE` badge (amber — deliberately borrows the cinema "event" color)
- `episodeNumber === 1 && seasonNumber > 1` → `SEASON PREMIERE` badge (amber)

Badge sits on the hero card or episode mini card top-left, as a small pill.

### 2.4 Network Badge

`series.network` is already mapped in the server-side poller. Display as a small chip right-aligned on episode rows (e.g., `HBO`, `FX`, `Netflix`). Truncate at 8 chars.

### 2.5 Season Progress Bar

Shows how far through the current season the show is at a glance.
- Requires `series.statistics.episodeCount` and `series.statistics.episodeFileCount`
- **These are not currently mapped** in `sonarr/poller.ts` — server change needed:
  ```typescript
  statistics: series.statistics ? {
      episodeCount: series.statistics.episodeCount,
      episodeFileCount: series.statistics.episodeFileCount,
      seasonCount: series.statistics.seasonCount,
  } : undefined,
  ```
- Progress = `episodeFileCount / episodeCount` (capped 0–1)
- 2px bar, teal fill, sits below the episode subtitle
- Hidden gracefully if statistics unavailable

### 2.6 Stats Bar (optional)

```
[● 8 airing this week]   [● 2 premiering]   [⚠ 5 missing]
```

- Airing = total episodes in `lookAheadDays` window
- Premiering = episodes where `episodeNumber === 1` in that window
- Missing = `missingCounts.missingCount` (unchanged source)

### 2.7 Config Schema Changes

| Key | Type | Default | Choices | Change |
|---|---|---|---|---|
| `viewMode` | buttons | `'auto'` | auto · stacked · column | No change |
| `showStatsBar` | toggle | `true` | show · hide | **Keep as-is** |
| `lookAheadDays` | buttons | `7` | 3 · 7 · 14 · 30 | **NEW** |
| `showNetwork` | toggle | `true` | show · hide | **NEW** |
| `showSeasonProgress` | toggle | `true` | show · hide | **NEW** (requires server change) |
| `highlightPremieres` | toggle | `true` | show · hide | **NEW** |

### 2.8 Bug Fix Bundled

Same `progress` / `timeleft` fix as Radarr:
1. `sonarr.types.ts` → add `progress?: number` and `timeleft?: string` to `QueueItem`
2. `useSonarrData.ts` → map both fields when processing SSE queue data
3. `MissingList.tsx` (sonarr) → same progress bar rendering as Radarr

---

## 3. Calendar Widget

### 3.1 Agenda View — Time-Proximity Grouping

**Current:** Flat date-sorted list. `Jul 18` looks identical to `Aug 5`.

**New:** Grouped sections — users stop reading dates and read proximity.

```
TODAY — Jul 18 ─────────────────────────────────────
▌ [p] The Bear · S03E04 "Trap"          TV    10pm
▌ [p] Severance · S02E06                TV    12am

TOMORROW ─ Jul 19 ──────────────────────────────────
▌ [p] Dune: Part Three  Digital release Film

THIS WEEK ─ Jul 20–25 ──────────────────────────────
▌ [p] The Last of Us · S02E07           TV    Jul 21
▌ [p] Mission: Impossible 8  In Cinemas Film  Jul 23

NEXT WEEK ─────────────────────────────────────────
▌ ...

LATER ─────────────────────────────────────────────
▌ ...
```

Groups: `Today`, `Tomorrow`, `This Week` (next 7 days), `Next Week`, `Later`.  
Empty groups are hidden.

**Each agenda item:**
- Left-border stripe: purple = TV (Sonarr), amber = cinema, blue = digital, orange = physical
- Poster thumbnail (26px wide, 2:3 ratio) via image proxy; fallback gradient if unavailable
- Title (bold, 11px), subtitle (episode info or release type + studio/network, 9px)
- Type badge (ReleasePill, small) right-aligned
- Time or date right-aligned

### 3.2 Month Grid — Richer Day Cells

**Today cell:** Accent-blue filled circle around the day number (iOS Calendar convention) + subtle accent tint on cell background. No new learning curve — universally recognised.

**Event pills:** Current pills are solid-color bars with no type info. New pills add a 2px left-border accent in the release type color + optional emoji suffix:
- Cinema 🎬 (amber)
- Digital 📱 (blue)
- Physical 💿 (purple)
- TV episode (teal, no emoji — too frequent to warrant it)

On wider grid cells, pill shows a truncated title (1 line, ellipsis). On narrow cells, color + emoji only.

### 3.3 Multi-Date Plotting (calendar `movieDates` config)

When `movieDates === 'all'`: a movie with multiple confirmed dates appears in multiple cells — each with the appropriately colored pill.

Example — Batman II with all dates set:
- `inCinemas` cell → amber pill "Batman II 🎬"
- `digitalRelease` cell → blue pill "Batman II 📱"
- `physicalRelease` cell → purple pill "Batman II 💿"

When `movieDates === 'digital'` (default): only `digitalRelease` date is plotted. Preserves existing behavior.

Note: multi-date mode can be visually noisy on small widgets. Consider gating it behind a minimum widget size or documenting it as a "wide widget" feature.

### 3.4 Controls Move to Header

The All / TV / Movies filter chips and month navigation arrows (‹ Today ›) move into the 36px widget header. Reclaims a full content row (~32px) of widget height.

Header layout:
```
[📅 Calendar]  [All][TV][Film]  [‹][Today][›]
```

Filter chips use the existing `chip` style. Navigation arrows are ghost buttons.

### 3.5 Split Mode Ratio

Current code: **65/35** (CSS `flex: 65` / `flex: 35`). Note: TSX comment says "70/30" — this is wrong and should be corrected.

Target: **60/40** — agenda deserves more space with the new grouped + thumbnail layout. Change: `flex: 60` / `flex: 40` in `.cal-split-calendar` / `.cal-split-agenda`. Verify visually once the new agenda layout is implemented before locking in.

### 3.6 Config Schema Changes

| Key | Type | Default | Choices | Change |
|---|---|---|---|---|
| `viewMode` | buttons | `'month'` | month · agenda · both | No change |
| `showPastEvents` | toggle | `false` | show · hide | No change |
| `startWeekOnMonday` | buttons | `'false'` | sunday · monday | No change |
| `movieDates` | buttons | `'digital'` | cinema · digital · physical · all | **NEW** |
| `showReleaseEmoji` | toggle | `true` | show · hide | **NEW** |

---

## 4. Tautulli Widget

### 4.1 Direction

Tautulli's role in the dashboard: **library and viewing history** — not live sessions. Active streams are handled by the Plex widget. Users who want to monitor sessions connect Plex.

Core problem with the current widget: the tab navigation (Top Movies / Top TV / Top Users / Recently Added) requires interaction to get any value. A dashboard widget should be glanceable, not interactive.

### 4.2 Layout — "Content-Forward, No Tabs"

Remove tabs entirely. Show all sections at once in a single scrollable layout, with visual hierarchy:

```
┌─────────────────────────────────────────────────────┐
│ 📊 Tautulli                                         │
├─────────────────────────────────────────────────────┤
│  [STATS BAR — optional]                             │
│  1,247 Movies · 186 Shows · 18.4k Plays · 8d Watch │
├─────────────────────────────────────────────────────┤
│  RECENTLY ADDED ───────────────────────────────     │
│  [poster][poster][poster][poster][poster]  →        │  ← cinematic scroll
├─────────────────────────────────────────────────────┤
│  TOP MOVIES ──────────── TOP TV ───────────────     │
│  1. [p] Dune 2   · 42    1. [p] The Bear · 118     │  ← side-by-side compact
│  2. [p] Oppenheimer · 38 2. [p] Severance  · 94    │
│  3. [p] Fallout  · 31    3. [p] Succession · 87    │
└─────────────────────────────────────────────────────┘
```

**Recently Added carousel (hero section):**
- Horizontal poster scroll, same pattern as Radarr upcoming mini scroll but with larger cards (~80px wide)
- Proper poster artwork, cinematic gradient overlay, title + "X days ago" floating at bottom
- This section changes daily — most "alive" piece of data Tautulli has

**Top Movies / Top TV (always visible, side-by-side):**
- Two compact columns, 3–5 items each
- Rank number + small poster thumb + title + play count
- No tabs needed — both always visible

**Top Users:** Removed from widget. Users who care about per-user stats should use Tautulli directly.

### 4.3 Config Schema Changes

| Key | Type | Default | Choices | Change |
|---|---|---|---|---|
| `showStatsBar` | toggle | `true` | show · hide | **Keep as-is** — repurposed for library stats strip |
| `itemCount` | buttons | `5` | 3 · 5 · 10 | **Reduced scope** — now controls items per top-content column only |

`itemCount` changes meaning: previously controlled tab list items, now controls rows in the Top Movies / Top TV columns. Keep the config key so it's not a breaking change, but update the label in the config UI.

### 4.4 SSE — No Changes Needed

Active sessions (`get_activity`) are explicitly out of scope for this redesign. All three existing SSE subtypes are sufficient:
- `libraries` (60s) → powers stats bar and counts
- `stats` (5min) → powers Top Movies / Top TV columns
- `recent` (5min) → powers Recently Added carousel

---

## 5. Open Questions

- [ ] **Radarr — physical release type config:** Should users be able to opt out of seeing physical release dates entirely? Consider adding `showReleasePills` as a multiselect to the config schema now (default: all checked) so it's not a breaking change later. `physicalRelease` is currently unused in the widget — this would be new functionality.
- [ ] **Tautulli — top content item count:** Currently `itemCount` defaults to 5. With two side-by-side columns (Top Movies + Top TV), should the default be 3 to avoid the section feeling crowded?
- [ ] **Calendar — multi-date noise:** If a movie has all 3 dates, it appears 3× in the month grid. Is there a minimum widget size below which `movieDates: 'all'` should be disabled or warned against?
- [ ] **Sonarr — hero for season premieres:** Should season premiere episodes get an enhanced hero treatment (larger card, special badge) similar to how Radarr treats theatrical releases? Currently premiere badges apply to the mini cards and hero equally.
- [ ] **Calendar split ratio:** 60/40 is the target but should be verified visually with the new agenda layout before locking in. May want to try both 60/40 and 55/45.

---

## 6. Implementation Tasks

### Phase 1 — Pure Frontend (no server changes)

| Task | Widget(s) | Size |
|---|---|---|
| 7-state date logic replacing current filter in `useRadarrData.ts` | Radarr | M |
| Hero card component (fanart bg, cinematic overlay, badge + title) | Radarr | M |
| Mini poster scroll (reuse/adapt existing horizontal carousel) | Radarr | S |
| Header chips (upcoming count, missing count conditional) | Radarr + Sonarr | S |
| Needs Attention section (severity stripes, action buttons) | Radarr + Sonarr | M |
| `progress` + `timeleft` added to `QueueItem` types | Radarr + Sonarr | XS |
| Map `progress`/`timeleft` in SSE handlers | Radarr + Sonarr | XS |
| Inline progress bar in Needs Attention list | Radarr + Sonarr | S |
| `ReleasePill` shared component | Shared | S |
| Premiere badge logic (client-side, `episodeNumber === 1`) | Sonarr | XS |
| Network badge (`series.network` already in data) | Sonarr | XS |
| Stats bar expansion (cinema / digital / missing breakdown) | Radarr + Sonarr | S |
| `sortBy` + `lookAheadDays` config options + logic | Radarr + Sonarr | S |
| Calendar: agenda time-proximity grouping | Calendar | M |
| Calendar: poster thumbnails in agenda items | Calendar | S |
| Calendar: controls moved to header | Calendar | S |
| Calendar: iOS today cell (accent circle + tint) | Calendar | XS |
| Calendar: event pill left-border + emoji suffix | Calendar | S |
| Calendar: multi-date plotting (`movieDates` config) | Calendar | M |
| Calendar: split ratio 65/35 → 60/40 + fix comment discrepancy | Calendar | XS |
| Tautulli: remove tab nav, render all sections at once | Tautulli | M |
| Tautulli: Recently Added carousel (cinematic style) | Tautulli | M |
| Tautulli: Top Movies + Top TV side-by-side layout | Tautulli | S |
| New config options wired to `plugin.ts` for all widgets | All | S |

### Phase 2 — Requires Server Change

| Task | Widget | Server Change |
|---|---|---|
| Season progress bar | Sonarr | Add `statistics` to series mapping in `sonarr/poller.ts` |
