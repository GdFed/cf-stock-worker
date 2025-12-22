export async function getGitHubFile(rawUrl) {
  const r = await fetch(rawUrl);
  if (!r.ok) {
    let snippet = '';
    try {
      const body = await r.text();
      if (body) {
        snippet = ` - ${body.slice(0, 200)}`;
      }
    } catch {
      // 忽略响应体读取错误，以便报告错误
    }
    throw new Error(`Failed to fetch ${rawUrl}: ${r.status} ${r.statusText}${snippet}`);
  }
  return r.text();
}
