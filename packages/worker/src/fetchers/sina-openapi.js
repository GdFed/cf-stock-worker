import { DEFAULT_UA } from '../utils/http.js';

// 从新浪 openapi 拉取 K 线数据
// 返回：解析后的数组（元素包含 day/open/close/high/low），或 null
export async function fetchFromSinaOpenapi(input, datalen) {
  const s = String(input || '').trim().toLowerCase();
  let symbol = '';
  if (/^(sh|sz|bj)\d{6}$/.test(s)) {
    symbol = s;
  } else {
    const m = s.match(/\d{6}/);
    const code = m ? m[0] : s;
    if (/^\d{6}$/.test(code)) {
      const first = code[0];
      const ex = (first === '0' || first === '3') ? 'sz' : (first === '6' ? 'sh' : 'bj');
      symbol = ex + code;
    } else {
      symbol = 'bj' + code;
    }
  }
  const url = `https://quotes.sina.cn/cn/api/openapi.php/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=240&datalen=${datalen}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Referer: 'https://finance.sina.com.cn',
      Accept: 'application/json, text/plain, */*',
    },
  });
  if (!res.ok) throw new Error(`sina openapi ${res.status}`);
  const j = await res.json();

  // 兼容多种结构，尽量提取 kline 列表
  let kd = null;
  if (Array.isArray(j)) {
    kd = j;
  } else if (j?.result?.data) {
    const data = j.result.data;
    if (Array.isArray(data)) {
      kd = data;
    } else {
      const firstKey = Object.keys(data || {})[0];
      kd = data[firstKey]?.kline || data[firstKey] || data.kline;
    }
  } else if (j?.data?.kline) {
    kd = j.data.kline;
  }

  if (!Array.isArray(kd) || kd.length < 2) return null;
  return kd.map((item) => {
    if (Array.isArray(item)) {
      return { day: item[0], open: item[1], close: item[2], high: item[3], low: item[4] };
    }
    return { day: item?.day, open: item?.open, close: item?.close, high: item?.high, low: item?.low };
  });
}

// CLI 调试入口：node src/fetchers/sina-openapi.js 600519 120
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
        console.error('用法: node src/fetchers/sina-openapi.js <6位代码或带前缀symbol> [datalen]');
        process.exit(2);
      }
      const data = await fetchFromSinaOpenapi(code, Number.isFinite(datalen) ? datalen : 2);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[ERROR]', e?.message || e);
      process.exit(1);
    }
  })();
}
