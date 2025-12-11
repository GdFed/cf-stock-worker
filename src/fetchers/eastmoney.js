import { DEFAULT_UA } from '../utils/http.js';

// 从东方财富拉取 K 线数据
// 返回：解析后的数组（元素包含 day/open/close/high/low），或 null
export async function fetchFromEastmoney(input, datalen) {
  const s = String(input || '').trim().toLowerCase();
  let secid = '';
  if (/^(0.|1.)\d{6}$/.test(s)) {
    secid = s;
  } else {
    const m = s.match(/\d{6}/);
    const code = m ? m[0] : s;
    if (/^\d{6}$/.test(code)) {
      const first = code[0];
      const ex = first === '6' ? '1.' : '0.';
      secid = ex + code;
    }
  }
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&end=20500101&lmt=${datalen}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Referer: 'https://quote.eastmoney.com',
      Accept: 'application/json, text/plain, */*'
    },
  });
  if (!res.ok) throw new Error(`eastmoney ${res.status}`);
  const j = await res.json();
  const arr = j?.data?.klines;
  if (!Array.isArray(arr) || arr.length < 2) return null;
  return arr.map((line) => {
    const parts = String(line).split(',');
    return {
      day: parts[0],
      open: parts[1],
      close: parts[2],
      high: parts[3],
      low: parts[4],
    };
  });
}

// CLI 调试入口：node src/fetchers/eastmoney.js 600519 100
import { fileURLToPath } from 'url';
const isDirectRun = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  (async () => {
    try {
      const code = process.argv[2] || '';
      const datalen = Number.parseInt(process.argv[3] || '2', 10);
      if (!code) {
        console.error('用法: node src/fetchers/eastmoney.js <6位代码或带前缀symbol> [datalen]');
        process.exit(2);
      }
      const data = await fetchFromEastmoney(code, Number.isFinite(datalen) ? datalen : 2);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[ERROR]', e?.message || e);
      process.exit(1);
    }
  })();
}
