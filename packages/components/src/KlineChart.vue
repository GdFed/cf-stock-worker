<template>
  <div ref="chart" style="width: 100%; height: 500px;"></div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import * as echarts from 'echarts';

const getKlineData = async (codeId, klineType) => {
  const zt = {
    '分时': '1', '五日': '5', '日K': '101', '周K': '102', '月K': '103', '季K': '104', '年K': '106',
    '120分': '120', '60分': '60', '30分': '30', '15分': '15', '5分': '5'
  };

  let path, params;

  if (klineType === '分时' || klineType === '五日') {
    path = '/api/qt/stock/trends2/get';
    params = {
      secid: codeId,
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14',
      fields2: 'f51,f53,f56,f58',
      iscr: 0,
      iscca: 0,
      ndays: zt[klineType],
    };
    if (klineType === '五日') {
      params.fields1 += ',f17';
    }
  } else {
    path = '/api/qt/stock/kline/get';
    let lmt = 280;
    if (klineType === '5分' || klineType === '15分') lmt = 500;
    else if (klineType === '30分' || klineType === '60分' || klineType === '120分') lmt = 400;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}${month}${day}`;

    params = {
      secid: codeId,
      klt: zt[klineType],
      fqt: 1,
      lmt: lmt,
      end: formattedDate,
      iscca: 1,
      fields1: 'f1,f2,f3,f4,f5',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f59',
      ut: 'f057cbcbce2a86e2866ab8877db1d059',
      forcect: 1,
    };
  }
  
  const buildQueryString = (p) => {
    return Object.entries(p)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      .join('&');
  };

  const queryString = buildQueryString(params);
  
  try {
    const baseUrl = process.env.VITE_API_TARGET || '';
    const url = `${baseUrl}${path}?${queryString}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch kline data:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
};

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

const chart = ref(null);
let myChart = null;

// --- 数据处理与指标计算函数 ---

/**
 * @description 解析原始K线数据
 * @param {string[]} rawDataStrings - 原始K线数据字符串数组
 * @returns {{categoryData: string[], values: number[][], volumes: (number|string)[][]}}
 */
const processRawData = (rawDataStrings) => {
  const categoryData = []; // 日期
  const values = []; // OCHL (开盘, 收盘, 最高, 最低)
  const volumes = []; // 成交量

  for (let i = 0; i < rawDataStrings.length; i++) {
    let parts = rawDataStrings[i].split(",");
    categoryData.push(parts[0]);
    parts.shift();
    const ohlc = parts.map(Number);
    // ECharts expects [open, close, lowest, highest]
    values.push([ohlc[0], ohlc[1], ohlc[3], ohlc[2]]);
    // 卷, 涨跌
    volumes.push([i, ohlc[4], ohlc[0] > ohlc[1] ? -1 : 1]);
  }
  return { categoryData, values, volumes };
};

/**
 * @description 计算移动平均线 (MA)
 * @param {number} period - 周期
 * @param {{values: number[][]}} processedData - 解析后的数据
 * @returns {(number|string)[]}
 */
const calculateMA = (period, processedData) => {
  const result = [];
  for (let i = 0, len = processedData.values.length; i < len; i++) {
    if (i < period) {
      result.push("-");
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      // 使用收盘价计算
      sum += processedData.values[i - j][1];
    }
    result.push(+(sum / period).toFixed(3));
  }
  return result;
};

/**
 * @description 计算MACD指标
 * @param {{values: number[][]}} processedData
 * @param {number} short - 短周期
 * @param {number} long - 长周期
 * @param {number} signal - 信号周期
 * @returns {{dif: (number|null)[], dea: (number|null)[], macd: (number|null)[]}}
 */
const calculateMACD = (processedData, short = 12, long = 26, signal = 9) => {
  const closePrices = processedData.values.map(item => item[1]);
  const ema = (prices, period) => {
    const result = [];
    const alpha = 2 / (period + 1);
    let lastEma = prices[0];
    result.push(lastEma);
    for (let i = 1; i < prices.length; i++) {
      lastEma = prices[i] * alpha + lastEma * (1 - alpha);
      result.push(lastEma);
    }
    return result;
  };

  const emaShort = ema(closePrices, short);
  const emaLong = ema(closePrices, long);
  const dif = closePrices.map((_, i) => i < long - 1 ? null : emaShort[i] - emaLong[i]);
  const dea = ema(dif.map(d => d === null ? 0 : d), signal);
  const macd = closePrices.map((_, i) => (dif[i] !== null && dea[i] !== null) ? (dif[i] - dea[i]) * 2 : null);

  // 修正DEA前段为null
  const finalDea = dea.map((val, i) => i < long + signal - 2 ? null : val);

  return { dif, dea: finalDea, macd };
};

/**
 * @description 计算KDJ指标
 * @param {{values: number[][]}} processedData
 * @param {number} n - 周期
 * @param {number} m1 - K的平滑因子
 * @param {number} m2 - D的平滑因子
 * @returns {{k: (number|null)[], d: (number|null)[], j: (number|null)[]}}
 */
const calculateKDJ = (processedData, n = 9, m1 = 3, m2 = 3) => {
    const length = processedData.values.length;
    const rsvList = [];
    const kList = [];
    const dList = [];
    const jList = [];

    for (let i = 0; i < length; i++) {
        const close = processedData.values[i][1];
        const start = Math.max(0, i - n + 1);
        const periodData = processedData.values.slice(start, i + 1);
        const low = Math.min(...periodData.map(item => item[2]));
        const high = Math.max(...periodData.map(item => item[3]));

        const rsv = high === low ? 0 : (close - low) / (high - low) * 100;
        rsvList.push(rsv);

        if (i === 0) {
            kList.push(50);
            dList.push(50);
        } else {
            const prevK = kList[i - 1];
            const prevD = dList[i - 1];
            const newK = (rsv + (m1 - 1) * prevK) / m1;
            const newD = (newK + (m2 - 1) * prevD) / m2;
            kList.push(newK);
            dList.push(newD);
        }
        jList.push(3 * kList[i] - 2 * dList[i]);
    }
    // KDJ早期数据可能不稳定，前面补null
    return {
        k: kList.map((v, i) => i < n - 1 ? null : v),
        d: dList.map((v, i) => i < n - 1 ? null : v),
        j: jList.map((v, i) => i < n - 1 ? null : v)
    };
};


const maConfigs = [
  { name: "MA5", period: 5, color: "#faa90e" },
  { name: "MA10", period: 10, color: "#8400ff" },
  { name: "MA20", period: 20, color: "#416df9" },
  { name: "MA60", period: 60, color: "#001953" },
];

const getOption = (rawData) => {
    const { data } = rawData || {};
    if (!data || !data.klines || data.klines.length === 0) {
      // 当没有数据时，返回一个空的配置对象，避免渲染错误
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center'
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: []
      };
    }

    const processedData = processRawData(data.klines);
    const macdData = calculateMACD(processedData);
    const kdjData = calculateKDJ(processedData);

    const upColor = '#eb5454';
    const downColor = '#47b262';

    return {
        animation: false,
        title: {
            text: `${data.name} ${data.code}`,
            left: 20,
        },
        legend: {
            bottom: 10,
            left: 'center',
            data: ['MA5', 'MA10', 'MA20', 'MA60', 'MACD', 'DIF', 'DEA', 'K', 'D', 'J']
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            },
            position: function (pos, params, el, elRect, size) {
                const obj = { top: 10 };
                obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
                return obj;
            }
        },
        axisPointer: {
            link: [{ xAxisIndex: 'all' }]
        },
        grid: [
            { top: '8%', left: '10%', right: '8%', height: '40%' }, // 主图
            { left: '10%', right: '8%', top: '53%', height: '10%' }, // 成交量
            { left: '10%', right: '8%', top: '68%', height: '10%' }, // MACD
            { left: '10%', right: '8%', top: '83%', height: '10%' }  // KDJ
        ],
        xAxis: [
            { type: 'category', data: processedData.categoryData, scale: true, boundaryGap: false, axisLine: { onZero: false }, splitLine: { show: false }, min: 'dataMin', max: 'dataMax' },
            { type: 'category', gridIndex: 1, data: processedData.categoryData, scale: true, boundaryGap: false, axisLine: { onZero: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, min: 'dataMin', max: 'dataMax' },
            { type: 'category', gridIndex: 2, data: processedData.categoryData, scale: true, boundaryGap: false, axisLine: { onZero: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, min: 'dataMin', max: 'dataMax' },
            { type: 'category', gridIndex: 3, data: processedData.categoryData, scale: true, boundaryGap: false, axisLine: { onZero: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, min: 'dataMin', max: 'dataMax' }
        ],
        yAxis: [
            { scale: true, splitArea: { show: true } },
            { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
            { scale: true, gridIndex: 2, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
            { scale: true, gridIndex: 3, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } }
        ],
        dataZoom: [
            { type: 'inside', xAxisIndex: [0, 1, 2, 3], start: 50, end: 100 },
            { show: true, xAxisIndex: [0, 1, 2, 3], type: 'slider', top: '95%', start: 50, end: 100 }
        ],
        series: [
            // 主图 Candlestick
            {
                name: data.name,
                type: 'candlestick',
                data: processedData.values,
                itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor }
            },
            // MA线
            ...maConfigs.map(config => ({
                name: config.name,
                type: 'line',
                data: calculateMA(config.period, processedData),
                smooth: true,
                showSymbol: false,
                lineStyle: { color: config.color, opacity: 0.8, width: 1.3 }
            })),
            // 成交量
            {
                name: '成交量',
                type: 'bar',
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: processedData.volumes,
                itemStyle: { color: ({ data: [,, value] }) => value === 1 ? upColor : downColor }
            },
            // MACD
            {
                name: 'MACD',
                type: 'bar',
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.macd,
                itemStyle: { color: ({ value }) => value >= 0 ? upColor : downColor }
            },
            {
                name: 'DIF',
                type: 'line',
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.dif,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: '#f6b92b', width: 1.2 }
            },
            {
                name: 'DEA',
                type: 'line',
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.dea,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: '#2b7cff', width: 1.2 }
            },
            // KDJ
            {
                name: 'K',
                type: 'line',
                xAxisIndex: 3,
                yAxisIndex: 3,
                data: kdjData.k,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: '#f6b92b', width: 1.2 }
            },
            {
                name: 'D',
                type: 'line',
                xAxisIndex: 3,
                yAxisIndex: 3,
                data: kdjData.d,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: '#2b7cff', width: 1.2 }
            },
            {
                name: 'J',
                type: 'line',
                xAxisIndex: 3,
                yAxisIndex: 3,
                data: kdjData.j,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: '#ff00ff', width: 1.2 }
            }
        ]
    };
};

const renderChart = async () => {
  if (!myChart) {
    myChart = echarts.init(chart.value);
  }
  myChart.showLoading();
  try {
    const klineData = await getKlineData(props.codeId, props.klineType);
    const option = getOption(klineData);
    myChart.setOption(option);
  } catch (error) {
    console.error('Failed to render chart:', error);
  } finally {
    myChart.hideLoading();
  }
};

onMounted(() => {
  renderChart();
});

watch(() => [props.codeId, props.klineType], () => {
  renderChart();
});

</script>
