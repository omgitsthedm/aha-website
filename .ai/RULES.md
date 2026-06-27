# AI-Ops Project Rules

Rules Version: 2026-06-27-aiops-foundation-v1
Generated date/time: 2026-06-27T05:29:19-0700
Source Base: /Users/davidmarsh/AI-OPS/TEMPLATES/RULES_BASE.md
Source Header: /Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website/aha-website/.ai/RULES_HEADER.md
<!-- AI-OPS-GENERATED: edit RULES_HEADER.md or RULES_BASE.md, then rerun generate-rules. -->
<!-- AI-OPS-CONTENT-CHECKSUM: 4054569368:9046 -->

<!-- AI-OPS-CONTENT-BEGIN -->
## Project Rules Header

# After Hours Agenda AI-Ops Rules Header

Project Code:

LFNYC-AHA

Project Name:

After Hours Agenda

Business Line:

After Hours Agenda under Little Fight NYC

Tier:

Tier 3 - Live Commerce / Internal Brand

Risk:

High

Canonical Path:

/Users/davidmarsh/Desktop/LiFi NYC/Clients/After Hours Agenda/Website/aha-website

Remote:

https://github.com/omgitsthedm/aha-website.git

Host:

Netlify

Live URL:

TBD unless verified from repo files or later read-only observation

Stack:

Next.js / Netlify custom commerce storefront

Commerce:

Square + Printful referenced; `app/api/checkout` present

Related Non-Canonical Folder:

`~/Desktop/Personal/OpenClaw_Local/aha_marketing_ai` - separate marketing-AI tool, not canonical storefront

## Locked Rules

- After Hours Agenda is under Little Fight NYC.
- AHA is a live commerce brand and must be treated as high risk.
- Do not place live orders.
- Do not run checkout/payment tests without sandbox or explicit David-run safe path.
- Do not alter products, inventory, customers, orders, fulfillment, shipping, tax, discounts, analytics, or live commerce data without explicit approval.
- Do not publish Netlify or storefront changes without explicit approval.
- Do not modify Square or Printful behavior without explicit approval.
- Do not inspect `.env` contents.
- Do not modify `.env` files.
- Do not modify product catalog or reorganization files without explicit approval.
- AHA checkout/payment/fulfillment actions are transactional.
- Live commerce changes require human-approved safe path.
- Dirty/untracked files must be recorded, not cleaned or committed, unless David explicitly approves.

## Do Not Touch

- `.env`
- `.env.local`
- `PRODUCT_CATALOG.json`
- `REORGANIZATION_LOG.csv`
- checkout/payment code
- Square integration behavior
- Printful integration behavior
- product/inventory/customer/order/fulfillment data
- Netlify deploy settings
- live commerce analytics/pixels unless explicitly approved

## AHA QA Harness Map

Observational checks an agent may run later:

- `git status`
- `git remote`
- `git branch`
- `git log`
- read package/config files
- read-only Netlify config inspection if local
- public GET to storefront pages if explicitly requested
- non-mutating page render checks
- read-only inspection of product catalog filenames/metadata, not mutation

Transactional/gated checks:

- checkout
- payment
- order creation
- customer creation/update
- inventory/product mutation
- Square actions
- Printful actions
- fulfillment actions
- customer email triggers
- live deploy/publish
- discount/tax/shipping changes
- analytics/pixel changes

## Shared Rules Base

# AI-Ops Shared Rules Base

This is the canonical shared behavior contract for Little Fight NYC AI-Ops work.

Keep truth in the repo. Store only what Git cannot know. Maintain shared rules once. Automate facts. Have AI propose judgment. Safety overrides forward motion.

## Command Words

Agents must recognize these exact commands:

- `SESSION START`
- `SESSION CLOSEOUT`
- `APPROVE LIVE CHANGE`
- `STOP`
- `HALT`

## Operating Contract

- Repo truth beats chat truth.
- Git knows code history.
- Deployment/build metadata knows what shipped.
- `.ai/STATE.md` stores what Git cannot know.
- Ideas go to inbox before becoming rules.
- Production QA must separate observation from transaction.
- Autonomy is useful until risk appears.
- Safety overrides forward motion.

## SESSION START Protocol

When starting work:

1. Read `.ai/RULES.md`.
2. Read `.ai/STATE.md`.
3. Check the current branch, worktree, and git status.
4. Check recent commits relevant to the requested work.
5. Check whether `.ai/STATE.md` is stale against Git, deploy metadata, or current task context.
6. Check `QA-PENDING` before claiming anything is complete.
7. State the current branch, dirty files, active risk level, and intended first action.

Do not rely on chat memory when the repo has a newer source of truth.

## SESSION CLOSEOUT Protocol

Before ending a work session:

1. Update `.ai/STATE.md` with facts Git cannot know.
2. Record unresolved `QA-PENDING` items.
3. Record proposed rule changes in the inbox rather than editing generated rules directly.
4. Report branch, files created, files modified, verification run, warnings, and next-agent directive.
5. Do not claim production QA passed unless production QA was actually run and stayed observational or was properly approved.

## Emergency Mode

Emergency Mode applies when production, client data, billing, secrets, auth, DNS, deployments, or irreversible operations may be affected.

In Emergency Mode:

- Stop forward feature work.
- Preserve evidence.
- Do the smallest reversible action.
- Ask David before destructive or transactional action.
- Prefer observation, rollback, and containment over new behavior.

## STOP / HALT Protocol

`STOP` means pause all work and report current state.

`HALT` means stop immediately, avoid further file or system changes, and report the last completed action plus the next safest recovery step.

If a STOP or HALT conflicts with automation, human instruction wins.

## APPROVE LIVE CHANGE Protocol

`APPROVE LIVE CHANGE` is required before any live transactional action unless the action is sandboxed, staged, explicitly David-run, or already protected by a project-specific approved safe path.

Approval must be scoped to a specific action. It does not authorize unrelated live changes.

## Proposed Changes / Inbox

Rules are not rewritten ad hoc.

Put candidate changes in `.ai/STATE.md` under `Proposed Changes / Inbox` with:

- Proposal
- Reason
- Risk
- Source evidence
- Suggested owner

Promote proposals into `.ai/RULES_HEADER.md` or `~/AI-OPS/TEMPLATES/RULES_BASE.md` only after review.

## Tactical Visibility Before >3 Source File Edits

Before editing more than three source files, report:

- Goal
- Files expected to change
- Risk
- Verification plan
- Rollback plan

Documentation, generated rules, and state files still require visibility when they affect agent behavior.

## Observational vs Transactional QA Split

Observational production QA is allowed when it only reads public or authorized state and does not create, mutate, submit, send, buy, book, upload, export, or persist anything.

Transactional production QA is not allowed unless sandboxed, staged, explicitly David-run, or gated by `APPROVE LIVE CHANGE` plus a safe test path.

If a `qa:prod` harness exists, run it instead of improvising checks.

Transactional actions include:

- live checkout orders
- live payments
- real appointment bookings
- real lead form submissions
- real client emails
- real database writes
- real uploads into client workflows
- PHC bid/export actions that could alter client data
- anything that pollutes client records, calendars, inboxes, analytics, orders, or production data

## Dangerous Operation Gate

Do not perform dangerous operations without explicit approval.

Dangerous operations include:

- pushing to protected branches
- deploying
- deleting files or cloud resources
- modifying secrets, `.env`, DNS, auth, or billing
- mutating production data
- running live transactional QA
- changing production infrastructure

The required approval phrase for live danger is `APPROVE LIVE CHANGE`.

No standing autonomy, Emergency Mode, or "do it all / don't ask" instruction elevates past this gate. Transactional production actions always require `APPROVE LIVE CHANGE`, scoped to the single action.

## Stale State Protocol

If `.ai/STATE.md` conflicts with Git, deploy metadata, logs, or current source files:

1. Treat the state as stale.
2. Use repo/deploy facts as the higher source of truth.
3. Update `.ai/STATE.md` during closeout with the corrected fact and evidence.
4. Do not silently carry stale assumptions forward.

## QA-PENDING Protocol

`QA-PENDING` means work is not verified enough to claim done.

Each pending item must include:

- What needs verification
- Why it matters
- Safe verification path
- Whether it is observational or transactional
- Current owner

Do not collapse QA-PENDING into success language.

## Collision Detection

Before editing, check for collisions:

- current branch
- current worktree
- `git status --short`
- recent commits
- existing lock file if the project uses one
- whether Claude Code, Codex, or another agent is likely active on the same branch or files

If a collision appears likely, stop and report the risk before writing.

## Optional Lock File Protocol

Projects may use `.ai/LOCK.md` for coordination.

If present, read it before edits. If creating one, include:

- Agent
- Branch
- Files or area claimed
- Start time
- Expected closeout
- Recovery note

Do not use a lock file as permission to bypass safety gates.

## Session History Compaction

Keep durable state short and factual.

Use `.ai/STATE.md` for current operational truth, not transcripts. Summarize long histories into recent decisions, unresolved risks, next steps, and evidence pointers.

## Safety Override

Safety overrides forward motion.
<!-- AI-OPS-CONTENT-END -->
