import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { getUsageOverview, getUsageRecords, updateDailyQuota, type UsageOverview, type UsagePage } from '@/api/usage';
export function useUsage() {
  const days = ref<7 | 30>(7);
  const overview = shallowRef<UsageOverview>();
  const records = shallowRef<UsagePage>({ items: [], total: 0, page: 1, pageSize: 20 });
  const page = ref(1); const source = ref(''); const model = ref(''); const date = ref('');
  const loading = ref(false); const recordsLoading = ref(false); const saving = ref(false);
  const error = ref(''); const recordsError = ref('');
  let overviewVersion = 0; let recordsVersion = 0;
  async function loadOverview() {
    const version = ++overviewVersion; loading.value = true; error.value = '';
    try { const value = await getUsageOverview(days.value); if (version === overviewVersion) overview.value = value; }
    catch { if (version === overviewVersion) error.value = '使用量加载失败，请检查后端与数据库状态后重试。'; }
    finally { if (version === overviewVersion) loading.value = false; }
  }
  async function loadRecords() {
    const version = ++recordsVersion; recordsLoading.value = true; recordsError.value = '';
    try {
      const value = await getUsageRecords({ page: page.value, pageSize: 20, source: source.value || undefined, model: model.value || undefined, date: date.value || undefined });
      if (version === recordsVersion) records.value = value;
    } catch { if (version === recordsVersion) recordsError.value = '明细加载失败，请重试。'; }
    finally { if (version === recordsVersion) recordsLoading.value = false; }
  }
  async function saveQuota(limit: number) {
    if (saving.value) return;
    saving.value = true;
    try { await updateDailyQuota(limit); ElMessage.success('每日额度已更新，即刻生效'); await loadOverview(); }
    catch { /* HTTP interceptor explains validation errors */ }
    finally { saving.value = false; }
  }
  function filterRecords() { if (page.value !== 1) page.value = 1; else void loadRecords(); }
  async function refresh() { await Promise.all([loadOverview(), loadRecords()]); }
  watch(days, loadOverview); watch(page, loadRecords); watch([source, model, date], filterRecords);
  let timer: ReturnType<typeof setInterval> | undefined;
  const onFocus = () => { void refresh(); };
  onMounted(() => {
    void refresh(); window.addEventListener('focus', onFocus);
    timer = setInterval(() => { if (!document.hidden && !loading.value && !recordsLoading.value) void refresh(); }, 30_000);
  });
  onBeforeUnmount(() => { ++overviewVersion; ++recordsVersion; clearInterval(timer); window.removeEventListener('focus', onFocus); });
  return { days, overview, records, page, source, model, date, loading, recordsLoading, saving, error, recordsError, saveQuota, refresh, loadRecords };
}
