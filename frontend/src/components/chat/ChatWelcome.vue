<script setup lang="ts">
import BrandMark from "@/components/common/BrandMark.vue";
import AppIcon from "@/components/common/AppIcon.vue";
defineProps<{ ready: boolean; busy: boolean }>();
defineEmits<{ create: []; suggest: [text: string] }>();
const suggestions = [
  {
    icon: "code",
    title: "一起读懂代码",
    text: "帮我审查一段代码，重点关注可读性和边界情况。",
  },
  {
    icon: "sparkles",
    title: "梳理一个想法",
    text: "请帮我梳理一个新功能的技术实现方案。",
  },
  {
    icon: "prompt",
    title: "写出更好的 Prompt",
    text: "请帮我设计一个结构清晰、可复用的 Prompt 模板。",
  },
] as const;
</script>
<template>
  <div class="welcome">
    <div class="welcome-mark"><BrandMark :size="58" /></div>
    <span class="welcome-kicker">THINK FURTHER. CREATE BETTER.</span>
    <h1>今天，想探索些什么？</h1>
    <p>从一个问题开始，让思考走得更远。</p>
    <el-button
      v-if="!ready"
      type="primary"
      size="large"
      round
      :loading="busy"
      @click="$emit('create')"
      >开始新对话 <AppIcon name="arrow-up-right" :size="17"
    /></el-button>
    <div v-else class="suggestions">
      <button
        v-for="item in suggestions"
        :key="item.title"
        @click="$emit('suggest', item.text)"
      >
        <AppIcon :name="item.icon" :size="15" />{{ item.title }}
      </button>
    </div>
  </div>
</template>
<style scoped>
.welcome {
  text-align: center;
  padding: 0 16px 28px;
}
.welcome-mark {
  width: 90px;
  height: 90px;
  margin: 0 auto 20px;
  display: grid;
  place-items: center;
  color: var(--el-color-primary);
  background: radial-gradient(circle, var(--app-hero), transparent 70%);
}
.welcome-kicker {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--app-muted);
}
h1 {
  font-size: clamp(25px, 2.8vw, 36px);
  font-weight: 550;
  letter-spacing: -1.2px;
  margin: 15px 0 12px;
}
p {
  font-size: 14px;
  color: var(--app-muted);
  margin: 0 0 26px;
}
.suggestions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.suggestions button {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--app-line);
  border-radius: 20px;
  background: var(--app-bg);
  color: var(--app-muted);
  padding: 10px 13px;
  font-size: 11px;
  transition:
    color 0.2s,
    border-color 0.2s;
}
.suggestions button:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}
@media (max-width: 600px) {
  .welcome {
    padding-inline: 0;
  }
  .welcome-mark {
    margin-bottom: 10px;
  }
  .suggestions button {
    min-height: 44px;
    padding-inline: 10px;
  }
}
</style>
