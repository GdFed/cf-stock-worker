<template>
  <div class="stock-detail-container">
    <h2>K线图组件使用示例</h2>
    <p>这是一个演示如何在您的项目中集成并使用 <code>KlineChart.vue</code> 组件的示例页面。</p>

    <div class="controls">
      <div class="control-item">
        <label for="code-input">股票代码:</label>
        <input id="code-input" v-model="stockCode" type="text" placeholder="例如: 1.600865" />
        <small>请输入有效的股票或指数代码。</small>
      </div>

      <div class="control-item">
        <span>K线类型:</span>
        <div class="kline-type-selector">
            <button @click="klineType = '分时'" :class="{ active: klineType === '分时' }">分时</button>
            <button @click="klineType = '五日'" :class="{ active: klineType === '五日' }">五日</button>
            <button @click="klineType = '日K'" :class="{ active: klineType === '日K' }">日K</button>
            <button @click="klineType = '周K'" :class="{ active: klineType === '周K' }">周K</button>
            <button @click="klineType = '月K'" :class="{ active: klineType === '月K' }">月K</button>
        </div>
      </div>
    </div>

    <p>下方即为引入的 <code>KlineChart</code> 组件：</p>
    <kline-chart :code-id="stockCode" :kline-type="klineType" />
  </div>
</template>

<script setup>
import { ref, defineProps } from 'vue';
// 1. 从其路径导入 KlineChart 组件
import KlineChart from './KlineChart.vue';

const props = defineProps({
  codeId: {
    type: String,
    default: '1.600865'
  }
});

// 2. 定义响应式数据，用于动态传递给 KlineChart 组件的 props
// 默认股票代码，例如上证指数
const stockCode = ref(props.codeId);
// 默认K线类型
const klineType = ref('日K');
</script>

<style scoped>
.stock-detail-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  padding: 20px;
  background-color: #f7f8fa;
  border-radius: 8px;
}

h2 {
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.controls {
  margin-bottom: 25px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background-color: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
}

.control-item {
    display: flex;
    align-items: center;
    gap: 10px;
}

label {
    font-weight: bold;
}

#code-input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 150px;
}

small {
    color: #888;
}

.kline-type-selector button {
  margin-right: 10px;
  padding: 8px 15px;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease-in-out;
}

.kline-type-selector button:hover {
    background-color: #e0e0e0;
    border-color: #bbb;
}

.kline-type-selector button.active {
  background-color: #416df9;
  color: white;
  border-color: #416df9;
  font-weight: bold;
}
</style>
