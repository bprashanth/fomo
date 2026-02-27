# Deployment & Environment Variables

## How env vars work

`.env.local` is for local development but the same `VUE_APP_` variables are set manually in the netlify console for production. Hence these two should be largely in sync. While different values can be inserted into `.env.local` for local testing, it shouldn't be comitted to git. 

---

## Current variables

| Variable | Local (`.env.local`) | Prod (`.env.production`) | Same value? |
|----------|----------------------|--------------------------|-------------|
| `VUE_APP_API_BASE_URL` | `https://foo.execute-api.ap-south-1.amazonaws.com/prod` | same | Yes |

**Cognito config** (`userPoolId`, `clientId`) is **not** an env var. It is
fetched at runtime from `https://fomomon.s3.ap-south-1.amazonaws.com/auth_config.json`
by `authService.initCognito()`. No env var needed; updating the S3 JSON is
sufficient if the pool ever changes.

---

## Adding a new variable

### Same value in local and prod (most common)

1. Add to `.env.local` with the same value (so `npm run serve` picks it up):
   ```
   VUE_APP_FOO=https://example.com
   ```
2. Add to the Netlify dashboard (overrides the build-time file in production):
   ```
   Project configuration -> Environment variables
   Just copy paste the key/values in .env.local
   ```
4. Use it in code:
   ```javascript
   process.env.VUE_APP_FOO
   ```
   Only `VUE_APP_*` prefixed vars are exposed to the browser bundle.

