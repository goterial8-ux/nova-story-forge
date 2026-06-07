import React from "react";
import { ScriptPart, StageStatus, AutopilotState } from "../types";
import {
  Check,
  Clipboard,
  Download,
  Eraser,
  Layers,
  RefreshCw,
  Trash2,
  Wand2,
} from "lucide-react";

const DEFAULT_STYLE_RULES = `You write a YouTube manga/manhwa recap script in English.

Sentence rules:
- Use short, direct sentences.
- Maximum twelve words per sentence whenever possible.
- Each paragraph must contain two to four short sentences.
- Every normal narrator paragraph must be 120-220 characters including spaces.
- Do not put every sentence on a separate line.
- Do not create giant paragraphs.

Recap rhythm:
- Action.
- Reaction.
- Next action.
- Result.
- New pressure.

Forbidden:
- No literary prose.
- No slow atmosphere.
- No philosophical monologue.
- No abstract emotional explanation.
- No markdown.
- No headings.
- No notes before or after the script.

Output only the script text.`;

interface ScriptWriterPanelProps {
  parts: ScriptPart[];
  updatePart: (index: number, partial: Partial<ScriptPart>) => void;
  onGeneratePart: (index: number) => void;
  onGenerateAllParts: () => void;
  onStopBatchGeneration: () => void;
  onClearAllParts: () => void;
  onInitScriptParts: () => void;
  onClearPart: (index: number) => void;
  isBatchGenerating: boolean;
  onCheckPart: (index: number) => void;
  onRebuildPart?: (index: number) => void;
  onAssembleScript: () => void;
  stageStatus: StageStatus;
  autopilotState?: AutopilotState;
}

function buildManualPromptPreview(part: ScriptPart): string {
  const target = part.manualTargetChars?.trim() || "13,000-15,000 characters including spaces";
  const styleRules = part.manualStyleRules?.trim() || DEFAULT_STYLE_RULES;
  const partPlan = part.manualPartPlan?.trim() || "[PASTE CURRENT PART PLAN HERE]";
  const sceneCards =
    part.manualSceneCards?.trim() ||
    part.sourceSceneCards?.trim() ||
    "[PASTE CURRENT PART SCENE CARDS HERE]";
  const extra = part.manualExtraInstruction?.trim() || "No extra instruction.";

  return `=== MANUAL FULL PART WRITER ===

You are writing ONE COMPLETE SCRIPT PART.

Write only:
Part ${part.partNumber} — ${part.partTitle}

Target length:
${target}

Hard output rules:
- Write the complete Part ${part.partNumber}, not a summary.
- Do not continue to Part ${part.partNumber + 1}.
- Do not write headings like "Part ${part.partNumber}" or "Scene Card".
- Do not write notes, explanations, markdown, QA reports, or meta text.
- Output only the script text.
- Every normal narrator paragraph must be 120-220 characters including spaces.
- Each paragraph must contain 2-4 short sentences.
- Do not create one-sentence micro-paragraphs unless it is dialogue, impact, system, or cliffhanger.
- Do not create long blocks above 220 characters.

=== CURRENT PART PLAN PASTED BY USER ===
${partPlan}

=== CURRENT PART SCENE CARDS PASTED BY USER ===
${sceneCards}

=== USER STYLE RULES ===
${styleRules}

=== EXTRA USER INSTRUCTION ===
${extra}

=== FINAL COMMAND ===
Write the full Part ${part.partNumber} now.
Use only the pasted current part plan and current part scene cards.
Follow the style rules strictly.
Target ${target}.
Output only the script text.`;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ScriptWriterPanel({
  parts,
  updatePart,
  onGeneratePart,
  onClearAllParts,
  onInitScriptParts,
  onClearPart,
  isBatchGenerating,
  onAssembleScript,
  stageStatus,
}: ScriptWriterPanelProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [copiedOutput, setCopiedOutput] = React.useState(false);

  React.useEffect(() => {
    if (selectedIndex >= parts.length) {
      setSelectedIndex(Math.max(0, parts.length - 1));
    }
  }, [parts.length, selectedIndex]);

  if (parts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 border border-slate-200 mt-4 shadow-sm p-8 text-center flex-col gap-4">
        <Layers className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 font-medium">
          No script parts found. Sync parts from the locked Story Plan first.
        </p>
        <button
          onClick={onInitScriptParts}
          className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-semibold transition-all shadow-sm rounded-sm"
        >
          Sync with Plan
        </button>
      </div>
    );
  }

  const part = parts[selectedIndex];
  const writtenParts = parts.filter((p) => p.draftText?.trim()).length;
  const approvedParts = parts.filter((p) => p.status === "approved").length;
  const allApproved = parts.length > 0 && parts.every((p) => p.status === "approved");
  const promptPreview = buildManualPromptPreview(part);
  const manualSceneCardsValue = part.manualSceneCards ?? part.sourceSceneCards ?? "";
  const manualStyleValue = part.manualStyleRules ?? DEFAULT_STYLE_RULES;
  const manualTargetValue = part.manualTargetChars ?? "13,000-15,000 characters including spaces";

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(promptPreview);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1500);
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(part.draftText || "");
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  };

  const fullScript = parts
    .filter((p) => p.draftText?.trim())
    .map((p) => `## Part ${p.partNumber}: ${p.partTitle}\n\n${p.draftText.trim()}`)
    .join("\n\n\n");

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
      <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
              Manual Full Part Writer
            </div>
            <div className="text-sm text-slate-600 mt-1">
              One request writes one complete part. No autopilot, no supervisor loop, no automatic repair.
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onInitScriptParts}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200"
              title="Recreate the parts list from Story Plan titles"
            >
              <RefreshCw className="w-3 h-3" /> Sync Parts
            </button>

            <button
              onClick={onClearAllParts}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200"
            >
              <Eraser className="w-3 h-3" /> Clear All Outputs
            </button>

            <button
              onClick={() => {
                onAssembleScript();
                downloadText(`manual_full_script_${Date.now()}.txt`, fullScript);
              }}
              disabled={!fullScript}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" /> Download Written Parts
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">Written</div>
            <div className="font-mono font-black text-slate-900">{writtenParts} / {parts.length}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">Approved manually</div>
            <div className="font-mono font-black text-slate-900">{approvedParts} / {parts.length}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">Current part chars</div>
            <div className="font-mono font-black text-slate-900">{(part.draftText || "").length}</div>
          </div>
        </div>

        {isBatchGenerating && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-sm text-xs font-semibold">
            Generation is running. Wait for it to finish before editing the current prompt.
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-4 overflow-hidden">
        <aside className="xl:col-span-3 bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-500">
            Parts
          </div>
          <div className="flex-1 overflow-y-auto">
            {parts.map((p, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={`${p.partNumber}-${idx}`}
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-3 border-b border-slate-100 transition-colors ${
                    active ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      Part {p.partNumber}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                        p.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : p.draftText
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}
                    >
                      {p.status === "approved" ? "approved" : p.draftText ? "written" : "empty"}
                    </span>
                  </div>
                  <div className={`mt-1 text-xs line-clamp-2 ${active ? "text-slate-200" : "text-slate-600"}`}>
                    {p.partTitle}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="xl:col-span-9 min-h-0 flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Current full part request
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Part {part.partNumber}: {part.partTitle}
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={copyPrompt}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200"
                >
                  <Clipboard className="w-3 h-3" /> {copiedPrompt ? "Copied" : "Copy Prompt"}
                </button>

                <button
                  onClick={() => onGeneratePart(selectedIndex)}
                  disabled={isBatchGenerating || stageStatus === "locked"}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Wand2 className="w-3 h-3" /> Generate Full Part
                </button>

                <button
                  onClick={() => updatePart(selectedIndex, { status: "approved", isComplete: true })}
                  disabled={!part.draftText?.trim() || stageStatus === "locked"}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check className="w-3 h-3" /> Approve Manually
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                  Current Part Plan — paste manually
                </span>
                <textarea
                  value={part.manualPartPlan || ""}
                  onChange={(e) => updatePart(selectedIndex, { manualPartPlan: e.target.value })}
                  placeholder="Paste only the current part plan here. Example: PART FIVE — ГОРОД НАЧИНАЕТ ДВИГАТЬСЯ..."
                  className="h-56 resize-y border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-sm"
                  disabled={stageStatus === "locked"}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                  Current Part Scene Cards — paste manually
                </span>
                <textarea
                  value={manualSceneCardsValue}
                  onChange={(e) => updatePart(selectedIndex, { manualSceneCards: e.target.value })}
                  placeholder="Paste only scene cards for this part here."
                  className="h-56 resize-y border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-sm"
                  disabled={stageStatus === "locked"}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <label className="lg:col-span-2 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                  Style rules
                </span>
                <textarea
                  value={manualStyleValue}
                  onChange={(e) => updatePart(selectedIndex, { manualStyleRules: e.target.value })}
                  className="h-44 resize-y border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-sm"
                  disabled={stageStatus === "locked"}
                />
              </label>

              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                    Target characters
                  </span>
                  <input
                    value={manualTargetValue}
                    onChange={(e) => updatePart(selectedIndex, { manualTargetChars: e.target.value })}
                    className="border border-slate-200 bg-slate-50 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-sm"
                    disabled={stageStatus === "locked"}
                  />
                </label>

                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                    Extra instruction
                  </span>
                  <textarea
                    value={part.manualExtraInstruction || ""}
                    onChange={(e) => updatePart(selectedIndex, { manualExtraInstruction: e.target.value })}
                    placeholder="Example: write more comedy in the turtle movement scene; do not mention future Part 6..."
                    className="flex-1 min-h-28 resize-y border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-sm"
                    disabled={stageStatus === "locked"}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Generated / editable output
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {(part.draftText || "").length} characters. You can edit manually before approving.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyOutput}
                  disabled={!part.draftText}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200 disabled:opacity-40"
                >
                  <Clipboard className="w-3 h-3" /> {copiedOutput ? "Copied" : "Copy Output"}
                </button>

                <button
                  onClick={() => downloadText(`part_${part.partNumber}_${Date.now()}.txt`, part.draftText || "")}
                  disabled={!part.draftText}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200 disabled:opacity-40"
                >
                  <Download className="w-3 h-3" /> Download Part
                </button>

                <button
                  onClick={() => onClearPart(selectedIndex)}
                  disabled={!part.draftText || stageStatus === "locked"}
                  className="flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-rose-200 disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" /> Clear Output
                </button>
              </div>
            </div>

            <textarea
              value={part.draftText || ""}
              onChange={(e) =>
                updatePart(selectedIndex, {
                  draftText: e.target.value,
                  status: e.target.value.trim() ? "generated" : "not_started",
                  wordOrCharacterCount: e.target.value.length,
                })
              }
              placeholder="Generated full part will appear here. You can also paste a manually generated part here."
              className="min-h-[420px] resize-y border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-sm"
              disabled={stageStatus === "locked"}
            />
          </div>

          {allApproved && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-sm flex items-center justify-between gap-3">
              <div className="text-xs font-semibold">
                All parts are manually approved. You can assemble the full script now.
              </div>
              <button
                onClick={onAssembleScript}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm"
              >
                Assemble Script
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
