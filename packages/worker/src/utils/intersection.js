// 交集工具 (ESM)
// 在 Worker 和 Node CLI 之间统一处理换行符和共享逻辑。

/**
 * 计算买入代码（按目标日期过滤）和强势代码的交集。
 * @param {string} buyText - 格式为 "代码:日期1,日期2,..." 的行
 * @param {string} strongText - 格式为 "代码,..." 的行 (取第一部分作为代码)
 * @param {Set<string>} targetDates - 用于过滤买入代码的日期集合 (例如, new Set([今天, 昨天]))
 * @returns {string[]} 交集中已排序的代码列表。
 */
export function intersectionByDateSet(buyText, strongText, targetDates) {
  const strongSet = new Set(
    strongText
      .split(/\r?\n/)
      .map(l => l.trim().split(',')[0])
      .filter(Boolean)
  );

  const buySet = new Set();
  buyText.split(/\r?\n/).forEach(line => {
    const [code, dates] = line.split(':');
    if (!dates) return;
    const hasTargetDate = dates
      .split(',')
      .some(d => targetDates.has(d.trim()));
    if (hasTargetDate) buySet.add(code.trim());
  });

  return [...buySet].filter(c => strongSet.has(c)).sort();
}

/**
 * 使用两个日期的便捷包装器。
 * @param {string} buyText
 * @param {string} strongText
 * @param {string[]} days
 * @returns {string[]}
 */
export function intersectionByDates(buyText, strongText, days) {
  const targetDates = new Set(days);
  return intersectionByDateSet(buyText, strongText, targetDates);
}
