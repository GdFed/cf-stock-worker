<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h3>分时图 ({{ date }})</h3>
        <button @click="handleClose" class="close-button">&times;</button>
      </div>
      <div class="modal-body">
        <div ref="timeSharingChart" style="width: 100%; height: 400px;"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { getKlineData } from './api/kline';
import { getTimeSharingOption } from './composables/kline-data/options';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  codeId: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['close']);

const timeSharingChart = ref(null);
let myChart = null;

const renderTimeSharingChart = async () => {
  if (!timeSharingChart.value) return;

  if (!myChart) {
    myChart = echarts.init(timeSharingChart.value);
  }

  myChart.showLoading();
  try {
    const klineData = await getKlineData(props.codeId, '分时', props.date);
    const option = getTimeSharingOption(klineData);
    myChart.setOption(option, true);
  } catch (error) {
    console.error('Failed to render time sharing chart:', error);
    myChart.setOption({
      title: { text: '数据加载失败', left: 'center', top: 'center' }
    });
  } finally {
    myChart.hideLoading();
  }
};

watch([() => props.visible, () => props.date, () => props.codeId], async ([isVisible]) => {
  if (isVisible) {
    // 使用 nextTick 确保 DOM 元素已经渲染
    await nextTick();
    await renderTimeSharingChart();
  } else if (myChart) {
    // 弹窗关闭时可以销毁图表实例以释放资源
    myChart.dispose();
    myChart = null;
  }
}, { immediate: true });

const handleClose = () => {
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 900px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.close-button {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  cursor: pointer;
}
</style>
