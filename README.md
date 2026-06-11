# Artist Travel Finder

A private travel research app for artist-friendly trips, slow bases, and watched airfare changes.

The app is intentionally not a booking engine. It keeps destination suggestions curated, shows price evidence and timestamps, and only refreshes airfare for destinations explicitly added to Price Watch.

## Current status

- Next.js, TypeScript, Tailwind
- Password-protected app shell
- Curated seed destinations
- Price Watch with local watched-search storage
- Server-side daily airfare refresh cap
- Mock flight/lodging/dining providers clearly labeled as mock

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Set a private password and long random session secret:

```txt
APP_PASSWORD=your-password
APP_SESSION_SECRET=a-long-random-string
```

4. Run the app for normal UI work:

```bash
npm run dev
```

This starts the Next dev server with Webpack hot reload on `127.0.0.1`. Use this for design and CSS changes. Avoid `npm run build`, `npm run start`, or `npm run preview` while iterating on the UI; those are production/Cloudflare checks and will feel much slower.

## Cloudflare deployment

This app uses Next.js route handlers and password middleware, so deploy it with the Cloudflare OpenNext adapter rather than as a plain static Pages output.

Cloudflare dashboard settings:

```txt
Framework preset: None / Workers
Build command: npm run build
Deploy command: npx wrangler deploy
```

`npm run build` runs the Cloudflare OpenNext build and creates `.open-next/worker.js`. The plain Next.js build is available as `npm run next:build`.

Local Cloudflare build/deploy command:

```bash
npm run deploy
```

Local Cloudflare-runtime preview:

```bash
npm run preview
```

Required Cloudflare build variables/secrets:

```txt
APP_PASSWORD=<private-login-password>
APP_SESSION_SECRET=<long-random-secret>
WATCH_DAILY_CAP=25
WATCH_REFRESH_STALE_HOURS=24
WATCH_MAX_DESTINATIONS=20
```

Keep `APP_PASSWORD` and `APP_SESSION_SECRET` in Cloudflare environment variables/secrets, not in the repository.

In the Cloudflare dashboard, add them under:

```txt
Workers & Pages -> artist-travel-finder -> Settings -> Variables and Secrets
```

Use `Secret` for `APP_PASSWORD` and `APP_SESSION_SECRET`. The watch limit values can be plain environment variables.

## Cost-control design

The app is designed for a free or low-cost Cloudflare deployment:

- The whole app is password protected.
- Users must opt destinations into `Price Watch`.
- Auto-refresh checks only watched searches.
- Fresh checks are skipped until they are stale.
- `WATCH_DAILY_CAP` prevents unlimited airfare provider calls.
- Seed, lodging, dining, and destination notes are cached/curated by design.
- Airfare is the volatile data path and should use live provider data when configured.

Defaults:

```txt
WATCH_DAILY_CAP=25
WATCH_REFRESH_STALE_HOURS=24
WATCH_MAX_DESTINATIONS=20
```

## Mock mode

The current price sampler is mock-only. Mock data is labeled in the interface and should not be used as real travel pricing.

Destination summaries, caveats, highlights, and transport notes are also hand-curated seed data in v1. The app does not call OpenAI, Gemini, ChatGPT, or any other AI provider yet.

Destination card banners use external location-photo search URLs for private prototype use. If this app becomes public-facing, replace them with verified licensed/public-domain images and store attribution/source metadata beside the destination seed data.

When live providers are added, every displayed price should still include:

- source/provider
- sampled dates
- retrieved date
- source link or search URL where possible
- live/cached/mock/unavailable state

If live data is unavailable, the app should show `Price unavailable`, not invented prices.

## Future AI summaries

OpenAI is the preferred future AI provider, but only after the Cloudflare password deployment is verified. AI should run server-side with API keys stored in Cloudflare environment variables, summarize trusted source/provider data, and never invent prices, availability, or source links. If evidence is missing, the AI layer should say the information is unavailable.

## Future provider work

Recommended next integrations:

- Amadeus or another flight API for live DEN airfare samples
- Hotel baseline provider for 3-star and occasional 4-star samples
- Compliant rental APIs or public search links for rentals
- D1 or KV persistence for multi-device watch state and durable daily usage caps on Cloudflare
