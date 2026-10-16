<script setup lang="ts">
import { sourceLabels, formatTokens as fmt, type UsagePage, type UsageRecord } from '@/api/usage';
defineProps<{ data: UsagePage; loading: boolean; source: string; model: string; date: string; page: number; error: string }>();
defineEmits<{ 'update:source': [value: string]; 'update:model': [value: string]; 'update:date': [value: string]; 'update:page': [value: number]; retry: [] }>();
function status(row: UsageRecord) { return row.status !== 'settled' ? '进行中' : ({ success: '成功', error: '失败', cancelled: '已取消', not_sent: '未发送' }[row.outcome ?? ''] ?? '未知'); }
</script>
<template>
  <section class="records-panel"><header><h2>调用明细 <small>{{ data.total }} 条</small></h2><span>统计独立保留，删除生成历史不会退还额度</span></header>
    <div class="filters"><el-select :model-value="source" placeholder="全部来源" aria-label="筛选来源" clearable @update:model-value="$emit('update:source', $event)"><el-option v-for="(label, key) in sourceLabels" :key="key" :value="key" :label="label" /></el-select><el-input :model-value="model" placeholder="精确模型名称" aria-label="筛选模型" clearable @change="$emit('update:model', $event)" /><el-date-picker :model-value="date" value-format="YYYY-MM-DD" type="date" placeholder="全部日期（北京时间）" aria-label="筛选额度日期" clearable @update:model-value="$emit('update:date', $event || '')" /></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button link @click="$emit('retry')">重试</el-button></el-alert>
    <el-table v-else v-loading="loading" :data="data.items" empty-text="暂无符合条件的调用记录">
      <el-table-column label="时间（北京时间）" min-width="170"><template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) }}</template></el-table-column>
      <el-table-column label="来源" min-width="100"><template #default="{ row }">{{ sourceLabels[row.source] || row.source }}</template></el-table-column>
      <el-table-column prop="model" label="模型" min-width="150" />
      <el-table-column label="状态" min-width="90"><template #default="{ row }">{{ status(row) }}<small v-if="row.recovered" class="recovered">超时恢复</small></template></el-table-column>
      <el-table-column label="输入 / 输出" min-width="135"><template #default="{ row }">{{ fmt(row.reportedInputTokens) }} / {{ fmt(row.reportedOutputTokens) }}</template></el-table-column>
      <el-table-column label="扣量 / 预占" min-width="155"><template #default="{ row }"><strong>{{ fmt(row.status === 'settled' ? row.chargedTokens : row.reservedTokens) }}</strong><el-tag size="small" :type="row.usageSource === 'estimated' ? 'warning' : 'info'">{{ row.status !== 'settled' ? '预占' : row.usageSource === 'estimated' ? '估算' : row.usageSource === 'reported' ? '实际' : '未扣量' }}</el-tag></template></el-table-column>
    </el-table>
    <p class="note">流式中断或模型未报告完整用量时，按预占量保守结算并标记“估算”；实际输入、输出显示“未知”。工作流按实际执行的步骤计量。</p>
    <el-pagination v-if="data.total > 20" :current-page="page" :page-size="20" :total="data.total" layout="prev, pager, next" :pager-count="5" @update:current-page="$emit('update:page', $event)" />
  </section>
</template>
<style scoped>
.records-panel{border:1px solid var(--app-line);border-radius:14px;background:var(--app-bg);padding:24px;min-width:0}header{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}h2{font-size:15px;margin:0;font-weight:550}h2 small{margin-left:8px;font-size:12px;color:var(--app-muted)}header span,.note{font-size:12px;color:var(--app-muted);line-height:1.8}.filters{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap}.filters .el-select,.filters .el-input{width:180px}.filters :deep(.el-date-editor){max-width:100%}strong{font-weight:500;margin-right:8px}.recovered{display:block;color:var(--app-muted)}.note{margin:16px 0}.el-pagination{justify-content:flex-end}@media(max-width:640px){.records-panel{padding:18px 12px}.filters .el-select,.filters .el-input{width:100%}.filters :deep(.el-date-editor){width:100%}}
</style>
