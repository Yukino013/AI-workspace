<script setup lang="ts">
import { MODEL_OPTIONS } from '@/utils/constants';

const model = defineModel<string>({ required: true });
</script>

<template>
  <el-segmented v-model="model" :options="MODEL_OPTIONS" block />
</template>
