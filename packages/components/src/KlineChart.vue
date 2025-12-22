<template>
  <div ref="chart" style="width: 100%; height: 500px;"></div>
</template>

<script setup>
import { useKlineChart } from './composables/useKlineChart';

const props = defineProps({
  codeId: {
    type: String,
    required: true
  },
  klineType: {
    type: String,
    default: '日K'
  }
});

const { chart } = useKlineChart(props);
</script>
