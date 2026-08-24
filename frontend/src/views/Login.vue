<script setup lang="ts">
import { reactive, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { login, register } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const mode = shallowRef<"login" | "register">("login");
const form = reactive({ username: "", password: "" });
const loading = shallowRef(false);

async function submit() {
  if (!form.username.trim() || !form.password) {
    ElMessage.warning("请输入用户名和密码");
    return;
  }
  loading.value = true;
  try {
    if (mode.value === "login") {
      const data = await login(form.username.trim(), form.password);
      auth.setAuth(data.token, data.user);
      ElMessage.success("登录成功");
      router.push((route.query.redirect as string) || "/prompts");
    } else {
      await register(form.username.trim(), form.password);
      ElMessage.success("注册成功，请登录");
      mode.value = "login";
      form.password = "";
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <h2 class="title">AI 工作台</h2>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="3-20 位字母、数字或下划线" :maxlength="20" @keyup.enter="submit" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="至少 6 位" show-password :maxlength="50" @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">
          {{ mode === "login" ? "登录" : "注册" }}
        </el-button>
      </el-form>
      <div class="switch">
        <el-button link type="primary" @click="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === "login" ? "没有账号？去注册" : "已有账号？去登录" }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--el-fill-color);
}
.login-card {
  width: 380px;
}
.title {
  text-align: center;
  margin: 0 0 20px;
}
.submit-btn {
  width: 100%;
}
.switch {
  text-align: center;
  margin-top: 12px;
}
</style>
