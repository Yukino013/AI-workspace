<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
  items: string[];
}>();
</script>

<template>
  <section class="placeholder">
    <header class="placeholder-header">
      <h2 class="title">{{ title }}</h2>
      <p class="subtitle">{{ subtitle }}</p>
    </header>

    <el-card shadow="never" class="panel">
      <template #header>
        <span>当前阶段</span>
      </template>
      <el-empty description="页面骨架已就位，后续模块按文档逐步接入。">
        <ul class="items">
          <li v-for="item in items" :key="item">{{ item }}</li>
        </ul>
      </el-empty>
    </el-card>
  </section>
</template>

<style scoped>
.placeholder {
  display: grid;
  gap: 16px;
}

.placeholder-header {
  display: grid;
  gap: 6px;
}

.title {
  margin: 0;
  font-size: 20px;
  line-height: 1.3;
}

.subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.panel {
  border-radius: 8px;
}

.items {
  margin: 0;
  padding-left: 18px;
  text-align: left;
  color: var(--el-text-color-secondary);
}
</style>
