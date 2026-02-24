# Auth & Data Loading Flow Design

## Background

The web app currently authenticates via Google OAuth with an email domain whitelist
(`*@ncf-india.org`, `*@tech4goodcommunity.com`). Once logged in, org users must
manually click a "FOMO data" chip to load data from a public, unauthenticated S3
URL. This is a two-step kludge: auth and data loading are decoupled.

The good-shepherd server (`/api/sessions/{org}`) now provides an authenticated
endpoint that:

1. Requires a valid Cognito ID token (same pool as the Flutter mobile app)
2. Returns the full sessions array (same format as the current `db.json`)
3. Generates presigned S3 image URLs server-side -> clients never need direct S3 access

This document designs the replacement: a unified login -> data -> dashboard flow
that is consistent with the Flutter app.

---

## Login Page

### UI

Replace the current Google OAuth button with a form that mirrors the Flutter
`login_screen.dart`:

```
|------------------------------|
|  [org dropdown]              |  ncf / t4gc / testorg / ...
|  [name field]  (prefilled)   |  e.g. "Srini" for ncf
|  [password]  [show/hide]     |
|                              |
|  [  Sign In  ]               |  primary CTA -> Cognito auth
|  [Continue as Guest]         |  secondary -> skip auth, go to Home
|                              |
|  |- error box (if any) -|    |  invalidCredentials / networkError /
|  | ...                  |    |  configFetchFailed / unknown
|  |----------------------|    |
|------------------------------|
```

### Org selection

A static map (matching Flutter's `AppConfig.organizationData`) drives the dropdown
and pre-fills the name field:

```javascript
const ORG_DATA = {
  ncf:      { name: 'Srini',     email: 'srini@ncf-india.org' },
  t4gc:     { name: 'Prashanth', email: 'prashanth@tech4goodcommunity.com' },
  testorg:  { name: 'asimov',    email: 'hari@foundation' },
};
```

The name field is editable (Cognito username = name, not email). The email is
stored in the user object after login for display purposes only.

### Guest flow

"Continue as Guest" bypasses Cognito entirely. No token, no org. The user lands
on the Home page (excel upload flow) — same experience as today for all users.

---

## Authentication Flow

### Cognito library

Use `amazon-cognito-identity-js` (same SDK described in the server docs). It is
the lightest path and is what the server's cross-app auth document covers.

### Login sequence

```
LoginView
  |
  |-- onMounted → fetch auth_config.json (public S3)
  |     → extract userPoolId, clientId, region
  |     → construct CognitoUserPool
  |
  |-- handleSubmit(org, username, password)
  |     → new CognitoUser({ Username: username, Pool })
  |     → authenticateUser(AuthenticationDetails{ Username, Password })
  |           onSuccess(session)
  |             → idToken  = session.getIdToken().getJwtToken()
  |             → store.setUser({ username, org, idToken, cognitoUser })
  |             → loadOrgData(org, idToken)   ← see Data Loading below
  |           onFailure(err)
  |             → map err.code to error type, display in error box
  |
  |- handleGuest()
        → store.setUser({ username: 'guest', org: null })
        → router.push('/')
```

### Token storage

The `store.js` reactive store gains:

```javascript
store = reactive({
  user: ...,          // { username, org, idToken, cognitoUser }
  setUser(user) { ... },
  clearUser() { ... },
})
```

`cognitoUser` is the live `CognitoUser` object (not JSON-serializable). It is held
in memory only. `idToken` and `username`/`org` persist in `localStorage` (via the
existing `setUser` serialization) so the session survives page refresh.

On page refresh, the Cognito SDK auto-refreshes from its own `localStorage` keys
(`CognitoIdentityServiceProvider.*`). A session-restore check on `App.vue` mount
calls `cognitoUser.getSession()` to silently obtain a fresh token if the stored
one has expired (tokens last 1 hour, refresh tokens last 30 days).

### 401 retry

A thin wrapper around `fetch` — used for all API calls — catches 401 responses,
calls `cognitoUser.getSession()` to silently refresh the token, updates
`store.user.idToken`, and retries the request once. If the refresh also fails
(e.g., 30-day refresh token expired), the user is redirected to `/login`.

---

## Data Loading for Org Users

### After login

Immediately after a successful Cognito auth (before navigating away from login):

```
loadOrgData(org, idToken)
  |
  |-- GET /api/sessions/{org}?bucket=fomomon
  |     Authorization: Bearer {idToken}
  |
  |-- on success → store joinedData
  |- router.push('/dashboard')
```

This replaces the current manual "FOMO data" chip click and the public S3 fetch.
The response format is identical to the existing `db.json` (array of session
objects) — the Dashboard receives `joinedData` exactly as it does today.

### Org → API path mapping

| Org      | API path                           |
|----------|------------------------------------|
| `ncf`    | `/api/sessions/ncf?bucket=fomomon` |
| `t4gc`   | `/api/sessions/t4gc?bucket=fomomon`|
| `testorg`| `/api/sessions/testorg?bucket=fomomon`|

The bucket is always `fomomon` for now. If a future org uses a different bucket,
the `ORG_DATA` map can carry a `bucket` field.

### Loading state

The login button shows a spinner / "Loading data…" message while the sessions
fetch is in progress. Errors surface in the same error box as auth errors.

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/LoginView.vue` | Replace Google OAuth with Cognito org/name/password form |
| `src/store.js` | Add `idToken`, `org`, `cognitoUser`; add `clearUser()`; add session-restore helper |
| `src/App.vue` | Remove `orgDataSources` lookup and chip UI; remove S3 fetch; add session-restore call on mount |
| `src/services/authService.js` | New file: wraps `amazon-cognito-identity-js`; exposes `login`, `getSession`, `logout`; implements 401 retry `apiFetch` |

---

## UX (deferred)

UX refinements (transition animations, error copy, loading skeletons, dashboard
layout for guest vs org) are a follow-on discussion once the functional flow is
in place.

---

## Test Script Improvements

The current `tests/integration/test_sessions.sh` validates the happy path only.
Once the auth flow is implemented, the following cases should be added:

### 1. Token refresh

```bash
# Expire the ID token artificially (or wait) then retry the API call.
# The retry wrapper should obtain a new token and succeed without user action.
# Verifiable by running with a deliberately short-lived token (not easy with curl —
# consider a small Node/Python helper that uses the Cognito SDK for this test).
```

### 2. 401 on bad token

Add a sub-test that calls the sessions endpoint with a malformed / expired ID
token and asserts `HTTP 401`:

```bash
echo "==> Testing 401 on bad token"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer BADTOKEN" \
  "$SESSIONS_URL")
[[ "$HTTP_CODE" == "401" ]] || fail "Expected 401 for bad token, got $HTTP_CODE"
pass "Endpoint correctly rejects bad token with 401"
```

### 3. Wrong credentials

Assert that Cognito returns a non-200 (specifically `NotAuthorizedException`) when
password is wrong:

```bash
echo "==> Testing Cognito rejects bad password"
BAD_BODY=$(jq -n --arg cid "$CLIENT_ID" \
  '{AuthFlow:"USER_PASSWORD_AUTH",ClientId:$cid,
    AuthParameters:{USERNAME:"srini",PASSWORD:"wrongpassword"}}')
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$COGNITO_ENDPOINT" \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" \
  -d "$BAD_BODY")
[[ "$CODE" == "400" ]] || fail "Expected 400 (NotAuthorizedException), got $CODE"
pass "Cognito correctly rejects bad credentials"
```

### 4. Missing org data

Assert a 4xx when requesting a non-existent org:

```bash
echo "==> Testing missing org"
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ID_TOKEN" \
  "${APIGW_URL}/api/sessions/nonexistentorg?bucket=fomomon")
[[ "$CODE" =~ ^4 ]] || fail "Expected 4xx for unknown org, got $CODE"
pass "Endpoint returns 4xx for unknown org"
```

### 5. Session count regression

The current count comparison catches additions/deletions but not field-level drift.
Consider a stricter per-session comparison that flags unexpected keys appearing in
the API response (new fields added to session JSON that are not yet in the fixture).
