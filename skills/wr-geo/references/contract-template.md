# 官网 GEO/SEO 契约（空白模板）

把这份文件复制到项目里，改成你自己的站，命名成比如 `seo-契约.md`。改完之后它就是「接口」：实现的人照它改，检查的人照它验收，两边都不许临时改口径。

**改写规则**

1. 标识符逐字固定，不许改写、不许「优化」：域名、每个可收录页的路径、产品名、价格、支持邮箱、多语言互指关系。
2. 文案（title / description）是底稿：只有与页面真实内容不符时才能改。改了要在回执里逐条列「原文 → 改后 → 为什么」。
3. 拿不准的事实宁可写「待定」，也不要编一个数字填进去。价格、平台、发布日期没定就写「未定，不许在页面上写」。
4. 有两个以上语言版本时，两边的契约条目必须对称：A 指 B，B 就必须指回 A。

下面所有 `【方括号】` 都要换成真实内容，`example.com` 换成你的域名。没填完的契约不算契约。

---

## 1. 固定事实

- 产品名：`【Example Product】`（中文名 `【示例产品】`）；附属产品（浏览器 / 插件等）：`【如有】`
- 主标语：`【一句话标语，逐字】`
- 主站根：`https://www.example.com`；第二个语言站根：`https://www.example.org`（换成真实域名）
- 支持邮箱：`hello@example.com`
- 支持平台：`【Windows 10 22H2 / Windows 11（64 位）；Mac、安卓：待定】`
- **能不能下载**：`【还没有安装包：不许写下载地址、不许写版本已发布】`
- 价格档位：`【逐档写清货币和金额；没定价就写「未定，页面上不出现价格」】`
- 许可口径：`【哪些部分开源、哪些闭源；没定的部分写「页面不写」】`
- 页面上**不许出现**的过期说法：`【逐条列】`

## 2. 可收录页与规范地址

canonical 就是「规范地址」这一列，逐字照抄。只有这一列里的页可以进 sitemap。

| 站 | 规范地址 | hreflang 对应页 |
|---|---|---|
| 主站 | `https://www.example.com/` | 第二语言站 `【对应页地址】` |
| 主站 | `https://www.example.com/pricing` | 无 |
| 主站 | `https://www.example.com/privacy` | 无 |
| 主站 | `https://www.example.com/terms` | 无 |
| 第二语言站 | `【地址】` | 主站 `https://www.example.com/` |

- 有 hreflang 对应的页要写三条 `<link rel="alternate">`：`hreflang="【主站语言，如 en】"`、`hreflang="【第二语言，如 zh-CN】"`、`hreflang="x-default"`（指主站那条）。两边必须互指。
- 法律页、状态页内容不是互译时，不配 hreflang（`hreflang` 只给真正互译的页）。
- 404 页、支付结果页、登录后的页面：不进 sitemap，并且带 `<meta name="robots" content="noindex">`。

## 3. 每个可收录页的 `<head>` 必须有

1. `<title>`：全站唯一。主站页不含非主语言字符；第二语言站页必须含该语言字符。
2. `<meta name="description" content="…">`：全站唯一；主站 `【110–165 个字符】`，第二语言站 `【50–110 个字】`；含产品名。
3. `<link rel="canonical" href="第 2 节的规范地址">`
4. `og:type`、`og:site_name`、`og:title`、`og:description`、`og:url`（= canonical）、`og:image`（绝对 https 地址，文件必须真的在产物里，≥ 1200×630）、`twitter:card` = `summary_large_image`
5. 首页另加一段 `<script type="application/ld+json">`，`@graph` 里三个节点：
   - `Organization`：`name`、`alternateName`（第二语言名）、`url`、`logo`（绝对地址，文件在产物里）、`email`
   - `WebSite`：`name`、`url`、`inLanguage`
   - `SoftwareApplication`（或 `WebApplication`）：`name`、`applicationCategory`、`operatingSystem`、`description`、`offers`（每档一个 `Offer`，`price` 一律纯数字字符串，`priceCurrency` 照实写）
   - **禁止**出现 `aggregateRating`、`review`、`FAQPage`、`HowTo`、`downloadUrl`
6. 有独立产品页（比如浏览器页）时，该页另加一个对应的 `SoftwareApplication` 节点。

## 4. 标题与描述底稿

### 主站

| 路径 | title | description |
|---|---|---|
| `/` | `【底稿】` | `【底稿】` |
| `/pricing` | `【底稿】` | `【底稿】` |
| 其余页 | `【页名】 — 【产品名】` | 按页面真实内容写一句 |

### 第二语言站

| 路径 | title | description |
|---|---|---|
| `/` | `【底稿】` | `【底稿】` |
| 其余页 | 保留现有 | 按页面真实内容各写一句 |

## 5. 站点级文件

- `/robots.txt`：`User-agent: *` + `Allow: /` + `Sitemap: <本站根>/sitemap.xml`。**不许出现任何 Disallow 整站或针对搜索 / AI 爬虫的规则。**
- `/sitemap.xml`：只含第 2 节该站的规范地址（逐字一致），每条带 `<lastmod>`（取该页源文件最后一次提交日期，`YYYY-MM-DD`）。
- `/llms.txt`：一份带日期的事实单（Markdown）。第一行 `# 【产品名】`，下面一句话说它是什么，然后 `Checked on: 【YYYY-MM-DD】`，再列平台、价格、可收录页链接。价格必须与价格页逐字一致；不展示价格的站只写免费额度。
- `http://` 请求 301 到 `https://`；`*.html`、`/index.html`、无斜杠版本这些重复地址 301 到规范地址；已下线的旧地址 301 到对应新页，不能 404 一片。

## 6. 原始 HTML 要求（不跑 JS 就要成立）

- 首页 `<h1>` 文本 = `【逐字】`。
- 主站页面的可见文字里没有第二语言字符；第二语言站相反。
- 价格按第 1 节写在原始 HTML 里（不是只写在 JS 里）。
- 每页正文前 `【80 个词 / 120 个字】`以内出现产品名，并说清它是什么。
- 跑完 JS 之后的可见文字，必须与原始 HTML 的可见文字一致：静态内容和运行时字典不许两套说法。
- 页面观感不能变：除了 `<head>` 新增标签和必须改的那几处文案，不改版式、不改样式、不改动画。

## 7. 不许做的事

- 不许删页面、不许改版式、不许改 URL 大小写。
- 不许为了通过检查往页面里塞关键词、塞隐藏文字、塞假的评价和星级。
- 不许把检查脚本的判据改成「能过就行」：判据要改，先改这份契约。
- 不许把一个页的 canonical 指向另一个站（除非第 2 节明确写了）。
