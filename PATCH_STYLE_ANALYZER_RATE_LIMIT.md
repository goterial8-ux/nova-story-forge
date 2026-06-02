# Patch: Remove Style Analyzer Rate Limit Loop

Problem:

`Style Analyzer` currently triggers an extra AI Supervisor call. This wastes Vertex quota and can produce `Rate limit hit` even though Style DNA is only a support stage.

Required changes:

## 1. src/App.tsx

Inside `handleAnalyze`, before calling `buildSupervisorPrompt`, add an early local check for `style_analyzer`:

```ts
if (currentStageId === "style_analyzer") {
  const stageContent = getStageContent(currentStageId);
  const report: SupervisorReport = {
    status: stageContent.trim().length > 200 ? "ok" : "needs_small_repair",
    whatIsGood:
      "Style Analyzer is a support stage. It does not need an extra AI Supervisor call.",
    problems:
      stageContent.trim().length > 200
        ? []
        : ["Style DNA is too short or empty."],
    requiredFixes:
      stageContent.trim().length > 200
        ? []
        : ["Regenerate Style Analyzer or add more style notes."],
    recommendation:
      stageContent.trim().length > 200
        ? "Local style check passed. Safe to approve and lock."
        : "Style DNA needs more substance before locking.",
    canContinue: stageContent.trim().length > 200,
  };

  updateState({
    supervisorReports: {
      ...stateRef.current.supervisorReports,
      [currentStageId]: report,
    },
    promptHistory: [
      {
        id: Date.now().toString(),
        stageId: currentStageId,
        promptUsed: "[LOCAL STYLE ANALYZER CHECK - NO AI SUPERVISOR CALL]",
        inputDataSummary: "Local check for Style Analyzer",
        outputPreview: JSON.stringify(report, null, 2),
        createdAt: Date.now(),
        supervisorStatus: report.status,
        repairApplied: false,
        lockedStatus: false,
      },
      ...stateRef.current.promptHistory,
    ],
  });
  updateStageStatus(
    currentStageId,
    report.canContinue ? "generated" : "needs_repair",
  );
  return;
}
```

This makes Style Analyzer pass by local validation instead of spending another API call.

## 2. src/lib/PromptBuilder.ts

Reduce reference payload size:

```ts
function referenceExamples(state: ProjectState, maxChars = 14_000): string {
  return clipText(state.competitors || "None", maxChars);
}
```

This prevents huge competitor reference text from being sent on every early-stage prompt.

## Result

- No AI Supervisor call on Style Analyzer.
- Less Vertex/Gemini quota pressure.
- Fewer rate-limit retries.
- Style DNA can be approved quickly and used by later stages.

Important:

After applying this patch, redeploy Cloud Run from `main`.
