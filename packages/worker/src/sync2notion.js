#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { intersectionByDates } from './utils/intersection.js';
import { fmt, lastTradeDay, isTradeDay } from './utils/trading-day.js';

dotenv.config();

const NOTION_TIMEOUT_MS = Number(process.env.NOTION_TIMEOUT_MS || 180000); // 180秒
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 15000);    // 15秒

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  timeoutMs: NOTION_TIMEOUT_MS
});
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/* ============  2. 取最近 n 个交易日  ============ */
const N = Math.max(1, parseInt(process.env.DAYS_N || '3', 10));
function recentTradeDays(n) {
  let cur = new Date();
  if (!isTradeDay(cur)) cur = lastTradeDay(cur, -1);
  const out = [fmt(cur)];
  for (let i = 1; i < n; i++) {
    cur = lastTradeDay(cur, -1);
    out.push(fmt(cur));
  }
  return out;
}
const dates = recentTradeDays(N);
console.log(`[INFO] 过滤日期(${N}): ${dates.join(' / ')}`);
console.log(`[INFO] Notion timeoutMs=${NOTION_TIMEOUT_MS}ms, fetch timeout=${FETCH_TIMEOUT_MS}ms`);

/* ============  解析强榜文本为 code→strength 映射  ============ */
function buildStrengthMap(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const code = parts[0].trim();
    const last = parts[parts.length - 1].trim();
    const val = parseInt(last, 10);
    if (code && Number.isFinite(val)) {
      map.set(code, val);
    }
  }
  return map;
}

/* ============  工具：延迟 / 重试 / 带超时的 fetch  ============ */
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function isRetryableError(e) {
  const msg = String(e?.message || '');
  const code = e?.code || e?.cause?.code;
  const name = e?.name;

  // Notion SDK 特定超时码
  if (code === 'notionhq_client_request_timeout') return true;

  // 连接 / 超时类
  const timeoutLike =
    /timed out/i.test(msg) ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    name === 'AbortError';

  const networkLike =
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNREFUSED' ||
    code === 'ENETUNREACH';

  return Boolean(timeoutLike || networkLike);
}

async function withRetry(run, opts = {}) {
  const {
    retries = 3,
    minDelayMs = 1000,
    factor = 2,
    jitter = 0.2
  } = opts;
  let attempt = 0;
  // 共尝试 retries+1 次
  while (attempt <= retries) {
    try {
      return await run();
    } catch (e) {
      const last = attempt === retries;
      if (!isRetryableError(e) || last) {
        throw e;
      }
      const backoff =
        minDelayMs * Math.pow(factor, attempt) *
        (1 - jitter + Math.random() * jitter * 2);
      console.warn(`[RETRY] attempt=${attempt + 1}/${retries + 1} wait=${Math.round(backoff)}ms reason=${e?.code || e?.name || e}`);
      await delay(backoff);
      attempt++;
    }
  }
  // 理论上不会走到这里
  throw new Error('Unexpected retry loop exit');
}

async function fetchWithTimeout(url, {
  timeoutMs = FETCH_TIMEOUT_MS,
  retries = 2,
  minDelayMs = 800,
  factor = 2
} = {}) {
  let attempt = 0;
  while (attempt <= retries) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ac.signal });
      clearTimeout(timer);
      if (!res.ok) {
        // 非 2xx 也重试（有限次数）
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      const last = attempt === retries;
      if (last) throw e;
      const backoff = minDelayMs * Math.pow(factor, attempt);
      console.warn(`[FETCH RETRY] ${url} attempt=${attempt + 1}/${retries + 1} wait=${Math.round(backoff)}ms reason=${e?.message || e}`);
      await delay(backoff);
      attempt++;
    }
  }
  throw new Error('Unexpected fetch retry loop exit');
}

/* ============  预取：按日期列出现有页面，构建 Code->pageId 映射  ============ */
async function listExistingByDate(dateStr) {
  const pages = [];
  let cursor;
  do {
    const res = await withRetry(() =>
      notion.databases.query({
        database_id: DATABASE_ID,
        filter: { property: 'Date', date: { equals: dateStr } },
        start_cursor: cursor,
        page_size: 300
      }),
      { retries: 3, minDelayMs: 1000, factor: 2 }
    );
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  const map = new Map();
  for (const p of pages) {
    const codeTitle = p?.properties?.Code?.title?.[0]?.plain_text?.trim();
    if (codeTitle) map.set(codeTitle, p.id);
  }
  return map;
}

/* ============  5. 写入/更新 Notion（使用预取映射 + 重试）  ============ */
async function upsert(code, dateStr, strength, existingMap) {
  const payload = {
    Code: { title: [{ text: { content: code } }] },
    Date: { date: { start: dateStr } },
    来源: { select: { name: '交集' } }
  };
  if (Number.isFinite(strength)) {
    payload['强度'] = { number: strength };
  }

  const pageId = existingMap?.get(code);
  if (pageId) {
    await withRetry(
      () => notion.pages.update({ page_id: pageId, properties: payload }),
      { retries: 3, minDelayMs: 1000, factor: 2 }
    );
    console.log(`[UPDATE] ${code} ${dateStr}`);
  } else {
    await withRetry(
      () => notion.pages.create({ parent: { database_id: DATABASE_ID }, properties: payload }),
      { retries: 3, minDelayMs: 1000, factor: 2 }
    );
    console.log(`[INSERT] ${code} ${dateStr}`);
  }
}

(async () => {
  // 3. 读取数据（带超时与重试）
  let buyText;
  try {
    const buyRes = await fetchWithTimeout("http://xgpiao.net/mystock/const/hisdata/sortdata/genes_buy.txt");
    buyText = await buyRes.text();
  } catch (e) {
    console.error(`[ERROR] 读取买入榜失败，终止：${e?.message || e}`);
    process.exit(1);
  }

  // 4. 按天计算交集并写入
  let total = 0;
  for (const d of dates) {
    let strongText;
    try {
      const strongRes = await fetchWithTimeout(`http://xgpiao.net/mystock/const/hisdata/sortdata/ghosthisdata/power_${d}.txt`);
      strongText = await strongRes.text();
    } catch (e) {
      console.warn(`[WARN] 跳过：强榜文件不存在或请求失败 ${d} (${e?.message || e})`);
      continue;
    }

    const strengthMap = buildStrengthMap(strongText);
    const codes = intersectionByDates(buyText, strongText, [d]);
    console.log(`[INFO] ${d} 交集数量：${codes.length}`);

    // 预取当天已存在的页面，避免每条都先 query
    let existingMap = new Map();
    try {
      existingMap = await listExistingByDate(d);
      console.log(`[INFO] ${d} Notion 已有：${existingMap.size} 条`);
    } catch (e) {
      console.warn(`[WARN] 预取现有页面失败，将逐条创建/更新（可能更慢）：${e?.message || e}`);
    }

    for (const c of codes) {
      try {
        await upsert(c, d, strengthMap.get(c), existingMap);
      } catch (e) {
        console.error(`[ERROR] ${c} ${d} ${e?.message || e}`);
      }
      total++;
    }
  }

  if (total === 0) {
    console.log('[INFO] 无交集，跳过');
  } else {
    console.log(`[INFO] 同步完成，总计处理：${total}`);
  }
})();
