from pathlib import Path
import re

app_path = Path("src/App.tsx")
panel_path = Path("src/components/ScriptWriterPanel.tsx")

app = app_path.read_text(encoding="utf-8")
panel = panel_path.read_text(encoding="utf-8")

old = re.search(
    r"  const handleGenerateAllParts = async \(\) => \{\n[\s\S]*?\n  \};\n\n  const handleStopBatchGeneration = \(\) => \{",
    app,
)
if not old:
    raise SystemExit("Could not find handleGenerateAllParts block in src/App.tsx")

new = """  const handleGenerateAllParts = async () => {
    const currentParts = stateRef.current.scriptParts || [];

    if (currentParts.length === 0) {
      setWarningMessage("No script parts found. Sync parts from Story Plan first.");
      setTimeout(() => setWarningMessage(null), 4000);
      return;
    }

    const firstEmptyIndex = currentParts.findIndex(
      (p) => !String(p.draftText || "").trim(),
    );

    if (firstEmptyIndex === -1) {
      setWarningMessage("All parts already have generated text.");
      setTimeout(() => setWarningMessage(null), 3000);
      return;
    }

    setStopRequested(false);
    stopRequestedRef.current = false;
    setIsBatchGenerating(true);

    try {
      for (let i = firstEmptyIndex; i < stateRef.current.scriptParts.length; i += 1) {
        if (stopRequestedRef.current) {
          setWarningMessage("Simple auto-generation stopped by user.");
          setTimeout(() => setWarningMessage(null), 4000);
          break;
        }

        const currentPart = stateRef.current.scriptParts[i];
        if (!currentPart) continue;

        // Simple mode behaves like manual writing:
        // it only writes missing parts and does not run supervisor/check/repair/rebuild.
        if (String(currentPart.draftText || "").trim()) continue;

        setWarningMessage(`Auto-writing Part ${currentPart.partNumber}...`);
        const success = await handleGeneratePart(i);

        if (!success) {
          setWarningMessage(
            `Simple auto-generation stopped at Part ${currentPart.partNumber}.`,
          );
          setTimeout(() => setWarningMessage(null), 5000);
          break;
        }

        if (i < stateRef.current.scriptParts.length - 1 && !stopRequestedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      if (!stopRequestedRef.current) {
        setWarningMessage("Simple auto-generation finished.");
        setTimeout(() => setWarningMessage(null), 4000);
      }
    } finally {
      setIsBatchGenerating(false);
      stopRequestedRef.current = false;
      setStopRequested(false);
    }
  };

  const handleStopBatchGeneration = () => {"""

app = app[:old.start()] + new + app[old.end():]

# Ensure ScriptWriterPanel destructures the two props it already receives.
panel = panel.replace(
    """  onGeneratePart,
  onClearAllParts,
  onInitScriptParts,""",
    """  onGeneratePart,
  onGenerateAllParts,
  onStopBatchGeneration,
  onClearAllParts,
  onInitScriptParts,""",
)

# Add simple auto-generation buttons in header if they are not already present.
if "Auto Generate Missing" not in panel:
    marker = """            <button onClick={onInitScriptParts} className="px-3 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-xs font-bold uppercase tracking-wide flex items-center gap-2 rounded-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Sync Parts
            </button>"""
    replacement = marker + """
            <button onClick={onGenerateAllParts} disabled={isBatchGenerating} className="px-3 py-2 bg-slate-900 text-white border border-slate-900 hover:bg-slate-800 text-xs font-bold uppercase tracking-wide flex items-center gap-2 rounded-sm disabled:opacity-50">
              <Wand2 className="w-3.5 h-3.5" /> Auto Generate Missing
            </button>
            {isBatchGenerating && (
              <button onClick={onStopBatchGeneration} className="px-3 py-2 bg-white text-orange-700 border border-orange-200 hover:bg-orange-50 text-xs font-bold uppercase tracking-wide rounded-sm">
                Stop
              </button>
            )}"""
    if marker not in panel:
        raise SystemExit("Could not find header Sync Parts button in ScriptWriterPanel.tsx")
    panel = panel.replace(marker, replacement)

app_path.write_text(app, encoding="utf-8")
panel_path.write_text(panel, encoding="utf-8")

print("patched src/App.tsx")
print("patched src/components/ScriptWriterPanel.tsx")
print("done")
