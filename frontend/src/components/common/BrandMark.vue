<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 32 });
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
    class="brand-symbol"
    aria-hidden="true"
  >
    <path
      d="M31 5C39 5 40 17 36 26C45 18 56 19 58 26C60 34 48 39 38 37C46 44 45 56 37 58C29 60 25 47 27 38C19 46 8 45 6 37C4 29 16 25 26 27C18 19 22 5 31 5Z"
      fill="currentColor"
    />
    <path
      d="m32 25 7 7-7 7-7-7 7-7Z"
      fill="var(--mark-cutout, var(--app-bg))"
    />
  </svg>
</template>
<style scoped>
.brand-symbol {
  display: block;
  flex-shrink: 0;
}
</style>
