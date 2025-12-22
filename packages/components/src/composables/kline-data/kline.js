/**
 * @description 解析原始K线数据
 * @param {string[]} rawDataStrings - 原始K线数据字符串数组, e.g., ["2023-01-01,10,12,13,9,1000"]
 * @returns {{
 *   categoryData: string[],          // X 轴的日期数据: ["2023-01-01", ...]
 *   values: number[][],              // K线数据: [[open, close, lowest, highest], ...]
 *   volumes: (number|string)[][]     // 成交量数据: [[index, volume, sign], ...]
 * }}
 */
export const processRawData = (rawDataStrings) => {
    // categoryData: 用于图表X轴的日期标签
    // e.g., ["2023-01-01", "2023-01-02", ...]
    const categoryData = [];
    
    // values: K线图所需的核心数据，ECharts需要 [开盘价, 收盘价, 最低价, 最高价] 格式
    // e.g., [[10, 12, 9, 13], [12, 11, 10, 13], ...]
    const values = [];
    
    // volumes: 成交量图所需的数据
    // 格式为 [数据点索引, 当日成交量, 涨跌标志]
    // 涨跌标志: 1 表示涨或平（收盘价 >= 开盘价），-1 表示跌（收盘价 < 开盘价），用于区分成交量柱的颜色
    // e.g., [[0, 1000, 1], [1, 1200, -1], ...]
    const volumes = [];

    for (let i = 0; i < rawDataStrings.length; i++) {
        // rawDataString 格式: "日期,开盘价,收盘价,最高价,最低价,成交量"
        // e.g., "2023-01-01,10,12,13,9,1000"
        let parts = rawDataStrings[i].split(",");
        categoryData.push(parts[0]);
        parts.shift();
        const ohlc = parts.map(Number);
        
        // ECharts K线图需要的数据格式为 [open, close, lowest, highest]
        // 原始数据是 [open, close, highest, lowest, volume]
        values.push([ohlc[0], ohlc[1], ohlc[3], ohlc[2]]);
        
        // 成交量柱状图的数据
        volumes.push([
            i, // 数据点的索引，用于在图表上定位
            ohlc[4], // 当天的成交量
            ohlc[0] > ohlc[1] ? -1 : 1 // 判断当天是涨还是跌。-1: 跌, 1: 涨或平
        ]);
    }
    return { categoryData, values, volumes };
};
