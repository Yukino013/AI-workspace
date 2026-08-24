import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      redirect: '/prompts',
    },
    {
      path: '/prompts',
      name: 'prompt-list',
      component: () => import('@/views/PromptList.vue'),
    },
    {
      path: '/prompts/new',
      name: 'prompt-new',
      component: () => import('@/views/PromptWorkspace.vue'),
    },
    {
      path: '/prompts/:id',
      name: 'prompt-edit',
      component: () => import('@/views/PromptWorkspace.vue'),
      props: true,
    },
    {
      path: '/call-records',
      name: 'chat-history',
      component: () => import('@/views/ChatHistory.vue'),
    },
    {
      path: '/providers',
      name: 'provider-settings',
      component: () => import('@/views/ProviderSettings.vue'),
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
    },
    {
      path: '/code-tools',
      name: 'code-tools',
      component: () => import('@/views/CodeToolView.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/Profile.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (!to.meta.public && !auth.token) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.path === '/login' && auth.token) {
    return { path: '/prompts' };
  }
});

export default router;
