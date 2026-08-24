<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { updateProfile, uploadAvatar } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const displayName = computed(() => auth.user?.nickname || auth.user?.username || "");
const avatarInitial = computed(() => (displayName.value.charAt(0) || "U").toUpperCase());

const nickname = ref(auth.user?.nickname ?? "");
const savingNickname = shallowRef(false);
const uploading = shallowRef(false);

async function saveNickname() {
  const value = nickname.value.trim();
  if (value === (auth.user?.nickname ?? "")) {
    ElMessage.info("昵称没有变化");
    return;
  }
  savingNickname.value = true;
  try {
    const user = await updateProfile(value);
    auth.updateUser(user);
    ElMessage.success("昵称已更新");
  } finally {
    savingNickname.value = false;
  }
}

function beforeAvatarUpload(file: File) {
  const okType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
  if (!okType) {
    ElMessage.error("仅支持 jpg / png / webp / gif 图片");
    return false;
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error("头像不能超过 2MB");
    return false;
  }
  return true;
}

async function handleAvatarUpload(options: UploadRequestOptions) {
  uploading.value = true;
  try {
    const user = await uploadAvatar(options.file as File);
    auth.updateUser(user);
    ElMessage.success("头像已更新");
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="profile-page">
    <el-card class="profile-card" shadow="never">
      <div class="profile-header">
        <el-upload
          class="avatar-upload"
          :show-file-list="false"
          accept="image/*"
          :http-request="handleAvatarUpload"
          :before-upload="beforeAvatarUpload"
        >
          <div class="avatar-wrap" :class="{ uploading }">
            <el-avatar :size="96" :src="auth.user?.avatar || undefined">
              {{ avatarInitial }}
            </el-avatar>
            <div class="avatar-tip">{{ uploading ? "上传中..." : "点击更换头像" }}</div>
          </div>
        </el-upload>

        <div class="meta">
          <div class="name">{{ displayName }}</div>
          <div class="username">@{{ auth.user?.username }}</div>
        </div>
      </div>

      <el-divider />

      <div class="field">
        <label class="field-label">昵称</label>
        <div class="nickname-row">
          <el-input
            v-model="nickname"
            :maxlength="30"
            show-word-limit
            placeholder="设置你的昵称（留空则显示用户名）"
            clearable
            @keyup.enter="saveNickname"
          />
          <el-button type="primary" :loading="savingNickname" @click="saveNickname">
            保存
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px;
}
.profile-card {
  border: 1px solid var(--el-border-color-light);
  background: var(--app-bg);
}
.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
}
.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.avatar-tip {
  font-size: 12px;
  color: var(--app-muted);
}
.meta .name {
  font-size: 20px;
  font-weight: 500;
  color: var(--app-text);
}
.meta .username {
  margin-top: 4px;
  font-size: 13px;
  color: var(--app-muted);
}
.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--app-muted);
}
.nickname-row {
  display: flex;
  gap: 12px;
}
.nickname-row .el-input {
  max-width: 360px;
}
</style>
