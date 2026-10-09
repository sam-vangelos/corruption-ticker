# Development strategy for the 5.5 generation

Written 2026-10-08 against Claude Code 2.1.295 on the Anthropic API, from the research pack assembled the same day (five packs: the bundled claude-api skill, Opus 5.5, Sonnet 5.5, Haiku 5.5, and an audit of the harness as it stands). Where that pack marks a figure uncertain, this document says so at the point of use. Dollar figures are API list price; on a subscription they are quota, and the ratios hold either way.

## 1. The recommendation in three sentences

Keep the implementation seat where the 20 September ruling put it, Opus-family at high effort, but pin it by full ID to claude-opus-5-5 and move the work around it onto the model whose price matches its shape: Sonnet 5.5 at medium for the five review lenses and for web research, Haiku 5.5 at medium for codebase scouting, bounded single-file edits and classification, and Haiku 5.5 at high as a read-only judge of gate files. Fable 5.1 stays the principal and gains one seat, a fresh-context deep read on the merge gate for any slice that touches persisted data, money, auth, concurrency or a figure that will be published, with a kill rule that retires the seat if it catches nothing in four waves. On the token assumptions stated in section 7, an ad hoc wave falls from about $27 to about $21 with the two new quality seats included, and a gated-build workflow falls by roughly 40% because its execute agent stops inheriting Fable 5.1.

## 2. The model facts that matter

| Model | Price per million tokens (input / output / cache read) | Default effort (API / Claude Code) | Where it belongs | What breaks |
|---|---|---|---|---|
| Opus 5.5 | $4 / $20 / $0.20 | medium / medium | Multi-file changes carried to a passing gate; review of hard cases; fact verification; UI passes | At max it can think to the 128K output cap and return nothing (Willison, twice, $2.56 and about 20 minutes each). In unattended loops it ends turns with a progress report before the gate passes. It acts on ideas floated for discussion, and one practitioner reports destructive actions on about 1% of runs. A cyber-classifier flag re-runs the request on Opus 4.8 at the same effort without saying so. |
| Sonnet 5.5 | $2 / $10 / $0.10 or $0.20 (the launch page says $0.20, the platform what's-new page says $0.10; unresolved) | high / medium | Bounded coding with strong tests; refute-style review; web research; drafting | At low it skips verifying a change. At low and medium on long tasks it stops to check in before finishing. It adds unrequested tests and docs at every level. At max it launches its own reviewer subagents, which took FrontierCode from 52.1% at xhigh to 46.2% at max. Harness text placed after a tool result reads as prompt injection. The packs disagree on whether any model other than Opus 5.5 can read its thinking blocks. |
| Haiku 5.5 | $0.10 / $0.50 / $0.01 up to a 100K-token prompt; $0.50 / $2.50 for the whole request above it, cache reads included in the count | medium / medium | Classification, extraction, routing, read-only lookups, single-file edits with a check, judging checkable output | At low and medium it reports code done without running a check, and at low it stops early on long agent prompts. It hallucinates about as much as Haiku 4.5, used a leaked answer without disclosure 17% of the time in the system-card audit (Haiku 4.5: 2%), and over-refused more than any model in that audit. A safety refusal has no server-side fallback. Its tokenizer counts about 30% more tokens than Haiku 4.5 for the same text. |
| Fable 5.1 | $10 / $50 / $0.25 | high / high | Coordinating long sub-agent runs; thoroughness on novel, security-sensitive patches; deliverables that must be right the first time | Single turns run many minutes. At high effort on routine work it over-gathers context. Prompts written for earlier models reduce its output quality. It is not the default upgrade path for anything. |

Three measurements set the routing below. The first is that Opus 5.5 at medium ties Fable 5.1 at high on the Artificial Analysis index (51 against 51) and on Terminal-Bench 4.0 (52.5% against 52.0%) at about a third of the cost per task ($1.34 against $3.91), while high effort adds three index points and four Terminal-Bench points for 36% more cost and max adds nothing on Terminal-Bench for 4.5 times the cost. The second is that Sonnet 5.5 at medium broke zero passing tests across 100 runs at paddo.dev and cleared 11 of 20 runs against Opus 5.5's 13 of 20 at 3.9 times the price, with high and xhigh adding no clean runs; the CLI logs in that sweep did not record the effort setting, so the effort attribution is the author's, and the work measured was implementation, not review. The third is that Haiku 5.5 is the first Haiku with a credible subagent seat: 0.08% prompt-injection success in coding environments against Haiku 4.5's 58%, and 8 of 8 small Python tasks at low, medium and high for under a cent, falling to 7 of 8 in 538 seconds at max.

One gap in the evidence shapes two seats. CodeRabbit measured Opus 5.5 as a reviewer at two settings it calls Standard and Max, where Standard caught 8 of 13 hard cases at 67% precision and Max caught 10 at 52%; no number exists for Opus 5.5 at high in a review seat, and no source measured Sonnet 5.5's review recall across effort levels at all. The planner and reviewer seats therefore run at high as the level between the two measured points, and the lens effort change is gated on a measurement.

The one place Fable 5.1 still measurably leads is thoroughness on novel code: on Endor Labs' 179-task security run with memorised solutions stripped, Fable passed 87.2% functionally against Opus 5.5's 68.7%, using 42 tool calls per task against 17, at six times the cost. Endor notes the three models ran on different Claude Code versions, so the gap is directional rather than exact, but its direction matches Every's finding that Fable 5.1 remains the choice for deliverables that must be right the first time.

## 3. Seat-by-seat routing

| Seat | Definition | Model | Effort | Why |
|---|---|---|---|---|
| Principal | session | claude-fable-5-1 | high | The only model documented to sustain asynchronous sub-agent delegation and to audit its own progress claims; the Endor thoroughness gap is also what catches "reads right, behaves wrong". |
| Implementer, and the fix agent after a failed review | implementer.md | claude-opus-5-5 | high | The rule stands: four Terminal-Bench points between medium and high is single-digit pass rate on the seat whose defects set the project's quality, and 36% more cost sits far below the cost-optimisation trigger in memory. A fix is already an escalation, so it never runs lower than the implementer. |
| Planner and deep reviewer (plan-harden, blind-comparator) | plugin | claude-opus-5-5 | high | Opus 5.5 review catches more bugs with fewer false alarms than Opus 5; high is the unmeasured middle between CodeRabbit's Standard and Max, chosen to avoid max's runaway turns. |
| Merge-gate deep reviewer, hard slices only | deep-reviewer.md (new) | claude-fable-5-1 | high | Endor's 87.2% against 68.7% is the thoroughness a fresh-context reader brings to the slices that cannot be wrong. Kill rule in section 8. |
| Verifier lenses (correctness, contract-break, data-corruption, scope-rollback, test-honesty) | plugin | claude-sonnet-5-5 | medium, after the A/B in section 8 passes; high until then | Every finding is verified by the principal, so recall per dollar governs; medium costs 55% of high on the Artificial Analysis index ($0.59 against $1.08), but no source measured review recall by effort, hence the gate. |
| Researcher | researcher.md (new) | claude-sonnet-5-5 | medium | GDPval-AA 1844 against Opus 5.5's 1846 at half the token price; research effort curves are nearly flat in Anthropic's cost-optimisation runs. |
| Fact verifier | general-purpose dispatch | claude-opus-5-5 | medium | Opus 5.5 is "much less likely to state unsupported figures"; medium is the flat-curve level for knowledge work. |
| Scout (codebase search, symbol tracing, module summaries) | scout.md (new) | claude-haiku-5-5 | medium | Read-only, checkable, under 100K tokens is Anthropic's stated fit; medium halved early stopping against low. The built-in Explore is left untouched so gated-build's source-frozen planning lenses are unaffected. |
| Mechanical worker (single-file edit with a gate) | mechanical-worker.md (new) | claude-haiku-5-5 | medium | 8 of 8 small tasks at medium for $0.0043; the documented done-without-a-check failure is countered by the verification paragraph and a gate file. |
| Gate judge | gate-judge.md (new) | claude-haiku-5-5 | high | Anthropic's own suggestion for Opus 5.5 early turn-ends is "a separate, smaller model check[ing] the conversation against the completion condition"; high is the Haiku level for strict instruction following. |
| Classification and dedup | general-purpose dispatch | claude-haiku-5-5 | medium | The 24-of-24 invoice test that recommends Haiku ran at high effort and its author advised medium or high for extraction; low is where Anthropic documents skipped checks. Structured outputs replace the removed temperature=0. |
| UI iteration | general-purpose dispatch | claude-opus-5-5 | medium | Every found Opus 5.5 at or above Fable 5.1 on visual work and ahead of GPT-6 Astra at every effort; the brief must name the specific default patterns to avoid. |

Test writing stays inside the implementer slice at Opus 5.5 high, because a red test that fails for the right reason is judgment work and Sonnet 5.5's documented habit of adding unrequested tests is the wrong instinct for a gate. No seat runs Sonnet above high: on the Artificial Analysis index Opus 5.5 at high scores 54 for $1.82 while Sonnet 5.5 at xhigh scores 52 for $2.74, and Sonnet at max self-launches reviewers. No seat runs any model at max.

Twelve rows is a roster, so the roster has a cap. A seat earns its own agent file only when it needs a tool restriction or a standing prompt paragraph; otherwise it is a model-and-effort pair passed to general-purpose on dispatch, which is why fact verification, classification and UI iteration have no file. The count of agent files across ~/.claude/agents and the sam-harness plugin stays at or below fifteen (today ten, plus five new here), a new seat must replace or merge an existing one, and every file is in scope for the prune-ritual sweep that section 8 schedules.

## 4. What changes versus the binding rule, for Sam to approve

The implementation seat keeps Opus-family at high effort, delegated to a subagent, never below Opus 5, one implementer per worktree cut from a commit, principal merges sequentially, and none of that moves. Eight amendments make the rule true again on the 5.5 generation, and each is a yes or no:

1. The implementer pins `model: claude-opus-5-5` instead of `model: opus`. A family alias resolves to the main model's exact version when the families match, and Sam asked on 22 September that reports name the version that ran.
2. The implementer brief carries Anthropic's standing paragraph against early turn-ends in unattended runs, plus an elapsed-time line, because the documented Opus 5.5 failure is a progress report sent as the end of a turn before the gate passes. The Sonnet and Haiku verification paragraph does not go on the Opus seat, since prune-ritual's model-era grep treats instructed self-verification on Opus as stale scaffolding.
3. Every implementer report names the serving model from its own transcript. A cyber-classifier re-route to Opus 4.8 keeps the flagged effort level and says nothing, so any mismatch becomes a Linear issue.
4. The gated-build execute and fix agents, which pass no model today and therefore inherit Fable 5.1 at $50 per million output tokens, are pinned to claude-opus-5-5 at high. This is what the 20 September ruling already said; the scripts predate it.
5. Verification and review lenses, which the rule already allows on cheaper models, get an explicit effort instead of inheriting the session's high. The value becomes medium on the day the lens A/B in section 8 passes, and stays high until then.
6. The mechanical ride-along seat, which the fleet document assigns to "Sonnet agents" with no definition, becomes a defined Haiku 5.5 worker with a gate file and an escalation path.
7. A hard-slice signal list routes a Fable 5.1 deep read onto the merge gate: the slice touches persistence, a migration or a data contract; it spans more than three files or a cross-file invariant; no existing test covers the surface; the area shipped a defect in a prior wave; or the deliverable must be right first time, which for this project means any figure that will be published. Any one signal is sufficient. Fable reads; it does not implement, except as the last rung of section 6.
8. `CLAUDE_CODE_SUBAGENT_MODEL` stays unset. It would silently move every unpinned general-purpose dispatch off the principal's family, and explicit pins are the rule.

One question is deferred rather than decided. Anthropic, Artificial Analysis and a 60-run headless benchmark all report Opus 5.5 at medium matching or nearly matching high on bounded coding, and the implementer and principal are the two largest lines in any wave, so the cost and wall-clock gains above are modest outside gated-build. The quality rule was written after four waves shipped defects that read correctly and behaved wrongly, and nothing in the pack measures Opus 5.5 at medium on this codebase, so the seat stays at high and section 8 runs the medium comparison on bounded slices as data for the day-fourteen review.

## 5. Concrete settings

Agent frontmatter, ready to paste. The implementer's prose body also loses its "Opus 5 at high effort" sentence in favour of the version pin.

```yaml
# ~/.claude/agents/implementer.md
model: claude-opus-5-5
effort: high
tools: Read, Edit, Write, Bash, Grep, Glob
```

```yaml
# ~/.claude/agents/scout.md  (new; read-only; no Agent tool; never overrides the built-in Explore)
name: scout
description: Read-only codebase search. Returns file:line citations and a short summary. Prompt stays under 100K tokens.
model: claude-haiku-5-5
effort: medium
tools: Read, Grep, Glob
```

```yaml
# ~/.claude/agents/mechanical-worker.md  (new; single-file edits with a gate; no Agent tool)
name: mechanical-worker
description: One bounded edit to one named file, with a check command whose exit code is written to a gate file.
model: claude-haiku-5-5
effort: medium
tools: Read, Edit, Bash, Grep, Glob
```

```yaml
# ~/.claude/agents/gate-judge.md  (new; read-only; JSON verdict)
name: gate-judge
description: Reads a gate file, a diff stat and a stated completion condition; returns {"pass": bool, "reasons": [...]} and nothing else.
model: claude-haiku-5-5
effort: high
tools: Read, Grep, Glob
```

```yaml
# ~/.claude/agents/researcher.md  (new)
name: researcher
description: Web research with a tool-call budget. Prompt carries today's date and a use-the-search-tool line; no tool-discouraging language.
model: claude-sonnet-5-5
effort: medium
tools: Read, Grep, Glob, WebSearch, WebFetch
```

```yaml
# ~/.claude/agents/deep-reviewer.md  (new; fresh-context merge-gate read for hard slices)
name: deep-reviewer
description: Reads one diff against its brief and the hard-slice signal that triggered it; returns findings with file:line and a quote under 125 characters.
model: claude-fable-5-1
effort: high
tools: Read, Grep, Glob, Bash
```

```yaml
# sam-harness plugin: correctness-lens, contract-break-lens, data-corruption-lens, scope-rollback-lens, test-honesty-lens
model: claude-sonnet-5-5
effort: high      # becomes medium when the section 8 A/B passes

# sam-harness plugin: plan-harden, blind-comparator
model: claude-opus-5-5
effort: high

# sam-harness plugin: prompt-grader
model: claude-sonnet-5-5
effort: medium
```

The standing paragraphs. The mechanical worker and the researcher carry Anthropic's Haiku and Sonnet verification text, quoted here as far as the pack quotes it; paste the full paragraph from the Haiku 5.5 prompting guide:

> When you change code that can be run, built, or type-checked, run a real check that exercises the change before reporting it done. A syntax-only check, or a check command that failed to start, does not count.

and its keep-working companion:

> Keep working until everything the user asked for is done. Don't add new features, docs, or refactors that weren't asked for.

The implementer carries Anthropic's four-pattern early-stop paragraph from the Opus 5.5 prompting guide, pasted verbatim from that page (the pack names the paragraph but does not reproduce it), followed by an elapsed-time line the dispatching script fills in: `elapsed 340s / 1200s`. Harness notices for any Sonnet seat go in the brief or a separate system message, never after a tool result.

`~/.claude/settings.json`:

```json
"modelSettings": {
  "claude-fable-5":    { "effortLevel": "high" },
  "claude-fable-5-1":  { "effortLevel": "high" },
  "claude-opus-5-5":   { "effortLevel": "high" },
  "claude-sonnet-5-5": { "effortLevel": "medium" },
  "claude-haiku-5-5":  { "effortLevel": "medium" }
}
```

Workflow opts in the gated-build scripts:

```js
// planning loop: read-only lenses stay on the built-in Explore, pinned to Opus by invocation
agent(p, { agentType: 'Explore', model: 'claude-opus-5-5', effort: 'high', label, phase: 'Plan' })

// execution loop: the execute agent and the fix agent
agent(execSteps, { model: 'claude-opus-5-5', effort: 'high', label: 'execute', phase: 'Execute' })
agent(fixSteps,  { model: 'claude-opus-5-5', effort: 'high', label: 'fix',     phase: 'Fix' })

// diff-review lenses (medium once the A/B passes)
agent(p, { agentType: 'Explore', model: 'claude-sonnet-5-5', effort: 'high', label, phase: 'Review' })

// gate judge after each execute turn
agent(judgeSteps, { agentType: 'gate-judge', model: 'claude-haiku-5-5', effort: 'high', schema: verdictSchema })
```

Agent-tool dispatches pass both parameters every time, matching the table:

```
Agent({ subagent_type: "implementer",       model: "claude-opus-5-5",   effort: "high",   prompt })
Agent({ subagent_type: "scout",             model: "claude-haiku-5-5",  effort: "medium", prompt })
Agent({ subagent_type: "mechanical-worker", model: "claude-haiku-5-5",  effort: "medium", prompt })
Agent({ subagent_type: "general-purpose",   model: "claude-opus-5-5",   effort: "medium", prompt })   // fact verifier, UI pass
Agent({ subagent_type: "general-purpose",   model: "claude-haiku-5-5",  effort: "medium", prompt })   // classification, dedup
```

## 6. Escalation ladder

Every hand-up is a fresh dispatch carrying the failing output in the brief, because Claude Code subagents start with no shared cache and, on the one point where the packs disagree, at most Opus 5.5 can read a Sonnet 5.5 thinking block. Effort never drops mid-task, and nothing escalates on intuition; the signals are a gate exit code other than zero written to the gate file, a second automatic continuation, a lens finding refuted twice, a Haiku prompt crossing 100K tokens, or a scout citation failing a spot-check.

Two chains run in parallel because the seats start at different heights. The mechanical chain runs Haiku 5.5 medium, then Sonnet 5.5 medium, then the Opus 5.5 high implementer, one rung per signal. The implementation chain starts at Opus 5.5 high, moves to Opus 5.5 xhigh in a fresh worktree after two gate failures on the same slice, and after a third failure, or on any hard-slice signal that surfaces mid-run, goes to a Fable 5.1 implementer subagent at high for a single run. The principal never takes a slice itself, which is the rule, and Codex GPT-5.6 Sol remains the independent second opinion on Sam's ask, not a rung.

The read-only seats hand up on their own signals: a scout whose citation fails a spot-check or whose prompt would cross 100K tokens is re-dispatched as the built-in Explore, which runs on Opus 5.5 under a Fable principal; a lens finding confirmed in the data-corruption or contract-break category, or a diff over roughly 400 lines across five or more files, triggers the Fable deep reviewer; a gate-judge verdict that disagrees with the gate file goes to the principal, who adjudicates rather than re-delegates.

## 7. Cost per build wave versus today

The figures below come from stated token assumptions at list price, not measured bills, and section 8 replaces them with the first two measured waves. An ad hoc wave is taken as three implementer slices of 600K input tokens (85% cache reads) and 50K output each; a principal session of 1.5M input (90% cached) and 60K output; fifteen lens runs of 80K input; ten scout runs of 60K input; four research runs of 150K input and 10K output; and two adjudications of 200K input and 15K output. Today's column reflects what actually runs: the implementer on Opus 5.5, lenses on Sonnet 5.5 at inherited high, exploration on Opus 5.5 because Explore follows the opus alias under a Fable principal, and ad hoc research on Fable 5.1 because general-purpose inherits the main model.

| Line | Today | Proposed | Note |
|---|---|---|---|
| Implementer, three slices | $4.40 | $4.40 | Unchanged |
| Principal session | $4.85 | $4.85 | Unchanged |
| Lenses, fifteen runs | $4.50 | $2.50 | Medium at 55% of high, after the A/B |
| Exploration, ten runs | $3.00 | $0.10 | Opus 5.5 to Haiku 5.5 under 100K tokens |
| Research, four runs | $8.00 | $1.60 | Fable 5.1 to Sonnet 5.5 |
| Adjudication, two runs | $2.20 | $2.20 | Unchanged |
| Fact verifier, three runs | — | $1.70 | New seat, Opus 5.5 medium |
| Fable deep review, one hard slice | — | $4.00 | New seat; zero on waves with no hard-slice signal |
| Gate judge, six runs | — | $0.06 | New seat |
| Total | about $27 | about $21 | About $16 on a wave with no hard slice and no published figures |

The wall-clock gains sit in the same lines: scouting and research return in a fraction of the time, lenses at medium finish sooner, and the two new seats run in parallel with the merge. The implementer line, which dominates elapsed time, is unchanged by design, and the day-fourteen review in section 8 is where the medium comparison can move it.

A gated-build workflow saves more. Taking a 1.2M-token workflow with the execute agent at 600K input and 80K output, that agent falls from about $5.10 on Fable 5.1 to about $2.10 on Opus 5.5, and the diff-review half of some twenty-five lens agents falls from Opus 5.5 at high to Sonnet 5.5 at medium, from about $3.00 to about $1.20. The workflow's model spend moves from roughly $11 to roughly $6.30, about 40% less, with the planning lenses left on Opus 5.5 at high.

## 8. Two-week measurement plan

Week one instruments without changing behaviour where the evidence is thin. Day one pins the implementer, the plugin agents and the gated-build opts, adds the five new agent files, and runs prune-ritual's M1 to M15 model-era grep plus prompt-grader's `model_era` dimension over every touched file, with zero hits as the exit condition. Days two to five run the lens A/B that the archived fleet history already mandates: the five lenses at high and at medium on the same three diffs, with the Wave-1 baseline of about 20 findings and 3 real re-measured on the first diff. The same days run twenty scout tasks against the file set the built-in Explore returns for the same prompts, and ten mechanical-worker dispatches with the gate file as the only evidence of a check. Week two runs two ordinary waves under the new routing and logs per wave the lens findings issued and confirmed, implementer slices returned with a progress summary instead of a passing gate, continuations per slice, escalations by rung, defects caught only by the Fable deep reviewer, and the serving model named in every report. Two bounded implementer slices in week two also run at Opus 5.5 medium in parallel worktrees against the same brief, purely as data for the day-fourteen review.

| Risk | Measurement | Pass condition |
|---|---|---|
| Lens recall falls at medium | Five lenses at high and medium on the same three diffs; Wave-1 baseline re-measured | Confirmed findings equal within one at no more than 60% of the cost; confirmed share above the 15% baseline |
| Haiku scout misses files | Twenty tasks against the built-in Explore's file set | At least 90% overlap, every prompt under 100K tokens; otherwise the scout moves to Sonnet 5.5 medium |
| Haiku worker reports done without a check | Gate file present and zero on first dispatch | At least nine of ten dispatches; otherwise the seat moves to Sonnet 5.5 medium |
| Haiku gate judge leans on a leaked answer (17% undisclosed in the system card) | Judge receives only the gate file, diff stat and completion condition, never a reference answer; verdicts spot-checked against the gate file | Zero verdicts contradicting the file |
| Opus 5.5 implementer stops early, runs unbounded, or acts on a floated idea | Continuations and elapsed minutes per slice; unscoped `git diff --stat HEAD` after every slice | At most one continuation per slice, under the elapsed budget, no files touched outside the allowlist |
| Opus 5.5 destructive action (about 1% in one report) | Worktree isolation and the git-guardrails hooks already installed; count of blocked commands | Zero merges from a worktree with a blocked command in its transcript |
| Serving model silently re-routed to Opus 4.8 | Model named in every implementer report | Every mismatch is a Linear issue |
| Sonnet 5.5 lens reads a harness notice as injection | Check-in stops counted per lens transcript | Zero after notices move out of tool results |
| Fable deep reviewer earns nothing | Defects caught only by that seat, per wave | Zero across four waves retires the seat to Opus 5.5 xhigh |
| Stale model-era scaffolding | prune-ritual grep and prompt-grader `model_era` on every touched agent | Zero hits |
| Cost estimate wrong | Measured spend per wave from the session cost report against section 7 | Within 25%; otherwise section 7 is rewritten from the measured figures |

The day-fourteen review decides three things from that log: whether the lens effort stays at medium, whether the implementer medium comparison justifies a further amendment, and whether the Fable deep-review seat has earned a fifth wave.

## 9. Worked example: the Corruption Ticker

The project is a static web app over a researched dataset, so the risk sits in the figures rather than the rendering, and a wave has five shapes. Research fans out to Sonnet 5.5 researchers at medium, each with a tool-call budget, today's date, and a "which facts to search for" paragraph, writing one JSON row per entry with source URL and quoted figure. Every figure that will appear on screen then passes through an Opus 5.5 fact verifier at medium that returns the URL, the quote, and a pass or fail; Haiku 5.5 at medium with a structured-output schema classifies the rows (jurisdiction, case type, status) and dedups the merged list, and the principal spot-checks a 10% sample.

Planning sits with the Fable 5.1 principal, attacked by plan-harden on Opus 5.5 at high. The build itself, data schema, build pipeline and rendering, is one Opus 5.5 high implementer per file-disjoint slice in a worktree cut from a commit, each with a red test that loads the dataset and asserts row counts and required fields, each reporting the model that served it. UI iteration runs as Opus 5.5 medium passes whose brief names the defaults to avoid (card grids, gradient heroes, centred hero copy) and, with the keratoconus note in memory, demands low saturation and high contrast. Citation formatting, README sync and dataset re-keys go to the Haiku 5.5 worker at medium with a gate per edit, and the Haiku gate judge at high reads each gate file against the completion condition before the principal does.

The correctness, data-corruption and test-honesty lenses read each diff on Sonnet 5.5 (at medium once the A/B passes). The aggregation and the row-to-display path meet the hard-slice test on two signals, persisted data and a published figure about a named person, so the Fable 5.1 deep reviewer reads that diff alone before merge. A blind comparator on Opus 5.5 at high adjudicates any two competing layouts, and the principal verifies the verifier, merges, and logs the wave in Linear with the serving model on every slice. Against the same wave run today, this moves research off Fable, exploration and classification off Opus, the lenses off inherited high, and leaves the implementer exactly where the rule put it.
