# wr-skills

[简体中文](README.md) | English

> A collection of Chinese-language AI Skills and deterministic engineering hooks by Windrise AI. Battle-tested habits for daily thinking and shipping software with AI, packaged to install individually or as a full suite.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-11-2563EB.svg?style=flat-square)](#skills)
[![Hooks](https://img.shields.io/badge/hooks-4-0F766E.svg?style=flat-square)](#universal-hooks)

Works with Claude Code, Codex, Cursor, Antigravity, claude.ai, and other agents that support Skills. Every Skill also includes a standalone prompt checklist in Chinese for web chats that do not support Skills.

## Four Core Recommended Skills

Start with these four core engineering skills for new projects or high-stakes tasks.

| Skill | Plain-language summary |
| --- | --- |
| [wr-10x-goal](docs/wr-10x-goal/README.md) | Set 10x speed (0.1x parallel wall-clock time) and 10x size-reduction targets after clarifying context, compare 10 existing solutions before building, and strictly block reward hacking (dropped features, hardcoded fakes, skipped slow paths, or weakened assertions) |
| [wr-ask-first](docs/wr-ask-first/README.md) | Challenge requirement flaws and compare 10 open-source options before coding, surface leaks/contradictions/second-order risks, and resolve unknowns via a decision tree into `docs/SPEC.md` |
| [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | Extract independent FRs and DPs into a design matrix, eliminate reverse coupling via reordering and a single source of truth until lower-triangular before parallel splits |
| [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | Three physically isolated read-only reviews after merge: a no-source user audits click steps, a no-source reader audits plain copy, and a fresh engineer audits the diff against 8 checks |

Install all four core skills at once:

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-10x-goal wr-ask-first wr-axiomatic-design wr-skeptic-audit
```

## Skills

### Windrise Software Engineering Suite (9 Standalone Skills)

| Skill | What it does |
| --- | --- |
| [wr-10x-goal](docs/wr-10x-goal/README.md) | Set 10x speed and 10x size-reduction targets after clarifying context, compare 10 existing solutions before building, and lock down anti-cheat bans against dropped features, fake returns, skipped slow paths, or weakened test assertions |
| [wr-ask-first](docs/wr-ask-first/README.md) | Challenge requirement flaws and compare 10 open-source options before coding, expose leak/context/contradiction/second-order risks, and lock answers in `docs/SPEC.md` |
| [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | Extract independent FRs and DPs into a design matrix, eliminate reverse coupling via reordering and a single source of truth until lower-triangular before parallel splits |
| [wr-split-work](docs/wr-split-work/README.md) | Split parallel work across isolated `git worktree` directories with exclusive file lists, coordinator-only planning and verification, four-tier model routing, and upfront bundle slimming |
| [wr-ux-craft](docs/wr-ux-craft/README.md) | Polish UI with 8 zero-effort UX rules, 7 state-driven motion checks, diagonal hover safe corridors with click-lock, elastic data scaling, and 2nd/3rd-order impact checks |
| [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | Run three physically isolated read-only reviews after merge: no-source interaction click-step audit, no-source plain-copy audit, and fresh veteran engineer diff audit |
| [wr-real-qa](docs/wr-real-qa/README.md) | Verify real execution paths with changed-file-to-test mapping (blocking `UNMAPPED` and `ZERO_RUN`), mutation probes for weak tests, `getBoundingClientRect` clipping/occlusion scans, and two-strike stops |
| [wr-plain-cn](docs/wr-plain-cn/README.md) | Write plain Chinese without AI cliches: verify 5 concrete physical details first, zero invented inner thoughts, strict banned patterns, and a 22-item checklist |
| [wr-hook-forge](docs/wr-hook-forge/README.md) | Turn repeated mistakes into zero-dependency Node.js guard hooks with Claude Code and Antigravity protocol support, starting in `observe` mode before switching to `enforce` |

### Everyday & Growth Skills

| Skill | What it does |
| --- | --- |
| [wr-sunkit](docs/wr-sunkit/README.md) | Calorie counting from meal photos, side-by-side plans from three different AIs, and an AI that argues against your assumptions |
| [wr-geo](docs/wr-geo/README.md) | SEO and GEO audit for product sites: measure live crawler and no-JS content first, write a byte-fixed contract, and verify with an independent check script |

## Universal Hooks

Four zero-dependency Node.js standard-library scripts in `hooks/`, written to the Claude Code and Antigravity hook input/output specifications plus Git `pre-commit` support, with `observe` and `enforce` modes:

- `hooks/safety-redline-guard.mjs`: blocks credential access, unsafe deletions outside scratch/worktree paths, destructive git resets on main checkouts, and noisy desktop actions on quiet hosts (including unpacked batch tool arguments).
- `hooks/evidence-before-pass-gate.mjs`: tracks files actually read during a session and blocks marking `passes: true` in acceptance reports when coverage is unmapped, zero tests ran, or cited evidence was never read.
- `hooks/speak-before-act-hook.mjs`: prompts the agent to state its plan before calling tools on a new user turn, and optionally checks outgoing responses for raw hashes or boilerplate headers.
- `hooks/copy-and-privacy-lint.mjs`: pre-commit / CI scanner that dynamically checks for local username/path leaks plus banned copywriting patterns.

Configuration examples live in `examples/` (`wr.config.example.json`, `AGENTS.template.md`, `hooks.claude.json`, `hooks.agy.json`, `acceptance.example.json`). Verify all four hooks locally with the 17 offline dual-protocol unit tests via `node hooks/test-hooks.mjs`.

## Install

Install all Skills globally with one command:

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

Install a single Skill:

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-10x-goal
```

Claude Code plugin marketplace:

```bash
claude plugin marketplace add WindriseAI/wr-skills
claude plugin install wr-engineering@wr-skills
claude plugin install wr-10x-goal@wr-skills
claude plugin install wr-sunkit@wr-skills
```

Or simply tell your Agent:

> Please install all Skills from `github.com/WindriseAI/wr-skills` using `npx -y skills add WindriseAI/wr-skills -g --all`.

claude.ai: download the repository ZIP archive, extract it, zip the target `skills/<skill-name>` subfolder, and upload it on the Skills settings page (or paste `docs/<skill-name>/提示词清单.md` directly into chat).

## License

[CC BY-NC 4.0](LICENSE). Free to use, share and adapt with attribution to Windrise AI and a link to this repo. **No commercial use**, including bundling into paid courses, bootcamps, paid communities or paid resource packs. For a commercial license, open an [issue](https://github.com/WindriseAI/wr-skills/issues).
