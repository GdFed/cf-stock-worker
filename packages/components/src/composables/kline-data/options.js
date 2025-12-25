import * as echarts from 'echarts';
import { processTimeSharingData } from './time-sharing';

/**
 * @description 获取分时图的ECharts配置
 * @param {object} rawData - 从接口获取的完整原始数据
 * @returns {object} ECharts option
 */
export const getTimeSharingOption = (rawData) => {
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
