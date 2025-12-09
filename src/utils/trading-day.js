// Trading day utilities (ESM)
// Extracted shared logic: holiday calendar, fmt, isTradeDay, lastTradeDay.

/**
 * Holiday calendar for 2026 (YYYY-MM-DD).
 */
export const holiday = new Set([
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-22','2026-02-23','2026-04-05','2026-04-06','2026-05-01','2026-05-02',
  '2026-06-14','2026-06-15','2026-09-21','2026-09-22','2026-10-01','2026-10-02',
  '2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'
]);

/**
 * Format Date to YYYY-MM-DD.
 * @param {Date} d
 * @returns {string}
 */
export const fmt = d => d.toISOString().slice(0, 10);

/**
 * Check if given date is a trading day (Mon-Fri and not in holiday set).
 * @param {Date} d
 * @returns {boolean}
 */
export const isTradeDay = d => {
  const day = d.getDay();
  return day !== 0 && day !== 6 && !holiday.has(fmt(d));
};

/**
 * Walk dates by given step until hitting a trading day.
 * Note: step=0 returns immediately if current date is trade day; if not, it will loop forever.
 * @param {Date|string} d - Date or date string compatible with new Date()
 * @param {number} step - day step, default -1
 * @returns {Date}
 */
export const lastTradeDay = (d, step = -1) => {
  const t = new Date(d);
  // Preserve original semantics from callers; no guard for step=0 here.
  // Caller uses step=0 expecting "today if trade day".
  while (true) {
    t.setDate(t.getDate() + step);
    if (isTradeDay(t)) return t;
  }
};
