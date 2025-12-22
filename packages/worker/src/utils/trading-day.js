// 交易日工具 (ESM)
// 提取的共享逻辑：假日日历、fmt、isTradeDay、lastTradeDay。

/**
 * 2026 年假日日历 (YYYY-MM-DD)。
 */
export const holiday = new Set([
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-22','2026-02-23','2026-04-05','2026-04-06','2026-05-01','2026-05-02',
  '2026-06-14','2026-06-15','2026-09-21','2026-09-22','2026-10-01','2026-10-02',
  '2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'
]);

/**
 * 将日期格式化为 YYYY-MM-DD。
 * @param {Date} d
 * @returns {string}
 */
export const fmt = d => d.toISOString().slice(0, 10);

/**
 * 检查给定日期是否为交易日（周一至周五且不在假日列表中）。
 * @param {Date} d
 * @returns {boolean}
 */
export const isTradeDay = d => {
  const day = d.getDay();
  return day !== 0 && day !== 6 && !holiday.has(fmt(d));
};

/**
 * 按给定步长遍历日期，直到找到一个交易日。
 * 注意：如果当前日期是交易日，step=0 会立即返回；如果不是，则会无限循环。
 * @param {Date|string} d - 日期或与 new Date() 兼容的日期字符串
 * @param {number} step - 日期步长，默认为 -1
 * @returns {Date}
 */
export const lastTradeDay = (d, step = -1) => {
  const t = new Date(d);
  // 保留调用者的原始语义；此处不对 step=0 进行保护。
  // 调用者使用 step=0 期望“如果是交易日则返回今天”。
  while (true) {
    t.setDate(t.getDate() + step);
    if (isTradeDay(t)) return t;
  }
};
