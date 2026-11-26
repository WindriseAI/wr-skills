# wr-hook-forge

[← 返回 wr-skills](../../README.md) · [English](../../README.en.md#skills)

> 高频踩坑写成确定性拦截钩子。把零例外的客观硬规矩从文档抽出来，写成毫秒级、零依赖的 Node.js 检查脚本或 Agent 钩子，先挂 `observe` 观察档确认零误报再切 `enforce` 硬拦。

**支持 Claude Code、Codex、Cursor、Antigravity、Git Hooks，以及其他支持 Skills 的 Agent。** 用的 AI 不支持 Skill，也可以直接复制 [提示词清单](提示词清单.md)。

[为什么文档管不住的事要写进钩子](#为什么文档管不住的事要写进钩子) · [四步落盘流程](#四步落盘流程) · [自带 4 个通用钩子](#自带-4-个通用钩子) · [安装](#安装) · [SKILL.md 原文](../../skills/wr-hook-forge/SKILL.md)

## 为什么文档管不住的事要写进钩子

| 写在文档里（概率约束） | 写进钩子脚本（确定性约束） |
| --- | --- |
| 对话一长、工具一多，模型照样忘掉前面三遍感叹号 | 每次调用工具或提交前由程序毫秒级检查，一次不漏 |
| 规则越加越多，文档膨胀到几千字，拖慢每轮响应 | 文档只留需要判断的软原则，越变越薄越清爽 |
| 换一个批量工具或子代理就可能漏掉提示 | 钩子展开批量工具里的嵌套参数，所有底层路径和命令过同一把筛子 |

## 四步落盘流程

1. **二分规矩**。软偏好留 `AGENTS.md`，零例外客观硬规矩（安全、证据、路径脱敏、禁词、计数同步）进脚本。
2. **先挂 `observe` 观察档**。记录命中日志到 `.wr-hook-observe.jsonl` 但不拦断操作，跑一阵核查有没有误伤正常场景。
3. **补齐三组自测**。覆盖正常放行、`enforce` 拦截（含批量包装参数）和 `observe` 留痕，全部跑绿。
4. **切 `enforce` 硬拦**。把 `wr.config.json` 里的 `hookMode` 改为 `"enforce"`，违规直接阻断并给出精确行号与替代做法。

## 自带 4 个通用钩子

仓库根目录 [hooks/](../../hooks/) 已提供 4 个纯 Node.js 标准库零依赖脚本与全量自测（`node hooks/test-hooks.mjs`），配套配置模板位于 [examples/](../../examples/)，一共下面这 4 个脚本。

- `hooks/safety-redline-guard.mjs`，涵盖安全四红线、PowerShell `orca` 长参数改 `-file` 防引号劈裂与远端裸临时目录防并发碰撞。
- `hooks/evidence-before-pass-gate.mjs`
- `hooks/speak-before-act-hook.mjs`
- `hooks/copy-and-privacy-lint.mjs`，涵盖破折号、翻案句、商业与 AI 塑料黑话及本机隐私路径动态扫描。

## 安装

只装这一个技能，运行下面这行命令。

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-hook-forge
```

一键安装全套风起技能，运行下面这行命令。

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

更多安装方式见 [主说明文档](../../README.md#安装)。

## 授权

[CC BY-NC 4.0](../../LICENSE)。可以免费学习、使用、分享和修改，须注明作者 Windrise AI 与仓库链接，禁止用于付费课程、训练营或付费资料包等商业用途。
