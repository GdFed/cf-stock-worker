#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { intersectionByDates } from './utils/intersection.js';
import { fmt, lastTradeDay, isTradeDay } from './utils/trading-day.js';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
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


/* ============  5. 写入/更新 Notion  ============ */
async function upsert(code, dateStr) {
  // 先查是否已存在（按 Code + Date 唯一）
  const exist = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: 'Code', title: { equals: code } },
        { property: 'Date', date: { equals: dateStr } }
      ]
    }
  });
  const payload = {
    Code: { title: [{ text: { content: code } }] },
    Date: { date: { start: dateStr } },
    来源: { select: { name: '交集' } }
  };
  if (exist.results.length) {
    await notion.pages.update({ page_id: exist.results[0].id, properties: payload });
    console.log(`[UPDATE] ${code} ${dateStr}`);
  } else {
    await notion.pages.create({ parent: { database_id: DATABASE_ID }, properties: payload });
    console.log(`[INSERT] ${code} ${dateStr}`);
  }
}

(async ()=>{
  // 3. 读取数据
  const buyRes = await fetch("http://xgpiao.net/mystock/const/hisdata/sortdata/genes_buy.txt");
  const buyText = await buyRes.text();

  // 4. 按天计算交集并写入
  let total = 0;
  for (const d of dates) {
    const strongRes = await fetch(`http://xgpiao.net/mystock/const/hisdata/sortdata/ghosthisdata/power_${d}.txt`);
    if (!strongRes.ok) {
      console.warn(`[WARN] 跳过：强榜文件不存在或请求失败 ${d} (${strongRes.status})`);
      continue;
    }
    const strongText = await strongRes.text();
    const codes = intersectionByDates(buyText, strongText, [d]);
    console.log(`[INFO] ${d} 交集数量：${codes.length}`);
    for (const c of codes) {
      await upsert(c, d);
      total++;
    }
  }

  if (total === 0) {
    console.log('[INFO] 无交集，跳过');
  } else {
    console.log(`[INFO] 同步完成，总计处理：${total}`);
  }
})();
