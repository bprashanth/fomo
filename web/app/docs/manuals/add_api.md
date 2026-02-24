# Adding or Changing an API Endpoint

This document covers what to change when the server team adds a new endpoint, or
when the API base URL changes (e.g., a new API Gateway deployment). It also covers
the full deployment checklist for pushing to production via the existing
GitHub ↔ Netlify integration.

---

## Background

All authenticated API calls go through `src/services/authService.js::apiFetch()`.
It prepends `VUE_APP_API_BASE_URL` to relative paths and attaches a Cognito Bearer
token to every request, refreshing silently on 401.

```
Browser → apiFetch('/api/sessions/ncf?bucket=fomomon')
        → fetch('https://<VUE_APP_API_BASE_URL>/api/sessions/ncf?bucket=fomomon',
                { Authorization: 'Bearer <idToken>' })
```

The base URL is the only moving part. The Cognito token machinery is independent
of it.

---

## Adding a call to a new endpoint

Say the server team adds `GET /api/photos/{org}?bucket=fomomon`.

### 1. Call it via `apiFetch`

```javascript
import { apiFetch } from '../services/authService';

const response = await apiFetch(`/api/photos/${org}?bucket=fomomon`);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const photos = await response.json();
```

No other changes to `authService.js` are needed. Token attachment and retry are
handled automatically.

### 2. Test the endpoint before wiring it to the UI

Run the existing integration test to confirm the current sessions endpoint is
still healthy after any server-side changes:

```bash
cd web/app/tests/integration
# Fill in real credentials first:
#   TEST_USERNAME=srini   (Cognito username, lowercase)
#   TEST_PASSWORD=...
vi test-credentials.env
./test_sessions.sh
```

Write a similar script for the new endpoint before shipping the UI change. The
pattern in `test_sessions.sh` (fetch auth config → authenticate → call endpoint
→ diff against fixture) is the template.

---

## Changing the API base URL

Example: the API Gateway is redeployed and the new URL is
`https://foo.execute-api.ap-south-1.amazonaws.com/prod`.

### Local development

Edit `web/app/.env.local` (this file is git-ignored via `.env.*` in `.gitignore`
and must never be committed):

```
VUE_APP_API_BASE_URL=https://foo.execute-api.ap-south-1.amazonaws.com/prod
```

Restart the dev server after editing — Vue CLI only reads env files at startup:

```bash
npm run serve
```

Verify with the integration test before touching the UI.

### Production (Netlify)

Netlify injects `VUE_APP_*` variables at build time (`npm run build`). Set or
update the variable in the Netlify dashboard:

```
Site → Site configuration → Environment variables → Add / edit variable

Key:   VUE_APP_API_BASE_URL
Value: https://foo.execute-api.ap-south-1.amazonaws.com/prod
```

After saving, trigger a redeploy (push a commit, or manually in
Deploys → Trigger deploy → Deploy site). Netlify rebuilds and the new URL is
baked into the bundle.

### Other `VUE_APP_*` variables currently in use

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `VUE_APP_API_BASE_URL` | `.env.local` + Netlify dashboard | API Gateway base URL |

TODO: Cognito config (`userPoolId`, `clientId`) is fetched at runtime from
`https://fomomon.s3.ap-south-1.amazonaws.com/auth_config.json` — it is currently 
**not** an env var and does not need to be set anywhere. If that S3 object ever 
changes (e.g., the User Pool is recreated), update the JSON file in S3 and no code
changes are required.

---

## Production deployment checklist

Before pushing a branch that changes API integration:

1. **Run the integration test locally** against the target API URL:
   ```bash
   # Set VUE_APP_API_BASE_URL in .env.local to the new URL first
   cd web/app/tests/integration && ./test_sessions.sh
   ```

2. **Confirm `VUE_APP_API_BASE_URL` is set in the Netlify dashboard** to the
   same URL you just tested.

3. **Open a PR targeting main** — Netlify auto-deploys
   deploy-preview branches for PRs, and promotes to production on merge.

4. **After deploy**, open the Netlify deploy log and confirm the build succeeded
   with no `VUE_APP_*` warnings. Then log in via the live URL and verify the
   dashboard loads data.

### What Netlify does automatically

The free-tier Netlify setup already configured in this repo:

- Runs `npm run build` in `web/app/` on every push to `main`
- Injects all `VUE_APP_*` env vars from the dashboard into the build
- Serves the `dist/` output as a static site
- Routes all paths to `index.html` (required for Vue Router's HTML5 history mode)

No server-side code runs on Netlify — the app is a fully static SPA. The only
runtime dependencies are the Cognito User Pool (auth) and the API Gateway
(data), both of which are on AWS.
