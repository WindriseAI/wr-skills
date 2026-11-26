#!/usr/bin/env node
// 提交前中文文风与本机隐私路径动态扫描（Git pre-commit / CI / CLI）
// 纯 Node.js 标准库零依赖，运行时动态读取当前机器用户名与家目录，防止私密路径外泄。
import { existsSync, readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';
import { homedir, userInfo } from 'node:os';

function parseCliArgs(argv) {
  const out = { targets: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode' && argv[i + 1]) out.mode = argv[++i];
    else if (argv[i] === '--cwd' && argv[i + 1]) out.cwd = argv[++i];
    else if (argv[i] === '--config' && argv[i + 1]) out.config = argv[++i];
    else out.targets.push(argv[i]);
  }
  return out;
}

function loadConfig(cwd, configOverride) {
  const cfgPath = configOverride ? resolve(cwd, configOverride) : join(cwd, 'wr.config.json');
  if (!existsSync(cfgPath)) return {};
  try {
    return JSON.parse(readFileSync(cfgPath, 'utf8'));
  } catch {
    return {};
  }
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDynamicPrivacyRules() {
  const rules = [
    ['本地绝对路径', /\b[A-Za-z]:[/\\](?:Users|work|worktrees|tmp|Documents|Desktop)[/\\]/i],
    ['本地绝对路径', /\/(?:Users|home)\/[a-zA-Z0-9._-]{2,}\//],
    ['本地绝对路径', new RegExp('App' + 'Data[/\\\\](?:Local|Roaming)', 'i')]
  ];
  try {
    const home = homedir().replace(/\\/g, '/');
    if (home && home.length > 4) {
      rules.push(['当前用户家目录', new RegExp(escapeRegExp(home), 'i')]);
      const winHome = homedir().replace(/\//g, '\\');
      if (winHome !== home) {
        rules.push(['当前用户家目录', new RegExp(escapeRegExp(winHome), 'i')]);
      }
    }
  } catch {
    // 忽略受限环境
  }
  try {
    const uname = userInfo().username;
    if (uname && uname.length >= 3 && !/^(root|user|admin|runner|node)$/i.test(uname)) {
      rules.push([
        '本机用户名路径',
        new RegExp(`(?:Users|home)[/\\\\]${escapeRegExp(uname)}(?:[/\\\\]|$)`, 'i')
      ]);
    }
  } catch {
    // 忽略受限环境
  }
  return rules;
}

// 字符拼接构造禁用词表，保证脚本自身不含违规字面量
const BANNED_BUZZWORDS = [
  ['赋', '能'], ['抓', '手'], ['闭', '环'], ['颗', '粒', '度'], ['对', '齐'],
  ['链', '路'], ['心', '智'], ['底', '层', '逻', '辑'], ['范', '式'],
  ['降', '本', '增', '效'], ['方', '法', '论'], ['倒', '逼'], ['护', '城', '河'],
  ['收', '口'], ['丝', '滑'], ['打', '法'], ['赛', '道'], ['心', '法']
].map((parts) => parts.join(''));

const FLIP_RE_1 = new RegExp(
  `(?<!是)${['不', '是'].join('')}[^。！？\\n「」]{0,40}?[，,；;]\\s*(?:而)?是(?!${['不', '是'].join('')})`
);
const FLIP_RE_2 = new RegExp(['而', '非'].join(''));
const BUZZ_RE = new RegExp(BANNED_BUZZWORDS.map(escapeRegExp).join('|'));
const DASH_RE_1 = /[\u2014\u2013]/;
const DASH_RE_2 = new RegExp('(?<![-!\\w(])' + '-'.repeat(2) + '(?![->\\w])');
const TABLE_RULE = /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/;

function walkFiles(baseDir, targetPaths, exts, excludeNames) {
  const found = [];
  const roots = targetPaths.length ? targetPaths.map((p) => resolve(baseDir, p)) : [baseDir];

  function visit(absPath) {
    if (!existsSync(absPath)) return;
    const st = statSync(absPath);
    if (st.isFile()) {
      if (exts.includes(extname(absPath).toLowerCase())) found.push(absPath);
      return;
    }
    if (!st.isDirectory()) return;
    for (const entry of readdirSync(absPath, { withFileTypes: true })) {
      if (excludeNames.has(entry.name)) continue;
      visit(join(absPath, entry.name));
    }
  }

  for (const r of roots) visit(r);
  return [...new Set(found)];
}

function scanFile(absPath, baseDir, rules) {
  const rel = relative(baseDir, absPath).replace(/\\/g, '/') || absPath;
  const isCss = absPath.toLowerCase().endsWith('.css');
  const lines = readFileSync(absPath, 'utf8').split(/\r?\n/);
  const hits = [];
  let inCodeFence = false;

  lines.forEach((line, idx) => {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      return;
    }
    for (const rule of rules) {
      if (isCss && rule.group === 'style') continue;
      if (inCodeFence && rule.group === 'style') continue;
      if (rule.name === '破折号' && TABLE_RULE.test(line)) continue;
      const text = rule.skipInlineCode ? line.replace(/`[^`]*`/g, (c) => ' '.repeat(c.length)) : line;
      const m = text.match(rule.re);
      if (!m) continue;
      const start = Math.max(0, m.index - 14);
      const snippet = line.slice(start, m.index + m[0].length + 14).trim();
      hits.push({ file: rel, line: idx + 1, name: rule.name, snippet, hint: rule.hint || '' });
    }
  });
  return hits;
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const cwd = cli.cwd ? resolve(cli.cwd) : process.cwd();
  const config = loadConfig(cwd, cli.config);
  const mode = (cli.mode || process.env.WR_HOOK_MODE || config.hookMode || 'enforce').toLowerCase();
  const lintCfg = config.copyLint || {};

  const exts = (lintCfg.extensions || ['.md', '.txt', '.html', '.js', '.mjs', '.ts', '.json', '.css']).map((e) =>
    e.toLowerCase()
  );
  const excludeNames = new Set(lintCfg.excludePaths || ['node_modules', '.git', 'dist', 'build']);

  const rules = [
    { group: 'dash', name: '破折号', re: DASH_RE_1, skipInlineCode: true },
    { group: 'dash', name: '破折号', re: DASH_RE_2, skipInlineCode: true },
    { group: 'style', name: '翻案句', re: FLIP_RE_1, skipInlineCode: true },
    { group: 'style', name: '翻案句', re: FLIP_RE_2, skipInlineCode: true },
    { group: 'style', name: '黑话', re: BUZZ_RE, skipInlineCode: true },
    ...buildDynamicPrivacyRules().map(([name, re]) => ({ group: 'privacy', name, re, skipInlineCode: false }))
  ];

  if (Array.isArray(lintCfg.customBannedWords)) {
    for (const w of lintCfg.customBannedWords) {
      if (w) rules.push({ group: 'style', name: '自定义禁词', re: new RegExp(escapeRegExp(w)), skipInlineCode: true });
    }
  }
  if (lintCfg.termReplacements && typeof lintCfg.termReplacements === 'object') {
    for (const [oldTerm, advice] of Object.entries(lintCfg.termReplacements)) {
      if (oldTerm) {
        rules.push({
          group: 'term',
          name: '术语替换',
          re: new RegExp(escapeRegExp(oldTerm)),
          skipInlineCode: false,
          hint: String(advice)
        });
      }
    }
  }

  const files = walkFiles(cwd, cli.targets, exts, excludeNames);
  const allHits = [];
  for (const f of files) {
    allHits.push(...scanFile(f, cwd, rules));
  }

  for (const h of allHits) {
    const suffix = h.hint ? ` -> ${h.hint}` : '';
    console.log(`FAIL ${h.name}  ${h.file}:${h.line}  ${h.snippet}${suffix}`);
  }
  console.log(`扫描 ${files.length} 个文件，命中 ${allHits.length} 处（模式：${mode}）。`);

  if (allHits.length > 0 && mode === 'observe') {
    const logRel = config.observeLogPath || '.wr-hook-observe.jsonl';
    try {
      appendFileSync(
        resolve(cwd, logRel),
        JSON.stringify({ ts: new Date().toISOString(), hook: 'copy-and-privacy-lint', mode: 'observe', hits: allHits }) + '\n',
        'utf8'
      );
    } catch {
      // 忽略
    }
    process.exit(0);
  }

  process.exit(allHits.length > 0 ? 1 : 0);
}

main();
