import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/Home.vue') },
    { path: '/play/:gameId', name: 'play', component: () => import('@/views/Play.vue') },
    { path: '/result', name: 'result', component: () => import('@/views/Result.vue') },
    { path: '/profile', name: 'profile', component: () => import('@/views/Profile.vue') },
    { path: '/challenge', name: 'challenge', component: () => import('@/views/Challenge.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
