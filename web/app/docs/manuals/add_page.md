# Adding a New Page

This document explains the end-to-end pattern for adding a new page to the app —
for example, a dedicated `PhotoMon` page that shows timelapse imagery from a
specific data source — including how to wire it into the sidebar and how to
optionally redirect to it automatically after login.

---

## 1. Create the component

Create `src/components/PhotoMonView.vue` (or whatever name fits).

The component receives `data` as a prop if it needs the loaded session array,
following the same convention as `DashboardComponent`:

```vue
<script setup>
const props = defineProps({
  data: { type: Array, default: () => [] },
});
</script>
```

If the page needs Cognito-authenticated API calls use `apiFetch` from
`src/services/authService.js` — it handles token refresh and 401 retries
automatically.

---

## 2. Register the route

Open `src/router/index.js` and add:

```javascript
import PhotoMonView from '../components/PhotoMonView.vue';

const routes = [
  // ... existing routes ...
  {
    path: '/photomon',
    name: 'PhotoMon',
    component: PhotoMonView,
    props: true,   // lets the router pass :data as a prop if needed
  },
];
```

The existing `beforeEach` guard already protects every non-Login route —
unauthenticated users are redirected to `/login` automatically. No extra guard
code is needed unless the page has different auth requirements.

---

## 3. Pass data to the route (if needed)

`App.vue` is the single source of truth for `store.joinedData`. If the new page
needs the session array:

```vue
<!-- App.vue template, alongside the existing Dashboard router-view -->
<router-view
  :data="joinedData"
  v-if="$route.name === 'PhotoMon'"
></router-view>
```

If the page fetches its own data independently (e.g., a different API endpoint),
skip this step and call `apiFetch` directly inside the component.

---

## 4. Add a sidebar link

Open `src/components/SideBar.vue` and add a `<button>` inside `.sidebar-nav`:

```vue
<button
  class="nav-item"
  :class="{ 'nav-item--active': route.path === '/photomon' }"
  @click="goToPage('/photomon')"
>
  <svg ...><!-- icon --></svg>
  PhotoMon
</button>
```

The `goToPage()` helper already closes the drawer and calls `router.push()`.

---

## 5. Conditional post-login redirect

After a successful org login `LoginView.vue` calls `router.push('/dashboard')`.
To redirect to a different page based on data characteristics or the logged-in
user, edit that line in `handleSubmit()`:

```javascript
// Example: send ncf org users to PhotoMon, everyone else to Dashboard
const destination = (org === 'ncf') ? '/photomon' : '/dashboard';
router.push(destination);
```

Or inspect the loaded data:

```javascript
// Example: redirect if any session has image data
const hasImages = data.some(s => s.portraitImageUrl);
router.push(hasImages ? '/photomon' : '/dashboard');
```

The `data` variable at that point is the parsed JSON from
`/api/sessions/{org}?bucket=fomomon`, already stored in `store.joinedData`.

**Key rule**: the redirect decision belongs in `LoginView.handleSubmit()` because
that is the only place where both the authenticated user object and the freshly
loaded data are simultaneously available before any navigation has occurred.
Putting it in the router guard or in a component's `onMounted` leads to race
conditions or repeated fetches.

---

## File checklist

| File | Change |
|------|--------|
| `src/components/PhotoMonView.vue` | New component |
| `src/router/index.js` | Add route entry |
| `src/App.vue` | Add `<router-view>` block if passing `joinedData` |
| `src/components/SideBar.vue` | Add nav-item button |
| `src/components/LoginView.vue` | Change `router.push()` destination if auto-redirect needed |
