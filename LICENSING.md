# 授权对照表 / Licensing

本仓库的文件分两种授权。下表按路径列出每类文件归哪一种；表里没列到的按「文档和内容」算。

| 路径 | 是什么 | 授权 |
| --- | --- | --- |
| `hooks/*.mjs` | 钩子脚本和自测 | MIT，见 [LICENSE-MIT](LICENSE-MIT) |
| `skills/*/scripts/*` | 技能附带的检查和渲染脚本 | MIT |
| `docs/*/src/*.py` | 维护者重出配图用的脚本 | MIT |
| `examples/*.json` | 叫你复制进自己项目的配置模板（钩子挂载、配置全集、权限拒绝表、验收单示例） | MIT |
| `skills/*/SKILL.md`、`skills/*/references/*` | 技能正文和参考模板 | CC BY-NC 4.0 加作者额外授权，见 [LICENSE](LICENSE) |
| `docs/**`（除 `docs/*/src/*.py`） | 说明文档、提示词清单、配图和出图源文件 | CC BY-NC 4.0 加作者额外授权 |
| `examples/*.md` | AGENTS 模板、首次对齐原文、字段说明 | CC BY-NC 4.0 加作者额外授权 |
| `skills/*/fixtures/*` | 检查脚本的样例站点 | CC BY-NC 4.0 加作者额外授权 |
| `README.md`、`README.en.md`、`.claude-plugin/*` | 仓库说明和插件市场清单 | CC BY-NC 4.0 加作者额外授权 |

## 作者额外授权

版权人 Windrise AI 在 CC BY-NC 4.0 之外另行许可，和 [LICENSE](LICENSE) 一起生效：

- 个人和团队在自己的工作中使用这些技能、提示词和配套文档（包括在公司里用来开发自己的软件），不算商业用途，可以免费用。
- 仍然不可以：把这些内容本身拿去卖或换钱，例如转售、放进付费课程、训练营、付费社群、付费资料包、付费咨询交付物，或者打包进收费产品当卖点或会员赠品。
- 转载、修改、分享时注明作者 Windrise AI 和本仓库链接。拿不准算不算商用，或者需要商业授权，请提 [Issue](https://github.com/WindriseAI/wr-skills/issues)。

## In English

- **MIT** ([LICENSE-MIT](LICENSE-MIT)): `hooks/*.mjs`, `skills/*/scripts/*`, `docs/*/src/*.py`, and the configuration templates `examples/*.json`.
- **CC BY-NC 4.0 plus an additional permission** ([LICENSE](LICENSE)): everything else, including `SKILL.md` files, references, docs, prompt checklists, images, fixtures, `examples/*.md`, READMEs and plugin manifests.
- **Additional permission from the copyright holder**: individuals and teams using these Skills, prompts and accompanying docs in their own work, including at a company to build its own software, is not considered commercial use. Selling the content itself (reselling, paid courses, bootcamps, paid communities, paid resource packs, paid consulting deliverables, paid products) is still not allowed. Attribute Windrise AI with a link to this repository.
