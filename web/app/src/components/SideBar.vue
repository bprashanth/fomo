<!-- SideBar.vue
 *
 * Navigation panel for the DSS (Decision Support System). Rendered globally from
 * App.vue when the user is logged in and not on the Login page. This panel lets
 * users move between sections of the app (Home, Dashboard, etc.). New app sections
 * should be added as routes in src/router/index.js and exposed as nav items here.
 *
 * @props: None. User state comes from the shared store; routing uses vue-router.
 * @emits: None.
 -->
<template>
  <!-- Hamburger button: the three .bar spans animate into an X when .is-open is
       applied (bar-1/bar-3 rotate, bar-2 fades out). See .hamburger-btn.is-open
       in <style> for the transform rules. -->
  <button
    class="hamburger-btn"
    :class="{ 'is-open': isOpen }"
    @click="isOpen = !isOpen"
    aria-label="Toggle menu"
  >
    <span class="bar bar-1"></span>
    <span class="bar bar-2"></span>
    <span class="bar bar-3"></span>
  </button>

  <!-- Click-outside backdrop -->
  <Transition name="fade">
    <div v-if="isOpen" class="sidebar-backdrop" @click="isOpen = false" />
  </Transition>

  <!-- Sidebar panel -->
  <div class="sidebar-panel" :class="{ 'is-open': isOpen }">
    <!-- User section -->
    <div class="sidebar-user">
      <div class="user-avatar">{{ initial }}</div>
      <div class="user-meta">
        <span class="user-name">{{ user.username }}</span>
        <span class="user-org">{{ user.org || 'Guest' }}</span>
      </div>
    </div>

    <div class="sidebar-divider" />

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <button
        class="nav-item"
        :class="{ 'nav-item--active': route.path === '/dashboard' }"
        @click="goToPage('/dashboard')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        Dashboard
      </button>
      <!-- Home button: currently only works for guest users. Even though the path changes, the router guard in src/router/index.js redirects logged-in org users from Home to Dashboard. -->
      <button
        class="nav-item"
        :class="{ 'nav-item--active': route.path === '/' }"
        @click="goToPage('/')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Home
      </button>
    </nav>

    <div class="sidebar-spacer" />

    <!-- Footer -->
    <div class="sidebar-footer">
      <button class="logout-btn" @click="handleLogout">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign Out
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { store } from '../store';
import { logout } from '../services/authService';

const router = useRouter();
const route = useRoute();

const isOpen = ref(false);

const user = computed(() => store.user || { username: '', org: null });
const initial = computed(() => (user.value.username || '?').charAt(0).toUpperCase());

/**
 * Navigate to a route and close the sidebar. Uses Vue Router's push() so the
 * URL and view update. Note: the router guard in src/router/index.js redirects
 * logged-in org users from Home to Dashboard.
 */
function goToPage(path) {
  isOpen.value = false;
  router.push(path);
}

function handleLogout() {
  isOpen.value = false;
  logout();
  store.setUser(null);
  store.setJoinedData(null);
  router.push('/login');
}
</script>

<style scoped>
/* Hamburger button */
.hamburger-btn {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 1100;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: rgba(12, 38, 52, 0.55);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  padding: 0;
  transition: background 0.2s;
}

.hamburger-btn:hover {
  background: rgba(12, 38, 52, 0.85);
}

.bar {
  display: block;
  width: 18px;
  height: 2px;
  background: #94BAB6;
  border-radius: 2px;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.hamburger-btn.is-open .bar-1 { transform: translateY(7px) rotate(45deg); }
.hamburger-btn.is-open .bar-2 { opacity: 0; transform: scaleX(0); }
.hamburger-btn.is-open .bar-3 { transform: translateY(-7px) rotate(-45deg); }

/* Backdrop */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  z-index: 1050;
}

/* Sidebar panel */
.sidebar-panel {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 256px;
  z-index: 1060;
  background: rgba(10, 35, 50, 0.92);
  backdrop-filter: blur(24px);
  border-right: 1px solid rgba(148, 186, 182, 0.18);
  display: flex;
  flex-direction: column;
  padding: 1.25rem 0.875rem;
  box-sizing: border-box;
  transform: translateX(-100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-panel.is-open {
  transform: translateX(0);
}

/* User section */
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 0.5rem 1rem;  /* 3rem top clears the hamburger button */
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(148, 186, 182, 0.2);
  border: 1px solid rgba(148, 186, 182, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  color: #94BAB6;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(232, 244, 245, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-org {
  font-size: 0.7rem;
  color: rgba(148, 186, 182, 0.65);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 2px;
}

/* Divider */
.sidebar-divider {
  height: 1px;
  background: rgba(148, 186, 182, 0.14);
  margin: 0 0 0.75rem;
}

/* Nav */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: rgba(232, 244, 245, 0.65);
  font-size: 0.875rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: rgba(148, 186, 182, 0.12);
  color: rgba(232, 244, 245, 0.92);
}

.nav-item--active {
  background: rgba(30, 98, 140, 0.3);
  color: #94BAB6;
}

.nav-item svg {
  flex-shrink: 0;
  opacity: 0.75;
}

/* Spacer + footer */
.sidebar-spacer {
  flex: 1;
}

.sidebar-footer {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 186, 182, 0.12);
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(148, 186, 182, 0.18);
  border-radius: 7px;
  background: transparent;
  color: rgba(232, 244, 245, 0.5);
  font-size: 0.875rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.logout-btn:hover {
  background: rgba(200, 70, 70, 0.12);
  border-color: rgba(200, 100, 100, 0.35);
  color: rgba(255, 170, 170, 0.9);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
