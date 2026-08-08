# Integration brief

Read this before touching anything. It's the ground truth for how session data
actually moves. Several checked-in docs contradict it — see "Docs that lie" at
the bottom.

## TL;DR

This is a 3-repo system. If you were only pointed at `cc/fomo`, you're missing
the two repos that own the data.

| Repo | Local path | Owns |
|---|---|---|
| `bprashanth/cc` (subdir `fomo/`) | `~/src/github.com/bprashanth/cc/fomo` | web dashboard (this repo) |
| `bprashanth/fomomon` | `~/src/github.com/bprashanth/fomomon` | Flutter app (producer) + admin UI |
| `bprashanth/good-shepherd` | `~/src/github.com/bprashanth/good-shepherd/server` | Lambda API (the thing in between) |

## The actual data path

```
Flutter app
  -> images  : s3://{site.bucketRoot}/{siteId}/{userId}_{ts}_{portrait|landscape}.jpg
  -> session : s3://{bucket}/{org}/sessions/{userId}_{ts}.json   (image paths swapped for https URLs)
       -> GET /api/sessions/{org}?bucket=fomomon   (Lambda: list + download + strip + presign)
            -> LoginView.vue:136 -> store.joinedData -> dashboard
```

That's it. One API call, at login. No polling, no refetch.

## Read these

Tier 1, all five, they're the contract:

- `good-shepherd/server/docs/api.md`
- `good-shepherd/server/docs/manuals/client_integration.md` (auth)
- `cc/fomo/README.md` (most current overview in the whole system)
- `fomomon/docs/upload.md` (S3 key layout, producer side)
- `fomomon/docs/deletions.md` (`isDeleted` semantics — you need this)

Tier 2, only if you're touching the dashboard:

- `cc/fomo/docs/architecture.md`, `docs/event_processing.md`, `docs/layout.md`
- `fomomon/docs/sites.md`

Source > docs. These four are shorter and more honest than anything above:

- `good-shepherd/server/services/sessions_service.py` (60 lines, the real contract)
- `good-shepherd/server/services/s3_service.py` (presign + bucket parsing)
- `cc/fomo/web/app/src/services/authService.js`
- `cc/fomo/web/app/src/components/LoginView.vue:136`

## Gotchas

### Images aren't under `{org}/`, and may not be in the same bucket

Sessions are at `{bucket}/{org}/sessions/*.json`. Images go to
`{siteId}/{userId}_{ts}_{orientation}.jpg` under **the site's** `bucketRoot`,
which can be a different bucket — `api.md`'s own example shows an `ncf` request
returning `fomomonguest.s3...` URLs. `presign_url` re-parses the bucket out of
each stored URL, so cross-bucket is by design, not a bug.

`aws s3 ls s3://fomomon/ncf/` gives you `sessions/`, `sites.json`, and per-site
image prefixes. To find *all* images you read the URL inside each session JSON.

**Verified against prod** — the 74 sessions in `s3://fomomon/ncf/sessions/`
reference **three different buckets**:

| bucket | image URLs | what |
|---|---|---|
| `forestfomo-images` | 80 | the 2019/2024 DSLR archive series |
| `fomomon` | 62 | phone-app captures |
| `fomomonguest` | 6 | guest-mode captures |

So "the ncf bucket" is not a thing. Always resolve per-URL.

### Site IDs were renamed (migration `site_rename_0426`) — old IDs are dead

Any doc, mirror, or fixture using `P1R1` / `P2R1` / `H13R1` is **stale**.
Verified against prod `s3://fomomon/ncf/sites.json` (27 sites, all new IDs):

| old | new |
|---|---|
| `P1R1` | `2019_LA_R1` |
| `P1R2` | `2019_LA_R2` |
| `P2R1` | `2019_SM_R1` |
| `P2R2` | `2019_SM_R2` |
| `J12R1` | `2024_J12_R1` |
| `H13R1` | `2024_H13_R1` |
| `I17R1_2016` | `2016_I17_R1` |

Map lives at
`good-shepherd/server/migrations/site_rename_0426/site_rename_map.json`.
`~/rtmp/data/ncf/` is a **pre-migration mirror** — don't trust its IDs.

### `isDeleted` is a soft delete and nobody filters it

Set when an admin deletes a site server-side (see `fomomon/docs/deletions.md`).
The API doesn't filter it, the frontend doesn't filter it, it's not in `api.md`'s
response example and not in `_DROP_FIELDS`.

**Current prod state: 0 of 74 sessions have `isDeleted: true`.** So this is a
latent bug, not an active one — don't go chasing missing data over it. But if
you build a gallery/timelapse, filter it yourself, because the first admin site
deletion will silently poison every downstream view.

### `heading` exists, undocumented, and is sparse

Compass bearing. 31/74 records. Not in `api.md`. Absent on older records, so
treat it as optional. Matters if you're doing anything with repeat-photo
framing/alignment.

### `responses` is always `[]` from the API. On purpose.

`sessions_service.py:39` hard-clears it. Survey answers are supposed to come
from form images via `POST /api/upload`.

But: `queryTemplateService.js` still ships a `SPECIES` placeholder, and
`SurveyResultPanel` / `SurveyGraphingModal` chart survey answers. Those are fed
by a totally different file — `web/app/public/data/biodiversity_db.json`
(GBIF + Zenodo), documented nowhere except the untracked
`docs/design/species_trends_issues.md`.

So if someone asks you for "species analysis", **don't** wire it to session
responses. You'll get empty arrays forever.

### `/api/sites/{org}` is documented, unused, and broken

- `s3_service.py:75` presigns fields called `referenceImageUrl` / `ghostImageUrl`
- real `sites.json` (`fomomon/config/sites/t4gc.json`) has `reference_portrait` /
  `reference_landscape` — relative keys, not URLs — and `location.lat`/`lng`,
  not `latitude`/`longitude`
- so the endpoint returns unpresigned relative paths, in a shape `api.md` does
  not describe
- frontend never calls it (grep: only `/api/sessions`)
- **verified against prod**: `s3://fomomon/ncf/sites.json` has 27 sites, all
  using `reference_portrait` / `reference_landscape`. Zero occurrences of
  `referenceImageUrl`. So the presign is a no-op in production today.

Net effect: **the dashboard has no site names, only `siteId`.** If you need
names, this endpoint needs fixing first — don't build against `api.md`'s
documented shape, it doesn't exist.

### Both checked-in fixtures are wrong, differently

| File | What's wrong |
|---|---|
| `data/db.json` | presigned URLs stamped `X-Amz-Date=20260421` + STS tokens. Dead. |
| `web/app/tests/integration/db.json` | raw un-presigned URLs from the old `forestfomo-images` bucket |

Neither shows what a live response looks like. Get a real one with a token.

Also: **presigned URLs expire in 7 days.** Persist the S3 key, never the URL.

### Env vars

`client_integration.md` says `VITE_API_BASE_URL` / `import.meta.env`. Wrong for
this repo. fomo is Vue CLI/webpack:

```js
process.env.VUE_APP_API_BASE_URL   // authService.js:8
```

`vite.config.js` exists but is Vitest-only. Copy the doc's snippet and you get a
silent `undefined`.

### Auth: two flows documented, one implemented

`client_integration.md` §2 says `USER_SRP_AUTH`. README says `USER_PASSWORD_AUTH`.
`USER_PASSWORD_AUTH` is what's actually implemented.

Config: `https://fomomon.s3.ap-south-1.amazonaws.com/auth_config.json` (public).
ID token 1h, refresh token 30d. `apiFetch` does the 401 -> refresh -> retry once.

### S3 creds vs Cognito creds give you different data

You have both. They are not interchangeable:

| Route | `responses` | image URLs | `isDeleted` rows |
|---|---|---|---|
| direct S3 | populated | raw, need creds | present |
| `/api/sessions` | always `[]` | presigned, 7d | present |

Decide which is authoritative for what you're building before you start.

### Scale constraint (not written down anywhere else)

- one `/api/sessions/{org}` call at login
- whole array lives in `store.joinedData`, in memory, never persisted
- all SQL runs client-side in AlasQL
- no pagination, no date filter, no polling
- **no thumbnails anywhere** — panels load full-res originals

If your integration multiplies session count, this is what breaks first.

## Docs that lie

Read these as history. Do not implement against them.

| Doc | Why |
|---|---|
| `cc/fomo/AGENTS.md` (= `CLAUDE.md`) | **auto-loads, so read this warning first.** Describes the app as the Excel-upload flow. No mention of Cognito, the API, or LoginView. "Key Files" omits `authService.js`. |
| `cc/fomo/docs/data_upload.md` | Drive -> S3 -> Excel -> manual CSV join. Dead forestfomo path. README marks it legacy; the doc itself has no banner. |
| `fomomon/docs/db_sessions.md` | says run `hack/s3/create_db.py` and upload `db.json` to `bucketroot/org/db.json` or the org sees "upload files" UX. Not true since the API landed. `sessions_service.py:29` lists `{org}/sessions/*.json` live per request. Regenerating db.json changes nothing. |
