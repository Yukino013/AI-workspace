import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import type { User } from '@/types';

const TOKEN_KEY = 'ai-workbench.token';
const USER_KEY = 'ai-workbench.user';

function readUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = shallowRef(localStorage.getItem(TOKEN_KEY) || '');
  const user = shallowRef<User | null>(readUser());

  const isLoggedIn = computed(() => !!token.value);

  function setAuth(t: string, u: User) {
    token.value = t;
    user.value = u;
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }

  function updateUser(u: User) {
    user.value = u;
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return { token, user, isLoggedIn, setAuth, updateUser, logout };
});
