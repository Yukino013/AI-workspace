<script setup lang="ts">
import BrandMark from "@/components/common/BrandMark.vue";
import AppIcon from "@/components/common/AppIcon.vue";
const entries = [
  {
    to: "/prompts/new",
    icon: "prompt",
    title: "把灵感写成 Prompt",
    text: "从一个想法，到可复用的工作流",
    label: "CREATE",
  },
  {
    to: "/chat",
    icon: "chat",
    title: "与 AI 一起探索",
    text: "理清思路，让复杂的问题变简单",
    label: "EXPLORE",
  },
  {
    to: "/code-tools",
    icon: "code",
    title: "专注更好的代码",
    text: "解释、重构、审查，少一点重复",
    label: "BUILD",
  },
] as const;
</script>
<template>
  <section class="library-hero">
    <div class="hero-kicker">
      <BrandMark :size="22" /><span>A SPACE FOR YOUR NEXT IDEA</span>
    </div>
    <h1>让想法，<span>开始发生。</span></h1>
    <p>连接模型，沉淀灵感。把每一次探索，变成下一次创作的起点。</p>
    <div class="entry-grid">
      <router-link
        v-for="entry in entries"
        :key="entry.to"
        :to="entry.to"
        class="entry-card"
      >
        <div class="entry-top">
          <AppIcon :name="entry.icon" :size="23" /><span>{{ entry.label }}</span
          ><AppIcon name="arrow-up-right" :size="18" class="entry-arrow" />
        </div>
        <h2>{{ entry.title }}</h2>
        <p>{{ entry.text }}</p>
      </router-link>
    </div>
  </section>
</template>
<style scoped>
.library-hero {
  padding: 24px 0 46px;
}
.hero-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-color-primary);
}
.hero-kicker span {
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 550;
  letter-spacing: 2px;
}
h1 {
  font-size: clamp(32px, 3.4vw, 48px);
  line-height: 1.4;
  font-weight: 550;
  letter-spacing: -2px;
  margin: 22px 0 14px;
}
h1 span {
  color: var(--el-color-primary);
}
.library-hero > p {
  color: var(--app-muted);
  font-size: 14px;
  line-height: 1.9;
  margin: 0;
}
.entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 38px;
}
.entry-card {
  display: block;
  padding: 24px;
  border: 1px solid var(--app-line);
  border-radius: 16px;
  text-decoration: none;
  color: var(--app-text);
  background: linear-gradient(130deg, var(--app-surface), var(--app-bg));
  transition:
    border-color 0.2s,
    transform 0.2s,
    box-shadow 0.2s;
}
.entry-card:hover {
  border-color: var(--el-color-primary-light-5);
  transform: translateY(-3px);
  box-shadow: 0 10px 26px #24386e08;
}
.entry-top {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--el-color-primary);
}
.entry-top > span {
  color: var(--app-muted);
  font-size: 9px;
  letter-spacing: 1.7px;
}
.entry-arrow {
  margin-left: auto;
  opacity: 0.55;
}
.entry-card h2 {
  margin: 24px 0 8px;
  font-size: 15px;
  font-weight: 550;
}
.entry-card p {
  color: var(--app-muted);
  font-size: 12px;
  line-height: 1.7;
  margin: 0;
}
@media (max-width: 1000px) {
  .entry-card {
    padding: 18px;
  }
  .entry-card p {
    font-size: 11px;
  }
}
@media (max-width: 600px) {
  .library-hero {
    padding: 10px 0 30px;
  }
  h1 {
    letter-spacing: -1px;
  }
  .entry-grid {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 26px;
  }
  .entry-card {
    position: relative;
    padding: 18px 18px 18px 65px;
  }
  .entry-top > .app-icon:first-child {
    position: absolute;
    left: 22px;
    top: 30px;
  }
  .entry-top > span {
    display: none;
  }
  .entry-arrow {
    position: absolute;
    right: 18px;
    top: 30px;
  }
  .entry-card h2 {
    margin: 0 25px 5px 0;
  }
}
</style>
