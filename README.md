# fomo

A Vue 3 web dashboard for analyzing wildlife and environmental survey data collected by the [fomomon](../fomomon) Flutter app. Field teams capture sessions with GPS coordinates, images, and survey responses; this app authenticates against the same Cognito pool, fetches sessions from the API server, and provides a four-panel analysis dashboard with maps, image timelines, SQL queries, and charts.

```console
cd web/app
npm install
npm run serve     # dev server on :8081
npm run build     # production bundle → dist/
npm test          # vitest unit tests
```

---

## What it does

1. **Login** — Org users authenticate with username and password via the same Cognito User Pool as the Flutter app. On success, sessions are fetched from `/api/sessions/{org}?bucket=fomomon` and the user is dropped directly into the dashboard.
2. **Dashboard** — A four-panel layout for querying and visualising the loaded sessions. SQL queries (AlasQL) run client-side against the session array; results route to one or all panels.
3. **Home / Excel upload** — Guest users and developers can upload an Excel file, join its tabs via a schema editor, and explore the joined data on a map. Also used for ad-hoc data that doesn't come through the API.

---

## Related infrastructure

This app is one part of a broader system. All three components share the same Cognito user pool and S3 bucket structure.

| Component | Repo | Local path |
|-----------|------|------------|
| Web dashboard (this) | `bprashanth/cc` (subfolder `fomo/`) | `~/src/github.com/bprashanth/cc/fomo` |
| Flutter field app | `bprashanth/fomomon` | `~/src/github.com/bprashanth/fomomon/fomomon` |
| Serverless Lambda API | `bprashanth/good-shepherd` | `~/src/github.com/bprashanth/good-shepherd/server` |
| Admin / user management | `bprashanth/fomomon` | `~/src/github.com/bprashanth/fomomon/admin` |

### Data flow

```
Flutter app (field)
  |--> S3: fomomon/{org}/sessions/*.json   (one JSON per session)
        |--> Lambda API: GET /api/sessions/{org}
              - lists + downloads session JSONs
              - strips survey responses
              - presigns image URLs (7-day expiry)
              |--> this web app: dashboard
```

Auth config (`userPoolId`, `clientId`, `identityPoolId`) is fetched at runtime
from `https://fomomon.s3.ap-south-1.amazonaws.com/auth_config.json` — shared by
all three components, no code changes needed if the pool changes.

---

## App structure

### Routes

| Path | Name | Component | Who sees it |
|------|------|-----------|-------------|
| `/login` | Login | `LoginView.vue` | Everyone (unauthenticated redirect) |
| `/dashboard` | Dashboard | `DashboardComponent.vue` | Org users (auto-redirected here on login) |
| `/` | Home | `App.vue` | Guest users, developers with Excel files |

The router guard (`src/router/index.js`) redirects unauthenticated users to
`/login` and org users away from `/` to `/dashboard`.

### Key components

| Component | Purpose |
|-----------|---------|
| `LoginView.vue` | Org select + username/password form; Cognito auth + sessions fetch; spinner states |
| `SideBar.vue` | Fixed hamburger menu; nav links, user info, sign-out |
| `DashboardComponent.vue` | Four-panel layout; routes query results between panels |
| `SchemaPanel.vue` | SQL query editor (AlasQL); central query engine for the dashboard |
| `MapComponent.vue` | Leaflet map with session point markers |
| `ImagePanel.vue` | Image gallery / timelapse viewer from query results |
| `SurveyResultPanel.vue` | Chart.js graphs from query results |
| `DataViewer.vue` | Side panel shown on all pages; insights tab hosts query templates |
| `QueryTemplatePanel.vue` | List of canned + user-saved SQL templates |
| `App.vue` | Shell layout + Home page (Excel upload workflow) |
| `FileUpload.vue` | Excel parser; emits tab/column structure |
| `SchemaEditor.vue` | Join configuration for multi-tab Excel files |
| `JsonViewer.vue` | Computes and displays joined data; emits result |
| `WriterMapComponent.vue` | Map view for joined Excel data (Home page) |

### Services

| Service | Purpose |
|---------|---------|
| `src/services/authService.js` | Cognito init, login, token refresh, `apiFetch` (auth header + 401 retry), logout |
| `src/services/queryTemplateService.js` | Default SQL templates, placeholder enums, user-saved template CRUD (localStorage) |
| `src/store.js` | Reactive singleton: `user` (persisted to localStorage), `joinedData` (in-memory) |

---

## Navigation flow

```
/login
  |-- [org login] --> fetch /api/sessions/{org} --> store.joinedData --> /dashboard
  |-- [guest]     --> /  (Home / Excel upload)

/dashboard
  |-- DataViewer (Ctrl+L) --> QueryTemplatePanel --> SchemaPanel --> all panels

/ (Home)
  |-- FileUpload --> TabComponent --> SchemaEditor --> JsonViewer / WriterMapComponent
                                                   |--> DataViewer --> /dashboard
```

---

## Key design notes

- **Single fetch on login** — sessions are loaded once at login and held in `store.joinedData`. No polling, no re-fetch on navigation.
- **Client-side SQL** — AlasQL runs entirely in the browser against the in-memory sessions array. No query round-trips to the server.
- **Shared auth** — The same Cognito User Pool (`ap-south-1_28HVATwK2`) is used by this app and the Flutter app. Usernames are lowercase; the `USER_PASSWORD_AUTH` flow is used (not SRP).
- **Presigned image URLs** — The Lambda generates 7-day presigned S3 URLs server-side. The browser never holds direct S3 credentials.
- **Guest mode** — `Continue as Guest` sets `store.user = { username: 'guest', org: null }` and lands on the Home page. No API calls are made.

---

## Docs index

### Architecture

| Doc | What it covers |
|-----|---------------|
| [`docs/layout.md`](docs/layout.md) | Overall panel layout and component hierarchy |
| [`docs/architecture.md`](docs/architecture.md) | Query template dispatch system; how SQL results flow between panels |
| [`docs/event_processing.md`](docs/event_processing.md) | Event flow inside `DashboardComponent` for direct queries vs. template queries |
| [`docs/data_upload.md`](docs/data_upload.md) | Legacy Excel + image upload workflow (pre-API path; still used for ad-hoc data) |
| [`docs/design/auth_data_flow.md`](docs/design/auth_data_flow.md) | Design doc for the Cognito login → sessions fetch → dashboard flow |

### Manuals (how-to for agents and developers)

| Doc | What it covers |
|-----|---------------|
| [`docs/manuals/add_page.md`](docs/manuals/add_page.md) | Adding a new page/route; wiring it into the sidebar; post-login redirect logic |
| [`docs/manuals/add_api.md`](docs/manuals/add_api.md) | Calling a new API endpoint; changing the base URL; integration test workflow |
| [`docs/manuals/add_user.md`](docs/manuals/add_user.md) | Adding users/orgs via the admin interface; how session data appears for a new org |
| [`docs/manuals/deploy.md`](docs/manuals/deploy.md) | Env var split across local/prod; `.env.local` vs `.env.production`; Netlify checklist |
