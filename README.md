# wr-skills

简体中文 | [English](README.en.md)

> Windrise AI 的中文 AI Skills 合集与软件工程实战体系。把日常和做软件时验证过的好习惯做成独立 Skill 和零依赖钩子脚本，装上就能用。

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-9-2563EB.svg?style=flat-square)](#skills-一览)
[![Hooks](https://img.shields.io/badge/hooks-4-0F766E.svg?style=flat-square)](#通用钩子脚本)
[![中文](https://img.shields.io/badge/语言-中文-B4532A.svg?style=flat-square)](#)

**支持 Claude Code、Codex、Cursor、Antigravity、claude.ai，以及其他支持 Skills 的 Agent。** 每个 Skill 都附一份独立提示词清单，用的 AI 不支持 Skill 也能直接复制。

[Skills 一览](#skills-一览) · [通用钩子脚本](#通用钩子脚本) · [安装](#安装) · [仓库结构](#仓库结构) · [授权](#授权) · [更新记录](https://github.com/WindriseAI/wr-skills/commits/main)

## Skills 一览

### 风起软件工程 7 件套（可单装，可一键全装）

按「定需求 → 拆活干 → 磨体验 → 换人审 → 跑真测 → 写人话 → 落钩子」完整串起个人与小团队带 AI 做软件的全流程，每个包高内聚、零耦合。

| Skill | 一句话 | 文档 | 提示词清单 |
| --- | --- | --- | --- |
| [wr-ask-first](docs/wr-ask-first/README.md) | 先质疑挑坑再问透立据：搜齐 10 个现成开源方案、当面指出风险与矛盾、决策树追问并落入 `docs/SPEC.md` | [说明](docs/wr-ask-first/README.md) | [复制用](docs/wr-ask-first/提示词清单.md) |
| [wr-split-work](docs/wr-split-work/README.md) | 多代理分桌并行：总协调人只拆活审回执，一活一棵独立 worktree，四档难度派活，砍废包减重与多路提速 | [说明](docs/wr-split-work/README.md) | [复制用](docs/wr-split-work/提示词清单.md) |
| [wr-ux-craft](docs/wr-ux-craft/README.md) | 麻烦归程序，动得有来回：8 条省心规矩、按状态变化查 7 条跟手动效、斜向防劫持走廊、任意条数据扩容与二三阶推演 | [说明](docs/wr-ux-craft/README.md) | [复制用](docs/wr-ux-craft/提示词清单.md) |
| [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | 三席物理隔离验货：禁读源码极懒初中生审交互 + 禁读源码初中生审文案 + 全新只读老兵工程师看 diff 总审 | [说明](docs/wr-skeptic-audit/README.md) | [复制用](docs/wr-skeptic-audit/提示词清单.md) |
| [wr-real-qa](docs/wr-real-qa/README.md) | 真路径验收与破测试排雷：改动映射禁 `UNMAPPED`/`ZERO_RUN`、破测试突变探针、像素裁切遮挡扫描、连败两次熔断 | [说明](docs/wr-real-qa/README.md) | [复制用](docs/wr-real-qa/提示词清单.md) |
| [wr-plain-cn](docs/wr-plain-cn/README.md) | 去模型腔平实中文写作：核实 5 件物理细节再动笔、零脑补心理戏、硬封常见机器腔句式、22 项指纹自查 | [说明](docs/wr-plain-cn/README.md) | [复制用](docs/wr-plain-cn/提示词清单.md) |
| [wr-hook-forge](docs/wr-hook-forge/README.md) | 同坑二次写进钩子：把零例外硬规矩固化为秒级静态脚本，先挂 `observe` 观察档再切 `enforce` 硬拦 | [说明](docs/wr-hook-forge/README.md) | [复制用](docs/wr-hook-forge/提示词清单.md) |

### 日常与增长 Skill

| Skill | 一句话 | 文档 | 提示词清单 |
| --- | --- | --- | --- |
| [wr-sunkit](docs/wr-sunkit/README.md) | 拍照算热量、三家 AI 出上中下策、让 AI 当你的反对者 | [说明](docs/wr-sunkit/README.md) | [复制用](docs/wr-sunkit/提示词清单.md) |
| [wr-geo](docs/wr-geo/README.md) | 官网上线前后的 SEO / GEO 体检：实测线上、写契约、用独立检查验收 | [说明](docs/wr-geo/README.md) | [复制用](docs/wr-geo/提示词清单.md) |

新的 Skill 会陆续加进来，Star 或 Watch 这个仓库就能收到更新。

---

## 通用钩子脚本

文档里写十遍感叹号，上下文一长 AI 照样漏看。`hooks/` 目录提供 4 个纯 Node.js 标准库编写、零第三方依赖、跨平台通用的确定性脚本，同时兼容 Claude Code 与 Antigravity 钩子协议，默认支持 `observe`（只记日志不拦截）和 `enforce`（硬拦）两档切换。

| 脚本 | 触发时机 | 干什么用 |
| --- | --- | --- |
| [hooks/safety-redline-guard.mjs](hooks/safety-redline-guard.mjs) | `PreToolUse` | 凭据零触碰、工作区外禁强删（提示移入回收站）、主分支禁硬重置、主力机静音保护，支持展开批量工具参数统一过筛 |
| [hooks/evidence-before-pass-gate.mjs](hooks/evidence-before-pass-gate.mjs) | `PostToolUse` + `PreToolUse` | 记录当前会话真正读过的证据文件；向验收单写入 `passes: true` 前，强制核验无未覆盖改动、无零条测试且证据已亲眼读过 |
| [hooks/speak-before-act-hook.mjs](hooks/speak-before-act-hook.mjs) | `PreToolUse` + `Stop` | 收到用户消息后若一句话没说就闷头调工具，先温和提醒一次；回复收尾时可选扫描裸露长哈希、会话标识与公文头 |
| [hooks/copy-and-privacy-lint.mjs](hooks/copy-and-privacy-lint.mjs) | `pre-commit` / CI | 运行时动态读取本机用户名与家目录，防止私密路径外泄；同步扫描中文禁用句式、禁用符号与自定义术语表 |

配套模板在 [examples/](examples/) 目录，包含 `wr.config.example.json`、`AGENTS.template.md`、`hooks.claude.json`、`hooks.agy.json` 和 `acceptance.example.json`。运行自测脚本可验证全部 4 个钩子的放行、拦截与双模式切换：

```bash
node hooks/test-hooks.mjs
```

---

### wr-sunkit

![wr-sunkit](docs/wr-sunkit/images/hero.png)

把 AI 当成你的营养师、军师和反对者：

- **📷 拍照算热量**：饭前饭后各拍一张，估出这顿吃了多少，睡前汇总一天
- **⚖️ 三家 AI 出上中下策**：同一份现状交给三家不同的 AI，再由裁判交叉对比，给出综合中策和 30 天行动清单
- **🛡️ AI 当反对者**：不许附和，只找你的计划会失败的理由，你嘴硬它也不让步

装好后直接说话，比如发一张饭菜照片，或者说"反驳我：……"，Agent 会自动进入对应模式。

[完整说明和示例 →](docs/wr-sunkit/README.md)

---

## 安装

### 推荐方式一：一行命令（Claude Code、Codex、Cursor、Antigravity 等）

一键安装仓库全部 Skill：

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

只装某一个独立 Skill（把最后的技能名换成任意包名即可）：

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first
npx -y skills add WindriseAI/wr-skills -g --skill wr-split-work
npx -y skills add WindriseAI/wr-skills -g --skill wr-ux-craft
npx -y skills add WindriseAI/wr-skills -g --skill wr-skeptic-audit
npx -y skills add WindriseAI/wr-skills -g --skill wr-real-qa
npx -y skills add WindriseAI/wr-skills -g --skill wr-plain-cn
npx -y skills add WindriseAI/wr-skills -g --skill wr-hook-forge
```

### 方式二：Claude Code 插件市场

```bash
claude plugin marketplace add WindriseAI/wr-skills
# 装整套风起工程 7 件套
claude plugin install wr-engineering@wr-skills
# 或者单装任意一个
claude plugin install wr-ask-first@wr-skills
claude plugin install wr-sunkit@wr-skills
```

通过插件安装的 Skill 带命名空间，点名调用时输入 `/wr-ask-first:wr-ask-first` 或 `/wr-engineering:wr-ask-first`。

### 方式三：直接跟你的 Agent 说一句话

把下面任意一句发给 Claude Code、Codex、Cursor 或 Antigravity，让它自己装好：

> 请帮我运行 `npx -y skills add WindriseAI/wr-skills -g --all`，把 WindriseAI/wr-skills 里的全部 Skill 装到我的全局技能目录。

只想装单个时：

> 请帮我安装 github.com/WindriseAI/wr-skills 里的 wr-ask-first 和 wr-real-qa。

### 方式四：claude.ai 网页版和 App

在 [Releases](https://github.com/WindriseAI/wr-skills/releases) 下载对应 Skill 的 zip，到设置里的 Skills 页面上传。

### 方式五：手动安装

把 `skills/` 下需要的文件夹整个复制到你的全局或项目技能目录（如 Claude Code 的全局技能目录或 Codex 的 `.agents/skills/`）。如果要启用确定性钩子，把 `hooks/` 与 `examples/wr.config.example.json` 复制到项目根目录，改名为 `wr.config.json` 后按 `examples/hooks.claude.json` 或 `examples/hooks.agy.json` 挂载。

## 仓库结构

```text
wr-skills/
├── skills/                  # 9 个独立 Skill 本体，每个文件夹可单独安装
│   ├── wr-ask-first/SKILL.md
│   ├── wr-split-work/SKILL.md
│   ├── wr-ux-craft/SKILL.md
│   ├── wr-skeptic-audit/SKILL.md
│   ├── wr-real-qa/SKILL.md
│   ├── wr-plain-cn/SKILL.md
│   ├── wr-hook-forge/SKILL.md
│   ├── wr-geo/
│   └── wr-sunkit/
├── docs/                    # 每个 Skill 的详细说明、提示词清单与配图
├── hooks/                   # 4 个零依赖通用 Node.js 钩子脚本与自测脚本
├── examples/                # 配置模板、AGENTS.template.md 与宿主挂载示例
├── .claude-plugin/          # Claude Code 插件市场配置
└── LICENSE
```

## 授权

本仓库所有内容（Skill、提示词、钩子脚本、文档、配图）采用 [CC BY-NC 4.0](LICENSE)（署名-非商业性使用 4.0 国际）授权。

**可以**

- 个人学习和使用，包括用在自己的工作与软件项目里
- 免费转载、分享、修改，但要注明作者 Windrise AI 和本仓库链接

**不可以**

- 用于任何商业目的，包括但不限于：包装进付费课程、训练营、付费社群、付费资料包或付费咨询的交付物，以及作为付费产品的一部分出售或"会员领取"

需要商业授权，请通过 [Issue](https://github.com/WindriseAI/wr-skills/issues) 联系。

## 贡献

欢迎提 Issue 和 PR：哪里不顺手、哪种场景不好用、想要什么新 Skill，都可以说。
