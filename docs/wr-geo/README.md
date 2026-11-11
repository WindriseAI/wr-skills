# wr-geo

[← 返回 wr-skills](../../README.md) · [English](../../README.en.md#wr-geo)

> 让搜索引擎和 AI 助手读得到、说得对你的网站。先实测线上，再写契约，改完由另一份独立检查验收。

**支持：Claude Code、Codex、claude.ai，以及其他支持 Skills 的 Agent。** 用的 AI 不支持 Skill，也可以直接复制 [提示词清单](提示词清单.md)。

[这是什么](#这是什么) · [四步流程](#四步流程) · [脚本](#脚本) · [配置格式](#配置格式) · [安装](#安装) · [注意事项](#注意事项) · [SKILL.md 原文](../../skills/wr-geo/SKILL.md)

## 这是什么

官网要被人和 AI 同时读到。这件事有一半能当场核实，一半不能：

- **能核实的**：爬虫拿到的是不是 200、不跑 JS 时页面里有没有真内容、robots 有没有拦整站、sitemap 里的地址和真实页面是否一致、每页有没有 canonical、结构化数据有没有不该有的东西。这些用脚本逐条判，通过就是通过。
- **不能核实的**：「你家产品在 ChatGPT 里排第几」「这个关键词有多少搜索量」。没人能保证，所以这个 Skill 不编数字，只写「没核」。

wr-geo 把能核实的部分按「先查、再定、后改、另验」的顺序做成流程，并且要求验收的人**不是**实现的人。

| 你的处境 | 你会得到 |
|---|---|
| AI 提到同类产品时从来不说你 | 一份线上实测表：各家爬虫能不能进来、不跑 JS 时页面里有什么、缺哪些基础标签 |
| 让 AI 改 SEO，改完不知道对不对 | 一份逐字固定的契约 + 一个不参与实现的检查脚本，通过项都对到当前提交 |
| 官网有中英文两版，怕两边说法打架 | 一份两边对称的 hreflang / canonical 对照表，和检查脚本逐字比对 |
| 有人说加个 FAQ 标记、加个评分星级能提权重 | 明确的禁用清单：没有真实评价就不该有星，这两类标记搜索引擎基本不展示了 |

## 四步流程

### 第一步：实测线上（只读，什么都不改）

对首页和每个主要页面，逐条给「通过 / 不通过」和证据：

- **爬虫进得来吗**：拿各家搜索类爬虫的标识请求，状态码必须是 200。

  ```bash
  curl -s -o /dev/null -w "%{http_code}" -A "OAI-SearchBot/1.0" https://www.example.com/
  ```

  至少测 `OAI-SearchBot`、`Claude-SearchBot`、`PerplexityBot`、`bingbot`、`Googlebot`；面向中文用户再加 `Baiduspider`。实时回答靠的是这些搜索类爬虫；`GPTBot`、`ClaudeBot`、`Google-Extended` 是训练用的，拦不拦是另一件事。

- **读线上的 robots.txt，不是仓库里那份**。CDN 会在文件头部自己加一段规则。
- **不跑 JS 时有没有真内容**：`render.mjs` 同时抓「原始 HTML 的可见文字」和「浏览器跑完 JS 后的可见文字」并对比。原始 HTML 里没有标题和正文，等于给不跑 JS 的爬虫一张白纸；原始 HTML 是另一种语言或另一套价格，比白纸更糟。每个可收录页都要测。
- **重复地址**：`http://` 是否跳 `https://`、裸域名是否跳 `www`、`/page` 与 `/page.html` 与 `/page/` 是不是只有一个返回 200。
- **基础标签**：title、description、canonical、Open Graph、sitemap、结构化数据有没有。

### 第二步：写契约

复制 [契约模板](../../skills/wr-geo/references/contract-template.md)，把域名、每个可收录页的规范地址、产品名、价格、邮箱、多语言互指关系逐字填死。文案给底稿，只有与页面真实内容不符时才允许改，改了要列「原文 → 改后 → 为什么」。

契约里同时写清**不许做的事**：不许改版式、不许删页面、不许出现哪些过期说法。

### 第三步：改

从最小的改起。每条改动写明：改哪个文件、怎么改、用什么命令验证。多语言站的静态产物必须就是目标语言，不能靠浏览器里再翻译；内容只能有一个来源，不许静态一份、脚本里再抄一份。

碰 robots.txt、canonical、跳转、noindex 之前，先把差异给人看，点头再发。

### 第四步：用另一份配置验收

实现的人自己写的自检只算自检。验收用 `seo-check.mjs` 加一份**实现者没参与写的**配置去跑构建产物；实现者是 AI 的话，这份配置和判据不要给它看。

## 脚本

两个脚本只用 Node 自带模块，不装任何依赖。渲染脚本需要 Node 22 或更新（内置 WebSocket）。

### `scripts/seo-check.mjs`：按配置检查构建产物

```bash
node skills/wr-geo/scripts/seo-check.mjs <配置.json> <产物目录>
```

退出码 `0` 表示全部通过，`1` 表示有不通过项，`2` 表示用法或配置错误。输出逐条 `PASS / FAIL / WARN / SKIP`，`FAIL` 后面带证据（那一行、那个地址）。脚本里没有任何具体站点的域名、产品名、价格、文案，全从配置读。

仓库自带两份示例，一好一坏：

```bash
node skills/wr-geo/scripts/seo-check.mjs skills/wr-geo/fixtures/good.json skills/wr-geo/fixtures/good   # 退出码 0
node skills/wr-geo/scripts/seo-check.mjs skills/wr-geo/fixtures/bad.json  skills/wr-geo/fixtures/bad    # 退出码 1，5 条 FAIL
```

`bad` 里故意放了五种错：缺 canonical、description 过短、sitemap 多一条地址、结构化数据里带评分星级、robots 拦整站。检查脚本会把这五条分别点名报出来。

### `scripts/render.mjs`：无头浏览器渲染并对比

```bash
node skills/wr-geo/scripts/render.mjs <输出目录> 名字=网址@宽x高 [名字=网址@宽x高 ...]

node skills/wr-geo/scripts/render.mjs out \
  home=https://www.example.com/@1440x900 \
  phone=https://www.example.com/@390x844
```

浏览器自动找：Windows 的 Edge / Chrome、macOS 的 Chrome、Linux 的 chromium / google-chrome。想指定别的，设环境变量 `WR_GEO_BROWSER` 指向可执行文件。

每个任务产出 `<名字>.png`（截图）、`<名字>.txt`（跑完 JS 的可见文字）、`<名字>.raw.txt`（原始 HTML 的可见文字），并在末尾打印一行 JSON：横向溢出像素、渲染后与原始 HTML 的字数、以及「有哪些整句只在渲染后出现」（这个数字大于 0，说明有真内容只存在 JS 里，爬虫看不到）。

## 配置格式

完整示例见 [references/config-example.json](../../skills/wr-geo/references/config-example.json)。主要字段：

| 字段 | 作用 |
|---|---|
| `root` | 站点根，如 `https://www.example.com`；所有绝对地址都对着它核 |
| `language` | `<html lang>`、title / description 允不允许中文字符、description 长度区间、原始 HTML 是否允许出现中文字符 |
| `product` | 产品名、第二语言名、支持邮箱 |
| `openGraph` | 必填的 `og:*` 列表、图片最小尺寸、`twitter:card` 的期望值 |
| `pages[]` | 每个可收录页：`path`、`canonical`、`hreflang`（没有就写 `null`）、`titleContains`、`descriptionContains`、`h1`、`lead`（开头 N 词 / N 字内必须出现产品名）、`mustContain`、`mustNotContain` |
| `robots` / `sitemap` | 站点级文件的名字；sitemap 的地址集合由 `pages[]` 自动推出 |
| `llmsTxt` | 第一行、必须出现的字样、禁止出现的字样 |
| `structuredData` | 禁用项列表（`aggregateRating`、`FAQPage` 等）、哪些页要哪些 `@type` 和字段、offers 的价格档位与货币 |
| `siteWide` | 全站禁止出现的字样、禁止出现的 HTML 片段、必须带 noindex 的路径、产物里不该存在的文件 |

## 安装

```bash
npx -y skills add Hestamen/wr-skills -g --skill wr-geo
```

Claude Code 插件市场、claude.ai 上传、手动安装等其他方式，见 [wr-skills 的安装说明](../../README.md#安装)。

### 不支持 Skill 的 AI

ChatGPT、豆包、Kimi 等，可以直接用 [提示词清单](提示词清单.md)，每段都能复制过去用；也可以把 [SKILL.md](../../skills/wr-geo/SKILL.md) 的正文贴进它们的自定义指令。

## 注意事项

- **检查脚本只能证明契约里写的东西成立**。契约本身写错，检查会一路通过一个错站。所以契约要人看一遍再发。
- **别把判据改成能过就行**。有 FAIL 就改站或者改契约，不要改脚本里去迁就现状。
- **原始 HTML 和渲染后不一致不一定是错**，但如果关键内容只在 JS 里，等于对不跑 JS 的爬虫不存在。
- **价格、发布日期这类事实会变**。`llms.txt` 带核对日期，改一次价格就顺手改它以日期，别让各家 AI 引到过期的数字。
- **只有人能做的事**：Google Search Console、Bing Webmaster Tools（开 IndexNow）、面向中文用户的百度搜索资源平台、软件目录和发布平台的信息一致性。这些脚本替不了。

## 授权

[CC BY-NC 4.0](../../LICENSE)。可以免费使用、分享和修改，须注明作者 Windrise AI 和仓库链接；禁止商用，包括包装进付费课程、训练营、付费社群或付费资料包。详见 [授权说明](../../README.md#授权)。
