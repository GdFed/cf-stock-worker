import { ref, onMounted, watch } from 'vue';
import * as echarts from 'echarts';
import { getKlineData } from '../api/kline';
import { calculateKDJ, calculateMACD, calculateMA } from './kline-data/indicators';
import { processRawData } from './kline-data/kline';
import { processTimeSharingData } from './kline-data/time-sharing';

export function useKlineChart(props) {
  const chart = ref(null);
  let myChart = null;

  const maConfigs = [
    { name: "MA5", period: 5, color: "#faa90e" },
    { name: "MA10", period: 10, color: "#8400ff" },
    { name: "MA20", period: 20, color: "#416df9" },
    { name: "MA60", period: 60, color: "#001953" },
  ];

  /**
   * @description 获取分时图的ECharts配置
   * @param {object} rawData - 从接口获取的完整原始数据
   * @returns {object} ECharts option
   */
    const getTimeSharingOption = (rawData) => {
        const { data } = rawData || {};
        if (!data || !data.trends || data.trends.length === 0) {
            return {
                title: { text: '暂无分时数据', left: 'center', top: 'center' },
                xAxis: { show: false }, yAxis: { show: false }, series: []
            };
        }

        const processedData = processTimeSharingData(data);
        const upColor = '#eb5454';
        const downColor = '#47b262';

        // 计算Y轴的动态范围
        const getMinMax = (prePrice, prices) => {
            const max = Math.max(prePrice, ...prices);
            const min = Math.min(prePrice, ...prices);
            const diff = Math.abs(max - min);
            // 增加一点缓冲区，防止图表顶边或触底
            return {
                min: (min - diff * 0.1).toFixed(2),
                max: (max + diff * 0.1).toFixed(2),
            };
        };
        
        const yAxisMinMax = getMinMax(processedData.prePrice, processedData.values);

        return {
            animation: false,
            title: { text: `${data.name} ${data.code}`, left: 20 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            legend: { data: ['价格', '均价'], bottom: 10, left: 'center' },
            grid: [
                { top: '8%', left: '10%', right: '8%', height: '60%' }, // 主图
                { left: '10%', right: '8%', top: '73%', height: '20%' }, // 成交量
            ],
            xAxis: [
                {
                    type: 'category',
                    data: processedData.categoryData,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    splitLine: { show: false },
                    min: 'dataMin',
                    max: 'dataMax',
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: processedData.categoryData,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: false },
                    min: 'dataMin',
                    max: 'dataMax',
                }
            ],
            yAxis: [
                {
                    scale: true,
                    splitArea: { show: true },
                    min: yAxisMinMax.min,
                    max: yAxisMinMax.max,
                    axisLabel: {
                        formatter: (value) => {
                            const rate = ((value - processedData.prePrice) / processedData.prePrice * 100);
                            const rateString = rate.toFixed(2) + '%';
                            return `${value.toFixed(2)}\n${rateString}`;
                        }
                    }
                },
                {
                    scale: true,
                    gridIndex: 1,
                    splitNumber: 2,
                    axisLabel: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                },
            ],
            dataZoom: [
                { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
            ],
            series: [
                {
                    name: '价格',
                    type: 'line',
                    data: processedData.values,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { color: '#2b7cff', width: 1.5 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                            offset: 0,
                            color: 'rgba(43, 124, 255, 0.3)'
                        }, {
                            offset: 1,
                            color: 'rgba(43, 124, 255, 0)'
                        }])
                    }
                },
                {
                    name: '均价',
                    type: 'line',
                    data: processedData.avgPrices,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { color: '#f6b92b', width: 1.2 }
                },
                {
                    name: '成交量',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: processedData.volumes,
                    itemStyle: {
                        color: ({ dataIndex }) => {
                            const currentPrice = processedData.values[dataIndex];
                            // 第一根柱子与昨收比较
                            const prevPrice = dataIndex > 0 ? processedData.values[dataIndex - 1] : processedData.prePrice;
                            return currentPrice >= prevPrice ? upColor : downColor;
                        }
                    }
                }
            ]
        };
    };

    const getKLineOption = (rawData) => {
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

    // 根据 klineType 路由到不同的 option 生成函数
    const getOption = (rawData) => {
        if (props.klineType === '分时' || props.klineType === '五日') {
            return getTimeSharingOption(rawData);
        }
        return getKLineOption(rawData);
    };

    const renderChart = async () => {
        if (!myChart) {
            myChart = echarts.init(chart.value);
        }

        myChart.showLoading();
        try {
            const klineData = await getKlineData(props.codeId, props.klineType);
            const option = getOption(klineData);
            // 第二个参数 `true` 表示不与之前的 option 进行合并，这对于切换完全不同的图表类型至关重要
            myChart.setOption(option, true);
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

  return {
    chart
  };
}
