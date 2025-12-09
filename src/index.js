// 买点 ∩ 强资金 交集逻辑（已去重、排序）
const holiday = new Set([
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-22','2026-02-23','2026-04-05','2026-04-06','2026-05-01','2026-05-02',
  '2026-06-14','2026-06-15','2026-09-21','2026-09-22','2026-10-01','2026-10-02',
  '2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'
]);
const fmt = d => d.toISOString().slice(0,10);
const isTradeDay = d => { const day=d.getDay(); return day!==0&&day!==6&&!holiday.has(fmt(d)); };
const lastTradeDay = (d,step=-1)=>{ const t=new Date(d); while(true){t.setDate(t.getDate()+step);if(isTradeDay(t))return t;} };

async function getGitHubFile(rawUrl) {
  const r = await fetch(rawUrl);
  return r.text();
}

function intersection(buyText, strongText, today, yesterday) {
  const target = new Set([today, yesterday]);
  const strongSet = new Set(strongText.split(/\n/).map(l=>l.trim().split(',')[0]).filter(Boolean));
  const buySet  = new Set();
  buyText.split(/\n/).forEach(line=>{
    const [code,dates]=line.split(':'); if(!dates)return;
    if(dates.split(',').some(d=>target.has(d.trim()))) buySet.add(code.trim());
  });
  return [...buySet].filter(c=>strongSet.has(c)).sort();
}

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
    const list = intersection(buyText, strongText, td, yd);

    // 4. 返回 JSON
    return new Response(JSON.stringify({ today:td, yesterday:yd, codes:list }, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
};