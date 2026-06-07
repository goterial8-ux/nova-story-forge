from pathlib import Path
import re

ROOT = Path.cwd()
types_path = ROOT / "src" / "types.ts"
app_path = ROOT / "src" / "App.tsx"

if not types_path.exists():
    raise FileNotFoundError(f"Cannot find {types_path}. Run this script from the repository root.")
if not app_path.exists():
    raise FileNotFoundError(f"Cannot find {app_path}. Run this script from the repository root.")

types = types_path.read_text(encoding="utf-8")
before_types = types
types = types.replace("  { id: 'scene_cards', name: 'Scene Cards' },\n", "")
types = types.replace('  { id: "scene_cards", name: "Scene Cards" },\n', "")
types_path.write_text(types, encoding="utf-8")
print("patched src/types.ts:", before_types != types)

app = app_path.read_text(encoding="utf-8")
before_app = app

old_stage_init = '''  const [currentStageId, setCurrentStageId] = useState<StageId>(() => {
    return (
      (localStorage.getItem("studio_writer_stage") as StageId) || "idea_market"
    );
  });'''

new_stage_init = '''  const [currentStageId, setCurrentStageId] = useState<StageId>(() => {
    const savedStage =
      (localStorage.getItem("studio_writer_stage") as StageId) || "idea_market";
    return savedStage === "scene_cards" ? "script_writer" : savedStage;
  });'''

if old_stage_init in app:
    app = app.replace(old_stage_init, new_stage_init)
elif "savedStage === \"scene_cards\" ? \"script_writer\"" not in app:
    print("warning: currentStageId initializer was not found; skipped saved-stage redirect")

old_script_gate = '''    if (
      stageId === "script_writer" &&
      state.stageStatuses["scene_cards"] !== "locked"
    )
      return {
        allowed: false,
        warning: "Scene Cards must be locked before writing Script.",
      };'''

new_script_gate = '''    if (
      stageId === "script_writer" &&
      state.stageStatuses["story_plan"] !== "locked"
    )
      return {
        allowed: false,
        warning: "Story Plan must be locked before writing Script.",
      };'''

if old_script_gate in app:
    app = app.replace(old_script_gate, new_script_gate)
else:
    app2 = re.sub(
        r'''    if \(\s*
      stageId === "script_writer" &&\s*
      state\.stageStatuses\["scene_cards"\] !== "locked"\s*
    \)\s*
      return \{\s*
        allowed: false,\s*
        warning: "Scene Cards must be locked before writing Script\.",\s*
      \};''',
        new_script_gate,
        app,
        count=1,
    )
    if app2 == app:
        print("warning: script_writer scene_cards gate not found")
    app = app2

old_source_part_plan = '''      const sourcePartPlan = extractPartSlice(planText, partNumber);'''

new_source_part_plan = '''      let sourcePartPlan = extractPartSlice(planText, partNumber);
      if (!String(sourcePartPlan || "").trim() && String(planText || "").trim()) {
        sourcePartPlan = [
          `AUTO-FALLBACK: The system could not isolate Part ${partNumber} automatically.`,
          `Use this Story Plan as reference, but write ONLY Part ${partNumber} — ${partTitle}.`,
          "",
          planText,
        ].join("\\n");
      }'''

if old_source_part_plan in app:
    app = app.replace(old_source_part_plan, new_source_part_plan)
elif "AUTO-FALLBACK: The system could not isolate Part" not in app:
    print("warning: sourcePartPlan assignment was not found; skipped fallback insertion")

auto_sync_hook = '''
  // Auto-sync Script Writer parts from the approved Story Plan.
  // Workflow: Story Plan -> Script Writer -> Current Part Plan auto-filled.
  useEffect(() => {
    if (currentStageId !== "script_writer") return;

    const current = stateRef.current;
    const hasStoryPlan = !!String(current.storyPlan || "").trim();
    if (!hasStoryPlan) return;

    const hasWrittenParts = current.scriptParts.some((p) =>
      !!String(p.draftText || "").trim(),
    );

    const hasMissingPartPlan =
      current.scriptParts.length === 0 ||
      current.scriptParts.some((p) =>
        !String(p.manualPartPlan || p.sourcePartPlan || "").trim(),
      );

    if (current.scriptParts.length === 0 || (!hasWrittenParts && hasMissingPartPlan)) {
      handleInitScriptParts();
    }
  }, [currentStageId, state.storyPlan]);
'''

insert_after = '''    updateState({ scriptParts: parts });
    updateStageStatus("script_writer", "generated");
  };'''

if "Auto-sync Script Writer parts from the approved Story Plan" not in app:
    if insert_after in app:
        app = app.replace(insert_after, insert_after + "\n" + auto_sync_hook)
    else:
        print("warning: handleInitScriptParts end was not found; auto-sync hook not inserted")
else:
    print("auto-sync hook already exists")

app_path.write_text(app, encoding="utf-8")
print("patched src/App.tsx:", before_app != app)
print("done")
