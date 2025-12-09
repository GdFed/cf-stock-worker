import { intersectionByDates } from './utils/intersection.js';
import { fmt, lastTradeDay } from './utils/trading-day.js';
import { getGitHubFile } from './utils/github-file.js';

// 买点 ∩ 强资金 交集逻辑（已去重、排序）
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // 1. 支持手动传参 ?today=2026-04-07&yesterday=2026-04-03
    let td = url.searchParams.get('today');
    let yd = url.searchParams.get('yesterday');
    if (!td || !yd) {                                 // 自动取最近两个交易日
      const d = lastTradeDay(new Date(),0);
      td = fmt(d);
      yd = fmt(lastTradeDay(d,-1));
    }

    // 2. 从 GitHub 原始文件读取（可换私有仓库+token）
    const buyText   = await getGitHubFile('https://raw.githubusercontent.com/GdFed/cf-stock-worker/main/data/buy.txt');
    const strongText= await getGitHubFile('https://raw.githubusercontent.com/GdFed/cf-stock-worker/main/data/strong.txt');

    // 3. 计算
    const list = intersectionByDates(buyText, strongText, td, yd);

    // 4. 返回 JSON
    return new Response(JSON.stringify({ today:td, yesterday:yd, codes:list }, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
};
