<script setup lang="ts">
import { reactive, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { login, register } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/composables/useTheme";
import BrandMark from "@/components/common/BrandMark.vue";
import AppIcon from "@/components/common/AppIcon.vue";
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const { theme, toggle } = useTheme();
const mode = shallowRef<"login" | "register">("login");
const form = reactive({ username: "", password: "" });
const loading = shallowRef(false);
async function submit() {
  if (loading.value) return;
  const username = form.username.trim();
  if (!username || !form.password) {
    ElMessage.warning("请输入用户名和密码");
    return;
  }
  if (
    mode.value === "register" &&
    (!/^[a-zA-Z0-9_]{3,20}$/.test(username) || form.password.length < 6)
  ) {
    ElMessage.warning("用户名应为 3–20 位字母、数字或下划线，密码至少 6 位");
    return;
  }
  loading.value = true;
  try {
    if (mode.value === "login") {
      const data = await login(username, form.password);
      auth.setAuth(data.token, data.user);
      const target = route.query.redirect;
      await router.replace(
        typeof target === "string" &&
          target.startsWith("/") &&
          !target.startsWith("//") &&
          !target.startsWith("/login")
          ? target
          : "/prompts",
      );
    } else {
      await register(username, form.password);
      ElMessage.success("注册成功，请登录");
      mode.value = "login";
      form.password = "";
    }
  } catch {
    /* HTTP 拦截器展示具体错误，保留输入便于重试 */
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="login-page">
    <section class="login-story">
      <div class="login-brand"><BrandMark :size="32" />AI 工作台</div>
      <div class="story-content">
        <span>YOUR IDEAS. AMPLIFIED.</span>
        <h1>少一些重复，<br />多一些<span>创造。</span></h1>
        <p>
          连接你的模型、Prompt 和代码。<br />一个工作空间，让好想法持续发生。
        </p>
        <div class="idea-art" aria-hidden="true">
          <div class="orbit orbit-one" />
          <div class="orbit orbit-two" />
          <div class="art-mark"><BrandMark :size="150" /></div>
          <span class="art-caption">FROM A SPARK<br />TO SOMETHING GREAT.</span
          ><span class="art-coordinate">01 — ∞</span>
        </div>
        <div class="story-features">
          <span><AppIcon name="prompt" :size="16" />Prompt 管理</span
          ><span><AppIcon name="chat" :size="16" />多模型对话</span
          ><span><AppIcon name="code" :size="16" />代码工具</span>
        </div>
      </div>
      <footer>BUILT FOR YOUR EVERYDAY FLOW</footer>
    </section>
    <section class="login-form-area">
      <button
        class="icon-button theme-button"
        :aria-label="theme === 'dark' ? '切换浅色主题' : '切换深色主题'"
        @click="toggle"
      >
        <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
      </button>
      <div class="login-card">
        <span class="form-eyebrow">AI WORKBENCH</span>
        <h2>
          {{ mode === "login" ? "欢迎回到工作台" : "开启你的 AI 工作空间" }}
        </h2>
        <p>
          {{
            mode === "login"
              ? "登录账号，继续你的灵感与创作。"
              : "创建账号，把日常工作变得更简单。"
          }}
        </p>
        <el-form label-position="top" @submit.prevent="submit"
          ><el-form-item label="用户名"
            ><el-input
              v-model="form.username"
              aria-label="用户名"
              autocomplete="username"
              size="large"
              placeholder="3–20 位字母、数字或下划线"
              :maxlength="20" /></el-form-item
          ><el-form-item label="密码"
            ><el-input
              v-model="form.password"
              aria-label="密码"
              :autocomplete="
                mode === 'login' ? 'current-password' : 'new-password'
              "
              size="large"
              type="password"
              show-password
              placeholder="请输入密码（至少 6 位）"
              :maxlength="50" /></el-form-item
          ><el-button
            type="primary"
            native-type="submit"
            size="large"
            class="submit-btn"
            :loading="loading"
            >{{ mode === "login" ? "登录工作台" : "创建账号"
            }}<AppIcon name="chevron-right" :size="17" /></el-button
        ></el-form>
        <div class="switch">
          <span>{{ mode === "login" ? "还没有账号？" : "已经有账号？" }}</span
          ><el-button
            link
            type="primary"
            :disabled="loading"
            @click="mode = mode === 'login' ? 'register' : 'login'"
            >{{ mode === "login" ? "立即注册" : "返回登录" }}</el-button
          >
        </div>
        <div class="login-note">
          <AppIcon name="settings" :size="14" />登录后可在「模型与
          API」中配置你的 API Key
        </div>
      </div>
    </section>
  </div>
</template>
<style scoped>
.login-page {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--app-bg);
}
.login-story {
  background: #edf1fb;
  color: #242d49;
  padding: 42px 54px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.login-brand {
  color: #4d6bfe;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 550;
  letter-spacing: -0.5px;
}
.story-content {
  margin: auto 0;
  padding: 70px 0;
  max-width: 450px;
}
.story-content > span {
  font-size: 10px;
  letter-spacing: 3px;
  color: #657395;
}
.story-content h1 {
  font-size: clamp(38px, 4vw, 62px);
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -2px;
  margin: 26px 0;
}
.story-content h1 span {
  color: #4d6bfe;
}
.story-content p {
  color: #6b7590;
  font-size: 14px;
  line-height: 2;
}
.idea-art {
  height: 235px;
  position: relative;
  margin: 28px 0 32px;
  overflow: hidden;
  border-top: 1px solid #526bb21f;
  border-bottom: 1px solid #526bb21f;
}
.orbit {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 290px;
  height: 160px;
  border: 1px solid #728bd242;
  border-radius: 50%;
  transform: translate(-50%, -50%) rotate(-28deg);
}
.orbit-two {
  transform: translate(-50%, -50%) rotate(38deg);
  width: 215px;
  height: 200px;
}
.art-mark {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #4d6bfe;
  --mark-cutout: #edf1fb;
  transform: rotate(-12deg);
}
.art-caption {
  position: absolute;
  left: 0;
  bottom: 15px;
  color: #657395;
  font-size: 8px;
  letter-spacing: 1px;
  line-height: 1.8;
}
.art-coordinate {
  position: absolute;
  top: 15px;
  right: 0;
  color: #657395;
  font-size: 10px;
  letter-spacing: 2px;
}
.story-features {
  display: flex;
  gap: 22px;
  color: #657395;
  font-size: 11px;
}
.story-features > span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.login-story footer {
  font-size: 9px;
  letter-spacing: 2px;
  color: #657395;
}
.login-form-area {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 50px;
  position: relative;
}
.login-card {
  width: 100%;
  max-width: 370px;
}
.form-eyebrow {
  color: var(--el-color-primary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 2px;
}
.login-card h2 {
  font-size: 27px;
  letter-spacing: -0.6px;
  margin: 16px 0 12px;
}
.login-card > p {
  font-size: 13px;
  color: var(--app-muted);
  margin-bottom: 36px;
}
.login-card :deep(.el-form-item) {
  margin-bottom: 22px;
}
.login-card :deep(.el-form-item__label) {
  font-size: 12px;
}
.submit-btn {
  width: 100%;
  margin-top: 6px;
}
.submit-btn .app-icon {
  margin-left: 8px;
}
.switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 22px;
  font-size: 12px;
  color: var(--app-muted);
}
.login-note {
  border-top: 1px solid var(--el-border-color-light);
  margin-top: 40px;
  padding-top: 24px;
  font-size: 10px;
  color: var(--app-muted);
  display: flex;
  gap: 7px;
  align-items: center;
}
.theme-button {
  position: absolute;
  top: 24px;
  right: 26px;
}
@media (max-width: 1000px) {
  .login-story {
    padding: 35px;
  }
  .login-form-area {
    padding: 35px;
  }
  .story-features {
    gap: 12px;
    font-size: 10px;
  }
}
@media (max-width: 760px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .login-story {
    padding: 26px;
  }
  .story-content {
    padding: 28px 0 0;
  }
  .story-content h1 {
    font-size: 32px;
    letter-spacing: -1px;
    margin: 16px 0;
  }
  .story-content > p,
  .idea-art,
  .story-features,
  .login-story footer {
    display: none;
  }
  .login-form-area {
    padding: 50px 26px;
  }
  .login-brand {
    font-size: 17px;
  }
  .story-content > span {
    font-size: 8px;
  }
  .theme-button {
    top: 10px;
    right: 12px;
  }
  .login-card h2 {
    font-size: 24px;
  }
}
.dark .login-story {
  background: #20263b;
  color: #e5eaff;
}
.dark .login-story h1 span,
.dark .login-brand,
.dark .art-mark {
  color: #9caeff;
}
.dark .art-mark {
  --mark-cutout: #20263b;
}
.dark .story-content > span,
.dark .story-content p,
.dark .story-features,
.dark .login-story footer,
.dark .art-caption,
.dark .art-coordinate {
  color: #a8b4d0;
}
</style>
