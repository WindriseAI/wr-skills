#!/usr/bin/env node
// 提交前隐私路径与密钥扫描（Git pre-commit / CI / CLI）
// 纯 Node.js 标准库零依赖，运行时动态读取当前机器用户名与家目录，防止私密路径和密钥外泄。
// 只内置隐私与密钥两类检查；不带任何文风词表。项目自己的禁用词和旧名替换写在 wr.config.json 的 copyLint 里。
import { existsSync, readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, resolve, relative, extname, dirname } from 'node:path';
import { homedir, userInfo } from 'node:os';

// <wr-config> 配置读取、模式判定、提示语言与日志脱敏（四个钩子共用同一段，改动时四处保持一致，自测会逐字比对）
// 查找顺序：先读用户目录 ~/wr.config.json，再从当前目录逐级往上找项目里的 wr.config.json，项目字段覆盖用户目录字段。
// 模式优先级：命令行 --mode > 环境变量 WR_HOOK_MODE > 未完成首次对齐（onboarded 不是 true）按 observe > 配置 hookMode > 默认 observe。
function readJsonSafe(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}
function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}
function findProjectConfig(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    const p = join(dir, 'wr.config.json');
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function loadConfig(cwd, explicitPath) {
  let userCfg = {};
  try {
    const p = join(homedir(), 'wr.config.json');
    if (existsSync(p)) userCfg = readJsonSafe(p) || {};
  } catch {
    // 受限环境读不到用户目录时忽略
  }
  const projPath = explicitPath ? resolve(cwd, explicitPath) : findProjectConfig(cwd);
  const projCfg = projPath && existsSync(projPath) ? readJsonSafe(projPath) || {} : {};
  return deepMerge(isPlainObject(userCfg) ? userCfg : {}, isPlainObject(projCfg) ? projCfg : {});
}
function resolveMode(cliMode, config) {
  const explicit = cliMode || process.env.WR_HOOK_MODE;
  if (explicit) return { mode: String(explicit).toLowerCase(), explicit: true };
  if (config.onboarded !== true) return { mode: 'observe', explicit: false };
  return { mode: String(config.hookMode || 'observe').toLowerCase(), explicit: false };
}
// 提示语言：language.output 为 en 或 en-* 时用英文，其余（含 auto、没写）用中文
function pickLang(config) {
  const out = String((config.language && config.language.output) || '').toLowerCase();
  return out === 'en' || out.startsWith('en-') ? 'en' : 'zh';
}
function tr(lang, zh, en) {
  return lang === 'en' ? en : zh;
}
// 观察日志默认脱敏：路径只留最后一段，命令只留程序名和不带值的开关；observeLogDetail 写 full 才记完整内容
function logFull(config) {
  return String(config.observeLogDetail || '').toLowerCase() === 'full';
}
function redactPath(p) {
  const parts = String(p || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 1 ? '…/' + parts[parts.length - 1] : String(p || '');
}
function redactCommand(c) {
  const tokens = String(c || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';
  const kept = [redactPath(tokens[0]), ...tokens.slice(1).filter((t) => /^-{1,2}[A-Za-z][\w-]*$/.test(t))];
  return kept.join(' ') + ' …';
}
function redactQuoted(text) {
  return String(text || '').replace(/"([^"]*)"/g, (m, inner) => `"${redactPath(inner)}"`);
}
// </wr-config>

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

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDynamicPrivacyRules(lang) {
  const rules = [
    [tr(lang, '本地绝对路径', 'local absolute path'), /\b[A-Za-z]:[/\\](?:Users|work|worktrees|tmp|Documents|Desktop)[/\\]/i],
    [tr(lang, '本地绝对路径', 'local absolute path'), /\/(?:Users|home)\/[a-zA-Z0-9._-]{2,}\//],
    [tr(lang, '本地绝对路径', 'local absolute path'), new RegExp('App' + 'Data[/\\\\](?:Local|Roaming)', 'i')]
  ];
  try {
    const home = homedir().replace(/\\/g, '/');
    if (home && home.length > 4) {
      rules.push([tr(lang, '当前用户家目录', 'current user home'), new RegExp(escapeRegExp(home), 'i')]);
      const winHome = homedir().replace(/\//g, '\\');
      if (winHome !== home) {
        rules.push([tr(lang, '当前用户家目录', 'current user home'), new RegExp(escapeRegExp(winHome), 'i')]);
      }
    }
  } catch {
    // 忽略受限环境
  }
  try {
    const uname = userInfo().username;
    if (uname && uname.length >= 3 && !/^(root|user|admin|runner|node)$/i.test(uname)) {
      rules.push([
        tr(lang, '本机用户名路径', 'local username path'),
        new RegExp(`(?:Users|home)[/\\\\]${escapeRegExp(uname)}(?:[/\\\\]|$)`, 'i')
      ]);
    }
  } catch {
    // 忽略受限环境
  }
  return rules;
}

// 常见密钥格式（字符拼接构造，保证脚本自身不被自己扫到）
function buildSecretRules(lang) {
  const dash5 = '-'.repeat(5);
  return [
    [tr(lang, '私钥文件内容', 'private key block'), new RegExp(`${dash5}BEGIN (?:[A-Z]+ )*PRIVATE KEY${dash5}`)],
    [tr(lang, '云服务访问密钥', 'cloud access key'), new RegExp(['A', 'K', 'I', 'A'].join('') + '[0-9A-Z]{16}\\b')],
    [tr(lang, '代码托管令牌', 'code hosting token'), new RegExp('\\b(?:' + ['g', 'h', 'p'].join('') + '_[A-Za-z0-9]{36}|' + ['github', 'pat'].join('_') + '_[A-Za-z0-9_]{60,})\\b')],
    [tr(lang, '模型服务密钥', 'model API key'), new RegExp('\\b' + ['s', 'k'].join('') + '-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}')],
    [tr(lang, '聊天机器人令牌', 'chat bot token'), new RegExp('\\b' + ['x', 'o', 'x'].join('') + '[baprs]-[A-Za-z0-9-]{10,}')]
  ];
}

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

function scanFile(absPath, baseDir, rules, lang) {
  const rel = relative(baseDir, absPath).replace(/\\/g, '/') || absPath;
  const lines = readFileSync(absPath, 'utf8').split(/\r?\n/);
  const hits = [];
  let inCodeFence = false;

  lines.forEach((line, idx) => {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      return;
    }
    for (const rule of rules) {
      if (inCodeFence && rule.skipInCodeFence) continue;
      const text = rule.skipInlineCode ? line.replace(/`[^`]*`/g, (c) => ' '.repeat(c.length)) : line;
      const m = text.match(rule.re);
      if (!m) continue;
      const start = Math.max(0, m.index - 14);
      const snippet = rule.group === 'secret' ? tr(lang, '(已隐去命中内容)', '(match hidden)') : line.slice(start, m.index + m[0].length + 14).trim();
      hits.push({ file: rel, line: idx + 1, name: rule.name, snippet, hint: rule.hint || '' });
    }
  });
  return hits;
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const cwd = cli.cwd ? resolve(cli.cwd) : process.cwd();
  const config = loadConfig(cwd, cli.config);
  const { mode } = resolveMode(cli.mode, config);
  const lang = pickLang(config);
  const lintCfg = config.copyLint || {};

  const exts = (lintCfg.extensions || ['.md', '.txt', '.html', '.js', '.mjs', '.ts', '.json', '.css']).map((e) =>
    e.toLowerCase()
  );
  const excludeNames = new Set(lintCfg.excludePaths || ['node_modules', '.git', 'dist', 'build']);

  const rules = [
    ...buildDynamicPrivacyRules(lang).map(([name, re]) => ({ group: 'privacy', name, re, skipInlineCode: false })),
    ...buildSecretRules(lang).map(([name, re]) => ({ group: 'secret', name, re, skipInlineCode: false }))
  ];

  if (Array.isArray(lintCfg.customBannedWords)) {
    for (const w of lintCfg.customBannedWords) {
      if (w) {
        rules.push({ group: 'custom', name: tr(lang, '自定义禁词', 'custom banned word'), re: new RegExp(escapeRegExp(w)), skipInlineCode: true, skipInCodeFence: true });
      }
    }
  }
  if (lintCfg.termReplacements && typeof lintCfg.termReplacements === 'object') {
    for (const [oldTerm, advice] of Object.entries(lintCfg.termReplacements)) {
      if (oldTerm) {
        rules.push({
          group: 'term',
          name: tr(lang, '术语替换', 'term replacement'),
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
    allHits.push(...scanFile(f, cwd, rules, lang));
  }

  for (const h of allHits) {
    const suffix = h.hint ? ` -> ${h.hint}` : '';
    console.log(`FAIL ${h.name}  ${h.file}:${h.line}  ${h.snippet}${suffix}`);
  }
  console.log(tr(lang, `扫描 ${files.length} 个文件，命中 ${allHits.length} 处（模式：${mode}）。`, `Scanned ${files.length} files, ${allHits.length} hits (mode: ${mode}).`));

  if (allHits.length > 0 && mode !== 'enforce') {
    if (mode !== 'off') {
      const logRel = config.observeLogPath || '.wr-hook-observe.jsonl';
      try {
        appendFileSync(
          resolve(cwd, logRel),
          JSON.stringify({ ts: new Date().toISOString(), hook: 'copy-and-privacy-lint', mode: 'observe', hits: logFull(config) ? allHits : allHits.map(({ file, line, name }) => ({ file, line, name })) }) + '\n',
          'utf8'
        );
      } catch {
        // 忽略
      }
    }
    process.exit(0);
  }

  process.exit(allHits.length > 0 ? 1 : 0);
}

main();
