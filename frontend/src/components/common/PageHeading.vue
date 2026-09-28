<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; description: string }>();
</script>
<template>
  <header class="page-heading">
    <div class="heading-copy">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="heading-actions"><slot /></div>
  </header>
</template>
<style scoped>
.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin: 8px 0 34px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--app-muted);
  font-weight: 500;
}
h1 {
  font-size: clamp(26px, 2.5vw, 34px);
  line-height: 1.35;
  letter-spacing: -1.2px;
  font-weight: 550;
  margin: 12px 0;
}
p {
  font-size: 14px;
  color: var(--app-muted);
  margin: 0;
  line-height: 1.8;
}
.heading-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  padding-bottom: 4px;
}
@media (max-width: 760px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
  }
  h1 {
    letter-spacing: -0.7px;
  }
  .heading-actions {
    flex-wrap: wrap;
    max-width: 100%;
  }
}
</style>
