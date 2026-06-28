# Tippspiel — results pipeline

How verified race results become Tippspiel points. **Hard rule:** only ever enter results confirmed
against an official / reputable source. Never guess an order or invent a finisher (see the data-integrity
rule). A wrong result is far worse than a missing one.

## What's tippable (deliberately small, decided 2026-06-28)

Only these races can be tipped — see [`src/lib/tippable.ts`](../src/lib/tippable.ts):

- **IRONMAN Pro Series** races — auto-detected by the official `…/proseries/…` start-list URL on the
  series event. This set already **includes the Kona World Championship**.
- **DATEV Challenge Roth** (`se-ch-roth`)
- **T100 Triathlon World Tour** rounds (`series === 'T100'`)

Everything else hides the Tipp tab. Widen the allowlist later as result coverage grows.

## The flow

```
verified result (official source)
  → add to src/data/raceResults.json   (top-5 per gender, athlete SLUGS, + source + verifiedAt)
  → npm run sync:results               (pushes to Supabase race_results, admin key)
  → plpgsql score_gender() + leaderboard()/group_leaderboard() score every tip automatically
  → app shows it: Race Center → Tipp tab → "your tip vs. result" (RaceTipResult, same scoring engine)
```

The bundled JSON drives the in-app "your score" view (offline, instant). The synced DB rows drive the
**global + group leaderboards** (server-side aggregate). Same data, two consumers.

## Adding a result (per race)

1. **Find the official top 5** per gender (e.g. PTO stats `stats.protriathletes.org/race/<id>/<year>/results`,
   the timing provider, or the organiser's results page).
2. **Map each finisher to our athlete slug** (`firstname-lastname`, lowercased — e.g. `patrick-lange`).
   Confirm the slug exists in the roster (`src/data/proAthletes.json`, `src/mocks/athletes.ts`) so the
   name renders and the slug matches the picks. If a finisher isn't in the roster yet, add them via the
   athlete-ingestion robots first — don't invent a slug.
3. **Append to `src/data/raceResults.json`**:
   ```jsonc
   {
     "raceId": "se-im-frankfurt",          // the app race id (must equal predictions.race_id)
     "men":   ["slug1","slug2","slug3","slug4","slug5"],   // winner first
     "women": ["slug1","slug2","slug3","slug4","slug5"],
     "source": "https://stats.protriathletes.org/race/im-frankfurt/2026/results",
     "verifiedAt": "2026-06-29"
   }
   ```
   Women-only / men-only championships: fill the gender that raced, leave the other `[]`.
4. **Push to the backend** (needs the admin key — never commit it):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=xxxxx npm run sync:results
   ```
   Idempotent — safe to re-run. Commit the updated `raceResults.json`.

## Notes

- Top 5 is all that's needed (a tip covers 5). DNFs simply never appear → those picks score 0, no
  special-casing.
- Scoring lives in two mirrored places kept in sync: `src/lib/tippspiel.ts` (TS, in-app) and the
  `score_gender()` plpgsql function (DB). Change one → change both.
- The roster occasionally lags new pros (e.g. fresh 2026 winners). Refresh it via the pro-athlete
  ingestion before seeding a race whose podium isn't covered yet.
