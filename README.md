# wr-skills

简体中文 | [English](README.en.md)

> Windrise AI 的中文 AI Skills 合集与软件工程实战体系。把日常和做软件时验证过的好习惯做成独立 Skill 和零依赖钩子脚本，装上就能用。

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-10-2563EB.svg?style=flat-square)](#skills-一览)
[![Hooks](https://img.shields.io/badge/hooks-4-0F766E.svg?style=flat-square)](#通用钩子脚本)
[![中文](https://img.shields.io/badge/语言-中文-B4532A.svg?style=flat-square)](#)

**支持 Claude Code、Codex、Cursor、Antigravity、claude.ai，以及其他支持 Skills 的 Agent。** 每个 Skill 都附一份独立提示词清单，用的 AI 不支持 Skill 也能直接复制。

[四个核心推荐技能](#四个核心推荐技能) · [Skills 一览](#skills-一览) · [首次对齐](#首次对齐) · [通用钩子脚本](#通用钩子脚本) · [安装](#安装) · [仓库结构](#仓库结构) · [授权](#授权) · [更新记录](https://github.com/WindriseAI/wr-skills/commits/main)

## 四个核心推荐技能

这 4 个技能是整套工程做法的骨架，按开工前准备到验货顺序安排，建议新项目或重要任务优先装上。

| Skill | 一眼看懂用途 | 文档 | 提示词清单 |
| --- | --- | --- | --- |
| [wr-ask-first](docs/wr-ask-first/README.md) | **动手前先挑刺并问清需求**。写代码前先搜一批现成开源方案（默认 5 个）对比体积与协议，当面指出泄密、上下文膨胀、需求矛盾和连带隐患，再用决策树分轮追问并写入 `docs/SPEC.md` | [说明](docs/wr-ask-first/README.md) | [复制用](docs/wr-ask-first/提示词清单.md) |
| [wr-10x-goal](docs/wr-10x-goal/README.md) | **定十倍目标并堵死作弊与假通过**。交代清楚上下文后追求十倍速度（用十分之一时间分路跑完）、搜齐十个现成方案对比、把体积冗余压小十倍，同时硬禁靠删功能、假返回值、跳过慢路径和改弱断言凑指标 | [说明](docs/wr-10x-goal/README.md) | [复制用](docs/wr-10x-goal/提示词清单.md) |
| [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | **提取功能需求做下三角解耦**。列出互不重叠的功能需求与设计参数并画出依赖矩阵，通过重排顺序和抽取唯一真源消掉反向耦合，确认呈下三角阵后再多路并行 | [说明](docs/wr-axiomatic-design/README.md) | [复制用](docs/wr-axiomatic-design/提示词清单.md) |
| [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | **三席物理隔离独立盲审**。合并后开三个全新只读会话，分别由禁读源码的用户查交互、禁读源码的读者查文案，再由全新老兵工程师按八项清单审 diff | [说明](docs/wr-skeptic-audit/README.md) | [复制用](docs/wr-skeptic-audit/提示词清单.md) |

一行命令装齐四个核心推荐技能。

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first wr-10x-goal wr-axiomatic-design wr-skeptic-audit
```

## Skills 一览

### 风起软件工程套件（8 个按开工前到验收顺序排列的成熟技能）

按「开工前准备（`wr-ask-first`、`wr-10x-goal`、`wr-axiomatic-design`） → 开工与多路并行（`wr-split-work`、`wr-hook-forge`） → 跑通功能与排错验收（`wr-real-qa`、`wr-skeptic-audit`） → 功能稳后界面打磨（`wr-ux-craft`）」完整串起带 AI 做软件的全流程，每个技能独立可用，也可以整套配合。

| 阶段 | Skill | 一句话说清干什么 | 文档 | 提示词清单 |
| --- | --- | --- | --- | --- |
| 开工前准备 | [wr-ask-first](docs/wr-ask-first/README.md) | 动手前先挑刺并问清需求。搜一批现成开源方案（默认 5 个）对比体积与协议，当面指出泄密与逻辑矛盾隐患，再用决策树分轮追问并写入 `docs/SPEC.md` | [说明](docs/wr-ask-first/README.md) | [复制用](docs/wr-ask-first/提示词清单.md) |
| 开工前准备 | [wr-10x-goal](docs/wr-10x-goal/README.md) | 定十倍目标并堵死作弊与假通过。交代清楚上下文后追求十倍速度（用十分之一时间分路跑完）、对比十个现成方案与压小十倍体积冗余，并禁止靠删功能、假返回值、跳过慢路径或改弱断言凑指标 | [说明](docs/wr-10x-goal/README.md) | [复制用](docs/wr-10x-goal/提示词清单.md) |
| 开工前准备 | [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | 提取功能需求做下三角解耦。用 MIT 公理设计画出功能需求与设计参数矩阵，通过重排顺序和抽取唯一真源消掉反向耦合后再拆开并行 | [说明](docs/wr-axiomatic-design/README.md) | [复制用](docs/wr-axiomatic-design/提示词清单.md) |
| 开工与多路并行 | [wr-split-work](docs/wr-split-work/README.md) | 多工作区无重叠并行派活。总协调人只拆活审回执不写代码，每条子线独占一棵 `git worktree` 与文件白名单，先砍废包瘦身再按模型特点和思考强度多路并行 | [说明](docs/wr-split-work/README.md) | [复制用](docs/wr-split-work/提示词清单.md) |
| 开工与多路并行 | [wr-hook-forge](docs/wr-hook-forge/README.md) | 高频踩坑写成确定性拦截钩子。把零例外客观硬规矩写成零依赖 Node.js 脚本，先挂 `observe` 观察档确认零误报再切 `enforce` 硬拦 | [说明](docs/wr-hook-forge/README.md) | [复制用](docs/wr-hook-forge/提示词清单.md) |
| 跑通功能与排错验收 | [wr-real-qa](docs/wr-real-qa/README.md) | 改动全覆盖真路径验收。做改动文件到行为测试映射并硬禁未覆盖与零用例，用反向改写业务的突变探针抓假绿水测试，扫浏览器裁切遮挡并在连败两次时停手查根因 | [说明](docs/wr-real-qa/README.md) | [复制用](docs/wr-real-qa/提示词清单.md) |
| 跑通功能与排错验收 | [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | 三席物理隔离独立盲审。合并后开三个全新只读会话，分别由禁读源码用户查交互与文案，再由老兵工程师按八项清单审 diff | [说明](docs/wr-skeptic-audit/README.md) | [复制用](docs/wr-skeptic-audit/提示词清单.md) |
| 功能稳后界面打磨 | [wr-ux-craft](docs/wr-ux-craft/README.md) | 界面省心规矩与跟手动效设计。按只点默认按钮的新手视角过八条省心规矩和十二种状态动效，加上斜向防误触走廊、点击锁定、任意条数扩容与二三阶影响检查 | [说明](docs/wr-ux-craft/README.md) | [复制用](docs/wr-ux-craft/提示词清单.md) |

### 日常与增长 Skill

| Skill | 一句话说清干什么 | 文档 | 提示词清单 |
| --- | --- | --- | --- |
| [wr-sunkit](docs/wr-sunkit/README.md) | 拍照算饮食热量、三家 AI 出方案对比、让 AI 专门挑刺反对你 | [说明](docs/wr-sunkit/README.md) | [复制用](docs/wr-sunkit/提示词清单.md) |
| [wr-geo](docs/wr-geo/README.md) | 官网上线前后的搜索引擎与 AI 收录体检，先实测线上内容与爬虫状态，再写逐字契约并由独立检查脚本验收 | [说明](docs/wr-geo/README.md) | [复制用](docs/wr-geo/提示词清单.md) |

新的 Skill 会陆续加进来，Star 或 Watch 这个仓库就能收到更新。

---

## 首次对齐

每个技能开头都有「第 0 步」：先找 `wr.config.json`（当前目录逐级往上，再看用户目录 `~/wr.config.json`），没找到或里面没有 `"onboarded": true`，就一次问你 8 道题，每题带默认值，回一个「好」就全按默认。答案写回项目根目录的 `wr.config.json`，以后技能和钩子都读这一份。

| 题 | 问什么 | 默认 |
| --- | --- | --- |
| 1 机器与测试环境 | 只有一台电脑还是另有测试机、容器或 CI；跑测试能不能占用键鼠和浏览器 | 只有一台；耗时长的测试先说预计多久，同意后在本机跑；可以占用 |
| 2 系统与工具 | 系统、终端、AI 工具，有没有装 Orca | 自动探测 |
| 3 模型与额度 | 有几档模型、有没有第二家厂商交叉复核、额度松紧 | 只用当前模型；没有第二家；一般 |
| 4 协作与发布 | 一个人还是团队、要不要并行、默认分支、推送和发版谁确认 | 一个人；并行先问；自动探测；推送和发版要你确认 |
| 5 回复语言 | 回复用什么语言 | 跟随你的语言 |
| 6 做事强度 | 要不要先写规格、搜几个开源方案、要不要定十倍目标 | 大活才写规格；搜 5 个；你提性能或体积时才提十倍 |
| 7 安全尺度 | 安全红线用哪一档、有没有额外禁读目录 | 标准档；没有 |
| 8 项目类型 | 界面、命令行或库、后端还是官网；有没有线上用户；官网拦不拦训练爬虫 | 自动探测；没有线上用户；训练爬虫你来定 |

每个字段的含义、取值和默认值见 [examples/README.md](examples/README.md)，完整模板是 [examples/wr.config.example.json](examples/wr.config.example.json)。

---

## 通用钩子脚本

文档里写十遍感叹号，上下文一长 AI 照样漏看。`hooks/` 目录提供 4 个纯 Node.js 标准库编写、零第三方依赖的确定性脚本，按 Claude Code 与 Antigravity 钩子输入输出格式编写并支持 Git `pre-commit`。技能本身在 Claude Code、Codex、Cursor、Antigravity、claude.ai 都能用；钩子目前只能挂在 Claude Code 和 Antigravity 上。

**默认只记录不拦截。** 没有配置文件，或配置里还没有 `"onboarded": true` 时，四个钩子都只把命中写进 `.wr-hook-observe.jsonl`（记得加进 `.gitignore`），凭据和强删也不例外。做完首次对齐后，安全守卫按标准档执行：碰凭据和递归强删直接拦，git 硬重置只记录，其余跟随 `hookMode`（默认 `observe`）。想全部硬拦就把 `hookMode` 改成 `"enforce"`。

| 脚本 | 触发时机 | 干什么用 |
| --- | --- | --- |
| [hooks/safety-redline-guard.mjs](hooks/safety-redline-guard.mjs) | `PreToolUse` | 凭据零触碰；递归强删只放行临时目录和项目内的构建产物目录（按路径段整段匹配，提示移入回收站）；主检出 git 硬重置提醒。另有三条按环境启用、默认关的规则：本机静音、Orca 长参数改 `-file`、远端临时目录防碰撞。支持展开批量工具参数统一过筛，每条规则可单独开关 |
| [hooks/evidence-before-pass-gate.mjs](hooks/evidence-before-pass-gate.mjs) | `PostToolUse` + `PreToolUse` | 记录当前会话真正读过的证据文件；向 `acceptance.json` 验收单写入 `passes: true` 前，核验无未覆盖改动、无零条测试且证据已亲眼读过。项目不用验收单就不用挂 |
| [hooks/speak-before-act-hook.mjs](hooks/speak-before-act-hook.mjs) | `PreToolUse` + `Stop` | 收到用户消息后一句话没说就调工具，提醒一次（兼容 Claude Code 的会话记录格式）；收尾检查只查你在 `speakBeforeAct.stopPatterns` 里写的规则，默认什么都不查，并带防死循环保护 |
| [hooks/copy-and-privacy-lint.mjs](hooks/copy-and-privacy-lint.mjs) | `pre-commit` / CI | 运行时读取本机用户名与家目录，扫描私密路径外泄和常见密钥；另可配置你自己的禁用词和旧名替换，不带任何内置文风词表 |

常用开关如下，全部字段见 [examples/README.md](examples/README.md)。

| 字段或变量 | 默认 | 作用 |
| --- | --- | --- |
| `onboarded` | `false` | 不是 `true` 时所有钩子只记录 |
| `hookMode` | `observe` | `observe` 只记录，`enforce` 硬拦，`off` 全关 |
| `safetyGuard.profile` | `standard` | `relaxed` / `standard` / `strict` 三档 |
| `safetyGuard.rules.<规则名>` | 跟档位 | 单条规则写 `off` / `observe` / `enforce` |
| `environment.quietMainMachine` | `false` | 本机静音：打开后不许模拟全局键鼠、不许直接跑弹浏览器的端到端测试 |
| `environment.remoteHost` | 空 | 测试机主机名，填了才检查发往它的 `ssh` / `scp` 是否用了没有唯一后缀的共享临时目录 |
| `tools.orca` | 自动探测 | 探测到 Orca 且终端是 PowerShell 时，才检查 orca 命令的长内联参数 |
| `WR_HOOK_MODE` | 空 | 环境变量，临时指定所有钩子的模式 |
| `WR_QUIET_HOST=1` / `WR_TEST_RUNNER=1` | 空 | 临时打开本机静音；静音时放行某一条你同意在本机跑的重型测试 |

配套示例在 [examples/](examples/) 目录，包含 `wr.config.example.json`、`AGENTS.template.md`、`hooks.claude.json`、`hooks.agy.json` 和 `acceptance.example.json`。运行下面这行跑完全部离线单测，验证 4 个钩子的放行、拦截、双协议与模式切换。目前只在 Windows 11 上跑过，macOS 和 Linux 没有实测。

```bash
node hooks/test-hooks.mjs
```

---

### wr-sunkit

![wr-sunkit](docs/wr-sunkit/images/hero.png)

拍照算饮食热量、三家 AI 出方案对比、让 AI 专门挑刺反对你，一共三件事。

- **拍照算热量**，饭前饭后各拍一张，估出这顿吃了多少，睡前汇总一天
- **三家 AI 出方案对比**，同一份现状交给三家不同的 AI，再由裁判交叉对比，给出综合中策和 30 天行动清单
- **AI 当反对者**，不许附和，只找你的计划会失败的理由，你嘴硬它也不让步

装好后直接说话，比如发一张饭菜照片，或者说"反驳我，我打算……"，Agent 会自动进入对应模式。

[完整说明和示例 →](docs/wr-sunkit/README.md)

---

## 安装

### 推荐方式一 一行命令（Claude Code、Codex、Cursor、Antigravity 等）

一键安装仓库全部推荐 Skill，运行下面这行命令。

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

只装某一个独立 Skill，把最后的技能名换成任意包名即可（按开工前到验收顺序排列）。

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first
npx -y skills add WindriseAI/wr-skills -g --skill wr-10x-goal
npx -y skills add WindriseAI/wr-skills -g --skill wr-axiomatic-design
npx -y skills add WindriseAI/wr-skills -g --skill wr-split-work
npx -y skills add WindriseAI/wr-skills -g --skill wr-hook-forge
npx -y skills add WindriseAI/wr-skills -g --skill wr-real-qa
npx -y skills add WindriseAI/wr-skills -g --skill wr-skeptic-audit
npx -y skills add WindriseAI/wr-skills -g --skill wr-ux-craft
```

### 方式二 Claude Code 插件市场

```bash
claude plugin marketplace add WindriseAI/wr-skills
# 装整套风起工程 8 个成熟技能
claude plugin install wr-engineering@wr-skills
# 或者单装任意一个
claude plugin install wr-ask-first@wr-skills
claude plugin install wr-10x-goal@wr-skills
claude plugin install wr-sunkit@wr-skills
```

通过插件安装的 Skill 带命名空间，点名调用时输入 `/wr-ask-first:wr-ask-first` 或 `/wr-engineering:wr-ask-first`。

### 方式三 直接跟你的 Agent 说一句话

把下面任意一句发给 Claude Code、Codex、Cursor 或 Antigravity，让它自己装好。

> 请帮我运行 `npx -y skills add WindriseAI/wr-skills -g --all`，把 WindriseAI/wr-skills 里的推荐 Skill 装到我的全局技能目录。

只想装单个时可以这样说。

> 请帮我安装 github.com/WindriseAI/wr-skills 里的 wr-ask-first 和 wr-10x-goal。

### 方式四 claude.ai 网页版和 App

下载本仓库 ZIP 压缩包后解压，将 `skills/<技能名>` 文件夹单独打包成 `.zip` 上传到 claude.ai 设置里的 Skills 页面（或直接复制 `docs/<技能名>/提示词清单.md` 贴进对话使用）。

### 方式五 手动安装

把 `skills/` 下需要的文件夹整个复制到你的全局或项目技能目录（如 Claude Code 的全局技能目录或 Codex 的 `.agents/skills/`）。如果要启用确定性钩子，把 `hooks/` 复制到项目根目录，参照 `examples/hooks.claude.json`、`examples/hooks.agy.json` 或 Git `pre-commit` 接入（启用前建议先跑通 `node hooks/test-hooks.mjs`）。配置文件可以让技能在首次对齐时写，也可以把 `examples/wr.config.example.json` 复制成项目根目录的 `wr.config.json` 手改，改完记得把 `onboarded` 写成 `true`，否则钩子只记录不拦。

## 仓库结构

```text
wr-skills/
├── skills/                  # 10 个推荐独立 Skill（按开工前到验收顺序排列）
│   ├── wr-ask-first/SKILL.md
│   ├── wr-10x-goal/SKILL.md
│   ├── wr-axiomatic-design/SKILL.md
│   ├── wr-split-work/SKILL.md
│   ├── wr-hook-forge/SKILL.md
│   ├── wr-real-qa/SKILL.md
│   ├── wr-skeptic-audit/SKILL.md
│   ├── wr-ux-craft/SKILL.md
│   ├── wr-geo/
│   └── wr-sunkit/
├── docs/                    # 每个 Skill 的详细说明、提示词清单与配图
├── hooks/                   # 4 个零依赖通用 Node.js 钩子脚本与自测脚本
├── examples/                # 配置模板与字段说明、首次对齐原文、AGENTS.template.md 与宿主挂载示例
├── .claude-plugin/          # Claude Code 插件市场配置
└── LICENSE
```

## 授权

本仓库所有内容（Skill、提示词、钩子脚本、文档、配图）采用 [CC BY-NC 4.0](LICENSE)（署名-非商业性使用 4.0 国际）授权。

**可以**

- 个人学习和使用，包括用在自己的工作与软件项目里
- 免费转载、分享、修改，但要注明作者 Windrise AI 和本仓库链接

**不可以**

- 用于任何商业用途，例如放进付费课程、训练营、付费社群、付费资料包、付费咨询交付物，或者装进付费产品里售卖和充当会员赠品。

需要商业授权，请通过 [Issue](https://github.com/WindriseAI/wr-skills/issues) 联系。

## 贡献

哪里用着不顺手、哪种场景没照顾到、还想要什么新技能，直接提 Issue 或 PR 就行。
