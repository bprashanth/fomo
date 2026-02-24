# Managing Users, Orgs, and Passwords

Users are managed entirely server-side via the admin interface in the companion
`fomomon` repository. The frontend has no user-creation or password-management
logic — it only authenticates against the Cognito User Pool that the admin
interface maintains.

---

## Admin interface location

```
~/src/github.com/bprashanth/fomomon/admin
```

This directory contains scripts and configuration for the Cognito User Pool and
related AWS resources. All user lifecycle operations happen here and propagate
automatically to the frontend (no frontend changes needed).

---

## Operations performed via the admin interface

### Adding a new user

Create a new Cognito user in the pool with a username (lowercase), a temporary
password, and an org assignment. The user will be prompted to change their
password on first login unless a permanent password is set at creation time.

After creation:
1. Add the user to the `ORG_DATA` map in `src/components/LoginView.vue` so the
   login form prefills their name:
   ```javascript
   const ORG_DATA = {
     ncf:     { name: 'Srini',     email: 'srini@ncf-india.org' },
     t4gc:    { name: 'Prashanth', email: 'prashanth@tech4goodcommunity.com' },
     testorg: { name: 'asimov',    email: 'hari@foundation' },
     // add new org/user here
   };
   ```
   This is a UX convenience only — the name field is editable, and login still
   works if the prefill is wrong or missing.

### Adding a new org

1. Create the org's Cognito users via the admin interface.
2. Add the org key to `ORG_DATA` in `LoginView.vue` (see above).
3. The `<select>` in the login form picks up from `ORG_DATA` automatically —
   no template changes needed beyond the map entry.

**How session data appears for a new org:**
`GET /api/sessions/{org}?bucket=fomomon` reads every JSON file under
`s3://fomomon/{org}/sessions/` and returns the combined list with responses
stripped and image URLs presigned. There is no admin-side configuration that
controls this — the data appears automatically once the Flutter mobile app
uploads sessions to that S3 prefix. A new org's dashboard will be empty until
field users running the Flutter app under that org have recorded and uploaded at
least one session.

**`sites.json` is separate from sessions:**
`s3://fomomon/{org}/sites.json` is consumed by the `/api/sites/{org}` endpoint
(GPS coordinates, survey config, reference/ghost image URLs). It is not required
for sessions to appear in the dashboard. If the new org needs a pre-configured
sites list, upload `sites.json` to that S3 path directly; the server reads it
on demand.

### Changing a password

Use the admin interface to set a new permanent password for a Cognito user, or
issue a password reset (which sends the user a temporary password by email if
email is configured in the pool).

The frontend `handleSubmit()` in `LoginView.vue` calls
`authService.login(username, password)` which uses `USER_PASSWORD_AUTH` — so
any valid permanent password set via the admin interface will work immediately
without any frontend changes.

---

## What the admin interface does NOT affect on the frontend

| Concern | Lives in |
|---------|----------|
| Which orgs appear in the dropdown | `ORG_DATA` in `LoginView.vue` |
| Which API is called after login | `VUE_APP_API_BASE_URL` in `.env.local` / Netlify |
| Cognito pool / client IDs | `auth_config.json` on S3 (fetched at runtime) |
| Session data schema | Server-side (`fomomon` repo), not the frontend |

The frontend is stateless with respect to users — it reads user identity from
the Cognito token after login and stores only `{ username, org, email }` in
localStorage for routing purposes.
