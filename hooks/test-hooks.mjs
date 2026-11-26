#!/usr/bin/env node
// 4 个通用钩子脚本的全量自动化单测（测正常放行、危险拦截、双协议与 observe/enforce 切换）
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));
const sandbox = mkdtempSync(join(tmpdir(), 'wr-hooks-test-'));

function runNode(scriptName, args = [], stdinObj = null, envExtra = {}) {
  const input = stdinObj == null ? '' : (typeof stdinObj === 'string' ? stdinObj : JSON.stringify(stdinObj));
  return spawnSync(process.execPath, [join(HOOKS_DIR, scriptName), ...args], {
    input,
    encoding: 'utf8',
    cwd: sandbox,
    env: { ...process.env, WR_HOOK_MODE: '', WR_QUIET_HOST: '', WR_TEST_RUNNER: '', ...envExtra }
  });
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`PASS  ${name}`);
}

try {
  // 1. safety-redline-guard.mjs
  const fakeSsh = ['~/', '.', 's', 's', 'h', '/id_rsa'].join('');
  const fakeEnv = ['.', 'e', 'n', 'v', '.local'].join('');
  const safeEnv = ['.', 'e', 'n', 'v', '.example'].join('');

  test('safety: 正常读源码与 .env.example 放行', () => {
    const r1 = runNode('safety-redline-guard.mjs', [], { tool_name: 'read_file', tool_input: { Path: safeEnv }, cwd: sandbox });
    assert.equal(r1.status, 0);
    const r2 = runNode('safety-redline-guard.mjs', [], { tool_name: 'read_file', tool_input: { Path: 'src/keys/format.js' }, cwd: sandbox });
    assert.equal(r2.status, 0);
  });

  test('safety: enforce 模式拦截凭据路径（Claude 协议 exit 2）', () => {
    const r = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], {
      tool_name: 'read_file',
      tool_input: { Path: fakeSsh },
      cwd: sandbox
    });
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

  test('safety: enforce 模式拦截工作区外强删与主检出硬重置，放行 dist 清理', () => {
    const rBadDel = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], {
      tool_name: 'run_command',
      tool_input: { CommandLine: 'rm -rf ./important-data' },
      cwd: sandbox
    });
    assert.equal(rBadDel.status, 2);

    const rOkDel = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], {
      tool_name: 'run_command',
      tool_input: { CommandLine: 'rm -rf ./dist' },
      cwd: sandbox
    });
    assert.equal(rOkDel.status, 0);

    const rReset = runNode('safety-redline-guard.mjs', ['--mode', 'enforce'], {
      tool_name: 'run_command',
      tool_input: { CommandLine: 'git reset --hard HEAD~1' },
      cwd: sandbox
    });
    assert.equal(rReset.status, 2);
  });

  test('safety: quietMainMachine 启用时拦截重型浏览器测试，携带 WR_TEST_RUNNER=1 放行', () => {
    const rDeny = runNode(
      'safety-redline-guard.mjs',
      ['--mode', 'enforce'],
      { tool_name: 'run_command', tool_input: { CommandLine: 'npx playwright test' }, cwd: sandbox },
      { WR_QUIET_HOST: '1' }
    );
    assert.equal(rDeny.status, 2);
    const rAllow = runNode(
      'safety-redline-guard.mjs',
      ['--mode', 'enforce'],
      { tool_name: 'run_command', tool_input: { CommandLine: 'npx playwright test' }, cwd: sandbox },
      { WR_QUIET_HOST: '1', WR_TEST_RUNNER: '1' }
    );
    assert.equal(rAllow.status, 0);
  });

  test('safety: observe 模式放行违规但记录 .wr-hook-observe.jsonl', () => {
    const r = runNode('safety-redline-guard.mjs', ['--mode', 'observe'], {
      tool_name: 'read_file',
      tool_input: { Path: fakeSsh },
      cwd: sandbox
    });
    assert.equal(r.status, 0);
    const logPath = join(sandbox, '.wr-hook-observe.jsonl');
    assert.equal(existsSync(logPath), true);
    assert.match(readFileSync(logPath, 'utf8'), /safety-redline-guard/);
  });

  // 2. evidence-before-pass-gate.mjs
  const evFile = join(sandbox, 'qa-log.txt');
  writeFileSync(evFile, 'all 12 real tests passed\n', 'utf8');
  const sessionEv = 'sess-ev-' + Date.now();

  test('evidence: 未读证据就标 passes:true 被 enforce 拦截', () => {
    const doc = {
      coverageGate: { unmappedFiles: [], zeroRunSuites: [] },
      items: [{ id: 'qa-1', passes: true, evidence: 'qa-log.txt' }]
    };
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

    const badDoc = {
      coverageGate: { unmappedFiles: ['src/core.js'], zeroRunSuites: [] },
      items: [{ id: 'qa-1', passes: true, evidence: 'qa-log.txt' }]
    };
    const rUnmapped = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: sessionEv,
      tool_name: 'write_file',
      tool_input: { Path: 'acceptance.json', Content: JSON.stringify(badDoc) },
      cwd: sandbox
    });
    assert.equal(rUnmapped.status, 2);
    assert.match(rUnmapped.stderr, /UNMAPPED/);

    const goodDoc = {
      coverageGate: { unmappedFiles: [], zeroRunSuites: [] },
      items: [{ id: 'qa-1', passes: true, evidence: 'qa-log.txt' }]
    };
    const rOk = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: sessionEv,
      tool_name: 'write_file',
      tool_input: { Path: 'acceptance.json', Content: JSON.stringify(goodDoc) },
      cwd: sandbox
    });
    assert.equal(rOk.status, 0);
  });

  test('evidence: observe 模式对违规验收单放行并写观察日志', () => {
    const badDoc = {
      coverageGate: { unmappedFiles: [], zeroRunSuites: ['unit-suite'] },
      items: [{ id: 'qa-2', passes: true, evidence: 'qa-log.txt' }]
    };
    const rObs = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'observe'], {
      session_id: sessionEv,
      tool_name: 'write_file',
      tool_input: { Path: 'acceptance.json', Content: JSON.stringify(badDoc) },
      cwd: sandbox
    });
    assert.equal(rObs.status, 0);
    assert.match(readFileSync(join(sandbox, '.wr-hook-observe.jsonl'), 'utf8'), /evidence-before-pass-gate/);
  });

  // 3. speak-before-act-hook.mjs
  const sessionSpeak = 'sess-speak-' + Date.now();
  test('speak: 未开口直接调工具首次提醒拦截，同轮第二次放行不卡死', () => {
    const payload = {
      session_id: sessionSpeak,
      turn_id: 'turn-1',
      transcript: [{ role: 'user', content: '帮我修一下构建脚本' }],
      cwd: sandbox
    };
    const r1 = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], payload);
    assert.equal(r1.status, 2);
    assert.match(r1.stderr, /先应声再动手/);

    const r2 = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], payload);
    assert.equal(r2.status, 0);
  });

  test('speak: 已开口再调工具放行；Stop 阶段拦裸露长哈希并放过代码块与平实回复', () => {
    const rSpoken = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      session_id: sessionSpeak,
      turn_id: 'turn-2',
      transcript: [
        { role: 'user', content: '帮我查日志' },
        { role: 'assistant', content: '收到，我先看最近二十行构建日志再汇报原因。' }
      ],
      cwd: sandbox
    });
    assert.equal(rSpoken.status, 0);

    const rStopClean = runNode('speak-before-act-hook.mjs', ['--phase', 'stop', '--mode', 'enforce'], {
      session_id: sessionSpeak,
      last_assistant_message: '构建脚本已修好，测试全部通过。',
      cwd: sandbox
    });
    assert.equal(rStopClean.status, 0);

    const rStopBad = runNode('speak-before-act-hook.mjs', ['--phase', 'stop', '--mode', 'enforce'], {
      session_id: sessionSpeak,
      last_assistant_message: '已定位到提交 1234567890abcdef1234567890abcdef12345678 的问题。',
      cwd: sandbox
    });
    assert.equal(rStopBad.status, 2);

    const rStopObs = runNode('speak-before-act-hook.mjs', ['--phase', 'stop', '--mode', 'observe'], {
      session_id: sessionSpeak,
      last_assistant_message: '已定位到提交 1234567890abcdef1234567890abcdef12345678 的问题。',
      cwd: sandbox
    });
    assert.equal(rStopObs.status, 0);
  });

  // 4. copy-and-privacy-lint.mjs
  const goodMd = join(sandbox, 'good.md');
  writeFileSync(goodMd, '# 正常文档\n\n| 列一 | 列二 |\n| --- | --- |\n| 数据 | `npx --all` |\n\n用平实的话把事情说清楚。\n', 'utf8');

  const badMd = join(sandbox, 'bad.md');
  const badContent = [
    '# 问题稿',
    ['这里用了破折号', '\u2014\u2014', '会被拦住。'].join(''),
    ['这里用了黑话', '赋', '能', '也会被拦。'].join(''),
    ['这里有', '不', '是', '速度问题，', '而', '是', '结构问题。'].join(''),
    ['路径泄漏 /Users/', 'alice', '/secret.txt'].join('')
  ].join('\n');
  writeFileSync(badMd, badContent, 'utf8');

  test('copy-lint: 干净文档（含表格线和 --all）放行', () => {
    const r = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, '--mode', 'enforce', 'good.md']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test('copy-lint: enforce 拦截破折号/翻案句/黑话/私密路径，observe 放行并留痕', () => {
    const rEnf = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, '--mode', 'enforce', 'bad.md']);
    assert.equal(rEnf.status, 1);
    assert.match(rEnf.stdout, /破折号/);
    assert.match(rEnf.stdout, /翻案句/);
    assert.match(rEnf.stdout, /黑话/);
    assert.match(rEnf.stdout, /本地绝对路径/);

    const rObs = runNode('copy-and-privacy-lint.mjs', ['--cwd', sandbox, '--mode', 'observe', 'bad.md']);
    assert.equal(rObs.status, 0);
    assert.match(readFileSync(join(sandbox, '.wr-hook-observe.jsonl'), 'utf8'), /copy-and-privacy-lint/);
  });

  // 5. Antigravity (AGY) 协议标准输出与 hooks.agy.json 结构校验
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
    const doc = {
      coverageGate: { unmappedFiles: [], zeroRunSuites: [] },
      items: [{ id: 'qa-agy-1', passes: true, evidence: 'qa-log.txt' }]
    };

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

    const rPostOther = runNode('evidence-before-pass-gate.mjs', ['--phase', 'post'], {
      hookEventName: 'PostToolUse',
      conversationId: convId,
      toolCall: { name: 'run_command', args: { CommandLine: 'echo ok' } },
      cwd: sandbox
    });
    assert.equal(rPostOther.status, 0);
    assert.deepEqual(JSON.parse(rPostOther.stdout.trim()), {});

    const rAllow = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      hookEventName: 'PreToolUse',
      conversationId: convId,
      toolCall: { name: 'write_file', args: { Path: 'acceptance.json', Content: JSON.stringify(doc) } },
      cwd: sandbox
    });
    assert.equal(rAllow.status, 0);
    assert.deepEqual(JSON.parse(rAllow.stdout.trim()), { decision: 'allow' });

    const rObs = runNode('evidence-before-pass-gate.mjs', ['--phase', 'pre', '--mode', 'observe'], {
      hookEventName: 'PreToolUse',
      conversationId: convId,
      toolCall: {
        name: 'write_file',
        args: {
          Path: 'acceptance.json',
          Content: JSON.stringify({
            coverageGate: { unmappedFiles: ['src/x.js'], zeroRunSuites: [] },
            items: [{ id: 'qa-agy-2', passes: true, evidence: 'qa-log.txt' }]
          })
        }
      },
      cwd: sandbox
    });
    assert.equal(rObs.status, 0);
    assert.deepEqual(JSON.parse(rObs.stdout.trim()), { decision: 'allow' });
  });

  test('agy: speak-before-act-hook PreToolUse 放行输出 decision=allow，Stop 阶段观察留痕且返回 {} 不返回 deny', () => {
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
    assert.equal(JSON.parse(rPreDeny.stdout.trim()).decision, 'deny');

    const rPreSecond = runNode('speak-before-act-hook.mjs', ['--phase', 'pre', '--mode', 'enforce'], {
      hookEventName: 'PreToolUse',
      conversationId: convSpeak,
      turnId: 'turn-agy-2',
      toolCall: { name: 'read_file', args: { Path: 'qa-log.txt' } },
      transcript: [{ role: 'user', content: '再看一遍' }],
      cwd: sandbox
    });
    assert.equal(rPreSecond.status, 0);
    assert.deepEqual(JSON.parse(rPreSecond.stdout.trim()), { decision: 'allow' });

    const rStopClean = runNode('speak-before-act-hook.mjs', ['--phase', 'stop', '--mode', 'enforce'], {
      hookEventName: 'Stop',
      conversationId: convSpeak,
      response: '已经检查完日志，测试全部通过。',
      cwd: sandbox
    });
    assert.equal(rStopClean.status, 0);
    assert.deepEqual(JSON.parse(rStopClean.stdout.trim()), {});

    const rStopBad = runNode('speak-before-act-hook.mjs', ['--phase', 'stop', '--mode', 'enforce'], {
      hookEventName: 'Stop',
      conversationId: convSpeak,
      response: '已定位提交 1234567890abcdef1234567890abcdef12345678 的问题。',
      cwd: sandbox
    });
    assert.equal(rStopBad.status, 0);
    assert.deepEqual(JSON.parse(rStopBad.stdout.trim()), {});
    assert.match(readFileSync(join(sandbox, '.wr-hook-observe.jsonl'), 'utf8'), /裸露 40 位完整提交哈希/);
  });

  test('agy: examples/hooks.agy.json 符合反重力顶层具名组与 matcher+hooks 规范', () => {
    const agyCfgPath = join(HOOKS_DIR, '..', 'examples', 'hooks.agy.json');
    if (!existsSync(agyCfgPath)) return;
    const cfg = JSON.parse(readFileSync(agyCfgPath, 'utf8'));
    assert.equal('hooks' in cfg, false);
    const groupNames = Object.keys(cfg);
    assert.ok(groupNames.length >= 1);
    const g = cfg[groupNames[0]];
    assert.ok(Array.isArray(g.PreToolUse) && g.PreToolUse.length >= 1);
    assert.equal(typeof g.PreToolUse[0].matcher, 'string');
    assert.ok(Array.isArray(g.PreToolUse[0].hooks) && g.PreToolUse[0].hooks.length >= 1);
    assert.ok(Array.isArray(g.PostToolUse) && g.PostToolUse.length >= 1);
    assert.equal(typeof g.PostToolUse[0].matcher, 'string');
    assert.ok(Array.isArray(g.PostToolUse[0].hooks) && g.PostToolUse[0].hooks.length >= 1);
    assert.ok(Array.isArray(g.Stop) && g.Stop.length >= 1);
    assert.equal(typeof g.Stop[0].command, 'string');
    assert.equal('matcher' in g.Stop[0], false);
  });

  console.log(`\n全部 ${passed} 项钩子自测通过。`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
