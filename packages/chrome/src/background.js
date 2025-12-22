/**
 * CF Stock Hover Panel 的 MV3 Service Worker
 */

// 常见的中国A股代码正则表达式
const stockRegex = /\b(?:(?:SH|SZ|sh|sz)?\s*((?:60|68|00|30)\d{4}))\b/;

function extractStockCode(text) {
  if (!text) return '';
  const m = text.match(stockRegex);
  return (m && m[1]) ? m[1] : '';
}

/**
 * 此 service worker 现在仅处理打开股票页面。
 * 内容脚本处理选择和面板显示。
 */

/**
 * 处理来自内容脚本的请求。
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'OPEN_STOCK_PAGE') {
    handleOpenStockPage(message.code, sendResponse);
    return true; // 表示异步响应
  }
});

function handleOpenStockPage(code, sendResponse) {
  const cleanCode = String(code || '').trim();
  if (!cleanCode) {
    if (sendResponse) sendResponse({ ok: false, error: 'Empty code' });
    return;
  }
  const url = chrome.runtime.getURL(`stock.html?code=${encodeURIComponent(cleanCode)}`);
  chrome.tabs.create({ url }, () => {
    if (sendResponse) sendResponse({ ok: true });
  });
}

const CONTEXT_MENU_ID = 'view-stock-details';

// 在安装时创建上下文菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: '查看详情',
    contexts: ['selection'],
  });
});

// 处理上下文菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
    const code = extractStockCode(info.selectionText);
    if (code) {
      handleOpenStockPage(code); // 此处不需要 sendResponse 回调
    }
  }
});
