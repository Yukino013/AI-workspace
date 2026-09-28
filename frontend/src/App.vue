<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/composables/useTheme";
import AppShell from "@/components/layout/AppShell.vue";
const auth = useAuthStore();
useTheme().initialize();
</script>

<template>
  <AppShell v-if="auth.token"><router-view /></AppShell>
  <router-view v-else />
</template>
