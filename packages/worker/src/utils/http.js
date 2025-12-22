export const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export const textLooksBlocked = (txt) => /拒绝访问|Access Denied/i.test(txt);

export const safeJSON = (txt) => {
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
};
