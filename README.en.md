# wr-skills

[简体中文](README.md) | English

> A collection of Chinese-language AI Skills and deterministic engineering hooks by Windrise AI. Battle-tested habits for daily thinking and shipping software with AI, packaged to install individually or as a full suite.

[![Docs: CC BY-NC 4.0](https://img.shields.io/badge/docs-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Code: MIT](https://img.shields.io/badge/code-MIT-16A34A.svg?style=flat-square)](LICENSE-MIT)
[![Skills](https://img.shields.io/badge/skills-11-2563EB.svg?style=flat-square)](#skills)
[![Hooks](https://img.shields.io/badge/hooks-4-0F766E.svg?style=flat-square)](#universal-hooks)

Written to the common Skills format for Claude Code, Codex, Cursor, Antigravity, claude.ai and other agents that support Skills (not tested on every host). Every Skill also includes a standalone prompt checklist in Chinese for web chats that do not support Skills.

> This repository is the single source of truth for these Skills, prompts and hooks. Copies in Feishu docs or articles are excerpts; when they differ, the repository wins.

## Four Core Recommended Skills

### wr-ask-first: challenge and clarify before coding

- **Problem**: the AI starts coding immediately, then you find the direction was wrong, an existing library was ignored, or the requirements contradict each other.
- **Say**: "Don't write code yet. Poke holes in this and pin down the spec first."
- **You get**: a risk list (leaks, context bloat, contradictions, knock-on effects), a comparison of existing open-source options (configurable, 5 by default), and a `docs/SPEC.md` you have signed off.
- [Docs](docs/wr-ask-first/README.md) · [Prompt checklist](docs/wr-ask-first/提示词清单.md)

### wr-10x-goal: 10x targets with anti-cheat rules

- **Problem**: optimisation only squeezes out 10%, or the AI games the metric by dropping features, hardcoding results or weakening assertions.
- **Say**: "This export takes ten minutes. Optimise it with a 10x target, no cutting features."
- **You get**: physical lower bounds for disk, memory and network, 10x speed and size targets, a before/after measurement under the same conditions, and a check against four anti-cheat rules.
- [Docs](docs/wr-10x-goal/README.md) · [Prompt checklist](docs/wr-10x-goal/提示词清单.md)

### wr-axiomatic-design: decouple into a lower-triangular design

- **Problem**: changing one module breaks others, and parallel branches collide on merge.
- **Say**: "These modules keep tangling. Decouple them before we split the work."
- **You get**: an FR × DP dependency matrix, an implementation order with reverse coupling removed, and which parts can run in parallel versus which shared sources must be locked first.
- [Docs](docs/wr-axiomatic-design/README.md) · [Prompt checklist](docs/wr-axiomatic-design/提示词清单.md)

### wr-skeptic-audit: three isolated blind reviews

- **Problem**: the session that wrote the code almost always approves its own work.
- **Say**: "This batch is merged. Run the three-seat blind review."
- **You get**: a new user reviewing interaction, a veteran editor reviewing copy on behalf of ordinary readers, and a senior engineer reviewing the diff read-only, merged into one table of blockers, suggestions and won't-fix items, each with a screenshot location, quote or `file:line`.
- [Docs](docs/wr-skeptic-audit/README.md) · [Prompt checklist](docs/wr-skeptic-audit/提示词清单.md)

Install all four core skills at once:

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first wr-10x-goal wr-axiomatic-design wr-skeptic-audit
```

## Skills

### Windrise Software Engineering Suite (8 Skills Ordered Pre-Build to UI Polish)

Ordered by workflow stage: Pre-build (`wr-ask-first`, `wr-10x-goal`, `wr-axiomatic-design`) → Parallel Build & Guards (`wr-split-work`, `wr-hook-forge`) → QA & Blind Audit (`wr-real-qa`, `wr-skeptic-audit`) → UI Polish (`wr-ux-craft`).

| Stage | Skill | What it does |
| --- | --- | --- |
| Pre-build | [wr-ask-first](docs/wr-ask-first/README.md) | Challenge, compare existing options and lock a spec before coding (core) |
| Pre-build | [wr-10x-goal](docs/wr-10x-goal/README.md) | 10x performance and size targets with anti-cheat rules (core) |
| Pre-build | [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | Remove reverse coupling with a design matrix before deciding on parallel work (core) |
| Parallel Build & Guards | [wr-split-work](docs/wr-split-work/README.md) | Split parallel work across isolated `git worktree` workspaces with exclusive file lists, coordinator-only planning and verification, model routing by tier, and upfront bundle slimming |
| Parallel Build & Guards | [wr-hook-forge](docs/wr-hook-forge/README.md) | Turn repeated mistakes into zero-dependency Node.js guard hooks, starting in `observe` mode before switching to `enforce` |
| QA & Blind Audit | [wr-real-qa](docs/wr-real-qa/README.md) | Verify real execution paths with changed-file-to-test mapping (blocking `UNMAPPED` and `ZERO_RUN`), mutation probes for weak tests, clipping/occlusion scans, and two-strike stops |
| QA & Blind Audit | [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | Three isolated read-only reviews of interaction, copy and diff after merge (core) |
| UI Polish | [wr-ux-craft](docs/wr-ux-craft/README.md) | Polish UI with 8 low-effort UX rules, 7 state-driven motion checks, hover safe corridors with click-lock, elastic data scaling, and 2nd/3rd-order impact checks |

### Writing Skill

| Skill | What it does |
| --- | --- |
| [wr-plain-cn](docs/wr-plain-cn/README.md) | Plain Chinese writing and anti-AI-tone checks: concrete openings, natural spoken cadence, four hard bans, three syntax checks (enumeration chains, semicolons, adjacent parallel triplets), and an opt-in report-only script |

### Everyday & Growth Skills

| Skill | What it does |
| --- | --- |
| [wr-geo](docs/wr-geo/README.md) | SEO and GEO audit for product sites: measure live crawler and no-JS content first, write a byte-fixed contract, and verify with an independent check script |
| [wr-sunkit](docs/wr-sunkit/README.md) | Calorie counting from meal photos, side-by-side plans from three different AIs, and an AI that argues against your assumptions |

## First-Run Setup

Every Skill starts with a "step 0": it looks for `wr.config.json` (current directory upward, then `~/wr.config.json`). If there is no `"onboarded": true`, it asks eight questions in one message (machine and test environment, OS and tools, models and budget, collaboration and publishing, reply language, rigor, safety level, project type), each with a default. Reply "OK" to accept all defaults. Answers are written back to `wr.config.json` and read by both Skills and hooks. Field reference (Chinese): [examples/README.md](examples/README.md).

## Universal Hooks

Four zero-dependency Node.js standard-library scripts in `hooks/`, written to the Claude Code and Antigravity hook input/output specifications plus Git `pre-commit` support. The Skills work in Claude Code, Codex, Cursor, Antigravity and claude.ai; the hooks currently only attach to Claude Code and Antigravity.

**Two red lines are enforced from the start; everything else only logs until setup.** Without a config file, or before `"onboarded": true`, credential access and recursive force-deletes (outside temp and in-project build output) are blocked, and every other rule only appends to `.wr-hook-observe.jsonl` (add it to `.gitignore`). After setup the safety guard uses the `standard` profile: credentials and recursive force-deletes stay blocked, `git reset --hard` is only logged, and everything else follows `hookMode` (default `observe`). Set `language.output` to `en` for English hook messages. The observe log is redacted by default (rule name, last path segment, program name, `NAME=…` for env prefixes); set `observeLogDetail` to `full` to keep everything.

**Who can relax the two red lines**: only `~/wr.config.json` in your home directory, plus `--mode` and `--user-config <path>` that you put in the hook command. The home directory comes from the operating-system account, not from `HOME` or `USERPROFILE`, and temp directories are fixed system locations, not `TEMP`, `TMP` or `TMPDIR`. A project's `wr.config.json` and any environment variable can tighten but never relax them, so a cloned repository cannot switch them off. The guard blocks file-writing tools from editing `~/wr.config.json`, and blocks any shell command that mentions both a home-directory form (`~`, `$HOME`, `%USERPROFILE%`, `$env:USERPROFILE`, `homedir()`, `expanduser`, or the absolute home path) and `wr.config.json` unless it is a read-only viewer such as `cat` (this errs on the side of blocking). Each relaxed pass prints a notice.

**What it catches and what it does not**: the guard inspects paths in tool arguments (including Grep and Glob patterns) and words in commands. It catches common forms of reading or writing `.env`, `~/.ssh`, `~/.aws`, `~/.gnupg`, `.netrc`, `.npmrc`, `.git-credentials`, private keys and certificates (including `.bak` copies), and `rm -rf`, `/bin/rm`, `Remove-Item -Recurse`, `del /s`, `rd /s`, `find … -delete`, and literal-path `fs.rm` / `rmSync` / `shutil.rmtree` / `rimraf`. It does not catch paths produced by shell globbing (`cat .e*`, `.en?`), split or computed names (`.e""nv`, `$(echo .env)`, variables), recursive content searches (`grep -r API_KEY .`), deletes without a literal path, renamed or aliased commands, writes to the guard config through a path that does not look like it (variables or globs in the name, `../` from a subdirectory of home, a script file run afterwards), writes through a directory junction or symbolic link, changes to the hook settings files (`.claude/settings*.json`) or the hook scripts under `hooks/` (these are not protected by the guard), or permissions granted by the host itself. After a `cd` in the same command, relative delete targets no longer get the build-output allowlist. **It is best-effort blocking of common patterns, not a security boundary**; pair it with a permission deny list and operating-system permissions.

- `hooks/safety-redline-guard.mjs`: blocks credential access; allows recursive force-deletes only inside temp directories or build-output directories inside the project (matched by whole path segment); flags destructive git resets on main checkouts. Three environment-specific rules are off by default: quiet host (`environment.quietMainMachine`), Orca long inline arguments (only when Orca is detected and the shell is PowerShell), and bare shared temp dirs on remote hosts (only when `environment.remoteHost` is set). Each rule can be set to `off` / `observe` / `enforce` under `safetyGuard.rules`.
- `hooks/evidence-before-pass-gate.mjs`: tracks files actually read during a session and blocks marking `passes: true` in `acceptance.json` when coverage is unmapped, zero tests ran, or cited evidence was never read.
- `hooks/speak-before-act-hook.mjs`: reminds the agent to state its plan before calling tools on a new user turn (supports the Claude Code transcript format). By default the reminder is added to the agent's context without denying the call; set `speakBeforeAct.preAction` to `block` to deny instead. The Stop check only runs patterns you list in `speakBeforeAct.stopPatterns` (none by default) and respects `stop_hook_active` to avoid loops.
- `hooks/copy-and-privacy-lint.mjs`: pre-commit / CI scanner for local username/path leaks and common secret formats, plus your own banned words and term replacements. No built-in style word lists.

To attach the hooks in Claude Code, merge the `hooks` section of [examples/hooks.claude.json](examples/hooks.claude.json) into a Claude Code settings file. To guard against cloned repositories, **install them in the user-level `~/.claude/settings.json`**, not only in the project's `.claude/settings.json`, which the repository itself can change or delete. To keep the user-level guard config elsewhere, add `--user-config <path>` to the hook command; it must be an **absolute path outside the project**, otherwise the hook reports an error, ignores it and falls back to `~/wr.config.json`. Commands use the `node "${CLAUDE_PROJECT_DIR}/hooks/<script>.mjs"` form from the official Claude Code docs, which keeps working from subdirectories and worktrees. We have only checked it on Windows with Git Bash; if a hook reports that the script cannot be found, replace `${CLAUDE_PROJECT_DIR}` with the project's absolute path. For a global install, put `hooks/` in a fixed folder and use its absolute path. A matching permission deny list is in [examples/claude-permissions.example.json](examples/claude-permissions.example.json).

Run the offline unit tests with `node hooks/test-hooks.mjs`. They have only been run on Windows 11; macOS and Linux are untested. Chinese output needs a UTF-8 terminal.

## Install

Install all Skills globally with one command:

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

Install a single Skill:

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first
```

Claude Code plugin marketplace:

```bash
claude plugin marketplace add WindriseAI/wr-skills
claude plugin install wr-engineering@wr-skills
claude plugin install wr-ask-first@wr-skills
claude plugin install wr-10x-goal@wr-skills
claude plugin install wr-geo@wr-skills
```

Or simply tell your Agent:

> Please install all Skills from `github.com/WindriseAI/wr-skills` using `npx -y skills add WindriseAI/wr-skills -g --all`.

claude.ai: download the repository ZIP archive, extract it, zip the target `skills/<skill-name>` subfolder, and upload it on the Skills settings page (or paste `docs/<skill-name>/提示词清单.md` directly into chat).

Restricted network: download the ZIP (or clone from a mirror) on a machine with access, then copy the `skills/` folders into your skills directory by hand. Everything is plain text and dependency-free scripts.

## License

The repository contains two kinds of material under different licenses.

**Code is MIT: use it freely, including commercially.** This covers every executable script: the hooks and their tests under `hooks/`, the check scripts under `skills/*/scripts/`, and the image scripts under `docs/*/src/`. Each file starts with `SPDX-License-Identifier: MIT`, and the configuration templates under `examples/` (`*.json`) count as MIT too. Full text in [LICENSE-MIT](LICENSE-MIT); the file-by-file table is in [LICENSING.md](LICENSING.md). Keep the copyright notice and you may modify it, merge it into your own projects or ship it in paid products.

**Docs and Skill content are CC BY-NC 4.0 plus an additional permission.** This covers the Skills (`SKILL.md`), prompt checklists, README and other documentation, and images, licensed under [CC BY-NC 4.0](LICENSE). Adapt and share with attribution to Windrise AI and a link to this repo.

- **Additional permission from the author** (granted by the copyright holder on top of CC BY-NC 4.0): individuals and teams using these Skills and prompts in their own work, including at a company to build its own software, is not considered commercial use and is free.
- **Still not allowed**: selling the content itself, for example reselling it or bundling it into paid courses, bootcamps, paid communities, paid resource packs, paid consulting deliverables or paid products. If you are unsure whether your use counts as commercial, or need a commercial license, open an [issue](https://github.com/WindriseAI/wr-skills/issues).
