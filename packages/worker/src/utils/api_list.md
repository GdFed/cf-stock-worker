function buildEastmoneyUrl(market, code) {
  // Example: https://quote.eastmoney.com/sh600000.html
  const m = market || inferMarket(code) || 'sh';
  return `https://quote.eastmoney.com/${m}${code}.html`;
}

function buildSinaUrl(market, code) {
  // Example: https://finance.sina.com.cn/realstock/company/sh600000/nc.shtml
  const m = market || inferMarket(code) || 'sh';
  return `https://finance.sina.com.cn/realstock/company/${m}${code}/nc.shtml`;
}



# 福橘项目 API 接口清单

本文档记录了项目中使用的所有API接口，分为自研接口和第三方接口。

## 自研接口

这些是项目自身的后端服务接口。

### 主机: `https://bm-com.com/`

- **POST** `/api/sigin`
  - 描述: 用户登录。
  - 文件: `2.0.0_0/js/login.js`

- **POST** `/api/emailRegist`
  - 描述: 邮箱注册验证码。
  - 文件: `2.0.0_0/js/login.js`

- **GET** `api/user`
  - 描述: 获取用户详情。
  - 文件: `2.0.0_0/js/login.js`

- **GET/POST** `/api/stock/getOptionalStock`
  - 描述: 获取/更新用户自选股。
  - 文件: `2.0.0_0/js/login.js`, `2.0.0_0/js/popup.js`

### 主机: `https://plug2025.bm-com.com`

- **POST** `/api/visitor/visitorRecord`
  - 描述: 记录访客信息。
  - 文件: `2.0.0_0/js/background.js`

- **POST** `/api/visitor/visitorInstall`
  - 描述: 记录插件安装。
  - 文件: `2.0.0_0/js/background.js`

## 第三方接口

这些是项目依赖的外部数据服务接口。

### Eastmoney (东方财富)

- `http://86.push2.eastmoney.com/api/qt/clist/get`
  - 描述: 获取股票列表。
  - 文件: `2.0.0_0/js/stockCom.js`

- `https://dcfm.eastmoney.com/em_mutisvcexpandinterface/api/js/get`
  - 描述: 获取可转债数据。
  - 文件: `2.0.0_0/js/stockCom.js`

### QQ Finance (腾讯财经)

- `https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get`
  - 描述: 获取K线数据。
  - 文件: `2.0.0_0/js/stockCom.js`, `2.0.0_0/js/newStockCom.js`

- `https://proxy.finance.qq.com/cgi/cgi-bin/smartbox/search`
  - 描述: 股票搜索建议。
  - 文件: `2.0.0_0/js/search.js`, `2.0.0_0/js/popup.js`

### GTIMG (腾讯行情)

- `https://data.gtimg.cn/flashdata/hushen/latest/daily/`
  - 描述: 获取日线数据。
  - 文件: `2.0.0_0/js/stockCom.js`

- `https://qt.gtimg.cn/`
  - 描述: 获取实时行情数据。
  - 文件: `2.0.0_0/js/stockCom.js`, `2.0.0_0/js/newStockCom.js`

- `https://web.ifzq.gtimg.cn/stock/relate/data/plate`
  - 描述: 获取板块数据。
  - 文件: `2.0.0_0/js/stockCom.js`

- `https://web.ifzq.gtimg.cn/appstock/app/.../query`
  - 描述: 获取分时图数据。
  - 文件: `2.0.0_0/js/stockCom.js`

- `https://stock.gtimg.cn/data/index.php`
  - 描述: 获取排行榜数据。
  - 文件: `2.0.0_0/js/popup.js`

### AliCloud (阿里云)

- `https://dingxin.market.alicloudapi.com/dx/sendSms`
  - 描述: 发送短信。
  - 文件: `2.0.0_0/js/stockCom.js`

### Sina Finance (新浪财经)

- `http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeDataSimple`
  - 描述: 获取行情节点数据。
  - 文件: `2.0.0_0/js/stockCom.js`



# 爱盯盘项目接口调用清单

本项目主要通过前端的 `assets/subscribe-CfirD66p.js` 文件和后台的 `background/background.js` 文件调用外部API，数据来源主要包括东方财富、同花顺、大智慧以及一个开发者自建的 Deno 服务。

---

## 1. 东方财富 (eastmoney.com)

这是插件最核心的数据来源，用于获取股票/基金的各类行情数据。

### 1.1 获取实时行情数据 (批量)
- **URL:** `https://push2delay.eastmoney.com/api/qt/ulist.np/get`
- **功能:** 批量获取一个或多个证券的实时行情数据，用于首页列表、悬浮窗和角标的数字更新。
- **关键参数:**
    - `secids`: 证券代码列表 (例如: `1.600519,0.000678`)
    - `fields`: 请求的数据字段 (例如: 最新价, 涨跌幅, 名称等)

### 1.2 获取分时/五日趋势图数据
- **URL:** `https://push2his.eastmoney.com/api/qt/stock/trends2/get`
- **功能:** 获取单个证券的分时图或五日分时图数据。
- **关键参数:**
    - `secid`: 单个证券代码。
    - `ndays`: `1` (分时) 或 `5` (五日)。

### 1.3 获取K线数据
- **URL:** `https://push2his.eastmoney.com/api/qt/stock/kline/get`
- **功能:** 获取单个证券的各种周期K线图数据（日K, 周K, 月K, 5/15/30/60/120分钟）。
- **关键参数:**
    - `secid`: 单个证券代码。
    - `klt`: K线周期 (例如: `101` 代表日K)。

### 1.4 证券搜索
- **URL:** `https://searchapi.eastmoney.com/api/Info/Search`
- **功能:** 在添加自选股时，根据用户输入的名称、代码或拼音进行搜索。
- **关键参数:**
    - `and14`: 搜索的关键词。

### 1.5 获取排行榜数据
- **URL:** `https://push2delay.eastmoney.com/api/qt/clist/get`
- **功能:** 获取不同市场的排行榜数据，如A股的涨幅榜、跌幅榜、换手率榜等。
- **关键参数:**
    - `fs`: 市场和板块的筛选条件。

### 1.6 获取ETF列表数据
- **URL:** `https://datacenter.eastmoney.com/stock/etfselector/api/data/get`
- **功能:** 获取完整的ETF（交易所交易基金）列表及其详细数据，用于ETF页面。

---

## 2. 同花顺 (10jqka.com.cn)

用于获取更丰富的市场情绪和热点数据。

### 2.1 获取市场分析图表数据
- **URL:** `https://dq.10jqka.com.cn/fuyao/market_analysis_api/chart/v1/get_chart_data`
- **功能:** 获取分钟成交额、炸板股、涨停/跌停股数量等图表数据。
- **关键参数:**
    - `chart_key`: 图表类型 (例如: `turnover_minute`)。

### 2.2 获取市场涨跌分布
- **URL:** `https://dq.10jqka.com.cn/fuyao/up_down_distribution/distribution/v2/realtime`
- **功能:** 获取市场实时涨跌家数、涨停跌停家数等分布数据。

### 2.3 获取热榜数据
- **URL:** `https://dq.10jqka.com.cn/fuyao/hot_list_data/out/hot_list/v1/stock`
- **功能:** 获取1小时、24小时等不同时间维度的热榜股票。
- **关键参数:**
    - `type`: 热榜类型 (例如: `1h`)。

---

## 3. 大智慧 (dzh.com.cn)

### 3.1 获取涨停跌停温度数据
- **URL:** `https://webrelease.dzh.com.cn/htmlweb/ztts/api.php`
- **功能:** 获取每日的涨停跌停统计数据，用于“市场温度”功能。
- **关键参数:**
    - `service`: `getZttdData`。
    - `date`: 查询的日期。

---

## 4. 开发者自建API

### 4.1 获取股票列表 (备用)
- **URL:** `https://stock-list.deno.dev/`
- **功能:** 似乎是开发者自建的一个备用接口，通过证券代码获取股票列表信息。



# 股票提醒助手项目接口清单

本文档列出了项目中使用的所有外部接口。

## 数据接口

1.  **腾讯股票数据接口**
    *   **URL**: `http://qt.gtimg.cn/q=`
    *   **用途**: 获取股票的实时行情数据。
    *   **相关文件**: `3.8.0_0/js/stock.js`

2.  **雪球股票数据接口**
    *   **URL**: `https://stock.xueqiu.com/v5/stock/realtime/quotec.json?symbol=`
    *   **用途**: 获取雪球网提供的股票实时行情数据。
    *   **相关文件**: `3.8.0_0/js/stock.xueqiu.js`

3.  **新浪股票数据接口**
    *   **URL**: `http://hq.sinajs.cn/list=`
    *   **用途**: 获取新浪财经提供的股票实时行情数据。
    *   **相关文件**: `3.8.0_0/js/stock.sina.js`

4.  **新浪股票搜索建议接口**
    *   **URL**: `http://suggest3.sinajs.cn/suggest/`
    *   **用途**: 根据用户输入提供股票代码或名称的自动完成建议。
    *   **相关文件**: `3.8.0_0/js/options.js` (在注释中提及)

## 图表接口

5.  **新浪股票分钟图接口**
    *   **URL 格式**: `http://image.sinajs.cn/newchart/min/n/{stockCode}.gif`
    *   **用途**: 获取指定股票的分钟K线图。
    *   **相关文件**: `3.8.0_0/js/stock.js`, `3.8.0_0/js/stock.xueqiu.js`, `3.8.0_0/js/stock.sina.js`

6.  **新浪股票日K图接口**
    *   **URL 格式**: `http://image.sinajs.cn/newchart/daily/n/{stockCode}.gif`
    *   **用途**: 获取指定股票的日K线图。
    *   **相关文件**: `3.8.0_0/js/stock.js`, `3.8.0_0/js/stock.xueqiu.js`, `3.8.0_0/js/stock.sina.js`
