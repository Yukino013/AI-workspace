<script setup lang="ts">
import { ref, watch } from 'vue';
import { formatTokens } from '@/api/usage';
const props = defineProps<{ limit: number; committed: number; saving: boolean }>();
const emit = defineEmits<{ save: [limit: number] }>();
const draft = ref(props.limit);
watch(() => props.limit, value => { draft.value = value; });
const invalid = ref('');
function save() {
  invalid.value = '';
  if (!Number.isSafeInteger(draft.value) || draft.value < 1 || draft.value > 10_000_000) { invalid.value = '请输入 1～10,000,000 的整数'; return; }
  if (draft.value < props.committed) { invalid.value = `不能低于今日已消耗与预占合计 ${formatTokens(props.committed)}`; return; }
  emit('save', draft.value);
}
</script>
<template>
  <section class="settings-panel"><div><h2>每日额度设置</h2><p>默认 1,000,000 Token。修改立即生效，并用于后续每天的预算。</p><p>这是个人调用预算，不代表模型服务商的账户余额。可用额度＝每日预算－已消耗－预占。</p></div>
    <form @submit.prevent="save"><label for="daily-quota">每日 Token 上限</label><div class="controls"><el-input-number id="daily-quota" v-model="draft" :min="1" :max="10000000" :precision="0" :step="10000" :disabled="saving" aria-label="每日 Token 上限" /><el-button type="primary" native-type="submit" :loading="saving" :disabled="draft === limit">保存额度</el-button></div><p v-if="invalid" role="alert" class="validation">{{ invalid }}</p></form>
  </section>
</template>
<style scoped>
.settings-panel{display:flex;justify-content:space-between;gap:24px;padding:24px;border:1px solid var(--app-line);border-radius:14px;background:var(--app-bg);margin:20px 0}h2{font-size:15px;margin:0 0 10px;font-weight:550}p{font-size:12px;color:var(--app-muted);line-height:1.8;margin:5px 0}label{display:block;font-size:12px;margin-bottom:10px}.controls{display:flex;gap:10px}.el-input-number{width:190px}.validation{color:var(--el-color-danger)}@media(max-width:1050px){.settings-panel{flex-direction:column}}@media(max-width:420px){.settings-panel{padding:18px 14px}.controls{flex-wrap:wrap}.el-input-number{width:100%}}
</style>
