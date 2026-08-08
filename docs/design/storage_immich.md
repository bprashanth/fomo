# Immich eval

Can we use [Immich](https://immich.app) (self-hosted photo server) as the photo
backend, instead of / alongside the S3 + Lambda thing we have?

Assumption: the Flutter app keeps existing. It can dual-write, or we mirror from
S3. We're not rewriting capture.

**Scope narrowed (2026-08):** the flow that actually matters is
*"show me a timelapse of images for site X"*. Face search is a non-goal — these
are ecological sites, not people. AlasQL / arbitrary SQL is a non-goal too. That
narrowing changes the verdict a lot — see below.

## Verdict

- **Old verdict** (assuming we needed the full dashboard): bad replacement.
- **New verdict** (timelapse-for-site only): Immich covers the query natively.
  It's a reasonable fit *if* we also want the browse/search/share/mobile-upload
  surface. If we only want the one flow, we probably don't need Immich at all —
  see "Do we even need this?" at the bottom.

## Does it do the timelapse flow?

Yes. One API call, no SQL.

```http
POST /api/search/metadata
x-api-key: <key>
Content-Type: application/json

{
  "tagIds": ["<uuid-for-site-G14R1-2025>"],
  "order": "asc",
  "size": 250,
  "page": 1
}
```

[`/api/search/metadata`](https://api.immich.app/) supports `tagIds`,
`albumIds`, `personIds`, `takenAfter` / `takenBefore`, `createdAfter` /
`createdBefore`, `order`, and `page` / `size`. So "all photos for site X, oldest
first, optionally within a date range" is exactly one request.

### Tags vs albums for "site"

Do both, they're cheap:

| | good for |
|---|---|
| **album per site** | Immich's UI has a first-class album view — someone can just click in and scrub, zero code |
| **hierarchical tag** | `site/gudalur/plot14/row1` — lets us group sites by region/plot, which albums can't do. Tags are XMP sidecar-backed so they survive outside Immich. |

`albumIds` and `tagIds` are both metadata-search filters, so either works as the
query key.

### Three things to get right up front

**1. Tag/album IDs are UUIDs, not names.** Need a name → UUID lookup
(`GET /api/tags`, cache it). Minor but you'll hit it in the first hour.

**2. Ordering is by asset date, so set `fileCreatedAt` on upload.**
`POST /api/assets` takes `fileCreatedAt` explicitly. Set it from the session
JSON's `timestamp` field. If we let Immich infer it from EXIF and EXIF is
missing or wrong on some captures, the timelapse ordering silently breaks.

**3. Portrait/landscape pairing — this one actually bites.** Every session is
*two* assets at the *same* timestamp. A naive site query returns both,
interleaved, and the timelapse flickers between orientations.

Fix: tag `orientation/portrait` and `orientation/landscape` at upload, then add
that tagId to the query. Cheap, but has to be planned for — retrofitting it
means re-tagging everything.

### What Immich does *not* give us

**Immich gives you the ordered list. It does not give you a timelapse player.**
There's no auto-play/scrub-through-time view — you'd build that against the
search API. But that's the easy part, we already have `ImagePanel`, and the
input is just an ordered list of URLs.

Also still missing:
- ghost / alignment overlay for repeat framing
- `heading`, `siteId`, `sessionId`, survey responses have no typed home. Only
  free-text `description` + tags. Fine if we never need to *query* them; a
  one-way door if we do.

## Auth

Three separate things, don't conflate them.

### Programmatic (tools, sync jobs, fomo backend)

**API keys.** `x-api-key` header, scoped permissions — `asset.read`,
`asset.upload`, `album.read`, `album.write`, `library.read`, `user.read`. Clean.
No OAuth dance per call. This is the integration story and it's fine.

### Humans

**Immich speaks OIDC natively**, so we do **not** need Cloudflare Access for
identity. Cognito user pools are an OIDC provider — point Immich's OAuth config
straight at the same pool the Flutter app and fomo already use. One identity
everywhere.

Setup ([docs](https://docs.immich.app/administration/oauth/)):
- configure an app client in the Cognito pool
- redirect URIs must include every domain we serve Immich on, **plus
  `app.immich:///oauth-callback`** if we want the Immich mobile app to work
- optional backchannel logout: `https://DOMAIN/api/oauth/backchannel-logout`
- turn on **Auto Launch** so users never see Immich's own login form

Caveats: Immich keeps its own user records and links them via OIDC claims —
check claim mapping (it wants an email claim). Quota and admin flags are
per-Immich-user, not inherited from Cognito.

### Network front door

Cloudflare Tunnel is still worth it for ingress (no open ports, no cert
management). **But do not put Cloudflare Access in front of `/api`** — it breaks
the mobile app and every API-key client. Common footgun.

So: Tunnel for ingress, Cognito OIDC for humans, API keys for tools, Access (if
used at all) only on the web UI paths.

### Bonus: public read-only galleries

`POST /shared-links` with `type: ALBUM` and viewer permission, plus optional
password and expiry. Gives a public URL for a site's gallery with no login at
all.

For showing a restoration timeseries to funders or the public, that's basically
free and we have nothing like it today.

## Options

### A. Read-only mirror — cheapest thing that tells us something

`rclone mount` the bucket read-only, add as an
[external library](https://docs.immich.app/features/libraries/) with exclusion
patterns for `sessions/` and `*.json`. Immich indexes the JPEGs where they
already sit.

- zero phone changes, ~an afternoon
- **but**: no tags, no albums, no `fileCreatedAt` control → **no site timelapse**

So this validates "do people like Immich", not "does the flow work". Use
**scheduled** scans, not filesystem watching — inotify doesn't cross network
mounts reliably.

### B. Sync job that uploads properly — the real option

A job that walks `{org}/sessions/*.json` and for each session:
- uploads both images via `POST /api/assets` with `fileCreatedAt` = session
  `timestamp`
- puts them in the album for `siteId`
- tags `site/...` + `orientation/...`
- skips `isDeleted` sessions (see `integration_brief.md`)
- stashes `sessionId` in `description` for traceability

Then site timelapse = one `/api/search/metadata` call. fomo keeps session JSON as
source of truth for `siteId` / `heading` / responses, and swaps
`portraitImageUrl` for an Immich thumbnail URL.

Cost: two systems, plus a reconciliation job that has to be idempotent
(`deviceAssetId` is the dedup key — use `{sessionId}_{orientation}`).

### C. Fork Immich to add sites as a first-class entity — don't

Fast-moving NestJS + Postgres + SvelteKit + Flutter monorepo. We'd carry the
fork forever.

## Do we even need this?

Honest version, given the narrowed scope. The timelapse flow in the **existing**
stack is:

```js
sessions
  .filter(s => s.siteId === x && !s.isDeleted)
  .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
```

...plus thumbnails, which is a resize step in the existing Lambda. That's maybe
a day of work, zero new infrastructure, and it handles the portrait/landscape
pairing correctly because we already have the session object.

Immich earns its keep only if we *also* want:
- a browsable archive UI we don't have to build
- public shared links for funders/public
- mobile upload with background retry (replacing our own)
- CLIP text search over the archive ("show me photos with standing water")

That last one might actually be the interesting one for ecology — but see
[`image_features.md`](image_features.md) before getting excited. CLIP does fuzzy
retrieval ("photos that look like grassland"), **not** measurement ("photos with
>30% grass"). The measurement queries want segmentation, and they don't need
Immich at all.

## Open questions

- do we want a "browse all photos" UX, or is site timeseries the whole job?
- who operates it? Immich is another Postgres + Redis + ML container to babysit.
  We currently run zero servers (Lambda + S3 + Netlify).
- if the real pain is just thumbnails, does a resize step in the existing Lambda
  beat all of this? Probably yes.
- is CLIP search over field photos actually useful, or a toy? (see
  [`image_features.md`](image_features.md))

## Sources

- https://api.immich.app/ (API reference)
- https://docs.immich.app/administration/oauth/ (OIDC setup)
- https://docs.immich.app/features/libraries/ (external libraries)
- https://docs.immich.app/features/tags/
- https://docs.immich.app/features/sharing/
- https://github.com/immich-app/immich/discussions/23745 (object storage, PoC only)
