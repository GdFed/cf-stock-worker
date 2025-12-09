#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { intersectionByDates } from './utils/intersection.js';
import { fmt, lastTradeDay } from './utils/trading-day.js';
import { getGitHubFile } from './utils/github-file.js';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;


/* ============  2. 取最近两个交易日  ============ */
const todayTrade   = fmt(lastTradeDay(new Date(), 0));
const yesterdayTrade = fmt(lastTradeDay(new Date(todayTrade), -1));
console.log(`[INFO] 过滤日期：${todayTrade} / ${yesterdayTrade}`);


/* ============  5. 写入/更新 Notion  ============ */
async function upsert(code) {
  // 先查是否已存在（按 Code + Date 唯一）
  const exist = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: 'Code', title: { equals: code } },
        { property: 'Date', date: { equals: todayTrade } }
      ]
    }
  });
  const payload = {
    Code: { title: [{ text: { content: code } }] },
    Date: { date: { start: todayTrade } },
    来源: { select: { name: '交集' } }
  };
  if (exist.results.length) {
    await notion.pages.update({ page_id: exist.results[0].id, properties: payload });
    console.log(`[UPDATE] ${code}`);
  } else {
    await notion.pages.create({ parent: { database_id: DATABASE_ID }, properties: payload });
    console.log(`[INSERT] ${code}`);
  }
}

(async ()=>{
  // 3. 从 GitHub 原始文件读取（可换私有仓库+token）
  const buyText = await getGitHubFile('https://raw.githubusercontent.com/GdFed/cf-stock-worker/main/data/buy.txt');
  const strongText = await getGitHubFile('https://raw.githubusercontent.com/GdFed/cf-stock-worker/main/data/strong.txt');

  // 4. 计算交集
  const codes = intersectionByDates(buyText, strongText, todayTrade, yesterdayTrade);

  if(!codes.length) {
    console.log('[INFO] 无交集，跳过');
  } else {
    for (const c of codes) await upsert(c);
    console.log('[INFO] 同步完成');
  }
})();
