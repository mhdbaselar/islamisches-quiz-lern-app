import { createRouter, createWebHistory } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/einstellungen',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/quiz',
      name: 'quiz-home',
      component: () => import('../views/quiz/QuizHomeView.vue'),
    },
    {
      path: '/quiz/spielen',
      name: 'quiz-practice',
      component: () => import('../views/quiz/QuizPracticeView.vue'),
    },
    {
      path: '/quiz/verwalten',
      name: 'quiz-manage',
      component: () => import('../views/quiz/QuizManageView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/quiz/statistik',
      name: 'quiz-stats',
      component: () => import('../views/quiz/QuizStatsView.vue'),
    },
    {
      path: '/gebetszeiten',
      name: 'gebetszeiten',
      component: () => import('../views/GebetszeitenView.vue'),
    },
    {
      path: '/quran',
      name: 'quran',
      component: () => import('../views/quiz/QuranView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta?.requiresAdmin) {
    const admin = useAdminStore()
    admin.init()
    if (!admin.isAdmin) {
      admin.setPendingRoute(to.fullPath)
      return { name: 'settings', query: { admin: '1' } }
    }
  }
  return true
})

export default router
