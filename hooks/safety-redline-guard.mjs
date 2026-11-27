#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// 通用安全红线守卫（PreToolUse）
// 纯 Node.js 标准库零依赖，同时兼容 Claude Code 与 Antigravity 钩子协议，支持 observe / enforce 双模式，每条规则可单独设 off / observe / enforce。
import { existsSync, readFileSync, appendFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute, parse as parsePath, posix as posixPath } from 'node:path';
import { homedir, userInfo } from 'node:os';

// <wr-config> 配置读取、模式判定、提示语言与日志脱敏（四个钩子共用同一段，改动时四处保持一致，自测会逐字比对）
// 查找顺序：先读用户目录 ~/wr.config.json（按系统账户的真实用户目录，不看 HOME 等环境变量），再从当前目录逐级往上找项目里的 wr.config.json，项目字段覆盖用户目录字段。
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
// 真实的用户目录：os.userInfo() 读系统账户信息，不受 HOME / USERPROFILE 环境变量影响，项目改不了它
function realHome() {
  try {
    const h = userInfo().homedir;
    if (h) return h;
  } catch {
    // 个别受限环境拿不到账户信息时退回 homedir()
  }
  return homedir();
}
// 用户目录配置的位置：钩子命令行写了 --user-config 就用它（命令行是用户自己写在钩子设置里的），否则是真实用户目录下的 wr.config.json
function userConfigPath(cliUserConfig) {
  return cliUserConfig ? resolve(String(cliUserConfig)) : join(realHome(), 'wr.config.json');
}
function loadConfig(cwd, explicitPath, cliUserConfig) {
  let userCfg = {};
  try {
    const p = userConfigPath(cliUserConfig);
    if (existsSync(p)) userCfg = readJsonSafe(p) || {};
  } catch {
    // 受限环境读不到用户目录时忽略
  }
  const projPath = explicitPath ? resolve(cwd, explicitPath) : findProjectConfig(cwd);
  const projCfg = projPath && existsSync(projPath) ? readJsonSafe(projPath) || {} : {};
  const user = isPlainObject(userCfg) ? userCfg : {};
  const project = isPlainObject(projCfg) ? projCfg : {};
  const merged = deepMerge(user, project);
  // 两条安全红线只认用户目录那份配置能放宽，这里把两份来源单独留着
  Object.defineProperty(merged, '__sources', { value: { user, project }, enumerable: false });
  return merged;
}
function resolveMode(cliMode, config) {
  if (cliMode) return { mode: String(cliMode).toLowerCase(), explicit: true, source: 'cli' };
  if (process.env.WR_HOOK_MODE) return { mode: String(process.env.WR_HOOK_MODE).toLowerCase(), explicit: true, source: 'env' };
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
// 观察日志默认脱敏：路径只留最后一段；命令只留程序名、单字母开关和不带值的长开关，NAME=值 只留 NAME=…；observeLogDetail 写 full 才记完整内容
function logFull(config) {
  return String(config.observeLogDetail || '').toLowerCase() === 'full';
}
function redactPath(p) {
  const parts = String(p || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 1 ? '…/' + parts[parts.length - 1] : String(p || '');
}
function redactCommand(c) {
  const kept = [];
  let expectProgram = true;
  // 按 shell 的方式切词：引号里的空格不算分隔，TOKEN="abc def" 是一个词
  for (const raw of String(c || '').trim().match(/(?:[^\s"']+|"[^"]*"?|'[^']*'?)+/g) || []) {
    if (/^(?:&&|\|\||\||;)$/.test(raw)) {
      kept.push(raw);
      expectProgram = true;
      continue;
    }
    const t = raw.replace(/^["'`(]+|["'`);]+$/g, '');
    const env = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (env) {
      kept.push(env[1] + '=…');
    } else if (expectProgram) {
      if (t) kept.push(redactPath(t));
      expectProgram = false;
    } else if (/^-[A-Za-z]$/.test(t) || /^--[A-Za-z][\w-]*$/.test(t)) {
      kept.push(t);
    }
    if (/;$/.test(raw)) {
      kept.push(';');
      expectProgram = true;
    }
  }
  return kept.length ? kept.join(' ') + ' …' : '';
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
    if (argv[i] === '--user-config' && argv[i + 1]) out.userConfig = argv[++i];
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
  const pathKeys = new Set(['path', 'file_path', 'filepath', 'targetfile', 'target', 'file', 'cwd', 'glob', 'notebook_path']);
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
const DEFAULT_ALLOWED_DELETE_DIRS = [
  'dist', 'build', 'out', 'coverage', 'node_modules', '.cache', '.next', '.nuxt', '.turbo',
  '.parcel-cache', 'target', '__pycache__', '.pytest_cache', 'worktrees'
];
const VALID_RULE_MODES = new Set(['off', 'observe', 'enforce', 'follow']);

function ruleOverride(name, config) {
  const sg = config.safetyGuard || {};
  const v = sg.rules && typeof sg.rules[name] === 'string' ? sg.rules[name].toLowerCase() : '';
  return VALID_RULE_MODES.has(v) ? v : '';
}

function sourcesOf(config) {
  const s = config.__sources || {};
  return { user: isPlainObject(s.user) ? s.user : {}, project: isPlainObject(s.project) ? s.project : {} };
}

// 两条红线（凭据、递归强删）的模式只认三个来源：钩子命令行里的 --mode（用户自己写在钩子设置里）、
// 用户目录 ~/wr.config.json 里的 safetyGuard.rules / profile / hookMode。
// 项目里的 wr.config.json 和环境变量 WR_HOOK_MODE 只能收紧不能放宽，克隆来的陌生仓库关不掉它们。
function redLineMode(name, modeInfo, config) {
  if (modeInfo.explicit && modeInfo.source === 'cli') {
    return modeInfo.mode === 'off' || modeInfo.mode === 'observe' ? modeInfo.mode : 'enforce';
  }
  const { user } = sourcesOf(config);
  const sg = isPlainObject(user.safetyGuard) ? user.safetyGuard : {};
  const v = sg.rules && typeof sg.rules[name] === 'string' ? sg.rules[name].toLowerCase() : '';
  if (v === 'off' || v === 'observe' || v === 'enforce') return v;
  if (user.onboarded === true) {
    const userMode = String(user.hookMode || 'observe').toLowerCase();
    if (userMode === 'off') return 'off';
    if (v === 'follow' || String(sg.profile || '').toLowerCase() === 'relaxed') return userMode === 'enforce' ? 'enforce' : 'observe';
  }
  return 'enforce';
}

// 项目配置里有没有想放宽红线的写法（命中红线时用来提醒「已忽略」）
function projectTriedToRelax(config) {
  const { project } = sourcesOf(config);
  const sg = isPlainObject(project.safetyGuard) ? project.safetyGuard : {};
  const rules = isPlainObject(sg.rules) ? sg.rules : {};
  const relaxing = (v) => ['off', 'observe', 'follow'].includes(String(v || '').toLowerCase());
  return (
    relaxing(rules.credentials) ||
    relaxing(rules.hardDelete) ||
    String(sg.profile || '').toLowerCase() === 'relaxed' ||
    String(project.hookMode || '').toLowerCase() === 'off' ||
    (Array.isArray(sg.allowPatterns) && sg.allowPatterns.length > 0) ||
    Array.isArray(sg.allowedDeleteDirs)
  );
}

function ruleMode(name, modeInfo, config) {
  if (RED_LINES.has(name)) return redLineMode(name, modeInfo, config);
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
const CRED_EXT_RE = new RegExp(`\\.(?:${CRED_EXTS.join('|')})(?:\\.(?:bak|old|orig|backup|save|copy))?(?:$|["'\\s])`, 'i');
// 常见的凭据文件名：包管理器令牌、git 凭据、私钥（含备份）
const CRED_NAME_RE = new RegExp(
  '(?:^|\\/)(?:' +
    [
      ['.', 'n', 'p', 'm', 'r', 'c'].join('').replace('.', '\\.'),
      ['.', 'p', 'y', 'p', 'i', 'r', 'c'].join('').replace('.', '\\.'),
      ['.', 'g', 'i', 't', '-', 'c', 'r', 'e', 'd', 'e', 'n', 't', 'i', 'a', 'l', 's'].join('').replace('.', '\\.'),
      ['i', 'd', '_', '(?:rsa|dsa|ecdsa|ed25519)'].join('') + '(?!\\.pub$)[^/]*'
    ].join('|') +
    ')$',
  'i'
);

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

function credentialHit(norm) {
  if (CRED_DIR_RE.test(norm)) return true; // 凭据目录优先，不被「源码里的 keys 目录」豁免
  if (ENV_ALLOW_RE.test(norm)) return false;
  if (NORMAL_KEY_DIR_RE.test(norm)) return false;
  return CRED_FILE_RE.test(norm) || CRED_EXT_RE.test(norm) || CRED_NAME_RE.test(norm);
}

// 通配写法的几种展开：花括号（.{env,envrc}、*.{pem,key}）、单字符类（.[e]nv）；最多展开 32 个
function globVariants(text) {
  let out = [text];
  for (let round = 0; round < 4; round++) {
    const next = [];
    let changed = false;
    for (const v of out) {
      const m = v.match(/\{([^{}]*)\}/);
      if (!m) {
        next.push(v);
        continue;
      }
      changed = true;
      for (const alt of m[1].split(',')) next.push(v.slice(0, m.index) + alt + v.slice(m.index + m[0].length));
    }
    out = next.slice(0, 32);
    if (!changed) break;
  }
  return out.map((v) => v.replace(/\[!?\^?([^\]])[^\]]*\]/g, '$1'));
}

function isCredentialTarget(text, allowRes) {
  const raw = String(text || '').replace(/\\/g, '/').trim();
  if (!raw) return false;
  // 先归一化 a/../b 这类写法，再判断
  const norm = posixPath.normalize(raw);
  if (allowRes.some((re) => re.test(norm))) return false;
  // 冒号前缀（git show HEAD:.env、主机名:路径）：冒号后面那段也单独判断
  const candidates = [norm, ...norm.split(':').slice(1).filter(Boolean)];
  for (const c of candidates) {
    for (const v of globVariants(c)) {
      const n = posixPath.normalize(v);
      if (credentialHit(n)) return true;
      // 通配符写法（.env*、**/.env、*.pem）：去掉通配符后再判断一次
      if (/[*?]/.test(n)) {
        const stripped = n.replace(/\*\*\/?/g, '').replace(/[*?]/g, '');
        if (stripped && credentialHit(stripped)) return true;
      }
    }
  }
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

  // 脚本里的递归删除：Node 的 fs.rm / rmSync、Python 的 shutil.rmtree、rimraf
  const scriptDel = s.match(/(?:\bfs(?:\.promises)?\.rm(?:Sync)?|\.promises\.rm|\brmSync|\bshutil\.rmtree|\brimraf(?:\.sync)?)\s*\(([^)]*)/i);
  if (scriptDel) {
    const lit = scriptDel[1].match(/^\s*(["'`])([^"'`]*)\1/);
    return [lit ? lit[2] : ''];
  }

  // find … -delete 或 find … -exec rm：删除目标按 find 的起始目录算
  const find = s.match(/(?:^|[^\w.-])find(?:\.exe)?\s+(.+)$/i);
  if (find && /(?:^|\s)-delete\b|-exec(?:dir)?\s+\S*rm\b/i.test(find[1])) {
    const tokens = tokenize(find[1]).map(cleanToken).filter(Boolean);
    const starts = [];
    for (const t of tokens) {
      if (/^[-(!]/.test(t)) break;
      starts.push(t);
    }
    return starts.length ? starts : ['.'];
  }

  // 命令行的 rimraf（含 npx rimraf、pnpm dlx rimraf）：参数里的路径都是删除目标
  const rimrafCli = s.match(/(?:^|[^\w.-])["']?rimraf(?:\.cmd)?["']?\s+(.+)$/i);
  if (rimrafCli) {
    const targets = tokenize(rimrafCli[1]).map(cleanToken).filter((t) => t && !t.startsWith('-'));
    return targets.length ? targets : [''];
  }

  // 命令名按基名识别：rm、/bin/rm、\rm、rm.exe、带引号的 "rm" 都算
  const rm = s.match(/(?:^|[^\w.-])["']?rm(?:\.exe)?["']?\s+(.+)$/i);
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
  if (p === '~' || /^~[/\\]/.test(p)) return join(realHome(), p.slice(1));
  return p;
}

// 算作临时目录的固定位置。不用 os.tmpdir()，因为它读 TEMP / TMP / TMPDIR 环境变量，项目能改
function tempRoots() {
  const home = realHome();
  if (process.platform === 'win32') {
    return [join(home, 'AppData', 'Local', 'Temp'), join(parsePath(home).root || 'C:\\', 'Windows', 'Temp')].map((r) => resolve(r));
  }
  const roots = ['/tmp', '/var/tmp'];
  if (process.platform === 'darwin') roots.push('/private/tmp', '/private/var/tmp', '/var/folders', '/private/var/folders');
  return roots.map((r) => resolve(r));
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

function isAllowedDeleteTarget(rawTarget, cwd, allowedDirs, cdSeen = false) {
  const t = cleanToken(rawTarget);
  if (!t) return false;
  const roots = tempRoots();
  // 临时目录变量开头的（$TMPDIR/x、%TEMP%\x）：换成固定的系统临时目录后再归一化，$TMPDIR/../.. 这类穿越不放行
  const tmpVar = t.match(TMP_VAR_RE);
  const expanded = tmpVar ? join(roots[0], t.slice(tmpVar[0].length)) : t;
  if (!tmpVar && /[$%]/.test(t)) return false; // 解析不了的变量，按不放行处理
  // 命令里先 cd 过时，相对路径已经不是相对钩子拿到的工作目录，一律不按放行名单放行
  if (cdSeen && !tmpVar && !isAbsolute(expanded) && !/^~(?:[/\\]|$)/.test(expanded)) return false;
  const abs = resolve(cwd, expandHome(expanded));
  if (roots.some((r) => abs !== r && isInside(abs, r))) return true;
  if (tmpVar) return false;
  // 根目录下的临时目录：/tmp、/var/tmp、盘符根下的 tmp 或 temp
  const absSegs = segmentsOf(abs.replace(/^[A-Za-z]:/, ''));
  if (absSegs.length > 1 && (absSegs[0] === 'tmp' || absSegs[0] === 'temp' || (absSegs[0] === 'var' && absSegs[1] === 'tmp' && absSegs.length > 2))) return true;
  const root = resolve(cwd);
  if (abs === root || !isInside(abs, root)) return false;
  const relSegs = segmentsOf(relative(root, abs));
  // 项目里叫 tmp 或 temp 的目录
  if (relSegs.some((s) => s === 'tmp' || s === 'temp')) return true;
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

// 用户目录配置能放宽红线，所以命令里出现「用户目录 + wr.config.json」且不是只读查看时一律拦
const HOME_REF_RE = /(?:^|[\s"'=(:,])~(?=[/\\\s"']|$)|\$\{?HOME\}?|%USERPROFILE%|%HOMEPATH%|\$env:(?:USERPROFILE|HOME)|homedir\s*\(|expanduser|Path\.home|os\.environ|getenv/i;
const READ_ONLY_CMD_RE = /^\s*(?:cat|type|more|less|head|tail|bat|get-content|gc|wc|stat|ls|dir|get-item|test-path)\b/i;
function writesGuardConfig(cmd, cwd, guardPaths) {
  const text = String(cmd || '');
  if (!/wr\.config\.json/i.test(text)) return false;
  const lowered = text.replace(/\\/g, '/').toLowerCase();
  const mentionsHome =
    HOME_REF_RE.test(text) ||
    guardPaths.some((g) => lowered.includes(g.replace(/\\/g, '/').toLowerCase()) || lowered.includes(dirname(g).replace(/\\/g, '/').toLowerCase() + '/')) ||
    guardPaths.some((g) => resolve(cwd) === dirname(g));
  if (!mentionsHome) return false;
  const subs = splitSubCommands(text).filter((x) => x.trim());
  const readOnly = !/>|\btee\b/i.test(text) && subs.every((x) => READ_ONLY_CMD_RE.test(x));
  return !readOnly;
}

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function checkViolations(paths, commands, cwd, config, lang, toolName = '', guardPaths = []) {
  const sg = config.safetyGuard || {};
  const extraRes = safeRegExps(sg.extraProtectedPatterns);
  // 放宽两条红线的白名单只认用户目录那份配置；项目里写了也忽略
  const userSgRaw = sourcesOf(config).user.safetyGuard;
  const userSg = isPlainObject(userSgRaw) ? userSgRaw : {};
  const allowRes = safeRegExps(userSg.allowPatterns);
  const allowedDirs = Array.isArray(userSg.allowedDeleteDirs) ? userSg.allowedDeleteDirs : DEFAULT_ALLOWED_DELETE_DIRS;
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
  // 用户目录的 wr.config.json 是唯一能放宽红线的地方，不让 AI 用写文件工具改它
  const guardMsg = () => tr(
    lang,
    '红线拦截（守卫配置保护）：用户目录的 wr.config.json 能放宽安全红线，只能由用户本人修改。请把要改的内容告诉用户，让用户自己改。',
    'Blocked (guard config): ~/wr.config.json can relax the safety red lines, so only the user may edit it. Tell the user what to change instead.'
  );
  for (const cmd of commands) {
    if (writesGuardConfig(cmd, cwd, guardPaths)) add('credentials', guardMsg());
  }
  if (/write|edit|create|replace|patch/i.test(toolName)) {
    for (const p of paths) {
      if (guardPaths.some((g) => samePath(resolve(cwd, expandHome(String(p))), g))) {
        add('credentials', tr(
          lang,
          '红线拦截（守卫配置保护）：用户目录的 wr.config.json 能放宽安全红线，只能由用户本人修改。请把要改的内容告诉用户，让用户自己改。',
          'Blocked (guard config): ~/wr.config.json can relax the safety red lines, so only the user may edit it. Tell the user what to change instead.'
        ));
      }
    }
  }
  for (const p of paths) {
    if (isCredentialTarget(p, allowRes)) {
      add('credentials', tr(
        lang,
        `红线拦截（凭据保护）：禁止读取或修改敏感凭据路径 "${p}"。请改用模板文件或请用户本人处理；确属测试夹具时，把它的路径规则加进用户目录 ~/wr.config.json 的 safetyGuard.allowPatterns（项目里的配置不算）。`,
        `Blocked (credentials): reading or writing the sensitive path "${p}" is not allowed. Use a template file or ask the user to handle it; if it is a test fixture, add a pattern to safetyGuard.allowPatterns in ~/wr.config.json (project configs do not count).`
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
    let cdSeen = false;
    for (const sub of splitSubCommands(cmd)) {
      if (/^\s*(?:["']?(?:cd|pushd|chdir|set-location|sl)["']?)(?:\s|$)/i.test(sub)) cdSeen = true;
      const targets = findHardDeleteTargets(sub);
      if (!targets) continue;
      const bad = targets.find((t) => !isAllowedDeleteTarget(t, cwd, allowedDirs, cdSeen));
      if (bad !== undefined) {
        add('hardDelete', tr(
          lang,
          `红线拦截（防误删保护）：递归强删的目标 "${bad || '(无法解析)'}" 不在临时目录，也不是项目里的构建产物目录。${trashHint(config, lang)}。确属可删的产物目录时，把目录名加进用户目录 ~/wr.config.json 的 safetyGuard.allowedDeleteDirs。`,
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
  const config = loadConfig(cwd, undefined, cli.userConfig);
  const guardPaths = [...new Set([join(realHome(), 'wr.config.json'), userConfigPath(cli.userConfig)].map((p) => resolve(p)))];
  const modeInfo = resolveMode(cli.mode, config);
  const lang = pickLang(config);

  const paths = [];
  const commands = [];
  collectAtoms(parsed.args, paths, commands);
  // Glob 这类工具的 pattern 参数就是路径模式
  if (/glob/i.test(parsed.toolName) && parsed.args && typeof parsed.args.pattern === 'string') paths.push(parsed.args.pattern);

  const allHits = checkViolations(paths, commands, cwd, config, lang, parsed.toolName, guardPaths).map((h) => ({ ...h, mode: ruleMode(h.rule, modeInfo, config) }));

  // 红线被用户目录配置放宽时，放行之余给一句提醒；项目配置想放宽红线时，拦截原因里说明已忽略
  const relaxedRed = allHits.filter((h) => RED_LINES.has(h.rule) && h.mode !== 'enforce');
  if (relaxedRed.length) {
    process.stderr.write(tr(
      lang,
      `提醒：安全红线（${relaxedRed.map((h) => h.rule).join('、')}）已被用户目录的 wr.config.json 或钩子命令行放宽，本次没有拦截。\n`,
      `Notice: safety red line (${relaxedRed.map((h) => h.rule).join(', ')}) is relaxed by ~/wr.config.json or the hook command line, so this call was not blocked.\n`
    ));
  }
  const ignoredNote = projectTriedToRelax(config)
    ? tr(lang, '（项目里的 wr.config.json 想放宽这条红线，已忽略；只有用户目录 ~/wr.config.json 能放宽。）', ' (The project wr.config.json tries to relax this red line and was ignored; only ~/wr.config.json can relax it.)')
    : '';

  const hits = allHits.filter((h) => h.mode !== 'off').map((h) => (RED_LINES.has(h.rule) && h.mode === 'enforce' ? { ...h, reason: h.reason + ignoredNote } : h));

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
