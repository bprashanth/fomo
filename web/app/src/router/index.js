import { createRouter, createWebHistory } from 'vue-router';
import DashboardComponent from '../components/DashboardComponent.vue';
import LoginView from '../components/LoginView.vue';
import App from '../App.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: App
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardComponent,
    props: true
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const user = JSON.parse(localStorage.getItem('user'));

  // Old Google auth objects have no 'org' field — treat as logged out so the
  // stale entry doesn't bypass the Cognito login form.
  const isValidUser = user && ('org' in user);

  if (!isValidUser) {
    // Clear any stale user data
    localStorage.removeItem('user');
    if (to.name !== 'Login') {
      next({ name: 'Login', query: { redirect: to.fullPath } });
    } else {
      next();
    }
  } else if (isValidUser && user.org !== null && to.name === 'Home') {
    // Org user landing on Home → go to Dashboard
    next({ name: 'Dashboard' });
  } else {
    next();
  }
})

export default router;
