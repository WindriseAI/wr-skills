#!/usr/bin/env node
// wr-geo 渲染脚本：用本机已装的无头浏览器（Edge / Chrome / Chromium）打开网址，
// 截一张图，取「不跑 JS 的原始 HTML 里的可见文字」和「浏览器跑完 JS 后的可见文字」，
// 并报横向溢出像素。用来判断不跑 JS 的爬虫能看到什么。
//
// 用法：
//   node render.mjs <输出目录> <名字>=<网址>@<宽>x<高> [<名字>=<网址>@<宽>x<高> ...]
//
// 例：
//   node render.mjs out home=https://example.com/@1440x900 phone=https://example.com/@390x844
//
// 浏览器自动找（Windows 的 Edge / Chrome、macOS 的 Chrome、Linux 的 chromium / google-chrome）。
// 也可以用环境变量指定：WR_GEO_BROWSER=/path/to/chrome
// 只用 Node 自带模块，不装任何依赖；需要 Node 22 或更新（内置 WebSocket 和 fetch）。
//
// 每个任务输出：<名字>.png（截图）、<名字>.txt（渲染后的可见文字）、
// <名字>.raw.txt（原始 HTML 的可见文字，取不到就不写），并在末尾逐条打印一行 JSON。

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [outDir, ...jobs] = process.argv.slice(2);
const die = (msg) => { console.error(msg); process.exit(2); };
if (!outDir || !jobs.length) die('用法：node render.mjs <输出目录> <名字>=<网址>@<宽>x<高> ...');
if (typeof WebSocket !== 'function') die('需要 Node 22 或更新（内置 WebSocket）。当前：' + process.version);

// ---------- 找浏览器 ----------
const envBrowser = process.env.WR_GEO_BROWSER || process.env.WR_RENDER_BROWSER;
// Windows 上不写死盘符：只用系统环境变量拼路径，32 位系统缺的项就跳过。
const pf = process.env.ProgramFiles || '';
const pf86 = process.env['ProgramFiles(x86)'] || pf;
const localApp = process.env.LOCALAPPDATA || '';
const WIN_CANDIDATES = [
  path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
  path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
  path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(localApp, 'Google\\Chrome\\Application\\chrome.exe'),
].filter((f) => f && path.isAbsolute(f));
const MAC_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const NIX_NAMES = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'microsoft-edge', 'microsoft-edge-stable'];

function fromPath(name) {
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const f = path.join(dir, name + ext);
      try { fs.accessSync(f, fs.constants.X_OK); return f; } catch { /* 继续找 */ }
    }
  }
  return null;
}

function findBrowser() {
  if (envBrowser) {
    if (!fs.existsSync(envBrowser)) die(`WR_GEO_BROWSER 指向的文件不存在：${envBrowser}`);
    return envBrowser;
  }
  const fixed = process.platform === 'win32' ? WIN_CANDIDATES : process.platform === 'darwin' ? MAC_CANDIDATES : [];
  for (const f of fixed) if (f && fs.existsSync(f)) return f;
  for (const n of NIX_NAMES) { const f = fromPath(n); if (f) return f; }
  die('没找到无头浏览器。装了 Edge 或 Chrome 就会自动找到；也可以设 WR_GEO_BROWSER 指向浏览器可执行文件。');
}
const BROWSER = findBrowser();
console.error(`浏览器：${BROWSER}`);

// ---------- 原始 HTML 的可见文字（不发请求，只取一次源码） ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = (s) => String(s ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"').replace(/&mdash;/g, '—')
  .replace(/\s+/g, ' ')
  .trim();

async function rawTextOf(url) {
  if (!/^https?:\/\//i.test(url)) return { text: null, note: '非 http(s) 地址，取不到原始 HTML' };
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; wr-geo/1.0)' } });
    if (!res.ok) return { text: null, note: `原始 HTML 请求返回 ${res.status}` };
    return { text: visible(await res.text()), note: '' };
  } catch (e) {
    return { text: null, note: '原始 HTML 请求失败：' + e.message };
  }
}

// 渲染后的文字里，有哪些整句不在原始 HTML 里（= 只有跑 JS 才出现的内容）
function onlyInRendered(raw, rendered) {
  if (raw == null) return null;
  const sentences = String(rendered).split(/(?<=[.!?。！？])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
  const gone = sentences.filter((s) => !raw.includes(s));
  return { sentences: sentences.length, onlyInRendered: gone.length, samples: gone.slice(0, 3) };
}

// ---------- 起浏览器 ----------
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-geo-render-'));
const child = spawn(BROWSER, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--hide-scrollbars', '--force-prefers-reduced-motion', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws = null;
let port = null;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(150);
  try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch { /* 还没起来 */ }
}
if (!port) { await cleanup(); die('浏览器没起来：可能被安全策略拦住，或这个浏览器不支持 --headless=new。'); }

// 关掉浏览器并删掉临时用户数据目录。顺序很重要：先让浏览器自己退，
// 退不掉再按 pid 杀进程树，Windows 上最后再扫一遍命令行里带这份目录的进程。
// 只动命令行里带我们这份临时目录的进程，不会碰用户自己开着的浏览器。
async function cleanup() {
  try {
    if (ws && ws.readyState === 1) await Promise.race([send('Browser.close'), sleep(2000)]);
  } catch { /* 连接已经断了 */ }
  for (let i = 0; i < 30 && child.exitCode === null; i++) await sleep(100);
  try {
    if (child.exitCode === null && child.pid) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGKILL');
    }
  } catch { /* 已经退出 */ }
  if (process.platform === 'win32') {
    const ps = 'Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq "msedge.exe" -or $_.Name -eq "chrome.exe" -or $_.Name -eq "chromium.exe") -and $_.CommandLine -like '
      + `'*${profile}*'` + ' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
    spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
  }
  for (let i = 0; i < 15; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); return; } catch { await sleep(200); }
  }
}

const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}, sessionId) => new Promise((r) => {
  const i = ++id;
  pending.set(i, (m) => r(m.result || { error: m.error }));
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});

fs.mkdirSync(outDir, { recursive: true });
const results = [];
try {
  for (const job of jobs) {
    const m = /^([^=]+)=(.+)@(\d+)x(\d+)$/.exec(job);
    if (!m) { console.error(`跳过看不懂的参数：${job}（格式应为 名字=网址@宽x高）`); continue; }
    const [, name, url, w, h] = m;

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 }, sessionId);
    await send('Page.navigate', { url }, sessionId);
    await sleep(3500);
    const ev = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: '(()=>{const de=document.documentElement;return {title:document.title,scrollWidth:de.scrollWidth,innerWidth:innerWidth,scrollHeight:de.scrollHeight,text:document.body.innerText.replace(/\\s+/g," ").trim()}})()',
    }, sessionId);
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const v = ev.result?.value || {};

    const file = path.join(outDir, `${name}.png`);
    if (shot.data) fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    const rendered = v.text || '';
    fs.writeFileSync(path.join(outDir, `${name}.txt`), rendered);

    const raw = await rawTextOf(url);
    if (raw.text != null) fs.writeFileSync(path.join(outDir, `${name}.raw.txt`), raw.text);

    results.push({
      name, url, w: +w, h: +h, title: v.title,
      overflowX: (v.scrollWidth || 0) - (v.innerWidth || 0),
      renderedChars: rendered.length,
      rawChars: raw.text == null ? null : raw.text.length,
      jsOnly: onlyInRendered(raw.text, rendered),
      rawNote: raw.note || undefined,
      file,
    });
    await send('Target.closeTarget', { targetId });
  }
} finally {
  ws.close();
  await cleanup();
}
for (const r of results) console.log(JSON.stringify(r));
