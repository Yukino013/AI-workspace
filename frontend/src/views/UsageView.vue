<script setup lang="ts">
import PageHeading from '@/components/common/PageHeading.vue';
import UsageOverview from '@/components/usage/UsageOverview.vue';
import QuotaSettings from '@/components/usage/QuotaSettings.vue';
import UsageRecords from '@/components/usage/UsageRecords.vue';
import { useUsage } from '@/composables/useUsage';
const { days, overview, records, page, source, model, date, loading, recordsLoading, saving, error, recordsError, saveQuota, refresh, loadRecords } = useUsage();
</script>
<template>
  <div class="usage-page"><PageHeading eyebrow="USAGE & QUOTA" title="使用量与额度" description="了解每一次调用的消耗，为每天的探索设置预算。"><el-button :loading="loading || recordsLoading" @click="refresh">刷新数据</el-button></PageHeading>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-skeleton v-if="!overview && loading" :rows="8" animated />
    <template v-if="overview"><UsageOverview v-model:days="days" :data="overview" /><QuotaSettings :limit="overview.quota.dailyLimit" :committed="overview.quota.consumed + overview.quota.reserved" :saving="saving" @save="saveQuota" /></template>
    <UsageRecords v-model:page="page" v-model:source="source" v-model:model="model" v-model:date="date" :data="records" :loading="recordsLoading" :error="recordsError" @retry="loadRecords" />
  </div>
</template>
<style scoped>.usage-page{min-width:0}.el-alert{margin-bottom:20px}.el-skeleton{margin:24px 0}</style>
