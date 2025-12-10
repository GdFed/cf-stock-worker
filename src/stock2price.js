#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import dayjs from 'dayjs';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const textLooksBlocked = (txt) => /拒绝访问|Access Denied/i.test(txt);

const safeJSON = (txt) => {
  try { return JSON.parse(txt); } catch { return null; }
};

/**
 * 将 6 位股票代码转换为新浪接口 symbol
 * 规则：0/3 → sz，6 → sh，其他 → bj
 * 传入值形态为 "002095"
 */
function normalizeSymbol(code) {
  const c = String(code).trim();
  if (!/^\d{6}$/.test(c)) {
    console.warn(`[WARN] 非 6 位数字代码，默认 bj 前缀：${code}`);
    return `bj${c}`;
  }
  const first = c[0];
  if (first === '0' || first === '3') return `sz${c}`;
  if (first === '6') return `sh${c}`;
  return `bj${c}`;
}

/**
 * 拉取 K 线数据（多源：优先东方财富，失败回退新浪 openapi）
 * 返回：解析后的数组（元素包含 day/close/...），或 null
 */
async function fetchFromEastmoney(symbol, datalen) {
  const code = symbol.slice(2);
  const ex = symbol.slice(0, 2); // sh/sz/bj
  const secid = (ex === 'sh' ? `1.${code}` : `0.${code}`); // bj 暂按 0
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&end=20500101&lmt=${datalen}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      'Referer': 'https://quote.eastmoney.com',
      'Accept': 'application/json, text/plain, */*'
    }
  });
  if (!res.ok) throw new Error(`eastmoney ${res.status}`);
  const txt = await res.text();
  if (textLooksBlocked(txt)) throw new Error('eastmoney blocked');
  const j = safeJSON(txt);
  const arr = j?.data?.klines;
  if (!Array.isArray(arr) || arr.length < 2) return null;
  return arr.map(line => {
    const parts = String(line).split(',');
    return {
      day: parts[0],
      open: parts[1],
      close: parts[2],
      high: parts[3],
      low: parts[4]
    };
  });
}

async function fetchFromSinaOpenapi(symbol, datalen) {
  const url = `https://quotes.sina.cn/cn/api/openapi.php/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=240&datalen=${datalen}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      'Referer': 'https://finance.sina.com.cn',
      'Accept': 'application/json, text/plain, */*'
    }
  });
  const txt = await res.text();
  if (!res.ok || textLooksBlocked(txt)) throw new Error(`sina openapi blocked/status=${res.status}`);
  const j = safeJSON(txt);
  // 兼容多种结构，尽量提取 kline 列表
  let kd = null;
  if (Array.isArray(j)) {
    kd = j;
  } else if (j?.result?.data) {
    const data = j.result.data;
    const firstKey = Object.keys(data || {})[0];
    kd = data[firstKey]?.kline || data[firstKey] || data.kline;
  } else if (j?.data?.kline) {
    kd = j.data.kline;
  }
  if (!Array.isArray(kd) || kd.length < 2) return null;
  return kd.map(item => {
    if (Array.isArray(item)) {
      return { day: item[0], open: item[1], close: item[2], high: item[3], low: item[4] };
    }
    return { day: item?.day, open: item?.open, close: item?.close, high: item?.high, low: item?.low };
  });
}

async function fetchPrices(symbol, datalen) {
  const providers = [
    () => fetchFromEastmoney(symbol, datalen),
    () => fetchFromSinaOpenapi(symbol, datalen)
  ];
  for (const p of providers) {
    try {
      const arr = await p();
      if (Array.isArray(arr) && arr.length >= 2) return arr;
    } catch (e) {
      console.warn(`[WARN] 数据源失败 ${symbol}: ${e.message}`);
    }
    // 随机短暂等待，避免瞬时触发风控
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
  }
  return null;
}

/**
 * 分页拉取 Notion 数据库全部页面
 */
async function listAllPages(databaseId) {
  const pages = [];
  let cursor = undefined;
  while (true) {
    const resp = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100
    });
    pages.push(...resp.results);
    if (resp.has_more) {
      cursor = resp.next_cursor;
    } else {
      break;
    }
  }
  return pages;
}

/**
 * 从页面属性中提取 Code 文本
 */
function extractCodeFromPage(page) {
  const prop = page.properties?.Code;
  if (!prop || prop.type !== 'title') return null;
  const titleArr = prop.title || [];
  const text = titleArr[0]?.plain_text ?? titleArr[0]?.text?.content ?? '';
  const code = String(text || '').trim();
  if (!code) return null;
  // 页面值形态是 "002095"
  if (!/^\d{6}$/.test(code)) {
    console.warn(`[WARN] 页面 Code 非 6 位数字，跳过 page_id=${page.id} 值=${code}`);
    return null;
  }
  return code;
}

/**
 * 从页面属性中提取日期（Date）为 YYYY-MM-DD 字符串
 */
function extractDateFromPage(page) {
  const prop = page.properties?.Date;
  if (!prop || prop.type !== 'date') return null;
  const start = prop.date?.start;
  if (!start) return null;
  // 统一为 YYYY-MM-DD（Notion 内通常为此格式）
  return String(start).slice(0, 10);
}

/**
 * 更新页面价格
 */
async function updatePagePrices(pageId, entryClose, todayClose, maxClose, minClose) {
  const properties = {
    '入库股价': { number: entryClose },
    '当日股价': { number: todayClose },
    '最高价': { number: maxClose },
    '最低价': { number: minClose }
  };
  await notion.pages.update({ page_id: pageId, properties });
  console.log(`[UPDATE] page=${pageId} 入库股价=${entryClose} 当日股价=${todayClose} 最高价=${maxClose} 最低价=${minClose}`);
}

/**
 * 简单节流
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!DATABASE_ID) {
    console.error('[ERROR] 缺少环境变量 NOTION_DATABASE_ID');
    process.exit(1);
  }
  if (!process.env.NOTION_TOKEN) {
    console.error('[ERROR] 缺少环境变量 NOTION_TOKEN');
    process.exit(1);
  }

  console.log('[INFO] 拉取 Notion 数据库页面...');
  const pages = await listAllPages(DATABASE_ID);
  console.log(`[INFO] 页面总数：${pages.length}`);

  // 收集 code -> [{ page, date: 'YYYY-MM-DD' | null }, ...]
  const codeToInfos = new Map();
  for (const p of pages) {
    const code = extractCodeFromPage(p);
    if (!code) continue;
    const dateStr = extractDateFromPage(p); // 可能为 null
    if (!codeToInfos.has(code)) codeToInfos.set(code, []);
    codeToInfos.get(code).push({ page: p, date: dateStr });
  }

  const uniqueCodes = Array.from(codeToInfos.keys());
  console.log(`[INFO] 唯一股票代码数量：${uniqueCodes.length}`);

  // 拉取每个唯一代码的价格（按该代码所有页面里最早的日期计算 datalen）
  const dataByCode = new Map(); // code -> array of kline rows
  for (const code of uniqueCodes) {
    const infos = codeToInfos.get(code) || [];
    // 选择最早的日期
    const dates = infos.map(x => x.date).filter(Boolean);
    let earliest = null;
    if (dates.length) {
      earliest = dates.reduce((min, d) => (min && dayjs(min).isBefore(d) ? min : d), dates[0]);
    }

    // scale=240代表日，按 day 计算 datalen：diffDays + 1，至少 2
    let datalen = 2;
    if (earliest) {
      const today = dayjs().startOf('day');
      const start = dayjs(earliest).startOf('day');
      let diff = today.diff(start, 'day');
      if (diff < 0) diff = 0;
      datalen = Math.max(2, diff + 1);
    }

    const symbol = normalizeSymbol(code);
    const arr = await fetchPrices(symbol, datalen);
    if (arr) {
      dataByCode.set(code, arr);
    }
    // 轻微节流，避免外部接口/Notion过载
    await sleep(200);
  }

  // 更新页面
  let updated = 0;
  for (const [code, infos] of codeToInfos.entries()) {
    const arr = dataByCode.get(code);
    if (!arr) {
      console.warn(`[WARN] 无法获取价格，跳过代码 ${code}`);
      continue;
    }

    // 构建 日期(YYYY-MM-DD) -> close 映射
    const dateToClose = new Map();
    for (const item of arr) {
      const dayStr = item?.day;
      const closeNum = parseFloat(item?.close);
      if (!dayStr || Number.isNaN(closeNum)) continue;
      const key = dayjs(dayStr).format('YYYY-MM-DD');
      dateToClose.set(key, closeNum);
    }

    // todayClose 取最后一条有效 close
    let todayClose = NaN;
    for (let i = arr.length - 1; i >= 0; i--) {
      const c = parseFloat(arr[i]?.close);
      if (!Number.isNaN(c)) {
        todayClose = c;
        break;
      }
    }
    if (Number.isNaN(todayClose)) {
      console.warn(`[WARN] todayClose 解析失败，跳过代码 ${code}`);
      continue;
    }

    // fallback：第一条有效 close 作为入库价回退
    let firstClose = NaN;
    for (let i = 0; i < arr.length; i++) {
      const c = parseFloat(arr[i]?.close);
      if (!Number.isNaN(c)) {
        firstClose = c;
        break;
      }
    }
    if (Number.isNaN(firstClose)) {
      console.warn(`[WARN] first close 解析失败，跳过代码 ${code}`);
      continue;
    }

    // 计算 arr 中 close 的最高/最低
    const closes = arr
      .map(it => parseFloat(it?.close))
      .filter(v => Number.isFinite(v) && !Number.isNaN(v));
    if (!closes.length) {
      console.warn(`[WARN] 未找到有效 close，跳过代码 ${code}`);
      continue;
    }
    const maxClose = Math.max(...closes);
    const minClose = Math.min(...closes);

    for (const { page, date } of infos) {
      try {
        const entryClose = (date && dateToClose.has(date)) ? dateToClose.get(date) : firstClose;
        if (Number.isNaN(entryClose)) {
          console.warn(`[WARN] entryClose 解析失败 page=${page.id} code=${code} date=${date}`);
          continue;
        }
        await updatePagePrices(page.id, entryClose, todayClose, maxClose, minClose);
        updated++;
      } catch (e) {
        console.warn(`[WARN] 更新失败 page=${page.id} code=${code}: ${e.message}`);
      }
      await sleep(200);
    }
  }

  if (updated === 0) {
    console.log('[INFO] 无页面更新');
  } else {
    console.log(`[INFO] 完成，更新页面数量：${updated}`);
  }
})();
