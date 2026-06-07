# Nova Story Forge — Plan-only runtime/compaction patch

This patch aligns Script Writer with the plan-only workflow.

It changes:

- `src/lib/PromptBuilder.ts`
  - replaces Scene Anchors with `PLAN BEAT ANCHORS`;
  - adds style reset before each planned beat;
  - adds exact last line of the previous approved part;
  - keeps Scene Cards disabled for Script Writer.

- `server.ts`
  - removes Scene Cards from `SCRIPT_WRITER_RUNTIME_CORE`;
  - updates `compactClaudePrompt()` so it preserves current `===` sections:
    - `CURRENT PART PLAN`
    - `PREVIOUS WRITTEN PARTS CONTEXT`
    - `VOICE ANCHOR`
    - `PLAN BEAT ANCHORS`
    - `STYLE RULES`
    - `EXTRA INSTRUCTION`
    - `FINAL RUNTIME WRITER CORE`

## Apply

From the repository root:

```bash
python scripts/apply_plan_runtime_patch.py
```

Then commit:

```bash
git add server.ts src/lib/PromptBuilder.ts
git commit -m "Align script writer compaction with plan-only prompts"
git push
```
