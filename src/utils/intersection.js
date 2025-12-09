// Intersection utility (ESM)
// Unified newline handling and shared logic between Worker and Node CLI.

/**
 * Compute intersection of buy codes (filtered by target dates) and strong codes.
 * @param {string} buyText - Lines like "CODE:date1,date2,..."
 * @param {string} strongText - Lines like "CODE,..." (take first segment as code)
 * @param {Set<string>} targetDates - Set of dates to filter buy codes by (e.g., new Set([today, yesterday]))
 * @returns {string[]} Sorted list of codes in the intersection.
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
 * Convenience wrapper using two dates.
 * @param {string} buyText
 * @param {string} strongText
 * @param {string[]} days
 * @returns {string[]}
 */
export function intersectionByDates(buyText, strongText, days) {
  const targetDates = new Set(days);
  return intersectionByDateSet(buyText, strongText, targetDates);
}
