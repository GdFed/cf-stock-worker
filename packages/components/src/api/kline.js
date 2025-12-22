export const getKlineData = async (codeId, klineType) => {
  const zt = {
    '分时': '1', '五日': '5', '日K': '101', '周K': '102', '月K': '103', '季K': '104', '年K': '106',
    '120分': '120', '60分': '60', '30分': '30', '15分': '15', '5分': '5'
  };

  let path, params;

  if (klineType === '分时' || klineType === '五日') {
    path = '/api/qt/stock/trends2/get';
    params = {
      secid: codeId,
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14',
      fields2: 'f51,f53,f56,f58',
      iscr: 0,
      iscca: 0,
      ndays: zt[klineType],
    };
    if (klineType === '五日') {
      params.fields1 += ',f17';
    }
  } else {
    path = '/api/qt/stock/kline/get';
    let lmt = 280;
    if (klineType === '5分' || klineType === '15分') lmt = 500;
    else if (klineType === '30分' || klineType === '60分' || klineType === '120分') lmt = 400;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}${month}${day}`;

    params = {
      secid: codeId,
      klt: zt[klineType],
      fqt: 1,
      lmt: lmt,
      end: formattedDate,
      iscca: 1,
      fields1: 'f1,f2,f3,f4,f5',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f59',
      ut: 'f057cbcbce2a86e2866ab8877db1d059',
      forcect: 1,
    };
  }
  
  const buildQueryString = (p) => {
    return Object.entries(p)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      .join('&');
  };

  const queryString = buildQueryString(params);
  
  try {
    const baseUrl = import.meta.env.VITE_API_TARGET || '';
    const url = `${baseUrl}${path}?${queryString}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch kline data:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
};
