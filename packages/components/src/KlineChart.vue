<template>
  <div class="kline-chart-container">
    <div ref="chart" style="width: 100%; height: 500px;"></div>
    <div v-if="isTraining" class="training-controls">
      <button @click="$emit('next')">下一根</button>
      <button @click="$emit('showAll')">显示全部</button>
      <button @click="$emit('reset')">重置</button>
    </div>
    <TimeSharingModal
      v-if="showModal"
      :visible="showModal"
      :code-id="props.codeId"
      :date="selectedDate"
      @close="closeModal"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useKlineChart } from './composables/useKlineChart';
import TimeSharingModal from './TimeSharingModal.vue';

const props = defineProps({
  codeId: {
    type: String,
    required: false,
  },
  klineType: {
    type: String,
    default: '日K'
  },
  isTraining: {
    type: Boolean,
    default: false,
  },
  chartData: {
    type: Object,
    default: () => null,
  }
});

defineEmits(['next', 'showAll', 'reset']);

const showModal = ref(false);
const selectedDate = ref('');

const handleOpenTimeSharing = (date) => {
  console.log('handleOpenTimeSharing received date:', date);
  if (props.codeId) {
    selectedDate.value = date;
    showModal.value = true;
  }
};

const closeModal = () => {
  showModal.value = false;
};

const { chart } = useKlineChart(props, { onContextMenu: handleOpenTimeSharing });
</script>

<style scoped>
.kline-chart-container {
  position: relative;
}

.training-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

button {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f0f0f0;
  cursor: pointer;
}

button:hover {
  background-color: #e0e0e0;
}
</style>
