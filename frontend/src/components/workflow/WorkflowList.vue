<script setup lang="ts">
import type { Workflow } from '@/types';
import AppIcon from '@/components/common/AppIcon.vue';

defineProps<{
  workflows: Workflow[];
  loading: boolean;
}>();

const emit = defineEmits<{
  create: [];
  open: [workflow: Workflow];
  copy: [workflow: Workflow];
  remove: [workflow: Workflow];
}>();
</script>

<template>
  <section class="workflow-library" aria-labelledby="workflow-heading">
    <header class="library-heading">
      <div>
        <p class="eyebrow">REUSABLE AI FLOWS</p>
        <h1 id="workflow-heading">工作流</h1>
        <p class="intro">把常用的 Prompt 按顺序串起来，让重复任务一键完成。</p>
      </div>
      <button class="primary-button" type="button" @click="emit('create')">
        <AppIcon name="plus" :size="17" />
        新建工作流
      </button>
    </header>

    <div v-if="loading" class="empty-state" role="status">正在读取工作流…</div>
    <div v-else-if="!workflows.length" class="empty-state">
      <div class="empty-mark"><AppIcon name="workflow" :size="24" /></div>
      <h2>从一个重复任务开始</h2>
      <p>选择 Prompt 和模型，逐步传递结果，保存后即可再次运行。</p>
      <button class="primary-button" type="button" @click="emit('create')">创建第一个工作流</button>
    </div>
    <ul v-else class="workflow-grid">
      <li v-for="workflow in workflows" :key="workflow.id">
        <article class="workflow-card">
          <button class="card-main" type="button" @click="emit('open', workflow)">
            <span class="card-icon"><AppIcon name="workflow" :size="20" /></span>
            <span class="card-copy">
              <strong>{{ workflow.name }}</strong>
              <span>{{ workflow.description || '暂无说明' }}</span>
            </span>
            <span class="card-count">{{ workflow.steps.length }} 步</span>
          </button>
          <footer>
            <span>v{{ workflow.version }} · 更新于 {{ new Date(workflow.updatedAt).toLocaleDateString() }}</span>
            <button
              class="quiet-button"
              type="button"
              :aria-label="`复制工作流 ${workflow.name}`"
              @click="emit('copy', workflow)"
            >
              <AppIcon name="copy" :size="16" />
            </button>
            <button
              class="quiet-button"
              type="button"
              :aria-label="`删除工作流 ${workflow.name}`"
              @click="emit('remove', workflow)"
            >
              <AppIcon name="trash" :size="16" />
            </button>
          </footer>
        </article>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.workflow-library { max-width: 1120px; margin: 0 auto; padding: clamp(24px, 4vw, 56px); color: var(--app-text); }
.library-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 34px; }
.eyebrow { margin: 0 0 10px; color: var(--el-color-primary); font-size: 11px; font-weight: 700; letter-spacing: 1.4px; }
h1 { margin: 0; font-size: clamp(28px, 4vw, 38px); letter-spacing: -1.2px; }
.intro { margin: 10px 0 0; color: var(--app-muted); line-height: 1.6; }
.primary-button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--el-color-primary); color: white; font: inherit; font-weight: 600; cursor: pointer; transition: filter .18s ease; }
.primary-button:hover { filter: brightness(1.08); }
.primary-button:focus-visible, .quiet-button:focus-visible, .card-main:focus-visible { outline: 3px solid var(--el-color-primary-light-5); outline-offset: 2px; }
.workflow-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
.workflow-card { min-height: 178px; padding: 18px; border: 1px solid var(--el-border-color); border-radius: 16px; background: var(--app-card, var(--app-bg)); box-shadow: var(--app-shadow); }
.card-main { display: flex; width: 100%; align-items: flex-start; gap: 12px; padding: 0; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; }
.card-icon, .empty-mark { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; border-radius: 12px; background: var(--app-hover); color: var(--el-color-primary); }
.card-copy { display: grid; min-width: 0; gap: 7px; flex: 1; }
.card-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; }
.card-copy > span { display: -webkit-box; overflow: hidden; color: var(--app-muted); font-size: 13px; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.card-count { padding: 4px 8px; border-radius: 20px; background: var(--app-hover); color: var(--app-muted); font-size: 11px; white-space: nowrap; }
.workflow-card footer { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 34px; padding-top: 12px; border-top: 1px solid var(--el-border-color); color: var(--app-muted); font-size: 11px; }
.workflow-card footer > span { margin-right: auto; }
.quiet-button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 9px; background: transparent; color: var(--app-muted); cursor: pointer; }
.quiet-button:hover { background: var(--app-hover); color: var(--el-color-danger); }
.empty-state { display: grid; min-height: 300px; justify-items: center; align-content: center; padding: 28px; border: 1px dashed var(--el-border-color); border-radius: 18px; text-align: center; }
.empty-state h2 { margin: 18px 0 0; font-size: 20px; }
.empty-state p { max-width: 440px; margin: 8px 0 20px; color: var(--app-muted); line-height: 1.6; }
@media (max-width: 600px) { .workflow-library { padding: 24px 16px; } .library-heading { align-items: flex-start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { .primary-button { transition: none; } }
</style>
