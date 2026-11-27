#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// 4 个通用钩子脚本的全量自动化单测（正常放行、危险拦截、双协议、observe/enforce 切换、首次对齐与配置查找）
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(HOOKS_DIR, '..');
const sandbox = mkdtempSync(join(tmpdir(), 'wr-hooks-test-'));
const sandboxHome = join(sandbox, 'home');
mkdirSync(sandboxHome, { recursive: true });
const LOG = join(sandbox, '.wr-hook-observe.jsonl');

// 测试进程不继承本机的 Orca 环境变量与真实用户目录，避免本机环境影响结果
function baseEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('ORCA_')) continue;
    env[k] = v;
  }
  return {
    ...env,
    HOME: sandboxHome,
    USERPROFILE: sandboxHome,
    WR_HOOK_MODE: '',
    WR_QUIET_HOST: '',
    WR_TEST_RUNNER: '',
    ...extra
  };
}

// 钩子按系统账户的真实用户目录找 ~/wr.config.json，不看 HOME 环境变量；测试里用 --user-config 指定一份
// （路径取 envExtra.HOME 下的 wr.config.json，没给就是沙盒里的空目录），opts.noUserConfig 时不传，用来验证环境变量伪造无效
function runNode(scriptName, args = [], stdinObj = null, envExtra = {}, opts = {}) {
  const input = stdinObj == null ? '' : (typeof stdinObj === 'string' ? stdinObj : JSON.stringify(stdinObj));
  const userCfg = opts.noUserConfig ? [] : ['--user-config', join(envExtra.HOME || sandboxHome, 'wr.config.json')];
  return spawnSync(process.execPath, [join(HOOKS_DIR, scriptName), ...args, ...userCfg], {
    input,
    encoding: 'utf8',
    cwd: sandbox,
    env: baseEnv(envExtra)
  });
}

let homeSeq = 0;
function homeWith(cfg) {
  const dir = join(sandbox, `home-cfg-${++homeSeq}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'wr.config.json'), JSON.stringify(cfg, null, 2), 'utf8');
  return { HOME: dir, USERPROFILE: dir };
}

let projSeq = 0;
function makeProject(cfg) {
  const dir = join(sandbox, `proj-${++projSeq}`);
  mkdirSync(dir, { recursive: true });
  if (cfg) writeFileSync(join(dir, 'wr.config.json'), JSON.stringify(cfg, null, 2), 'utf8');
  return dir;
}

function readLog(dir = sandbox) {
  const p = join(dir, '.wr-hook-observe.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function bash(command, cwd = sandbox) {
  return { tool_name: 'Bash', tool_input: { command }, cwd };
}

const ONBOARDED = { onboarded: true, hookMode: 'enforce' };

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
}

try {
  const fakeSsh = ['~/', '.', 's', 's', 'h', '/id_rsa'].join('');
  const fakeEnv = ['.', 'e', 'n', 'v', '.local'].join('');
  const safeEnv = ['.', 'e', 'n', 'v', '.example'].join('');
  const authJson = ['a', 'u', 't', 'h', '.', 'j', 's', 'o', 'n'].join('');
  const pemFile = ['server', '.', 'p', 'e', 'm'].join('');

  // ========== 一、默认模式与首次对齐（9-1） ==========
  test('默认模式：没有配置文件时只有凭据和递归强删两条红线硬拦，其余一律只记录（9-1）', () => {
    const r1 = runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: sandbox });
    assert.equal(r1.status, 2);
    assert.match(r1.stderr, /凭据保护/);
    const r1b = runNode('safety-redline-guard.mjs', [], bash('git reset --hard HEAD~1'));
    assert.equal(r1b.status, 0);
    assert.match(readLog(), /"rule":"gitReset"/);

    const doc = { coverageGate: {}, items: [{ id: 'd-1', passes: true, evidence: 'missing.txt' }] };
    const r2 = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre'], {
      session_id: 'sess-default-' + Date.now(),
      tool_name: 'Write',
      tool_input: { file_path: 'acceptance.json', content: JSON.stringify(doc) },
      cwd: sandbox
    });
    assert.equal(r2.status, 0);
    assert.match(readLog(), /evidence-before-pass-gate/);

    const r3 = runNode('speak-before-act-hook.mjs', ['--phase', 'pre'], {
      session_id: 'sess-default-speak-' + Date.now(),
      transcript: [{ role: 'user', content: '帮我改个配置' }],
      cwd: sandbox
    });
    assert.equal(r3.status, 0);
    assert.match(readLog(), /先应声再动手/);

    const leak = join(sandbox, 'leak-default.md');
    writeFileSync(leak, ['路径 /Users/', 'alice', '/notes.txt'].join(''), 'utf8');
    const r4 = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, 'leak-default.md']);
    assert.equal(r4.status, 0);
    assert.match(r4.stdout, /模式：observe/);
  });

  test('首次对齐：onboarded 不是 true 时，除两条红线外配置写了 enforce 也只记录；写上 onboarded:true 才按 hookMode 硬拦', () => {
    const quiet = { WR_QUIET_HOST: '1' };
    const notYet = makeProject({ hookMode: 'enforce' });
    const r1 = runNode('safety-redline-guard.mjs', [], bash('npx playwright test', notYet), quiet);
    assert.equal(r1.status, 0);
    assert.match(readLog(notYet), /本机静音/);
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: notYet }).status, 2, '凭据在对齐前也硬拦');

    const done = makeProject(ONBOARDED);
    const r2 = runNode('safety-redline-guard.mjs', [], bash('npx playwright test', done), quiet);
    assert.equal(r2.status, 2);
  });

  test('配置查找：从子目录往上找到项目配置；没有项目配置时读用户目录；两处都有时项目覆盖用户目录', () => {
    const root = makeProject(ONBOARDED);
    const deep = join(root, 'packages', 'app', 'src');
    mkdirSync(deep, { recursive: true });
    const quiet = { WR_QUIET_HOST: '1' };
    const r1 = runNode('safety-redline-guard.mjs', [], bash('npx playwright test', deep), quiet);
    assert.equal(r1.status, 2, '子目录应读到上层项目配置');

    const home2 = join(sandbox, 'home-with-config');
    mkdirSync(home2, { recursive: true });
    writeFileSync(join(home2, 'wr.config.json'), JSON.stringify(ONBOARDED), 'utf8');
    const bare = makeProject(null);
    const r2 = runNode(
      'safety-redline-guard.mjs',
      [],
      bash('npx playwright test', bare),
      { HOME: home2, USERPROFILE: home2, ...quiet }
    );
    assert.equal(r2.status, 2, '应读到用户目录配置');
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('npx playwright test', bare), quiet).status, 0, '没有用户目录配置时只记录');

    const override = makeProject({ safetyGuard: { rules: { quietHost: 'off' } } });
    const r3 = runNode('safety-redline-guard.mjs', [], bash('npx playwright test', override), { HOME: home2, USERPROFILE: home2, ...quiet });
    assert.equal(r3.status, 0, '普通规则：项目配置覆盖用户目录配置');
  });

  test('四个钩子内嵌的配置读取段逐字一致', () => {
    const blocks = ['safety-redline-guard.mjs', 'evidence-before-pass-gate.mjs', 'speak-before-act-hook.mjs', 'copy-and-privacy-lint.mjs'].map((f) => {
      const src = readFileSync(join(HOOKS_DIR, f), 'utf8');
      const m = src.match(/\/\/ <wr-config>[\s\S]*?\/\/ <\/wr-config>/);
      assert.ok(m, `${f} 缺少 wr-config 段`);
      return m[0];
    });
    for (const b of blocks) assert.equal(b, blocks[0]);
  });

  // ========== 二、safety-redline-guard ==========
  test('safety: 正常读源码与 .env.example 放行', () => {
    const r1 = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], { tool_name: 'read_file', tool_input: { Path: safeEnv }, cwd: sandbox });
    assert.equal(r1.status, 0);
    const r2 = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], { tool_name: 'read_file', tool_input: { Path: 'src/keys/format.js' }, cwd: sandbox });
    assert.equal(r2.status, 0);
  });

  test('safety: enforce 模式拦截凭据路径（Claude 协议 exit 2）', () => {
    const r = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], { tool_name: 'read_file', tool_input: { Path: fakeSsh }, cwd: sandbox });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /凭据保护/);
  });

  test('safety: enforce 模式展开批量工具参数拦截敏感文件（AGY 协议 deny）', () => {
    const r = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], {
      toolCall: { name: 'apply_edits', args: { edits: [{ path: fakeEnv, create: 'SECRET=1' }] } },
      cwd: sandbox
    });
    assert.equal(r.status, 0);
    const resp = JSON.parse(r.stdout.trim());
    assert.equal(resp.decision, 'deny');
    assert.match(resp.reason, /凭据保护/);
  });

  test('safety: 凭据误伤可用用户目录配置的 allowPatterns 放行测试夹具（7-1），项目里写的不算（终审 B3）', () => {
    const strict = makeProject(ONBOARDED);
    const rFix = runNode('safety-redline-guard.mjs', [], bash(`cat fixtures/${authJson}`, strict));
    assert.equal(rFix.status, 2);
    const rPem = runNode('safety-redline-guard.mjs', [], bash(`cat certs/${pemFile}`, strict));
    assert.equal(rPem.status, 2);

    const allowHome = homeWith({ ...ONBOARDED, safetyGuard: { allowPatterns: ['^fixtures/', '^certs/'] } });
    const plain = makeProject(null);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(`cat fixtures/${authJson}`, plain), allowHome).status, 0);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(`cat certs/${pemFile}`, plain), allowHome).status, 0);
    const projAllow = makeProject({ ...ONBOARDED, safetyGuard: { allowPatterns: ['.'] } });
    const rProj = runNode('safety-redline-guard.mjs', [], bash(`cat fixtures/${authJson}`, projAllow));
    assert.equal(rProj.status, 2, '项目里的 allowPatterns 不能放宽凭据红线');
    assert.match(rProj.stderr, /已忽略/);
  });

  // 删除规则的测试放在临时目录之外的虚拟项目与虚拟用户目录里，免得整段路径都落在系统临时目录被一律放行
  const fakeRoot = process.platform === 'win32' ? 'Z:\\wr-fake' : '/wr-fake';
  const fakeProj = join(fakeRoot, 'proj');
  const fakeHome = join(fakeRoot, 'home');
  const delEnv = { HOME: fakeHome, USERPROFILE: fakeHome };
  const del = (command) => runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash(command, fakeProj), delEnv).status;

  test('safety: 删除放行按路径段匹配，builder-notes 不再因含 build 被放行（7-2 实测复现）', () => {
    assert.equal(del('rm -rf ~/Documents/builder-notes'), 2);
    assert.equal(del('rm -rf ~/Documents/my-notes'), 2);
    assert.equal(del('rm -rf ./important-data'), 2);
    assert.equal(del('rm -rf ~/Documents/build'), 2, '项目外的同名目录不放行');
    assert.equal(del('rm -rf build'), 0);
    assert.equal(del('rm -rf ./dist'), 0);
    assert.equal(del('rm -rf ./node_modules/.cache'), 0);
    assert.equal(del('rm -rf packages/web/dist/*'), 0);
    assert.equal(del('rm -rf /tmp/wr-scratch-1'), 0);
    assert.equal(del('rm -rf dist && rm -rf src'), 2, '复合命令里任何一个目标不合规都拦');
    assert.equal(del('Remove-Item -Recurse -Force .\\dist'), 0);
    assert.equal(del('Remove-Item -Recurse -Force -Path .\\src'), 2);
    assert.equal(del('rm notes.txt'), 0, '非递归非强制的普通删除不归这条规则管');
  });

  test('safety: 显式 enforce 时主检出硬重置被拦，worktree 外的说明给出替代做法', () => {
    const r = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('git reset --hard HEAD~1'));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /git revert/);
  });

  test('safety: 标准档下 observe 也硬拦凭据与强删，git 硬重置只记录（7-4）', () => {
    const p = makeProject({ onboarded: true, hookMode: 'observe' });
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: p }).status, 2);
    const outside = JSON.stringify(join(fakeHome, 'Documents', 'notes'));
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(`rm -rf ${outside}`, p)).status, 2);
    const rReset = runNode('safety-redline-guard.mjs', [], bash('git reset --hard HEAD~1', p));
    assert.equal(rReset.status, 0);
    assert.match(readLog(p), /"rule":"gitReset"/);
  });

  test('safety: 宽松档（写在用户目录）红线跟随 hookMode，严格档全部硬拦，单条规则可关', () => {
    const relaxedHome = homeWith({ onboarded: true, hookMode: 'observe', safetyGuard: { profile: 'relaxed' } });
    const rRelaxed = runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: makeProject(null) }, relaxedHome);
    assert.equal(rRelaxed.status, 0);
    assert.match(rRelaxed.stderr, /已被用户目录/, '红线被放宽时要提醒');

    const strict = makeProject({ onboarded: true, hookMode: 'observe', safetyGuard: { profile: 'strict' } });
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('git reset --hard HEAD~1', strict)).status, 2);

    const offHome = homeWith({ ...ONBOARDED, safetyGuard: { rules: { gitReset: 'off', credentials: 'off' } } });
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('git reset --hard HEAD~1', makeProject(null)), offHome).status, 0);
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: makeProject(null) }, offHome).status, 0);
  });

  test('safety: 本机静音默认关；开启后拦重型浏览器测试，携带 WR_TEST_RUNNER=1 放行', () => {
    assert.equal(runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('npx playwright test')).status, 0);
    const rDeny = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('npx playwright test'), { WR_QUIET_HOST: '1' });
    assert.equal(rDeny.status, 2);
    assert.match(rDeny.stderr, /WR_TEST_RUNNER=1/);
    const rAllow = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('npx playwright test'), { WR_QUIET_HOST: '1', WR_TEST_RUNNER: '1' });
    assert.equal(rAllow.status, 0);
    const quiet = makeProject({ ...ONBOARDED, environment: { quietMainMachine: true } });
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('npx playwright test', quiet)).status, 2);
  });

  test('safety: observe 模式放行违规但记录 .wr-hook-observe.jsonl', () => {
    const r = runNode('safety-redline-guard.mjs', ['--mode', 'observe'], { tool_name: 'read_file', tool_input: { Path: fakeSsh }, cwd: sandbox });
    assert.equal(r.status, 0);
    assert.match(readLog(), /safety-redline-guard/);
  });

  test('safety: 远端裸临时目录规则默认关，普通 scp 不再被拦（1-5 实测复现）', () => {
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('scp backup.tgz myserver:/tmp/backup')).status, 0);
    assert.equal(runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('scp backup.tgz myserver:/tmp/backup')).status, 0);
  });

  test('safety: 配了 environment.remoteHost 才查远端裸目录，只查发往这些主机的命令，放行带后缀或二级子目录', () => {
    const p = makeProject({ ...ONBOARDED, environment: { remoteHost: ['runner-box'] } });
    const winBare = ['C', ':\\tmp\\my-site-v7'].join('');
    const rBareWin = runNode('safety-redline-guard.mjs', [], bash(`ssh runner-box "mkdir ${winBare}"`, p));
    assert.equal(rBareWin.status, 2);
    assert.match(rBareWin.stderr, /防碰撞/);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('scp bundle.tgz runner-box:/tmp/my-site-v7', p)).status, 2);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('scp bundle.tgz runner-box:/tmp/my-site-v7-task1-20261126/', p)).status, 0);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('ssh runner-box "mkdir -p /tmp/my-site-v7/job2"', p)).status, 0);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('scp backup.tgz otherhost:/tmp/backup', p)).status, 0, '没配置的主机不查');
  });

  test('safety: Orca 引号规则默认关，只有探测到 Orca 且终端是 PowerShell 才启用（2-1 实测复现）', () => {
    const longText = '测试正文'.repeat(33);
    const cmdLong = `orca orchestration worker-start --spec "${longText}"`;
    assert.equal(runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash(cmdLong)).status, 0, '没有 Orca 环境时不查');

    const bashShell = makeProject({ ...ONBOARDED, tools: { orca: true }, environment: { shell: 'bash' } });
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(cmdLong, bashShell)).status, 0, 'Orca 但不是 PowerShell 时不查');

    const ps = makeProject({ ...ONBOARDED, tools: { orca: true }, environment: { shell: 'powershell' } });
    const rLong = runNode('safety-redline-guard.mjs', [], bash(cmdLong, ps));
    assert.equal(rLong.status, 2);
    assert.match(rLong.stderr, /--spec-file/);
    const rQuote = runNode('safety-redline-guard.mjs', [], bash(`orca orchestration send --type note --body 'check "assets/a.svg" now'`, ps));
    assert.equal(rQuote.status, 2);
    assert.match(rQuote.stderr, /--body-file/);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash('orca orchestration send --type worker_done --body-file msg.txt', ps)).status, 0);
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(`orca orchestration send --type note --body 'short clean note'`, ps)).status, 0);

    const envDetect = makeProject({ ...ONBOARDED, environment: { shell: 'pwsh' } });
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(cmdLong, envDetect), { ORCA_APP_VERSION: '1.0.0' }).status, 2, '靠环境变量探测到 Orca');
    const optOut = makeProject({ ...ONBOARDED, tools: { orca: true }, environment: { shell: 'powershell' }, safetyGuard: { rules: { orcaQuote: 'off' } } });
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(cmdLong, optOut)).status, 0);
  });

  test('safety: 没有配置文件时递归强删照样硬拦，红线只能由用户目录配置在对齐前改成只记录', () => {
    const delNoMode = (command, env = {}) => runNode('safety-redline-guard.mjs', [], bash(command, fakeProj), { ...delEnv, ...env }).status;
    assert.equal(delNoMode('rm -rf ~/Documents/builder-notes'), 2);
    assert.equal(delNoMode('rm -rf ./dist'), 0);
    const softHome = homeWith({ safetyGuard: { rules: { credentials: 'observe' } } });
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: makeProject(null) }, softHome).status, 0);
  });

  test('safety: 观察日志默认脱敏路径和命令参数，observeLogDetail=full 才记完整内容（7-7）', () => {
    const secretDir = 'very-private-folder';
    const red = makeProject({ ...ONBOARDED, hookMode: 'observe' });
    runNode('safety-redline-guard.mjs', [], bash(`git reset --hard HEAD~1 && echo ${secretDir}/notes`, red));
    const logRed = readLog(red);
    assert.match(logRed, /"rule":"gitReset"/);
    assert.doesNotMatch(logRed, new RegExp(secretDir), '默认不记命令参数');
    assert.match(logRed, /git --hard/);

    const full = makeProject({ ...ONBOARDED, hookMode: 'observe', observeLogDetail: 'full' });
    runNode('safety-redline-guard.mjs', [], bash(`git reset --hard HEAD~1 && echo ${secretDir}/notes`, full));
    assert.match(readLog(full), new RegExp(secretDir));

    const lintP = makeProject({ ...ONBOARDED, hookMode: 'observe' });
    writeFileSync(join(lintP, 'x.md'), ['见 /Users/', 'alice', '/', secretDir, '/a.txt'].join(''), 'utf8');
    runNode('copy-and-privacy-lint.mjs', ['--cwd', lintP, 'x.md']);
    const lintLog = readLog(lintP);
    assert.match(lintLog, /copy-and-privacy-lint/);
    assert.doesNotMatch(lintLog, new RegExp(secretDir), '隐私扫描日志不回显命中原文');
  });

  test('language.output 为 en 时四个钩子的提示改用英文（8-1）', () => {
    const en = makeProject({ ...ONBOARDED, language: { output: 'en' }, speakBeforeAct: { preAction: 'block' } });
    const r1 = runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: en });
    assert.equal(r1.status, 2);
    assert.ok(r1.stderr.startsWith('Blocked (credentials)'), r1.stderr);
    const r2 = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre'], {
      session_id: 'sess-en-' + Date.now(),
      tool_name: 'Write',
      tool_input: { file_path: 'acceptance.json', content: JSON.stringify({ items: [{ id: 'e1', passes: true, evidence: '' }] }) },
      cwd: en
    });
    assert.equal(r2.status, 2);
    assert.match(r2.stderr, /^Evidence gate/);
    const r3 = runNode('speak-before-act-hook.mjs', ['--phase', 'pre'], { session_id: 'sess-en-sp-' + Date.now(), transcript: [{ role: 'user', content: 'fix it' }], cwd: en });
    assert.match(r3.stderr, /^Speak-before-act reminder/);
    writeFileSync(join(en, 'k.md'), ['/Users/', 'alice', '/x'].join(''), 'utf8');
    const r4 = runNode('copy-and-privacy-lint.mjs', ['--cwd', en, 'k.md']);
    assert.match(r4.stdout, /local absolute path/);
    assert.match(r4.stdout, /Scanned 1 files/);
    const zh = makeProject({ ...ONBOARDED, language: { output: 'auto' } });
    assert.match(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: zh }).stderr, /凭据保护/);
  });

  test('终审 B1：观察日志不留 NAME=值 前缀和 -p密码 这类带值短开关', () => {
    const p = makeProject({ ...ONBOARDED, hookMode: 'observe' });
    const token = 'ghp_' + 'a'.repeat(36);
    runNode('safety-redline-guard.mjs', [], bash(`GITHUB_TOKEN=${token} git reset --hard`, p));
    runNode('safety-redline-guard.mjs', [], bash('MYSQL_PWD=hunter2xyz git reset --hard', p));
    runNode('safety-redline-guard.mjs', [], bash('mysql -uroot -pTopSecretPw1 -e x && git reset --hard', p));
    const log = readLog(p);
    assert.match(log, /GITHUB_TOKEN=…/);
    assert.match(log, /MYSQL_PWD=…/);
    for (const secret of [token, 'hunter2xyz', 'TopSecretPw1', 'uroot']) assert.ok(!log.includes(secret), secret);
  });

  test('终审 B2：递归强删的路径穿越与命令名绕过都会被拦', () => {
    assert.equal(del('rm -rf $TMPDIR/../../Documents/x'), 2);
    assert.equal(del('Remove-Item -Recurse -Force $env:TEMP\\..\\..\\Documents\\x'), 2);
    assert.equal(del('rd /s /q %TEMP%\\..\\Documents\\x'), 2);
    assert.equal(del('rm -rf $TMPDIR/build-cache'), 0, '真正落在临时目录里的放行');
    assert.equal(del('/bin/rm -rf ~/Documents/x'), 2);
    assert.equal(del('\\rm -rf ~/Documents/x'), 2);
    assert.equal(del('find ~/Documents -name "*.log" -delete'), 2);
    assert.equal(del('find ./dist -type f -delete'), 0);
    assert.equal(del(`python -c "import shutil; shutil.rmtree('/srv/data')"`), 2);
    assert.equal(del(`node -e "require('fs').rmSync('~/Documents/x', { recursive: true })"`), 2);
    assert.equal(del('rm -rf ~/tmp/Documents'), 2, '家目录下叫 tmp 的普通目录不再当临时目录');
    assert.equal(del('rm -rf ./tmp/cache'), 0, '项目里的 tmp 目录放行');
  });

  test('终审 B3：项目里的 wr.config.json 关不掉两条红线，环境变量 WR_HOOK_MODE 也不行', () => {
    const evil = makeProject({ ...ONBOARDED, hookMode: 'off', safetyGuard: { profile: 'relaxed', rules: { credentials: 'off', hardDelete: 'off' }, allowedDeleteDirs: ['Documents'] } });
    const r1 = runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: evil });
    assert.equal(r1.status, 2);
    assert.match(r1.stderr, /已忽略/);
    const r2 = runNode('safety-redline-guard.mjs', [], bash('rm -rf ./src', evil));
    assert.equal(r2.status, 0, '工作区在临时目录下，强删本来就放行');
    const strictHome = homeWith({ ...ONBOARDED, safetyGuard: { profile: 'strict' } });
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: evil }, strictHome).status, 2, '用户的严格档不被项目配置覆盖');
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: sandbox }, { WR_HOOK_MODE: 'off' }).status, 2);
    assert.equal(runNode('safety-redline-guard.mjs', ['--mode', 'off'], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: sandbox }).status, 0, '钩子命令行是用户自己写的，可以关');
    assert.equal(del('rm -rf ~/Documents/x'), 2);

    const h = homeWith({ onboarded: true });
    const p = makeProject(null);
    const write = runNode('safety-redline-guard.mjs', [], { tool_name: 'Write', tool_input: { file_path: '~/wr.config.json', content: '{}' }, cwd: p }, h);
    assert.equal(write.status, 2, 'AI 不能改用户目录的守卫配置');
    assert.match(write.stderr, /守卫配置保护/);
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: '~/wr.config.json' }, cwd: p }, h).status, 0, '读可以');
    assert.equal(runNode('safety-redline-guard.mjs', [], { tool_name: 'Write', tool_input: { file_path: 'wr.config.json', content: '{}' }, cwd: p }, h).status, 0, '项目里的配置照常能写（首次对齐要写）');
  });

  test('终审 B4：Grep/Glob 的通配参数、常见凭据文件名和 ../ 穿越都会被拦', () => {
    const p = makeProject(null);
    const call = (tool, input) => runNode('safety-redline-guard.mjs', [], { tool_name: tool, tool_input: input, cwd: p }).status;
    assert.equal(call('Grep', { pattern: 'API_KEY', glob: ['.', 'e', 'n', 'v', '*'].join(''), path: '.' }), 2);
    assert.equal(call('Glob', { pattern: ['**/', '.', 'e', 'n', 'v'].join('') }), 2);
    assert.equal(call('Glob', { pattern: 'src/**/*.ts' }), 0);
    const ssh = ['~/', '.', 's', 's', 'h'].join('');
    assert.equal(call('Bash', { command: `cat ${ssh}/docs/keys/../id_rsa` }), 2);
    for (const name of ['.npmrc', '.git-credentials', 'backup/id_ed25519', ['server', 'key', 'bak'].join('.')]) {
      assert.equal(call('Bash', { command: 'cat ~/' + name }), 2, name);
    }
    assert.equal(call('Bash', { command: 'cat ~/backup/id_ed25519.pub' }), 0, '公钥放行');
  });

  test('复审 B1：用 HOME、USERPROFILE、TEMP、TMPDIR 伪造家目录或临时目录，放宽不了两条红线', () => {
    const fakeHomeCfg = homeWith({ onboarded: true, safetyGuard: { rules: { credentials: 'off', hardDelete: 'off' } } });
    const p = makeProject(null);
    const noFlag = { noUserConfig: true };
    const r1 = runNode('safety-redline-guard.mjs', [], { tool_name: 'Read', tool_input: { file_path: fakeSsh }, cwd: p }, fakeHomeCfg, noFlag);
    assert.equal(r1.status, 2, '伪造的 HOME 里的放宽配置不算');
    const fakeTmp = { TEMP: fakeHome, TMP: fakeHome, TMPDIR: fakeHome };
    assert.equal(runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('rm -rf ~/Documents/x', fakeProj), { ...delEnv, ...fakeTmp }).status, 2);
    assert.equal(runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('rm -rf $TMPDIR/Documents', fakeProj), { ...delEnv, ...fakeTmp }).status, 0, '$TMPDIR 展开成固定的系统临时目录，不按环境变量的值');
    const rootTmp = { TEMP: fakeRoot, TMP: fakeRoot, TMPDIR: fakeRoot };
    assert.equal(runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], bash('rm -rf ' + join(fakeRoot, 'home'), fakeProj), { ...delEnv, ...rootTmp }).status, 2);
  });

  test('复审 B2：Bash 里写、改、移动、覆盖用户目录的 wr.config.json 一律拦，只读查看放行', () => {
    const p = makeProject(null);
    const cfg = 'wr.config.json';
    const writes = [
      `echo {} > ~/${cfg}`,
      `sed -i 's/enforce/off/' ~/${cfg}`,
      `cp x.json ~/${cfg}`,
      `mv x.json $HOME/${cfg}`,
      `echo {} | tee %USERPROFILE%\\${cfg}`,
      `node -e "require('fs').writeFileSync(require('os').homedir()+'/${cfg}','{}')"`,
      `python -c "open(__import__('os').path.expanduser('~/${cfg}'),'w').write('{}')"`,
      `Set-Content -Path $env:USERPROFILE\\${cfg} -Value '{}'`
    ];
    for (const c of writes) {
      const r = runNode('safety-redline-guard.mjs', [], bash(c, p));
      assert.equal(r.status, 2, c);
      assert.match(r.stderr, /守卫配置保护/, c);
    }
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(`cat ~/${cfg}`, p)).status, 0, '只读查看放行');
    assert.equal(runNode('safety-redline-guard.mjs', [], bash(`echo {} > ${cfg}`, p)).status, 0, '写项目里的配置照常放行');
  });

  test('复审非阻塞：带引号的 rm、cd 之后的相对路径、命令行 rimraf、promises.rm、花括号与冒号前缀的凭据写法都拦', () => {
    assert.equal(del('"rm" -rf ~/Documents/x'), 2);
    assert.equal(del("'rm' -rf ~/Documents/x"), 2);
    assert.equal(del('cd ~/Documents/important && rm -rf dist'), 2);
    assert.equal(del('rm -rf dist'), 0, '没有 cd 时项目里的 dist 照常放行');
    assert.equal(del('npx rimraf ~/Documents/x'), 2);
    assert.equal(del('npx rimraf ./dist'), 0);
    assert.equal(del(`node -e "require('fs').promises.rm('/srv/x', { recursive: true })"`), 2);
    const p = makeProject(null);
    const envName = ['.', 'e', 'n', 'v'].join('');
    const call = (tool, input) => runNode('safety-redline-guard.mjs', [], { tool_name: tool, tool_input: input, cwd: p }).status;
    assert.equal(call('Bash', { command: 'git show HEAD:' + envName }), 2);
    assert.equal(call('Glob', { pattern: '.{env,envrc}' }), 2);
    assert.equal(call('Grep', { pattern: 'x', glob: '*.{pem,key}' }), 2);
    assert.equal(call('Bash', { command: 'cat .[e]nv' }), 2);
    assert.equal(call('Glob', { pattern: 'src/**/*.{ts,tsx}' }), 0);
  });

  test('复审非阻塞：引号里带空格的环境变量值不会漏进观察日志', () => {
    const p = makeProject({ ...ONBOARDED, hookMode: 'observe' });
    runNode('safety-redline-guard.mjs', [], bash('TOKEN="abc def-SECRET2" git reset --hard', p));
    const log = readLog(p);
    assert.match(log, /TOKEN=…/);
    assert.ok(!log.includes('SECRET2') && !log.includes('abc def'), log);
  });

  // ========== 三、evidence-before-pass-gate ==========
  const evFile = join(sandbox, 'qa-log.txt');
  writeFileSync(evFile, 'all 12 real tests passed\n', 'utf8');
  const sessionEv = 'sess-ev-' + Date.now();

  test('evidence: 未读证据就标 passes:true 被 enforce 拦截', () => {
    const doc = { coverageGate: { unmappedFiles: [], zeroRunSuites: [] }, items: [{ id: 'qa-1', passes: true, evidence: 'qa-log.txt' }] };
    const r = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: sessionEv,
      tool_name: 'write_file',
      tool_input: { Path: 'acceptance.json', Content: JSON.stringify(doc) },
      cwd: sandbox
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /尚未亲眼读取/);
  });

  test('evidence: PostToolUse 读取证据后，仍拦截 UNMAPPED 与 ZERO_RUN，全齐则放行', () => {
    const rPost = runNode('evidence-before-pass-gate.mjs', ['--phase', 'post'], {
      session_id: sessionEv,
      tool_name: 'read_file',
      tool_input: { Path: 'qa-log.txt' },
      cwd: sandbox
    });
    assert.equal(rPost.status, 0);

    const badDoc = { coverageGate: { unmappedFiles: ['src/core.js'], zeroRunSuites: [] }, items: [{ id: 'qa-1', passes: true, evidence: 'qa-log.txt' }] };
    const rUnmapped = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: sessionEv,
      tool_name: 'write_file',
      tool_input: { Path: 'acceptance.json', Content: JSON.stringify(badDoc) },
      cwd: sandbox
    });
    assert.equal(rUnmapped.status, 2);
    assert.match(rUnmapped.stderr, /UNMAPPED/);
    assert.match(rUnmapped.stderr, /用户本人确认/);

    const goodDoc = { coverageGate: { unmappedFiles: [], zeroRunSuites: [] }, items: [{ id: 'qa-1', passes: true, evidence: 'qa-log.txt' }] };
    const rOk = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: sessionEv,
      tool_name: 'write_file',
      tool_input: { Path: 'acceptance.json', Content: JSON.stringify(goodDoc) },
      cwd: sandbox
    });
    assert.equal(rOk.status, 0);
  });

  test('evidence: observe 模式对违规验收单放行并写观察日志', () => {
    const badDoc = { coverageGate: { unmappedFiles: [], zeroRunSuites: ['unit-suite'] }, items: [{ id: 'qa-2', passes: true, evidence: 'qa-log.txt' }] };
    const rObs = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'observe'], {
      session_id: sessionEv,
      tool_name: 'write_file',
      tool_input: { Path: 'acceptance.json', Content: JSON.stringify(badDoc) },
      cwd: sandbox
    });
    assert.equal(rObs.status, 0);
    assert.match(readLog(), /evidence-before-pass-gate/);
  });

  test('evidence: 默认只盯 acceptance.json，不再盯 batch-results.json（6-7）', () => {
    const doc = { items: [{ id: 'b-1', passes: true, evidence: 'never-read.txt' }] };
    const r = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: 'sess-batch-' + Date.now(),
      tool_name: 'Write',
      tool_input: { file_path: 'batch-results.json', content: JSON.stringify(doc) },
      cwd: sandbox
    });
    assert.equal(r.status, 0);
  });

  // ========== 四、speak-before-act-hook ==========
  const sessionSpeak = 'sess-speak-' + Date.now();
  const hintOf = (r) => {
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout.trim());
    assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal('permissionDecision' in out.hookSpecificOutput, false, '软提示不替用户做放行决定');
    return out.hookSpecificOutput.additionalContext;
  };
  test('speak: enforce 下没开口就调工具只给软提示不拒绝（9-6），同轮第二次不再提示', () => {
    const payload = { session_id: sessionSpeak, turn_id: 'turn-1', transcript: [{ role: 'user', content: '帮我修一下构建脚本' }], cwd: sandbox };
    const r1 = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], payload);
    assert.match(hintOf(r1), /先应声再动手/);
    const r2 = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], payload);
    assert.equal(r2.status, 0);
    assert.equal(r2.stdout.trim(), '');
  });

  test('speak: speakBeforeAct.preAction 写 block 时才拒绝这次工具调用', () => {
    const p = makeProject({ ...ONBOARDED, speakBeforeAct: { preAction: 'block' } });
    const r = runNode('speak-before-act-hook.mjs', ['--phase', 'pre'], { session_id: 'sess-block-' + Date.now(), transcript: [{ role: 'user', content: '改一下' }], cwd: p });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /先应声再动手/);
  });

  test('speak: 已开口再调工具放行', () => {
    const r = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: sessionSpeak,
      turn_id: 'turn-2',
      transcript: [
        { role: 'user', content: '帮我查日志' },
        { role: 'assistant', content: '收到，我先看最近二十行构建日志再汇报原因。' }
      ],
      cwd: sandbox
    });
    assert.equal(r.status, 0);
  });

  // 按 Claude Code 真实会话记录的字段结构造一份 JSONL：顶层没有 role，角色在 message.role；
  // 工具结果也是 type=user；另有请求快照等非对话条目
  function ccLine(obj) {
    return JSON.stringify({
      parentUuid: null,
      isSidechain: false,
      userType: 'external',
      entrypoint: 'cli',
      cwd: sandbox,
      sessionId: 'cc-session',
      version: '2.1.0',
      gitBranch: 'main',
      timestamp: new Date().toISOString(),
      ...obj
    });
  }
  function writeCcTranscript(name, entries) {
    const p = join(sandbox, name);
    writeFileSync(p, entries.join('\n') + '\n', 'utf8');
    return p;
  }
  const ccUser = (uuid, text) => ccLine({ type: 'user', uuid, promptId: 'p-' + uuid, message: { role: 'user', content: text } });
  const ccThinking = (uuid) => ccLine({ type: 'assistant', uuid, message: { id: 'msg_' + uuid, type: 'message', role: 'assistant', model: 'model-x', content: [{ type: 'thinking', thinking: '想一想', signature: 'sig' }] } });
  const ccText = (uuid, text) => ccLine({ type: 'assistant', uuid, message: { id: 'msg_' + uuid, type: 'message', role: 'assistant', model: 'model-x', content: [{ type: 'text', text }] } });
  const ccToolUse = (uuid, id) => ccLine({ type: 'assistant', uuid, message: { id: 'msg_' + uuid, type: 'message', role: 'assistant', model: 'model-x', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'ls' } }] } });
  const ccToolResult = (uuid, id) => ccLine({ type: 'user', uuid, message: { role: 'user', content: [{ tool_use_id: id, type: 'tool_result', content: 'a.txt' }] }, toolUseResult: { stdout: 'a.txt' } });
  const ccNoise = [
    JSON.stringify({ type: 'queue-operation', operation: 'enqueue', sessionId: 'cc-session' }),
    JSON.stringify({ type: 'api-request-blob', sessionId: 'cc-session', hash: 'h1', message: { role: 'user', content: [{ type: 'text', text: '系统注入的请求快照' }] } })
  ];
  const ccPre = (session, transcriptPath, mode = 'enforce') =>
    runNode('speak-before-act-hook.mjs', ['--mode', mode], {
      session_id: session,
      transcript_path: transcriptPath,
      cwd: sandbox,
      permission_mode: 'default',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_use_id: 'toolu_02'
    });

  test('speak: 兼容 Claude Code 记录格式，没开口就调工具会提醒（3-4 实测复现，原先 exit 0 不触发）', () => {
    const t = writeCcTranscript('cc-silent.jsonl', [...ccNoise, ccUser('u1', '帮我修一下构建脚本'), ccThinking('a1'), ccToolUse('a2', 'toolu_01'), ccToolResult('u2', 'toolu_01'), ...ccNoise]);
    const r = ccPre('cc-silent-' + Date.now(), t);
    assert.match(hintOf(r), /先应声再动手/);
  });

  test('speak: Claude Code 格式下先说了话再调工具放行，工具结果不算用户新消息', () => {
    const t = writeCcTranscript('cc-spoke.jsonl', [ccUser('u1', '查一下日志'), ccText('a1', '收到，我先看最近的日志。'), ccToolUse('a2', 'toolu_01'), ccToolResult('u2', 'toolu_01'), ccToolUse('a3', 'toolu_02')]);
    assert.equal(ccPre('cc-spoke-' + Date.now(), t).status, 0);
  });

  test('speak: Claude Code 格式无配置时只记录不拦', () => {
    const t = writeCcTranscript('cc-default.jsonl', [ccUser('u9', '改一下 README'), ccToolUse('a9', 'toolu_09')]);
    const r = runNode('speak-before-act-hook.mjs', [], {
      session_id: 'cc-default-' + Date.now(),
      transcript_path: t,
      cwd: sandbox,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' }
    });
    assert.equal(r.status, 0);
  });

  const hash40 = '1234567890abcdef1234567890abcdef12345678';
  const uuid = '3f2b9c1e-8a7d-4e6f-9b0a-1c2d3e4f5a6b';
  test('speak: 收尾回复里带提交哈希、UUID、PID 一律放行（5-13 实测复现，原先无配置 exit 2）', () => {
    const msg = `已修好，提交 ${hash40}，会话 ${uuid}，PID 12345。`;
    assert.equal(runNode('speak-before-act-hook.mjs', ['--phase', 'stop'], { session_id: sessionSpeak, last_assistant_message: msg, cwd: sandbox }).status, 0);
    assert.equal(runNode('speak-before-act-hook.mjs', ['--phase', 'stop', '--mode', 'enforce'], { session_id: sessionSpeak, last_assistant_message: msg, cwd: sandbox }).status, 0);
  });

  test('speak: 收尾检查只查用户在 stopPatterns 里写的规则，stop_hook_active 时直接放行防死循环', () => {
    const p = makeProject({ ...ONBOARDED, speakBeforeAct: { stopPatterns: [{ pattern: 'TODO\\(内部\\)', hint: '内部待办标记' }] } });
    const bad = '功能做完了，TODO(内部) 下次再清理。';
    const r1 = runNode('speak-before-act-hook.mjs', ['--phase', 'stop'], { session_id: 's-stop', hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: bad, cwd: p });
    assert.equal(r1.status, 2);
    assert.match(r1.stderr, /内部待办标记/);
    const r2 = runNode('speak-before-act-hook.mjs', ['--phase', 'stop'], { session_id: 's-stop', hook_event_name: 'Stop', stop_hook_active: true, last_assistant_message: bad, cwd: p });
    assert.equal(r2.status, 0);
    const rCode = runNode('speak-before-act-hook.mjs', ['--phase', 'stop'], { session_id: 's-stop', hook_event_name: 'Stop', last_assistant_message: '代码里有 `TODO(内部)` 标记。', cwd: p });
    assert.equal(rCode.status, 0, '行内代码里的内容不查');
  });

  test('speak: Claude Code Stop 阶段从会话记录取本轮回复检查', () => {
    const p = makeProject({ ...ONBOARDED, speakBeforeAct: { stopPatterns: ['内部代号X'] } });
    const t = writeCcTranscript('cc-stop.jsonl', [ccUser('u1', '好了吗'), ccText('a1', '做完了，按内部代号X 交付。')]);
    const r = runNode('speak-before-act-hook.mjs', [], { session_id: 'cc-stop', transcript_path: t, cwd: p, hook_event_name: 'Stop', stop_hook_active: false });
    assert.equal(r.status, 2);
  });

  // ========== 五、copy-and-privacy-lint ==========
  const goodMd = join(sandbox, 'good.md');
  writeFileSync(goodMd, '# 正常文档\n\n| 列一 | 列二 |\n| --- | --- |\n| 数据 | `npx --all` |\n\n用平实的话把事情说清楚。\n', 'utf8');

  test('copy-lint: 干净文档放行', () => {
    const r = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, '--mode', 'enforce', 'good.md']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test('copy-lint: 不再带文风词表，「对齐」「链路」、破折号和年份区间都不报（5-11、5-12 实测复现）', () => {
    writeFileSync(join(sandbox, 'style.js'), '// 把两列对齐\nconst a = 1; // 调用链路说明\n', 'utf8');
    writeFileSync(join(sandbox, 'style.md'), ['统计区间 2020', '\u2013', '2024，', '说明', '\u2014\u2014', '补充。'].join(''), 'utf8');
    const r = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, '--mode', 'enforce', 'style.js', 'style.md']);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /命中 0 处/);
  });

  test('copy-lint: enforce 拦截本机隐私路径与常见密钥，observe 放行并留痕', () => {
    const bad = join(sandbox, 'bad.md');
    const fakeKey = ['A', 'K', 'I', 'A'].join('') + 'ABCDEFGHIJKLMNOP';
    writeFileSync(bad, [['路径泄漏 /Users/', 'alice', '/secret.txt'].join(''), `密钥 ${fakeKey}`].join('\n'), 'utf8');
    const rEnf = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, '--mode', 'enforce', 'bad.md']);
    assert.equal(rEnf.status, 1);
    assert.match(rEnf.stdout, /本地绝对路径/);
    assert.match(rEnf.stdout, /云服务访问密钥/);
    assert.doesNotMatch(rEnf.stdout, new RegExp(fakeKey), '输出里不回显密钥原文');

    const rObs = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, '--mode', 'observe', 'bad.md']);
    assert.equal(rObs.status, 0);
    assert.match(readLog(), /copy-and-privacy-lint/);
  });

  test('copy-lint: 自定义禁词与旧名替换只来自用户配置', () => {
    const p = makeProject({ ...ONBOARDED, copyLint: { customBannedWords: ['旧代号'], termReplacements: { 老产品名: '请改为新产品名' } } });
    writeFileSync(join(p, 'doc.md'), '这里提到旧代号和老产品名。\n', 'utf8');
    const r = runNode('copy-and-privacy-lint.mjs', ['--cwd', p, 'doc.md']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /自定义禁词/);
    assert.match(r.stdout, /请改为新产品名/);
  });

  test('copy-lint: 钩子脚本自身通过隐私与密钥扫描（0 命中）', () => {
    const rSelf = runNode('copy-and-privacy-lint.mjs', [
      '--cwd',
      HOOKS_DIR,
      '--mode',
      'enforce',
      'safety-redline-guard.mjs',
      'copy-and-privacy-lint.mjs',
      'speak-before-act-hook.mjs',
      'evidence-before-pass-gate.mjs'
    ]);
    assert.equal(rSelf.status, 0, rSelf.stdout);
    assert.match(rSelf.stdout, /命中 0 处/);
  });

  // ========== 六、Antigravity (AGY) 协议 ==========
  test('agy: safety-redline-guard 放行与 observe 均输出 decision=allow JSON', () => {
    const rAllow = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], {
      hookEventName: 'PreToolUse',
      conversationId: 'conv-agy-1',
      toolCall: { name: 'read_file', args: { Path: safeEnv } },
      cwd: sandbox
    });
    assert.equal(rAllow.status, 0);
    assert.deepEqual(JSON.parse(rAllow.stdout.trim()), { decision: 'allow' });

    const rObs = runNode('safety-redline-guard.mjs', ['--mode', 'observe'], {
      hookEventName: 'PreToolUse',
      conversationId: 'conv-agy-1',
      toolCall: { name: 'read_file', args: { Path: fakeSsh } },
      cwd: sandbox
    });
    assert.equal(rObs.status, 0);
    assert.deepEqual(JSON.parse(rObs.stdout.trim()), { decision: 'allow' });
  });

  test('agy: evidence-before-pass-gate PostToolUse 固定输出 {}，PreToolUse 放行输出 decision=allow', () => {
    const convId = 'conv-agy-ev-' + Date.now();
    const doc = { coverageGate: { unmappedFiles: [], zeroRunSuites: [] }, items: [{ id: 'qa-agy-1', passes: true, evidence: 'qa-log.txt' }] };
    const rDeny = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      hookEventName: 'PreToolUse',
      conversationId: convId,
      toolCall: { name: 'write_file', args: { Path: 'acceptance.json', Content: JSON.stringify(doc) } },
      cwd: sandbox
    });
    assert.equal(rDeny.status, 0);
    const denyJson = JSON.parse(rDeny.stdout.trim());
    assert.equal(denyJson.decision, 'deny');
    assert.match(denyJson.reason, /尚未亲眼读取/);

    const rPostRead = runNode('evidence-before-pass-gate.mjs', ['--phase', 'post'], {
      hookEventName: 'PostToolUse',
      conversationId: convId,
      toolCall: { name: 'read_file', args: { Path: 'qa-log.txt' } },
      cwd: sandbox
    });
    assert.equal(rPostRead.status, 0);
    assert.deepEqual(JSON.parse(rPostRead.stdout.trim()), {});

    const rAllow = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      hookEventName: 'PreToolUse',
      conversationId: convId,
      toolCall: { name: 'write_file', args: { Path: 'acceptance.json', Content: JSON.stringify(doc) } },
      cwd: sandbox
    });
    assert.equal(rAllow.status, 0);
    assert.deepEqual(JSON.parse(rAllow.stdout.trim()), { decision: 'allow' });
  });

  test('agy: speak-before-act-hook PreToolUse 默认放行留痕、preAction=block 才拒绝，Stop 阶段只留痕返回 {}', () => {
    const convSpeak = 'conv-agy-speak-' + Date.now();
    const rPreAllow = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      hookEventName: 'PreToolUse',
      conversationId: convSpeak,
      toolCall: { name: 'read_file', args: { Path: 'qa-log.txt' } },
      transcript: [
        { role: 'user', content: '查日志' },
        { role: 'assistant', content: '收到，我先读取日志确认。' }
      ],
      cwd: sandbox
    });
    assert.equal(rPreAllow.status, 0);
    assert.deepEqual(JSON.parse(rPreAllow.stdout.trim()), { decision: 'allow' });

    const rPreDeny = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      hookEventName: 'PreToolUse',
      conversationId: convSpeak,
      turnId: 'turn-agy-2',
      toolCall: { name: 'read_file', args: { Path: 'qa-log.txt' } },
      transcript: [{ role: 'user', content: '再看一遍' }],
      cwd: sandbox
    });
    assert.equal(rPreDeny.status, 0);
    assert.deepEqual(JSON.parse(rPreDeny.stdout.trim()), { decision: 'allow' }, '默认软提示：放行并记录');

    const pBlock = makeProject({ ...ONBOARDED, speakBeforeAct: { preAction: 'block' } });
    const rPreBlock = runNode('speak-before-act-hook.mjs', ['--phase', 'pre'], {
      hookEventName: 'PreToolUse',
      conversationId: convSpeak + '-b',
      turnId: 'turn-agy-3',
      toolCall: { name: 'read_file', args: { Path: 'qa-log.txt' } },
      transcript: [{ role: 'user', content: '再看一遍' }],
      cwd: pBlock
    });
    assert.equal(JSON.parse(rPreBlock.stdout.trim()).decision, 'deny');

    const p = makeProject({ ...ONBOARDED, speakBeforeAct: { stopPatterns: ['内部代号X'] } });
    const rStopBad = runNode('speak-before-act-hook.mjs', ['--phase', 'stop'], {
      hookEventName: 'Stop',
      conversationId: convSpeak,
      response: '按内部代号X 交付了。',
      cwd: p
    });
    assert.equal(rStopBad.status, 0);
    assert.deepEqual(JSON.parse(rStopBad.stdout.trim()), {});
    assert.match(readLog(p), /内部代号X/);
  });

  // ========== 七、示例与技能文档 ==========
  test('examples: hooks.agy.json 符合反重力顶层具名组与 matcher+hooks 规范', () => {
    const cfg = JSON.parse(readFileSync(join(REPO_DIR, 'examples', 'hooks.agy.json'), 'utf8'));
    assert.equal('hooks' in cfg, false);
    const g = cfg[Object.keys(cfg)[0]];
    assert.ok(Array.isArray(g.PreToolUse) && g.PreToolUse.length >= 1);
    assert.equal(typeof g.PreToolUse[0].matcher, 'string');
    assert.ok(Array.isArray(g.PostToolUse) && g.PostToolUse.length >= 1);
    assert.ok(Array.isArray(g.Stop) && g.Stop.length >= 1);
    assert.equal('matcher' in g.Stop[0], false);
  });

  test('examples: hooks.claude.json 用 ${CLAUDE_PROJECT_DIR} 定位脚本，不依赖当前目录（2-3）', () => {
    const cfg = JSON.parse(readFileSync(join(REPO_DIR, 'examples', 'hooks.claude.json'), 'utf8'));
    const cmds = Object.values(cfg.hooks).flat().flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(cmds.length >= 5);
    for (const c of cmds) assert.ok(/^node "\$\{CLAUDE_PROJECT_DIR\}\/hooks\/[a-z-]+\.mjs"/.test(c), c);
  });

  test('examples: wr.config.example.json 默认未对齐、observe 起步、标准安全档、只盯 acceptance.json', () => {
    const cfg = JSON.parse(readFileSync(join(REPO_DIR, 'examples', 'wr.config.example.json'), 'utf8'));
    assert.equal(cfg.onboarded, false);
    assert.equal(cfg.hookMode, 'observe');
    assert.equal(cfg.safetyGuard.profile, 'standard');
    assert.deepEqual(cfg.evidenceGate.targetFiles, ['acceptance.json']);
    assert.equal('quietMainMachine' in cfg, false, '静音开关已移到 environment 下');
  });

  test('skills: 每个 SKILL.md 开头都有逐字一致的第 0 步首次对齐，问卷第 5 题只问回复语言', () => {
    const canonical = readFileSync(join(REPO_DIR, 'examples', 'onboarding-step0.md'), 'utf8').trim();
    assert.match(canonical, /5\. 回复语言/);
    assert.doesNotMatch(canonical, /文风|plain-cn|plainCn|copyLint\.preset/);
    const skillsDir = join(REPO_DIR, 'skills');
    const names = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    assert.ok(names.length >= 10);
    for (const n of names) {
      const md = readFileSync(join(skillsDir, n, 'SKILL.md'), 'utf8');
      const m = md.match(/<!-- wr-onboarding:start -->[\s\S]*?<!-- wr-onboarding:end -->/);
      assert.ok(m, `${n} 缺少第 0 步`);
      assert.equal(m[0].trim(), canonical, `${n} 的第 0 步与 examples/onboarding-step0.md 不一致`);
      const firstSection = md.indexOf('\n## ');
      assert.ok(md.indexOf('## 第 0 步') === firstSection + 1, `${n} 的第 0 步不是第一个小节`);
    }
  });

  test('skills: 公开包不含写作风格技能 wr-plain-cn，也不再引用它', () => {
    assert.equal(existsSync(join(REPO_DIR, 'skills', 'wr-plain-cn')), false);
    assert.equal(existsSync(join(REPO_DIR, 'docs', 'wr-plain-cn')), false);
    const market = readFileSync(join(REPO_DIR, '.claude-plugin', 'marketplace.json'), 'utf8');
    assert.doesNotMatch(market, /plain-cn/);
    for (const f of ['README.md', 'README.en.md']) {
      assert.doesNotMatch(readFileSync(join(REPO_DIR, f), 'utf8'), /plain-cn/);
    }
  });

  test('docs: 三席人设中性、第二席是老编辑，README 以四个核心技能为主、不写死十个，AGENTS 模板分三档', () => {
    const read = (p) => readFileSync(join(REPO_DIR, p), 'utf8');
    const files = ['README.md', 'README.en.md', 'skills/wr-skeptic-audit/SKILL.md', 'docs/wr-skeptic-audit/README.md', 'docs/wr-skeptic-audit/提示词清单.md', 'examples/AGENTS.template.md', '.claude-plugin/marketplace.json'];
    for (const p of files) assert.doesNotMatch(read(p), /极懒|老兵|初中生/, p);
    assert.match(read('skills/wr-skeptic-audit/SKILL.md'), /## 第二席 老编辑替普通读者把关文案/);
    assert.match(read('docs/wr-skeptic-audit/提示词清单.md'), /## 第二席 老编辑替普通读者把关文案/);
    const readme = read('README.md');
    assert.doesNotMatch(readme, /### wr-sunkit|hero.png/);
    for (const n of ['wr-ask-first', 'wr-10x-goal', 'wr-axiomatic-design', 'wr-skeptic-audit']) assert.match(readme, new RegExp('### ' + n + ' '));
    assert.doesNotMatch(readme, /十个现成|10 个现成|搜齐十|搜齐 10/);
    const agents = read('examples/AGENTS.template.md');
    for (const t of ['## 轻量档', '## 标准档', '## 完整档']) assert.ok(agents.includes(t), t);
    JSON.parse(read('skills/wr-geo/references/config-example-zh.json'));
    JSON.parse(read('examples/claude-permissions.example.json'));
  });

  test('授权：所有脚本标了 SPDX MIT，LICENSE-MIT 在，README 写清代码 MIT、文档 CC BY-NC', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: REPO_DIR, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((p) => /\.(?:mjs|cjs|js|py|sh)$/.test(p));
    assert.ok(files.length >= 7);
    for (const p of files) {
      const head = readFileSync(join(REPO_DIR, p), 'utf8').split(/\r?\n/).slice(0, 3).join('\n');
      assert.match(head, /SPDX-License-Identifier: MIT/, p);
    }
    assert.match(readFileSync(join(REPO_DIR, 'LICENSE-MIT'), 'utf8'), /Copyright \(c\) 2026 Windrise AI/);
    for (const r of ['README.md', 'README.en.md']) {
      const t = readFileSync(join(REPO_DIR, r), 'utf8');
      assert.match(t, /LICENSE-MIT/, r);
      assert.match(t, /CC BY-NC 4\.0/, r);
    }
  });

  console.log(`\n全部 ${passed} 项钩子自测通过。`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
