# wr-skills

简体中文 | [English](README.en.md)

> Windrise AI 的中文 AI Skills 合集。把日常用 AI 的好习惯做成 Skill，装上就能用。

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-2-2563EB.svg?style=flat-square)](#skills-一览)
[![中文](https://img.shields.io/badge/语言-中文-B4532A.svg?style=flat-square)](#)

**支持：Claude Code、Codex、claude.ai，以及其他支持 Skills 的 Agent。** 每个 Skill 都附一份提示词清单，用的 AI 不支持 Skill 也能直接复制。

[Skills 一览](#skills-一览) · [安装](#安装) · [授权](#授权) · [更新记录](https://github.com/Hestamen/wr-skills/commits/main)

## Skills 一览

| Skill | 一句话 | 文档 | 提示词清单 |
| --- | --- | --- | --- |
| [wr-sunkit](docs/wr-sunkit/README.md) | 拍照算热量、三家 AI 出上中下策、让 AI 当你的反对者 | [说明](docs/wr-sunkit/README.md) | [复制用](docs/wr-sunkit/提示词清单.md) |
| [wr-geo](docs/wr-geo/README.md) | 官网上线前后的 SEO / GEO 体检：实测线上、写契约、用独立检查验收 | [说明](docs/wr-geo/README.md) | [复制用](docs/wr-geo/提示词清单.md) |

新的 Skill 会陆续加进来，Star 或 Watch 这个仓库就能收到更新。

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

### 推荐：一行命令（Claude Code、Codex 等）

安装全部 Skill：

```bash
npx -y skills add Hestamen/wr-skills -g --all
```

只装某一个：

```bash
npx -y skills add Hestamen/wr-skills -g --skill wr-sunkit
```

### Claude Code 插件市场

```bash
claude plugin marketplace add Hestamen/wr-skills
claude plugin install wr-sunkit@wr-skills
```

插件里的 Skill 会带上命名空间，点名调用时输入 `/wr-sunkit:wr-sunkit`。

### claude.ai 网页版和 App

在 [Releases](https://github.com/Hestamen/wr-skills/releases) 下载对应 Skill 的 zip（例如 `wr-sunkit.zip`），到设置里的 Skills 页面上传。

### 告诉 Agent

> 请帮我安装 github.com/Hestamen/wr-skills 里的 wr-sunkit

### 手动安装

把 `skills/` 下需要的文件夹整个复制到 `~/.claude/skills/`（Claude Code）或项目里的 `.agents/skills/`（Codex）。

## 仓库结构

```text
wr-skills/
├── skills/                  # Skill 本体，每个文件夹一个 Skill，安装时只复制这里
│   └── wr-sunkit/SKILL.md
├── docs/                    # 每个 Skill 的说明、提示词清单、配图
│   └── wr-sunkit/
├── .claude-plugin/          # Claude Code 插件市场配置
└── LICENSE
```

## 授权

本仓库所有内容（Skill、提示词、文档、配图）采用 [CC BY-NC 4.0](LICENSE)（署名-非商业性使用 4.0 国际）授权。

**可以**

- 个人学习和使用，包括用在自己的工作里
- 免费转载、分享、修改，但要注明作者 Windrise AI 和本仓库链接

**不可以**

- 用于任何商业目的，包括但不限于：包装进付费课程、训练营、付费社群、付费资料包或付费咨询的交付物，以及作为付费产品的一部分出售或"会员领取"

需要商业授权，请通过 [Issue](https://github.com/Hestamen/wr-skills/issues) 联系。

## 贡献

欢迎提 Issue 和 PR：哪里不顺手、哪种场景不好用、想要什么新 Skill，都可以说。
