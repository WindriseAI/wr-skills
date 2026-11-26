# wr-split-work

[← 返回 wr-skills](../../README.md) · [English](../../README.en.md#skills)

> 多代理分桌并行。总协调人只拆活审回执不写代码，一活一棵独立 `git worktree` 切死独占文件白名单，四档难度按需派活，砍废包减重与多路并发提速，附通用 Git 与 Orca 双路实操。

**支持 Claude Code、Codex、Cursor、Antigravity、Orca，以及其他支持 Skills 的 Agent。** 用的 AI 不支持 Skill，也可以直接复制 [提示词清单](提示词清单.md)。

[为什么需要分桌并行](#为什么需要分桌并行) · [核心机制](#核心机制) · [配置示例](#配置示例) · [安装](#安装) · [SKILL.md 原文](../../skills/wr-split-work/SKILL.md)

## 为什么需要分桌并行

| 常见翻车现场 | 用 wr-split-work 之后 |
| --- | --- |
| 一个对话聊了几十轮，AI 越写越忘前面的规矩，速度也越来越慢 | 协调人只派活收活，每条子线在全新独立会话里开工，始终保持清醒 |
| 开三个窗口同时改代码，结果互相覆盖，合并冲突解到崩溃 | 一活一棵独立 `git worktree` + 独占文件白名单，两活碰同一文件直接重拆 |
| 改个文案和做底层架构全用最贵模型，额度半天烧光 | 按四档通用难度读取本地 `wr.config.json` 映射模型，花钱花在刀刃上 |
| 每次加功能只敢套新壳，安装包和代码越滚越大 | 先做减法删死代码与废包，再按数据版式分离多路并发提速 |

## 核心机制

1. **角色切死**：总协调人只负责拆任务、查前置事实、审三句话回执与最终合并，绝不亲自写业务代码。
2. **物理隔离**：通过 `git worktree` 让每条子线有独立目录与独立分支，文件白名单硬约束零重叠。
3. **四档通用难度派活**：按 `tier1_architect`（架构与审美）、`tier2_builder`（逻辑攻坚）、`tier3_reviewer`（独立核查）、`tier4_runner`（机械跑腿）四档分工，不绑定任何具体供应商。
4. **先减法后并发**：先砍冗余依赖与死代码把体积压薄，再把数据层、样式层、逻辑层、测试层拆成多路并行推进。
5. **双路实操**：同时覆盖纯命令行 `git worktree` 通用方案，以及 Orca 多代理工作台调度方案。

## 配置示例

在项目根目录放置 `wr.config.json`（完整模板见 [examples/wr.config.example.json](../../examples/wr.config.example.json)），按你手头的账号自定义四档模型：

```json
{
  "modelTiers": {
    "tier1_architect": "your-top-reasoning-or-design-model",
    "tier2_builder": "your-main-coding-model",
    "tier3_reviewer": "your-second-vendor-review-model",
    "tier4_runner": "your-fast-economical-model"
  }
}
```

## 安装

单装本 Skill：

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-split-work
```

一键安装全套风起技能：

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

更多安装方式见 [主说明文档](../../README.md#安装)。

## 授权

[CC BY-NC 4.0](../../LICENSE)。可以免费学习、使用、分享和修改，须注明作者 Windrise AI 与仓库链接，禁止用于付费课程、训练营或付费资料包等商业用途。
