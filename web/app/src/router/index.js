import { createRouter, createWebHistory } from 'vue-router';
import DashboardComponent from '../components/DashboardComponent.vue';
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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
