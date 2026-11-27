#!/usr/bin/env node
// 通用安全红线守卫（PreToolUse）
// 纯 Node.js 标准库零依赖，同时兼容 Claude Code 与 Antigravity 钩子协议，支持 observe / enforce 双模式，每条规则可单独设 off / observe / enforce。
import { existsSync, readFileSync, appendFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';
import { tmpdir, homedir } from 'node:os';

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
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode' && argv[i + 1]) out.mode = argv[++i];
    if (argv[i] === '--cwd' && argv[i + 1]) out.cwd = argv[++i];
  }
  return out;
}

function parseHookInput(rawText) {
  if (!rawText || !rawText.trim()) return { protocol: 'claude', toolName: '', args: {}, raw: {} };
  const data = JSON.parse(rawText);
  const isAgy = Boolean(
    (data.toolCall && typeof data.toolCall === 'object') ||
    typeof data.hookEventName === 'string' ||
    typeof data.conversationId === 'string'
  );
  if (isAgy) {
    const tc = data.toolCall && typeof data.toolCall === 'object' ? data.toolCall : {};
    return {
      protocol: 'agy',
      toolName: String(tc.name || ''),
      args: tc.args || {},
      cwd: data.cwd || process.cwd(),
      raw: data
    };
  }
  return {
    protocol: 'claude',
    toolName: String(data.tool_name || data.toolName || ''),
    args: data.tool_input || data.toolInput || {},
    cwd: data.cwd || process.cwd(),
    raw: data
  };
}

function collectAtoms(node, paths, commands) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) {
      if (typeof item === 'string') paths.push(item);
      else collectAtoms(item, paths, commands);
    }
    return;
  }
  const pathKeys = new Set(['path', 'file_path', 'filepath', 'targetfile', 'target', 'file', 'cwd']);
  const cmdKeys = new Set(['command', 'commandline', 'cmd', 'script']);
  for (const [k, v] of Object.entries(node)) {
    const lk = k.toLowerCase();
    if (typeof v === 'string') {
      if (pathKeys.has(lk)) paths.push(v);
      if (cmdKeys.has(lk)) commands.push(v);
    } else if (Array.isArray(v)) {
      if (lk === 'paths' || lk === 'files') {
        for (const x of v) {
          if (typeof x === 'string') paths.push(x);
          else collectAtoms(x, paths, commands);
        }
      } else if (lk === 'commands' || lk === 'edits' || lk === 'queries' || lk === 'slices') {
        collectAtoms(v, paths, commands);
      }
    } else if (v && typeof v === 'object') {
      collectAtoms(v, paths, commands);
    }
  }
}

// —— 规则档位 ——
// 每条规则的模式：off（不查）/ observe（只记录）/ enforce（硬拦）/ follow（跟随 hookMode）。
// 标准档：凭据与递归强删永远硬拦，git 硬重置只提醒，其余跟随 hookMode；宽松档全部跟随 hookMode 且不查 git 重置；严格档全部硬拦。
// 首次对齐之前：凭据与递归强删照样硬拦（装守卫就是为了这两条），其余规则只记录。
const PROFILES = {
  relaxed: { credentials: 'follow', hardDelete: 'follow', gitReset: 'off', quietHost: 'follow', orcaQuote: 'follow', remoteTmp: 'follow' },
  standard: { credentials: 'enforce', hardDelete: 'enforce', gitReset: 'observe', quietHost: 'follow', orcaQuote: 'follow', remoteTmp: 'follow' },
  strict: { credentials: 'enforce', hardDelete: 'enforce', gitReset: 'enforce', quietHost: 'enforce', orcaQuote: 'enforce', remoteTmp: 'enforce' }
};
const RED_LINES = new Set(['credentials', 'hardDelete']);
const VALID_RULE_MODES = new Set(['off', 'observe', 'enforce', 'follow']);

function ruleOverride(name, config) {
  const sg = config.safetyGuard || {};
  const v = sg.rules && typeof sg.rules[name] === 'string' ? sg.rules[name].toLowerCase() : '';
  return VALID_RULE_MODES.has(v) ? v : '';
}

function ruleMode(name, modeInfo, config) {
  if (modeInfo.mode === 'off') return 'off';
  const sg = config.safetyGuard || {};
  const override = ruleOverride(name, config);
  const profile = PROFILES[String(sg.profile || 'standard').toLowerCase()] || PROFILES.standard;
  const base = override || profile[name] || 'follow';
  if (base === 'off') return 'off';
  // 命令行或环境变量显式指定模式时，所有未关闭的规则统一按它执行
  if (modeInfo.explicit) return modeInfo.mode;
  if (config.onboarded !== true) {
    if (override === 'observe' || override === 'enforce') return override;
    return RED_LINES.has(name) ? 'enforce' : 'observe';
  }
  return base === 'follow' ? modeInfo.mode : base;
}

function ruleExplicitlyOn(name, config) {
  const v = ruleOverride(name, config);
  return v === 'observe' || v === 'enforce' || v === 'follow';
}

// —— 规则 1：凭据零触碰 ——
// 使用字符拼接构造敏感凭据匹配模式，避免源码中出现敏感字面量
const DIR_SSH = ['.', 's', 's', 'h'].join('');
const DIR_AWS = ['.', 'a', 'w', 's'].join('');
const DIR_GNUPG = ['.', 'g', 'n', 'u', 'p', 'g'].join('');
const FILE_ENV = ['.', 'e', 'n', 'v'].join('');
const FILE_AUTH = ['a', 'u', 't', 'h', '.', 'j', 's', 'o', 'n'].join('');
const FILE_NETRC = ['.', 'n', 'e', 't', 'r', 'c'].join('');
const CRED_EXTS = [
  ['p', 'e', 'm'].join(''),
  ['k', 'e', 'y'].join(''),
  ['p', '1', '2'].join(''),
  ['p', 'f', 'x'].join('')
];

const ENV_ALLOW_RE = new RegExp(`\\${FILE_ENV}\\.(example|sample|template)$`, 'i');
const NORMAL_KEY_DIR_RE = /(?:^|\/)(?:src|lib|app|tests?|spec|docs)\/keys?\//i;
const CRED_DIR_RE = new RegExp(`(?:^|\\/)(?:\\${DIR_SSH}|\\${DIR_AWS}|\\${DIR_GNUPG})(?:\\/|$)`, 'i');
const CRED_FILE_RE = new RegExp(
  `(?:^|\\/)(?:${FILE_AUTH.replace('.', '\\.')}|\\${FILE_NETRC}|\\${FILE_ENV}(?:\\.[^/\\s"']+)?)$`,
  'i'
);
const CRED_EXT_RE = new RegExp(`\\.(?:${CRED_EXTS.join('|')})(?:$|["'\\s])`, 'i');

function safeRegExps(list) {
  const out = [];
  for (const pat of Array.isArray(list) ? list : []) {
    try {
      out.push(new RegExp(String(pat), 'i'));
    } catch {
      // 写错的正则直接忽略，不让配置错误把会话卡死
    }
  }
  return out;
}

function isCredentialTarget(text, allowRes) {
  const norm = String(text || '').replace(/\\/g, '/').trim();
  if (!norm) return false;
  if (ENV_ALLOW_RE.test(norm)) return false;
  if (NORMAL_KEY_DIR_RE.test(norm)) return false;
  if (allowRes.some((re) => re.test(norm))) return false;
  if (CRED_DIR_RE.test(norm)) return true;
  if (CRED_FILE_RE.test(norm)) return true;
  if (CRED_EXT_RE.test(norm)) return true;
  return false;
}

// —— 规则 2：递归强删只放行临时目录与项目内的构建产物（按路径段匹配） ——
const TMP_VAR_RE = /^(?:\$\{?TMPDIR\}?|\$\{?TMP\}?|\$\{?TEMP\}?|%TEMP%|%TMP%|\$env:TEMP|\$env:TMP)(?:[/\\]|$)/i;

function splitSubCommands(cmd) {
  return String(cmd || '').split(/&&|\|\||[;|\r\n]/);
}

function tokenize(s) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function cleanToken(t) {
  return String(t || '').trim().replace(/^["'`(]+|["'`),]+$/g, '');
}

// 返回 null 表示不是递归强删；否则返回删除目标数组（解析不出目标时返回 ['']，按不放行处理）
function findHardDeleteTargets(sub) {
  const s = String(sub || '').trim();
  if (!s) return null;

  const rmSync = s.match(/\bfs\.rmsync\s*\(([^)]*)/i);
  if (rmSync) {
    const lit = rmSync[1].match(/^\s*(["'`])([^"'`]*)\1/);
    return [lit ? lit[2] : ''];
  }

  const rm = s.match(/(?:^|[\s"'(])rm\s+(.+)$/i);
  if (rm) {
    const tokens = tokenize(rm[1]).map(cleanToken).filter(Boolean);
    const flags = tokens.filter((t) => t.startsWith('-'));
    const hard = flags.some((f) => /^-[a-z]*[rf]/i.test(f) || /^--(?:recursive|force)$/i.test(f));
    if (!hard) return null;
    const targets = tokens.filter((t) => !t.startsWith('-') && !/^\d*>/.test(t));
    return targets.length ? targets : [''];
  }

  const ri = s.match(/\b(?:remove-item|ri)\b(.*)$/i);
  if (ri && /-recurse\b/i.test(ri[1])) {
    const tokens = tokenize(ri[1]).map(cleanToken).filter(Boolean);
    const targets = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (/^-(?:erroraction|ea|warningaction|wa|filter|include|exclude)$/i.test(t)) {
        i++;
        continue;
      }
      if (t.startsWith('-')) continue;
      targets.push(t);
    }
    return targets.length ? targets : [''];
  }

  const del = s.match(/\b(?:del|erase|rmdir|rd)\s+(.+)$/i);
  if (del) {
    const tokens = tokenize(del[1]).map(cleanToken).filter(Boolean);
    if (!tokens.some((t) => /^\/s$/i.test(t))) return null;
    const targets = tokens.filter((t) => !/^\/[a-z]$/i.test(t));
    return targets.length ? targets : [''];
  }
  return null;
}

function expandHome(p) {
  if (p === '~' || /^~[/\\]/.test(p)) return join(homedir(), p.slice(1));
  return p;
}

function segmentsOf(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((s) => s && s !== '.')
    .map((s) => s.toLowerCase());
}

function isInside(child, parent) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function isAllowedDeleteTarget(rawTarget, cwd, allowedDirs) {
  const t = cleanToken(rawTarget);
  if (!t) return false;
  if (TMP_VAR_RE.test(t)) return true;
  if (/[$%]/.test(t)) return false; // 解析不了的变量，按不放行处理
  const abs = resolve(cwd, expandHome(t));
  const sysTmp = resolve(tmpdir());
  if (abs !== sysTmp && isInside(abs, sysTmp)) return true;
  if (segmentsOf(abs).some((s) => s === 'tmp' || s === 'temp')) return true;
  const root = resolve(cwd);
  if (abs === root || !isInside(abs, root)) return false;
  const relSegs = segmentsOf(relative(root, abs));
  for (const dir of allowedDirs) {
    const ds = segmentsOf(dir);
    if (!ds.length) continue;
    for (let i = 0; i + ds.length <= relSegs.length; i++) {
      if (ds.every((d, j) => relSegs[i + j] === d)) return true;
    }
  }
  return false;
}

function trashHint(config, lang) {
  const custom = config.safetyGuard && config.safetyGuard.trashCommand;
  if (custom) return tr(lang, `请改用回收站：${custom}`, `Move it to the trash instead: ${custom}`);
  if (process.platform === 'win32') {
    const cmd = "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('<路径>','OnlyErrorDialogs','SendToRecycleBin')";
    return tr(lang, `请改用回收站（PowerShell：${cmd}）`, `Move it to the Recycle Bin instead (PowerShell: ${cmd.replace('<路径>', '<path>')})`);
  }
  if (process.platform === 'darwin') return tr(lang, '请改用回收站（mv <路径> ~/.Trash/）', 'Move it to the trash instead (mv <path> ~/.Trash/)');
  return tr(lang, '请改用回收站（gio trash <路径>，没有 gio 时可装 trash-cli 用 trash-put <路径>）', 'Move it to the trash instead (gio trash <path>, or trash-put <path> from trash-cli)');
}

// —— 规则 3：主检出禁毁灭性 Git 重置 ——
function isWorktreeCheckout(cwd) {
  const norm = resolve(cwd).replace(/\\/g, '/').toLowerCase();
  if (norm.includes('/worktrees/') || norm.includes('/wt-')) return true;
  const dotGit = join(cwd, '.git');
  try {
    return existsSync(dotGit) && statSync(dotGit).isFile();
  } catch {
    return false;
  }
}

// —— 规则 5：Orca 命令行长参数与引号防劈裂（只在探测到 Orca 且终端是 PowerShell 时默认启用） ——
function orcaDetected(config) {
  const tools = config.tools || {};
  if (tools.orca === true) return true;
  if (tools.orca === false) return false;
  return Boolean(process.env.ORCA_APP_VERSION || process.env.ORCA_TERMINAL_HANDLE || process.env.ORCA_CLI_COMMAND);
}

function powershellLike(config) {
  const shell = String((config.environment && config.environment.shell) || '').toLowerCase();
  if (shell) return shell === 'powershell' || shell === 'pwsh';
  return process.platform === 'win32';
}

function checkOrcaQuoteSplit(cmd, maxChars, lang) {
  const subs = String(cmd || '').split(/&&|\|\||[;\r\n]/);
  const orcaTargetRe = /^(?:&\s*)?["']?(?:[^"'\s]*[/\\])?orca(?:\.exe|\.cmd)?["']?\s+(?:orchestration\s+(?:send|worker-start)|bot\s+(?:reply|item))\b/i;
  const flagRe = new RegExp('-'.repeat(2) + `(body|spec|comment|text)(?!-file)(?:=|\\s+)(?:'([^']*)'|"([^"]*)"|(\\S+))`, 'gi');
  for (const rawSub of subs) {
    const sub = rawSub.trim();
    if (!sub || !orcaTargetRe.test(sub)) continue;
    flagRe.lastIndex = 0;
    let m;
    while ((m = flagRe.exec(sub)) !== null) {
      const flag = m[1].toLowerCase();
      const singleQuoted = m[2] !== undefined;
      const val = m[2] ?? m[3] ?? m[4] ?? '';
      if (singleQuoted && val.includes('"')) {
        return tr(
          lang,
          `红线拦截（引号防劈裂）：orca 的 --${flag} 单引号参数内含英文双引号，在 PowerShell 下易被劈裂成 Unknown command。请先写入文本文件，改用 --${flag}-file <文件路径> 传入。不需要这条检查时，在 wr.config.json 写 safetyGuard.rules.orcaQuote 为 "off"。`,
          `Blocked (quote split): the single-quoted orca --${flag} argument contains double quotes, which PowerShell may split into "Unknown command". Write the text to a file and pass --${flag}-file <path>. To disable this check, set safetyGuard.rules.orcaQuote to "off" in wr.config.json.`
        );
      }
      if (val.length > maxChars) {
        return tr(
          lang,
          `红线拦截（引号防劈裂）：orca 的 --${flag} 内联参数长达 ${val.length} 字（超过 ${maxChars} 字），易触发命令行截断或引号出错。请先写入文本文件，改用 --${flag}-file <文件路径> 传入。阈值可在 safetyGuard.orcaInlineMaxChars 调整。`,
          `Blocked (quote split): the inline orca --${flag} argument is ${val.length} characters (limit ${maxChars}) and may be truncated or mis-quoted. Write it to a file and pass --${flag}-file <path>. Adjust the limit with safetyGuard.orcaInlineMaxChars.`
        );
      }
    }
  }
  return null;
}

// —— 规则 6：远端机器共享裸临时目录防并发碰撞（只在配置了 environment.remoteHost 时默认启用） ——
const REMOTE_TMP_DIR_RE = /(?:[A-Za-z]:[/\\]|(?:^|[\s:"'=/]))tmp[/\\]([A-Za-z0-9._-]+)([/\\][A-Za-z0-9._-]+)?/gi;
const DEFAULT_TMP_SUFFIXES = ['task[-_a-z0-9]*', 'run[-_a-z0-9]*', 'job[-_a-z0-9]*', 'wt[-_a-z0-9]*', 'branch[-_a-z0-9]*', 'worker[-_a-z0-9]*', 'r\\d+', '\\d{4,}', '[0-9a-f]{6,}'];
const SIMPLE_FILE_EXT_RE = /\.(?:tar\.gz|tgz|zip|7z|log|txt|json|jsonl|md|mjs|cjs|js|py|ps1|sh|png|jpg|webp|html)$/i;

function remoteHostsOf(config) {
  const h = config.environment && config.environment.remoteHost;
  if (Array.isArray(h)) return h.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  if (typeof h === 'string' && h.trim()) return [h.trim()];
  return [];
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkRemoteBareTempDir(cmd, hosts, suffixes, lang) {
  if (!/\b(?:ssh|scp)(?:\.exe)?\b/i.test(cmd)) return null;
  if (hosts.length && !hosts.some((h) => new RegExp(`(?:^|[\\s@"'])${escapeRegExp(h)}(?:$|[\\s:"'])`, 'i').test(cmd))) {
    return null;
  }
  let suffixRe;
  try {
    suffixRe = new RegExp(`(?:[-_](?:${suffixes.join('|')}))$`, 'i');
  } catch {
    suffixRe = new RegExp(`(?:[-_](?:${DEFAULT_TMP_SUFFIXES.join('|')}))$`, 'i');
  }
  REMOTE_TMP_DIR_RE.lastIndex = 0;
  let m;
  while ((m = REMOTE_TMP_DIR_RE.exec(cmd)) !== null) {
    const seg = m[1] || '';
    const nested = m[2] || '';
    if (!seg || nested) continue;
    if (seg.includes('$') || seg.includes('%')) continue;
    if (SIMPLE_FILE_EXT_RE.test(seg)) continue;
    if (suffixRe.test(seg)) continue;
    return tr(
      lang,
      `红线拦截（远端临时目录防碰撞）：远端命令指向没有唯一后缀的共享目录 "tmp/${seg}"，几路任务同时跑容易互相覆盖。请追加任务名或时间戳后缀（例如 /tmp/${seg}-task1-20261126），或改用任务专属的二级子目录。后缀规则可在 safetyGuard.remoteTmpSuffixes 调整，不需要这条检查时写 safetyGuard.rules.remoteTmp 为 "off"。`,
      `Blocked (remote temp collision): the remote command targets the shared directory "tmp/${seg}" without a unique suffix, so parallel jobs can overwrite each other. Add a task name or timestamp (e.g. /tmp/${seg}-task1-20261126) or use a per-task subdirectory. Tune suffixes with safetyGuard.remoteTmpSuffixes, or set safetyGuard.rules.remoteTmp to "off".`
    );
  }
  return null;
}

function checkViolations(paths, commands, cwd, config, lang) {
  const sg = config.safetyGuard || {};
  const extraRes = safeRegExps(sg.extraProtectedPatterns);
  const allowRes = safeRegExps(sg.allowPatterns);
  const allowedDirs = Array.isArray(sg.allowedDeleteDirs) ? sg.allowedDeleteDirs : ['dist', 'build', 'node_modules', '.cache', 'worktrees'];
  const env = config.environment || {};
  const quietHost =
    process.env.WR_QUIET_HOST === '1' ||
    env.quietMainMachine === true ||
    config.quietMainMachine === true ||
    ruleExplicitlyOn('quietHost', config);
  const allowHeavyRunner = process.env.WR_TEST_RUNNER === '1';
  const orcaOn = ruleExplicitlyOn('orcaQuote', config) || (orcaDetected(config) && powershellLike(config));
  const orcaMax = Number(sg.orcaInlineMaxChars) > 0 ? Number(sg.orcaInlineMaxChars) : 120;
  const hosts = remoteHostsOf(config);
  const remoteOn = ruleExplicitlyOn('remoteTmp', config) || hosts.length > 0;
  const suffixes = Array.isArray(sg.remoteTmpSuffixes) && sg.remoteTmpSuffixes.length ? sg.remoteTmpSuffixes.map(String) : DEFAULT_TMP_SUFFIXES;

  const hits = [];
  const seen = new Set();
  const add = (rule, reason) => {
    if (seen.has(rule)) return;
    seen.add(rule);
    hits.push({ rule, reason });
  };

  // 规则 1：凭据零触碰
  for (const p of paths) {
    if (isCredentialTarget(p, allowRes)) {
      add('credentials', tr(
        lang,
        `红线拦截（凭据保护）：禁止读取或修改敏感凭据路径 "${p}"。请改用模板文件或请用户本人处理；确属测试夹具时，把它的路径规则加进 safetyGuard.allowPatterns。`,
        `Blocked (credentials): reading or writing the sensitive path "${p}" is not allowed. Use a template file or ask the user to handle it; if it is a test fixture, add a pattern to safetyGuard.allowPatterns.`
      ));
    }
    for (const re of extraRes) {
      if (re.test(p)) {
        add('credentials', tr(
          lang,
          `红线拦截（自定义受保护路径）：路径 "${p}" 命中 safetyGuard.extraProtectedPatterns 里的受保护规则。`,
          `Blocked (protected path): "${p}" matches a rule in safetyGuard.extraProtectedPatterns.`
        ));
      }
    }
  }
  for (const cmd of commands) {
    const tokens = cmd.match(/[^\s"';|&]+/g) || [];
    for (const tok of tokens) {
      if (isCredentialTarget(tok, allowRes)) {
        add('credentials', tr(
          lang,
          `红线拦截（凭据保护）：命令疑似触碰敏感凭据 "${tok}"，已拒绝执行。`,
          `Blocked (credentials): the command appears to touch the sensitive path "${tok}".`
        ));
      }
    }

    // 规则 2：递归强删只放行临时目录与项目内构建产物
    for (const sub of splitSubCommands(cmd)) {
      const targets = findHardDeleteTargets(sub);
      if (!targets) continue;
      const bad = targets.find((t) => !isAllowedDeleteTarget(t, cwd, allowedDirs));
      if (bad !== undefined) {
        add('hardDelete', tr(
          lang,
          `红线拦截（防误删保护）：递归强删的目标 "${bad || '(无法解析)'}" 不在临时目录，也不是项目里的构建产物目录。${trashHint(config, lang)}。确属可删的产物目录时，把目录名加进 safetyGuard.allowedDeleteDirs。`,
          `Blocked (recursive delete): the target "${bad || '(unparsed)'}" is neither in a temp directory nor a build-output directory inside the project. ${trashHint(config, lang)}. If it is a disposable output directory, add its name to safetyGuard.allowedDeleteDirs.`
        ));
      }
    }

    // 规则 3：主检出禁毁灭性 Git 重置
    const gitDestructiveRe = /\bgit\s+(?:reset\s+--hard|clean\s+-[a-z]*f[a-z]*d|clean\s+-[a-z]*d[a-z]*f|clean\s+-f\s+-d)\b/i;
    if (gitDestructiveRe.test(cmd) && !isWorktreeCheckout(cwd)) {
      add('gitReset', tr(
        lang,
        '红线拦截（主工作区保护）：主检出目录执行 git reset --hard 或 git clean -fd 会丢掉未提交的改动。请先确认没有要保留的改动，或改用 git revert、git stash，或新建独立 git worktree 试验。',
        'Blocked (main checkout): git reset --hard or git clean -fd in the main checkout discards uncommitted work. Confirm nothing needs keeping, or use git revert, git stash, or a separate git worktree.'
      ));
    }

    // 规则 4：本机静音（按 environment.quietMainMachine 或 WR_QUIET_HOST=1 启用，默认关）
    if (quietHost && !allowHeavyRunner) {
      const uiHijackRe = /\b(?:SendKeys|mouse_event|SetCursorPos|xdotool|osascript\s+-e[^\n]*keystroke)\b/i;
      if (uiHijackRe.test(cmd)) {
        add('quietHost', tr(
          lang,
          '红线拦截（本机静音）：已开启本机静音（environment.quietMainMachine），禁止在这台电脑上模拟全局键鼠。需要时请用户临时关掉这个开关。',
          'Blocked (quiet host): environment.quietMainMachine is on, so simulating global keyboard or mouse input on this machine is not allowed. Ask the user to turn it off temporarily if needed.'
        ));
      }
      const heavyTestRe = /\b(?:playwright\s+test|cypress\s+run|electron\s+\.)\b/i;
      if (heavyTestRe.test(cmd)) {
        add('quietHost', tr(
          lang,
          '红线拦截（本机静音）：已开启本机静音（environment.quietMainMachine），这台电脑不直接跑会弹浏览器的端到端测试。请改到测试机、容器或 CI 跑；用户同意在本机跑时，命令前加环境变量 WR_TEST_RUNNER=1。',
          'Blocked (quiet host): environment.quietMainMachine is on, so browser-launching end-to-end tests do not run on this machine. Use a test machine, container or CI; if the user agrees to run it here, prefix the command with WR_TEST_RUNNER=1.'
        ));
      }
    }

    // 规则 5：Orca 长参数与引号防劈裂
    if (orcaOn) {
      const quoteHit = checkOrcaQuoteSplit(cmd, orcaMax, lang);
      if (quoteHit) add('orcaQuote', quoteHit);
    }

    // 规则 6：远端机器共享裸临时目录
    if (remoteOn) {
      const remoteTmpHit = checkRemoteBareTempDir(cmd, hosts, suffixes, lang);
      if (remoteTmpHit) add('remoteTmp', remoteTmpHit);
    }
  }
  return hits;
}

function recordObserve(cwd, config, payload) {
  const logRel = config.observeLogPath || '.wr-hook-observe.jsonl';
  const full = logFull(config);
  const entry = {
    ts: new Date().toISOString(),
    hook: 'safety-redline-guard',
    mode: 'observe',
    toolName: payload.toolName,
    rule: payload.rule,
    reason: full ? payload.reason : redactQuoted(payload.reason),
    paths: full ? payload.paths : payload.paths.map(redactPath),
    commands: full ? payload.commands : payload.commands.map(redactCommand)
  };
  try {
    appendFileSync(resolve(cwd, logRel), JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // 观察日志写入失败时不阻塞流程
  }
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  let rawText = '';
  try {
    rawText = readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }
  let parsed;
  try {
    parsed = parseHookInput(rawText);
  } catch {
    process.exit(0);
  }
  const cwd = cli.cwd || parsed.cwd || process.cwd();
  const config = loadConfig(cwd);
  const modeInfo = resolveMode(cli.mode, config);
  const lang = pickLang(config);

  const paths = [];
  const commands = [];
  collectAtoms(parsed.args, paths, commands);

  const hits = checkViolations(paths, commands, cwd, config, lang)
    .map((h) => ({ ...h, mode: ruleMode(h.rule, modeInfo, config) }))
    .filter((h) => h.mode !== 'off');

  const observed = hits.filter((h) => h.mode !== 'enforce');
  const enforced = hits.filter((h) => h.mode === 'enforce');
  for (const h of observed) {
    recordObserve(cwd, config, { toolName: parsed.toolName, rule: h.rule, reason: h.reason, paths, commands });
  }

  if (!enforced.length) {
    if (parsed.protocol === 'agy') {
      process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    }
    process.exit(0);
  }

  const reason = enforced[0].reason;
  if (parsed.protocol === 'agy') {
    process.stdout.write(JSON.stringify({ decision: 'deny', reason }) + '\n');
    process.exit(0);
  }
  process.stderr.write(reason + '\n');
  process.exit(2);
}

main();
