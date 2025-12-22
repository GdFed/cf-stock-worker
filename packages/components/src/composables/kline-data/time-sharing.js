/**
 * @description 解析分时图数据
 * @param {object} rawData - 接口返回的原始数据中的 `data` 对象.
 * @param {string} rawData.prePrice - 昨日收盘价.
 * @param {string[]} rawData.trends - 分时数据点字符串数组. e.g., ["2025-12-22 09:30,10.0,100,10.1", ...]
 * @returns {{
 *   categoryData: string[], // X 轴的时间数据 (HH:mm)
 *   values: number[],       // 每分钟的价格
 *   volumes: number[],      // 每分钟的成交量
 *   avgPrices: number[],    // 每分钟的均价
 *   prePrice: number        // 昨日收盘价
 * }}
 */
export const processTimeSharingData = (rawData) => {
    const { prePrice, trends } = rawData;

    // categoryData: 用于图表X轴的时间标签 (格式 "HH:mm")
    // e.g., ["09:30", "09:31", ...]
    const categoryData = [];
    
    // values: 分时图中的价格线
    // e.g., [10.0, 10.1, ...]
    const values = [];
    
    // volumes: 分时图下方的成交量柱
    // e.g., [100, 120, ...]
    const volumes = [];
    
    // avgPrices: 分时图中的均价线 (黄色线)
    // e.g., [10.1, 10.15, ...]
    const avgPrices = [];

    trends.forEach(itemStr => {
        // itemStr 格式: "YYYY-MM-DD HH:mm,价格,成交量,均价"
        // e.g., "2025-12-22 09:30,10.0,100,10.1"
        const parts = itemStr.split(',');
        const time = parts[0]; // e.g., "2025-12-22 09:30"
        const price = parseFloat(parts[1]);
        const volume = parseInt(parts[2]);
        const avgPrice = parseFloat(parts[3]);

        // 提取 "HH:mm" 部分作为X轴标签
        categoryData.push(time.slice(11));
        values.push(price);
        volumes.push(volume);
        avgPrices.push(avgPrice);
    });

    // 返回解析后的数据，同时将昨日收盘价转为数字类型
    return { categoryData, values, volumes, avgPrices, prePrice: parseFloat(prePrice) };
};
