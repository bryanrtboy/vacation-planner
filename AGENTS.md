# AGENTS.md

Guidance for Codex and other coding agents working in this repository.

## Project Scope

This is a personal travel-planning app for comparing trip ideas, saved destination leads, live or cached price checks, and art-show travel leads.

Primary user goals:

- Find and compare travel ideas with enough context to judge cost, season, transport, lodging, and fit.
- Keep lightweight shared preference signals for destinations, including stars and hidden items.
- Search a shared D1 art watchlist for museum and major gallery exhibition leads.
- Avoid runaway API cost, Cloudflare Worker CPU limits, and confusing quota displays.

This is not a public multi-tenant product. Prefer simple, durable, low-friction behavior over heavy authentication or complex admin flows.

## Stack

- Next.js app router
- React client UI in `components/`
- Cloudflare/OpenNext deployment
- Cloudflare D1 for durable app state
- SerpAPI for source checks: airfare, lodging, and art-show source discovery
- Gemini/AI only for destination idea generation

Important scripts:

- `npm run typecheck`
- `npm run lint`
- `npm run next:build`
- `npm run d1:migrate:local`
- `npm run d1:migrate:remote`

`next build` may modify `next-env.d.ts`. Revert that generated change unless the user explicitly asks to keep it.

## Cloudflare And D1

D1 migrations live in `migrations/`. Any schema change needs a new numbered migration.

Local migration:

```bash
npm run d1:migrate:local
```

Remote migration:

```bash
npm run d1:migrate:remote
```

Pushing to Git and deploying to Cloudflare does not automatically run D1 migrations. Tell the user when a remote migration is required.

Remote D1 can be inspected with:

```bash
npx wrangler d1 execute vacation_planner --remote --command "SELECT ..."
```

Treat remote D1 writes carefully. Do not reset or delete production data unless the user explicitly asks.

## Quotas And API Cost

The `usage_counters` table is the source of truth for daily caps.

- `service = 'serpapi'`: shared source checks for airfare, lodging, and Art Show Watch.
- `service = 'ai'`: destination suggestion generation.

Do not mix these counters in the UI. Labels should clearly distinguish:

- `source checks left`
- `AI ideas left`

SerpAPI calls cost real money and should be guarded by `tryReserveChecks`. Avoid speculative or automatic live searches that the user did not request.

Art Show Watch must remain resumable and bounded. Do not reintroduce a single large all-watchlist Gemini or search-grounded request.

## Art Show Watch

Current approach:

- Watchlist terms are stored in D1.
- Search uses SerpAPI Google organic results, not Gemini grounding.
- Results are leads, not confirmed travel plans.
- Saved and hidden art-show leads are persisted.
- Hidden URLs should stay suppressed where reasonably possible.
- Old source-result filtering should be conservative: avoid hiding valid future exhibitions because an artwork date or historical date appears in the snippet.

Design intent:

- Search should not freeze the UI.
- Searches should be incremental and safe to resume.
- New/unsearched artists should be visible to the user.
- The app should prefer fewer high-quality leads over a flood of marginal mentions.

## Destination Ideas

Destination cards are the main browsing surface.

Preference behavior:

- Stars are per display name, stored in D1.
- One person should not count as multiple stars across phone, iPad, and laptop if they use the same display name.
- Hide is personal by display name and should be reversible.
- Default destination sort should float starred destinations first.

Filtering behavior:

- Region dropdowns should behave like text search where practical. For example, selecting `Japan` should include subregions like `Kagawa, Japan`.
- Drive filtering should include destinations marked `Car useful` or `Driver recommended`, even before a live price check exists.
- Do not make unpriced but relevant destinations disappear merely because no live price has been checked yet.

## UI Guidelines

Keep the app practical and information-dense. This is an operational planning tool, not a marketing site.

- Prefer compact controls and clear labels.
- Avoid decorative redesigns that make scanning harder.
- Keep cards readable on mobile and desktop.
- Do not put cards inside cards.
- Use existing color and component patterns unless there is a clear reason to change them.
- Use lucide icons where icons are needed.

## Development Rules

- Use `rg` for searches.
- Use `apply_patch` for manual edits.
- Keep edits scoped to the requested behavior.
- Do not revert unrelated user changes.
- Do not run destructive Git commands unless explicitly requested.
- For code changes, run at least:

```bash
npm run typecheck
npm run lint
```

For UI, routing, or API changes, also run:

```bash
npm run next:build
```

For D1 schema changes, run:

```bash
npm run d1:migrate:local
```

Then tell the user whether `npm run d1:migrate:remote` is needed.
