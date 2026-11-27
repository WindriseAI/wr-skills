# wr-real-qa

[← 返回 wr-skills](../../README.md) · [English](../../README.en.md#skills)

> 改动全覆盖真路径验收。跑前做改动文件到行为测试的覆盖映射（硬禁 `UNMAPPED` 与 `ZERO_RUN`），用反向改写业务的突变探针抓假绿水测试，用 `getBoundingClientRect` 扫像素裁切与遮挡，连败两次立即熔断查根因。

**支持 Claude Code、Codex、Cursor、Antigravity、claude.ai，以及其他支持 Skills 的 Agent。** 用的 AI 不支持 Skill，也可以直接复制 [提示词清单](提示词清单.md)。

[为什么绿灯常常是假的](#为什么绿灯常常是假的) · [四道硬门禁](#四道硬门禁) · [配套钩子](#配套钩子) · [安装](#安装) · [SKILL.md 原文](../../skills/wr-real-qa/SKILL.md)

## 为什么绿灯常常是假的

| 常见假绿陷阱 | 用 wr-real-qa 怎么堵死 |
| --- | --- |
| 过滤参数写错，测试框架跑了 0 条用例也退出码 0 报绿 | 硬禁 `ZERO_RUN`，执行用例数为 0 一律判不通过 |
| 改了核心支付或权限文件，只跑了一套无关工具函数测试 | 硬禁 `UNMAPPED`，每个核心改动文件必须映射到行为测试 |
| 测试文件靠读源码搜字符串、吞异常或全换假替身敷衍过关 | 执行破测试突变探针，故意把业务条件改反，测试不变红就判水测试重写 |
| 宽屏看着好好的，窄屏半个字被裁掉、按钮被透明层挡住点不动 | 浏览器注入 `getBoundingClientRect` 与 `elementFromPoint` 几何扫描，抓出像素级裁切与遮挡 |
| 报一个错顺着瞎猜改十版，越改越烂 | 同一道验证连败两次立即熔断，写出两次共同的错误前提并反证 |

## 四道硬门禁

1. **新鲜证据与覆盖映射**。必须拿最后一次改动后刚跑出来的命令输出说话；逐文件建立改动到测试的映射，杜绝漏测与空跑。
2. **破测试突变探针**。清查源码搜词、漏 `await`、硬等秒数、强点绕遮挡和假替身测试，并用反向改写业务代码验证测试真能变红，随后还原源码零残留。
3. **像素几何扫描**。覆盖桌面宽屏、手机窄屏、浅色、深色四种组合，自动发现横向溢出、内容裁切与浮层遮挡。
4. **连败两次熔断与群反馈归批**。先独立复现找源头，连败两次停手反证；线上反馈先只读拉日志归批，拍板后再动线上。

## 配套钩子

可搭配本仓库的 [hooks/evidence-before-pass-gate.mjs](../../hooks/evidence-before-pass-gate.mjs) 与 [examples/acceptance.example.json](../../examples/acceptance.example.json)，在底层把「未读真实证据不许标通过」和 `UNMAPPED` / `ZERO_RUN` 写成自动拦截。

## 安装

只装这一个技能，运行下面这行命令。

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-real-qa
```

一键安装全套风起技能，运行下面这行命令。

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

更多安装方式见 [主说明文档](../../README.md#安装)。

## 授权

[CC BY-NC 4.0](../../LICENSE)。个人和团队可以免费使用（包括在公司里用来做自己的工作和项目），可以修改，转载分享时注明作者 Windrise AI 与仓库链接；不可以把这些内容本身拿去卖，例如放进付费课程、训练营、付费资料包或收费产品。拿不准算不算商用，提 [Issue](https://github.com/WindriseAI/wr-skills/issues) 问。本仓库是唯一来源，其他地方的副本以这里为准。
