<script setup lang="ts">
import { computed } from 'vue';
import { formatTokens as fmt, sourceLabels, type UsageOverview } from '@/api/usage';
const props = defineProps<{ data: UsageOverview; days: 7 | 30 }>();
defineEmits<{ 'update:days': [value: 7 | 30] }>();
const percent = computed(() => Math.min(100, Math.round((props.data.quota.consumed + props.data.quota.reserved) / props.data.quota.dailyLimit * 100)));
const peak = computed(() => Math.max(1, ...props.data.trend.map(day => day.consumedTokens)));
const periodTotal = computed(() => props.data.trend.reduce((sum, day) => sum + day.consumedTokens, 0));
</script>
<template>
  <section class="quota-summary" aria-label="今日额度概览">
    <div><span class="caption">今日可用额度 · {{ data.date }}</span><strong class="balance">{{ fmt(data.quota.available) }} <small>Token</small></strong>
      <p>每日预算 {{ fmt(data.quota.dailyLimit) }} · 每日 00:00 重置（北京时间）</p>
    </div>
    <div class="budget-progress"><el-progress :percentage="percent" :status="percent >= 90 ? 'warning' : undefined" /><p>已消耗与预占合计 {{ percent }}%</p></div>
  </section>
  <div class="metrics">
    <article><span>今日调用次数</span><strong>{{ fmt(data.today.startedRequests) }}</strong><small>成功 {{ data.today.successRequests }} · 失败 {{ data.today.failedRequests }} · 取消 {{ data.today.cancelledRequests }}</small></article>
    <article><span>今日已消耗</span><strong>{{ fmt(data.quota.consumed) }}</strong><small>含估算扣量 {{ fmt(data.today.estimatedChargedTokens) }}</small></article>
    <article><span>预占额度</span><strong>{{ fmt(data.quota.reserved) }}</strong><small>所有日期进行中的调用 {{ data.quota.activeRequests }} / {{ data.quota.maxActiveRequests }}</small></article>
    <article><span>模型报告 Token</span><strong>{{ fmt(data.today.reportedInputTokens + data.today.reportedOutputTokens) }}</strong><small>输入 {{ fmt(data.today.reportedInputTokens) }} · 输出 {{ fmt(data.today.reportedOutputTokens) }}</small></article>
  </div>
  <section class="panel trend-panel">
    <div class="panel-heading"><div><h2>用量趋势</h2><p>近 {{ days }} 天累计 {{ fmt(periodTotal) }} Token（含估算）</p></div>
      <el-radio-group :model-value="days" aria-label="统计时间范围" @update:model-value="$emit('update:days', $event as 7 | 30)"><el-radio-button :value="7">近 7 天</el-radio-button><el-radio-button :value="30">近 30 天</el-radio-button></el-radio-group>
    </div>
    <div class="chart" role="img" :aria-label="`近 ${days} 天消耗 ${fmt(periodTotal)} Token`">
      <div v-for="day in data.trend" :key="day.date" class="bar-column" :title="`${day.date}：${fmt(day.consumedTokens)} Token，${day.requests} 次调用`">
        <div class="bar-track"><div class="bar" :style="{ height: `${day.consumedTokens / peak * 100}%` }" /></div>
        <small v-if="days === 7 || day.date.endsWith('01') || day === data.trend[0] || day === data.trend[data.trend.length - 1]">{{ day.date.slice(5) }}</small><small v-else aria-hidden="true">·</small>
      </div>
      <span v-if="periodTotal === 0" class="chart-empty">暂无用量，完成一次 AI 调用后会显示在这里</span>
    </div>
    <details><summary>查看每日数值</summary><div class="daily-values"><span v-for="day in data.trend" :key="day.date">{{ day.date }}：{{ fmt(day.consumedTokens) }} Token / {{ day.requests }} 次</span></div></details>
  </section>
  <div class="breakdowns">
    <section class="panel"><h2>按来源统计 <small>近 {{ days }} 天</small></h2><p v-if="!data.bySource.length">暂无调用记录</p><div v-for="row in data.bySource" :key="row.source" class="breakdown-row"><span>{{ sourceLabels[row.source] || row.source }} <small>{{ row.requests }} 次</small></span><strong>{{ fmt(row.tokens) }} <small>Token</small></strong></div></section>
    <section class="panel"><h2>按模型统计 <small>近 {{ days }} 天</small></h2><p v-if="!data.byModel.length">暂无调用记录</p><div v-for="row in data.byModel" :key="row.model" class="breakdown-row"><span>{{ row.model }} <small>{{ row.requests }} 次</small></span><strong>{{ fmt(row.tokens) }} <small>Token</small></strong></div></section>
  </div>
</template>
<style scoped>
.quota-summary{display:flex;align-items:center;justify-content:space-between;gap:24px;background:var(--app-hero);border:1px solid var(--app-line);border-radius:16px;padding:28px}.caption,p,small{color:var(--app-muted)}.balance{display:block;font-size:clamp(30px,4vw,42px);margin-top:12px;font-weight:600;font-variant-numeric:tabular-nums}.balance small{font-size:14px;font-weight:400}p{font-size:12px;line-height:1.8;margin:8px 0 0}.budget-progress{width:260px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:20px 0}.metrics article,.panel{background:var(--app-bg);border:1px solid var(--app-line);border-radius:14px;padding:22px}.metrics span{font-size:13px;color:var(--app-muted)}.metrics strong{display:block;font-size:26px;margin:12px 0;font-variant-numeric:tabular-nums}.metrics small{font-size:11px;line-height:1.8}.panel-heading{display:flex;justify-content:space-between;gap:16px;align-items:center}h2{font-size:15px;margin:0;font-weight:550}h2 small{font-size:11px;margin-left:8px}.chart{display:flex;height:180px;gap:6px;position:relative;margin-top:24px}.bar-column{flex:1;min-width:0;display:flex;flex-direction:column;text-align:center;gap:10px}.bar-track{height:150px;display:flex;align-items:flex-end;border-bottom:1px solid var(--app-line)}.bar{width:100%;background:var(--el-color-primary);border-radius:4px 4px 0 0;min-height:1px}.bar-column small{font-size:10px;white-space:nowrap}.chart-empty{position:absolute;inset:50px 12px auto;text-align:center;color:var(--app-muted);font-size:13px}.daily-values{display:grid;gap:8px;margin-top:12px;font-size:12px;color:var(--app-muted)}summary{font-size:12px;color:var(--app-muted);cursor:pointer;margin-top:16px}.breakdowns{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}.breakdown-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--app-line);padding:16px 0;font-size:13px}.breakdown-row:last-child{border-bottom:0}.breakdown-row strong{font-weight:500;white-space:nowrap}.breakdown-row span{overflow-wrap:anywhere}.breakdown-row small{font-size:11px;margin-left:5px}@media(max-width:1100px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.quota-summary{align-items:stretch;flex-direction:column;padding:20px}.budget-progress{width:100%}.metrics{gap:10px}.metrics article{padding:16px 12px}.metrics strong{font-size:22px}.breakdowns{grid-template-columns:1fr;gap:12px}.panel{padding:18px 14px}.panel-heading{align-items:flex-start;flex-direction:column}.chart{gap:3px}}
</style>
