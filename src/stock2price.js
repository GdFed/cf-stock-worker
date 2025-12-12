#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import dayjs from 'dayjs';
import { fetchFromEastmoney } from './fetchers/eastmoney.js';
import { fetchFromSinaOpenapi } from './fetchers/sina-openapi.js';

dotenv.config();

const parseBool = (v, d = true) => {
  if (v == null) return d;
  const s = String(v).trim().toLowerCase();
  return !(s === 'false' || s === '0' || s === 'no' || s === 'off');
};

const argv = process.argv.slice(2);
const argUseNotion = argv.find(a => a.startsWith('--use-notion='));
const USE_NOTION = argUseNotion
  ? parseBool(argUseNotion.split('=')[1], true)
  : parseBool(process.env.USE_NOTION, true);

const notion = USE_NOTION ? new Client({ auth: process.env.NOTION_TOKEN }) : null;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;



async function fetchPrices(code, datalen) {
  const sources = [
    { name: 'sina openapi', fn: () => fetchFromSinaOpenapi(code, datalen) },
    { name: 'eastmoney', fn: () => fetchFromEastmoney(code, datalen) },
  ];

  for (const src of sources) {
    try {
      const arr = await src.fn();
      if (Array.isArray(arr) && arr.length >= 2) {
        return arr;
      } else {
        console.warn(`[WARN] 数据源返回为空 ${src.name} ${code}`);
      }
    } catch (e) {
      console.warn(`[WARN] 数据源失败 ${src.name} ${code}: ${e.message}`);
    }
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
 * 本地调试用：提供模拟的 Notion 页面数据
 * 结构与 extractCodeFromPage/extractDateFromPage 兼容
 */
function getMockPages() {
  return [
    {
      id: 'mock-1',
      properties: {
        Code: { type: 'title', title: [{ plain_text: '002095' }] },
        Date: { type: 'date', date: { start: dayjs().subtract(30, 'day').format('YYYY-MM-DD') } }
      }
    },
    {
      id: 'mock-2',
      properties: {
        Code: { type: 'title', title: [{ plain_text: '600519' }] },
        Date: { type: 'date', date: { start: dayjs().subtract(1, 'day').format('YYYY-MM-DD') } }
      }
    },
    {
      id: 'mock-3',
      properties: {
        Code: { type: 'title', title: [{ plain_text: '600519' }] },
        Date: { type: 'date', date: { start: dayjs().subtract(7, 'day').format('YYYY-MM-DD') } }
      }
    }
  ];
}

/**
 * 更新页面价格
 */
async function updatePagePrices(pageId, entryClose, todayClose, maxClose, minClose) {
  if (!USE_NOTION) {
    console.log(`[MOCK UPDATE] page=${pageId} 入库股价=${entryClose} 当日股价=${todayClose} 最高价=${maxClose} 最低价=${minClose}`);
    return;
  }
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
  if (USE_NOTION) {
    if (!DATABASE_ID) {
      console.error('[ERROR] 缺少环境变量 NOTION_DATABASE_ID');
      process.exit(1);
    }
    if (!process.env.NOTION_TOKEN) {
      console.error('[ERROR] 缺少环境变量 NOTION_TOKEN');
      process.exit(1);
    }
    console.log('[INFO] 拉取 Notion 数据库页面...');
  } else {
    console.log('[INFO] MOCK 模式：使用本地模拟的 Notion 页面数据，不会对远程 Notion 进行任何读写操作');
  }

  const pages = USE_NOTION ? await listAllPages(DATABASE_ID) : getMockPages();
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

    const arr = await fetchPrices(code, datalen);
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
    // console.log(`[INFO] 正在处理price数据 ${JSON.stringify(arr)}`)
    // 构建 日期(YYYY-MM-DD) -> close 映射
    const dateToClose = new Map();
    for (const item of arr) {
      const dayStr = item?.day;
      const closeNum = parseFloat(item?.close);
      if (!dayStr || Number.isNaN(closeNum)) continue;
      const key = dayjs(dayStr).format('YYYY-MM-DD');
      dateToClose.set(key, closeNum);
    }


    for (const { page, date } of infos) {
      try {
        const entryClose = dateToClose.get(date) || 0;
        const todayClose = parseFloat(arr[arr.length - 1].close) || 0;
        const limitArr = arr.filter(item => !dayjs(item.day).isBefore(dayjs(date), 'day'))
        console.log(date , '日期下: ',JSON.stringify(limitArr))
        const maxClose = parseFloat(limitArr.reduce((max, item) => (max > item.high ? max : item.high), 0));
        const minClose = parseFloat(limitArr.reduce((min, item) => (min < item.low ? min : item.low), Infinity));
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
