<template>
  <div class="login-container">
    <div class="blur-overlay">
      <div class="login-box">
        <h2 class="login-title">Sign In</h2>

        <!-- Auth config loading indicator -->
        <div v-if="isInitializing" class="init-status">
          <div class="spinner-sm"></div>
          <span>Connecting...</span>
        </div>

        <div class="form-group">
          <label for="org-select">Organization</label>
          <select id="org-select" v-model="selectedOrg" @change="onOrgChange" :disabled="isLoading">
            <option v-for="(data, key) in ORG_DATA" :key="key" :value="key">
              {{ key }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="username-input">Name</label>
          <input
            id="username-input"
            type="text"
            v-model="username"
            autocomplete="username"
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="password-input">Password</label>
          <div class="password-wrapper">
            <input
              id="password-input"
              :type="showPassword ? 'text' : 'password'"
              v-model="password"
              autocomplete="current-password"
              :disabled="isLoading"
              @keyup.enter="handleSubmit"
            />
            <button
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
              :disabled="isLoading"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>

        <div v-if="errorMessage" class="error-box">
          {{ errorMessage }}
        </div>

        <div class="button-group">
          <button class="btn-primary" @click="handleSubmit" :disabled="isLoading || isInitializing">
            Sign In
          </button>
          <button class="btn-secondary" @click="handleGuest" :disabled="isLoading">
            Continue as Guest
          </button>
        </div>
      </div>
    </div>

    <!-- Full-page loading overlay while signing in + fetching data -->
    <Transition name="fade">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-card">
          <div class="spinner-lg"></div>
          <p class="loading-label">{{ loadingLabel }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '../store';
import * as authService from '../services/authService';

const router = useRouter();

const ORG_DATA = {
  ncf:     { name: 'Srini',     email: 'srini@ncf-india.org' },
  t4gc:    { name: 'Prashanth', email: 'prashanth@tech4goodcommunity.com' },
  testorg: { name: 'asimov',    email: 'hari@foundation' },
};

const ERROR_MESSAGES = {
  invalidCredentials: 'Incorrect username or password.',
  networkError: 'Network error. Please check your connection.',
  configFetchFailed: 'Could not load auth configuration. Please try again.',
  unknown: 'An unexpected error occurred. Please try again.',
};

const selectedOrg = ref('ncf');
const username = ref(ORG_DATA.ncf.name);
const password = ref('');
const showPassword = ref(false);
const isInitializing = ref(true);
const isLoading = ref(false);
const loadingLabel = ref('Signing in...');
const errorMessage = ref('');

onMounted(async () => {
  try {
    await authService.initCognito();
  } catch {
    // Non-fatal: will retry on submit
  } finally {
    isInitializing.value = false;
  }
});

function onOrgChange() {
  username.value = ORG_DATA[selectedOrg.value]?.name || '';
}

async function handleSubmit() {
  errorMessage.value = '';
  isLoading.value = true;
  loadingLabel.value = 'Signing in...';
  const org = selectedOrg.value;

  try {
    await authService.login(username.value, password.value);

    loadingLabel.value = 'Loading your data...';
    const response = await authService.apiFetch(`/api/sessions/${org}?bucket=fomomon`);
    if (!response.ok) throw { type: 'unknown', original: new Error(`HTTP ${response.status}`) };
    const data = await response.json();

    store.setJoinedData(data);
    store.setUser({ username: username.value, org, email: ORG_DATA[org].email });
    router.push('/dashboard');
  } catch (err) {
    const type = err?.type || 'unknown';
    errorMessage.value = ERROR_MESSAGES[type] || ERROR_MESSAGES.unknown;
  } finally {
    isLoading.value = false;
  }
}

function handleGuest() {
  store.setUser({ username: 'guest', org: null });
  router.push('/');
}
</script>

<style scoped>
.login-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  background: url('../assets/fish.webp') no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
}

.blur-overlay {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.2);
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-box {
  position: relative;
  z-index: 2;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 12px;
  padding: 2rem 2.5rem;
  min-width: 320px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-title {
  margin: 0 0 0.25rem;
  color: #1E628C;
  font-size: 1.4rem;
  text-align: center;
}

/* Small "Connecting..." row */
.init-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: rgba(21, 21, 21, 0.45);
  margin-top: -0.5rem;
  justify-content: center;
}

.spinner-sm {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(30, 98, 140, 0.2);
  border-top-color: #1E628C;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-group label {
  font-size: 0.85rem;
  color: rgba(21, 21, 21, 0.7);
  font-weight: 600;
}

.form-group select,
.form-group input[type="text"],
.form-group input[type="password"] {
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(30, 98, 140, 0.3);
  border-radius: 6px;
  font-size: 0.95rem;
  color: #1a1a1a;
  background: rgba(255, 255, 255, 0.9);
  outline: none;
  transition: border-color 0.2s;
}

.form-group select:focus,
.form-group input:focus {
  border-color: #1E628C;
}

.form-group select:disabled,
.form-group input:disabled {
  opacity: 0.6;
}

.password-wrapper {
  display: flex;
  gap: 0.5rem;
}

.password-wrapper input {
  flex: 1;
}

.toggle-password {
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(30, 98, 140, 0.3);
  border-radius: 6px;
  background: transparent;
  color: #1E628C;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}

.toggle-password:hover:not(:disabled) {
  background: rgba(30, 98, 140, 0.08);
}

.error-box {
  background: rgba(200, 50, 50, 0.1);
  border: 1px solid rgba(200, 50, 50, 0.4);
  color: #b33;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.btn-primary {
  padding: 0.7rem 1.5rem;
  background: linear-gradient(135deg, #1E628C 0%, #3388ff 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #3388ff 0%, #1E628C 100%);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 0.6rem 1.5rem;
  background: transparent;
  color: #1E628C;
  border: 1px solid rgba(30, 98, 140, 0.4);
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(30, 98, 140, 0.08);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Full-page overlay during sign-in */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(12, 38, 52, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.spinner-lg {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(148, 186, 182, 0.25);
  border-top-color: #94BAB6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-label {
  color: rgba(232, 244, 245, 0.9);
  font-size: 1rem;
  margin: 0;
  letter-spacing: 0.02em;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
