/**
 * @description 计算移动平均线 (MA)
 * @param {number} period - 周期
 * @param {{values: number[][]}} processedData - 解析后的数据
 * @returns {(number|string)[]}
 */
export const calculateMA = (period, processedData) => {
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
export const calculateMACD = (processedData, short = 12, long = 26, signal = 9) => {
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
export const calculateKDJ = (processedData, n = 9, m1 = 3, m2 = 3) => {
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
