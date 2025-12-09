#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('@notionhq/client');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/* ============  1. 交易日历（2026）  ============ */
const holiday = new Set([
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-22','2026-02-23','2026-04-05','2026-04-06','2026-05-01','2026-05-02',
  '2026-06-14','2026-06-15','2026-09-21','2026-09-22','2026-10-01','2026-10-02',
  '2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'
]);
const fmt = d => d.toISOString().slice(0,10);
const isTradeDay = d => { const day=d.getDay(); return day!==0&&day!==6&&!holiday.has(fmt(d)); };
const lastTradeDay = (d,step=-1)=>{ const t=new Date(d); while(true){t.setDate(t.getDate()+step);if(isTradeDay(t))return t;} };

/* ============  2. 取最近两个交易日  ============ */
const todayTrade   = fmt(lastTradeDay(new Date(), 0));
const yesterdayTrade = fmt(lastTradeDay(new Date(todayTrade), -1));
const targetDates  = new Set([todayTrade, yesterdayTrade]);
console.log(`[INFO] 过滤日期：${todayTrade} / ${yesterdayTrade}`);

/* ============  3. 读取本地最新数据文件  ============ */
// 假设每天 06:30 由上游任务生成：data/buy.txt  &  data/strong.txt
const buyText    = fs.readFileSync(path.join(__dirname, 'data/buy.txt'),   'utf8');
const strongText = fs.readFileSync(path.join(__dirname, 'data/strong.txt'),'utf8');

/* ============  4. 计算交集  ============ */
const strongSet = new Set(strongText.split(/\r?\n/).map(l=>l.trim().split(',')[0]).filter(Boolean));
const buySet=new Set();
buyText.split(/\r?\n/).forEach(line=>{
  const [code,dates]=line.split(':'); if(!dates)return;
  if(dates.split(',').some(d=>targetDates.has(d.trim()))) buySet.add(code.trim());
});
const codes = [...buySet].filter(c=>strongSet.has(c)).sort();

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
  if(!codes.length) console.log('[INFO] 无交集，跳过');
  for(const c of codes) await upsert(c);
  console.log('[INFO] 同步完成');
})();