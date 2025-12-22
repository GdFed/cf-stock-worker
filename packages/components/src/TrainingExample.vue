<template>
  <div>
    <h1>K线训练模式示例</h1>
    <KlineChart
      :is-training="true"
      :chart-data="trainingData"
      :kline-type="klineType"
      @next="handleNext"
      @show-all="handleShowAll"
      @reset="handleReset"
    />
    <div v-if="fullData.data.klines.length > 0" class="info">
      <p>总K线数: {{ fullData.data.klines.length }}</p>
      <p>当前显示: {{ currentIndex }} / {{ fullData.data.klines.length }}</p>
      <p>股票: {{ fullData.data.name }} ({{ fullData.data.code }})</p>
    </div>
    <div v-else>
      正在加载数据...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import KlineChart from './KlineChart.vue';
import { getKlineData } from './api/kline';

const klineType = ref('日K');
const codeId = '1.600519'; // 以贵州茅台为例

// 存储从 API 获取的完整历史数据
const fullData = ref({ data: { klines: [], name: '', code: '' } });
// 当前训练的索引
const currentIndex = ref(100); // 初始显示100根
const initialIndex = 100;

onMounted(async () => {
  try {
    const data = await getKlineData(codeId, klineType.value);
    if (data && data.data && data.data.klines) {
      fullData.value = data;
    } else {
      console.error('获取到的数据格式不正确:', data);
    }
  } catch (error) {
    console.error('在 TrainingExample.vue 中获取K线数据失败:', error);
    // 可以在这里设置一个错误状态，以便在UI上显示错误信息
  }
});

// 根据 currentIndex 计算并传递给子组件的K线数据
const trainingData = computed(() => {
  if (!fullData.value.data.klines.length) {
    return null;
  }
  const klines = fullData.value.data.klines.slice(0, currentIndex.value);
  return {
    data: {
      ...fullData.value.data,
      klines,
    }
  };
});

const handleNext = () => {
  if (currentIndex.value < fullData.value.data.klines.length) {
    currentIndex.value++;
  }
};

const handleShowAll = () => {
  currentIndex.value = fullData.value.data.klines.length;
};

const handleReset = () => {
  currentIndex.value = initialIndex;
};
</script>

<style scoped>
.info {
  margin-top: 20px;
  padding: 10px;
  border-radius: 5px;
  background-color: #f3f3f3;
}
</style>
