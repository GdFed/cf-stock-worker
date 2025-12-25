import { ref, onMounted, watch } from 'vue';
import * as echarts from 'echarts';
import { getKlineData } from '../api/kline';
import { calculateKDJ, calculateMACD, calculateMA } from './kline-data/indicators';
import { processRawData } from './kline-data/kline';
import { getTimeSharingOption } from './kline-data/options';

export function useKlineChart(props, { onContextMenu } = {}) {
  const chart = ref(null);
  let myChart = null;
  let processedData = null; // 提升作用域，用于事件回调
  let selectedIndex = null; // 当前选中的K线索引，用于右键打开分时

  const maConfigs = [
    { name: "MA5", period: 5, color: "#faa90e" },
    { name: "MA10", period: 10, color: "#8400ff" },
    { name: "MA20", period: 20, color: "#416df9" },
    { name: "MA60", period: 60, color: "#001953" },
  ];

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

        processedData = processRawData(data.klines);
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
                    id: 'main-candle',
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

    const updateSelectionMark = () => {
        if (!myChart) return;

        const hasData = processedData && Array.isArray(processedData.categoryData) && processedData.categoryData.length > 0;
        const inRange = hasData && selectedIndex != null && selectedIndex >= 0 && selectedIndex < processedData.categoryData.length;

        if (!hasData || !inRange) {
            // 清除标记，并显式绑定到主蜡烛系列 id，避免 series 索引错位
            myChart.setOption({
                series: [{
                    id: 'main-candle',
                    markLine: {
                        symbol: 'none',
                        label: { show: false },
                        lineStyle: { color: '#888', type: 'dashed' },
                        data: []
                    }
                }]
            });
            return;
        }

        const date = processedData.categoryData[selectedIndex];
        myChart.setOption({
            series: [{
                id: 'main-candle',
                markLine: {
                    symbol: 'none',
                    label: { show: false },
                    lineStyle: { color: '#888', type: 'dashed' },
                    data: [{ xAxis: date }]
                }
            }]
        });
    };

    const bindInteractions = () => {
        const zr = myChart.getZr();

        // 左键点击：设置选中索引
        myChart.on('click', { seriesId: 'main-candle' }, (params) => {
            if (props.klineType === '分时' || props.klineType === '五日') return;
            if (!processedData || !processedData.categoryData || processedData.categoryData.length === 0) return;

            selectedIndex = params.dataIndex;
            updateSelectionMark();
            const date = processedData.categoryData[selectedIndex];
            console.log('K-line selected index:', selectedIndex, 'date:', date);
        });

        // 右键：打开分时弹窗
        zr.on('contextmenu', (event) => {
            if (props.klineType === '分时' || props.klineType === '五日') return;
            if (event && event.event && typeof event.event.preventDefault === 'function') {
                event.event.preventDefault();
            }

            if (!processedData || !processedData.categoryData || processedData.categoryData.length === 0) return;

            let idx = selectedIndex;
            if (idx == null) {
                const pointInPixel = [event.offsetX, event.offsetY];
                if (!myChart.containPixel({ gridIndex: 0 }, pointInPixel)) return;
                const xCoordArr = myChart.convertFromPixel({ gridIndex: 0 }, pointInPixel);
                const xCoord = Array.isArray(xCoordArr) ? xCoordArr[0] : xCoordArr;
                if (!Number.isFinite(xCoord)) return;
                idx = Math.max(0, Math.min(processedData.categoryData.length - 1, Math.round(xCoord)));
            }

            const date = processedData.categoryData[idx];
            console.log('K-line contextmenu on date:', date, 'index:', idx);
            if (typeof onContextMenu === 'function') {
                onContextMenu(date);
            }
        });
    };

    const renderChart = async () => {
        if (!myChart) {
            myChart = echarts.init(chart.value);
            // 解决图表初始动画导致的渲染问题
            myChart.setOption({ animation: false });
            bindInteractions();
        }

        myChart.showLoading();
        try {
            let klineData;
            // 如果是训练模式且有数据，则使用传入的数据
            if (props.isTraining && props.chartData) {
                klineData = props.chartData;
            } else if (props.codeId) { // 否则，如果不是训练模式，则通过接口获取
                klineData = await getKlineData(props.codeId, props.klineType);
            } else {
                // 如果是训练模式但初始没有数据，或者没有codeId，显示一个空状态
                myChart.setOption({
                    title: { text: '等待数据...', left: 'center', top: 'center' },
                    xAxis: { show: false }, yAxis: { show: false }, series: []
                }, true);
                myChart.hideLoading();
                return;
            }

            const option = getOption(klineData);
            // true 表示不与之前的 option 进行合并
            myChart.setOption(option, true);
            updateSelectionMark();
        } catch (error) {
            console.error('Failed to render chart:', error);
        } finally {
            myChart.hideLoading();
        }
    };

    onMounted(() => {
        renderChart();
    });

    watch(() => [props.codeId, props.klineType, props.chartData], () => {
        renderChart();
    }, { deep: true }); // 使用 deep watch 来侦听 chartData 内部的变化

  return {
    chart
  };
}
