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

const DEFAULT_STYLE_RULES = `You are a YouTube manga/manhwa recap scriptwriter.

HARD STYLE CONSTRAINTS — apply these before writing anything else:
- Every sentence: maximum 10 words. No exceptions. If a sentence runs longer, split it into two.
- Every paragraph: 120-220 characters including spaces.
- One paragraph = one visual beat = 2-4 short sentences.
- Never write a sentence longer than 10 words.

Rhythm (follow this order inside every paragraph):
1. Situation — one short sentence.
2. Action or threat — one short sentence.
3. Reaction — one short sentence.
4. Result or new pressure — one short sentence.

Voice:
- First person when the scene follows the main character directly.
- Third person when showing enemy reactions, crowd, politics, or events outside the main character.

Language: English. Script language is English only.

Length:
- One command = one complete part.
- Normal part length: 12,000-15,000 characters including spaces, unless another range is given.
- Do not finish early.
- Each important planned event must be expanded through action, reaction, consequence, pressure, and payoff.
- Mentioning an event once is not enough. Show it fully.

What to write:
- Dramatic, visual, clear, emotional.
- Show hunger, danger, fear, humiliation, survival tension through action, not description.
- Use father, mother, family, poverty, debt, old wounds from the plan through action and situation.

What NOT to write:
- No sentence over 10 words.
- No literary prose for beauty only.
- No dry summaries or reports.
- No giant paragraphs.
- No broken placeholder words.

SENTENCE LENGTH EXAMPLES:

Wrong (too long):
"The collectors took our barley before the pot even cooled and left us one cracked bowl."
"Mio poured water over the last grain anyway and made the soup thin enough to reflect the roof beams."

Correct (10 words or fewer per sentence):
"The collectors came at dawn. They took the barley. They left one cracked bowl."
"Mio poured water over the last grain. The soup was thin. She set it between us anyway."

Wrong (too long):
"I did not go to the normal hunting woods because every hunter had stripped them clean over two bad seasons."

Correct:
"I did not go to the normal hunting woods. Every hunter had stripped them clean. Two bad seasons had done that."

Paragraph rhythm example (correct):
"The door opened. Three soldiers stepped in. I did not move. My hands stayed flat on the table."

Plan expansion:
- Do not turn the plan into a checklist.
- Each important planned event should become a sequence of beats.
- Show the situation, threat, what the character notices, what the character does, what changes, who reacts, what result appears, and what new pressure begins.

Placeholder cleanup (before final output, silently fix these):
- Main → correct character name
- Show → she/her
- ONE, STYLE, Card, Face, Hook, Exit as residue → rewrite naturally

Do not output system messages, provider errors, or Chinese termination messages.
Output only clean script text.`;

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

function buildPreviousWrittenPartsPreview(parts: ScriptPart[], selectedIndex: number): string {
  const selectedPart = parts[selectedIndex];
  if (!selectedPart) return "None.";

  const previousParts = parts
    .filter((p) => p.partNumber < selectedPart.partNumber && p.draftText?.trim())
    .sort((a, b) => a.partNumber - b.partNumber);

  if (previousParts.length === 0) return "None. This is the first written part.";

  return previousParts
    .map((p) => {
      const paragraphs = (p.draftText || "")
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const opening = paragraphs.slice(0, 2).join(" ").slice(0, 450) || "Not available.";
      const ending = paragraphs.slice(-3).join(" ").slice(0, 900) || "Not available.";
      return [
        `Part ${p.partNumber}: ${p.partTitle}`,
        `Status: ${p.status}`,
        `Opening context: ${opening}`,
        `Latest ending / continuity state: ${ending}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function buildManualPromptPreview(parts: ScriptPart[], selectedIndex: number): string {
  const part = parts[selectedIndex];
  if (!part) return "";

  const target = part.manualTargetChars?.trim() || "12,000-15,000 characters including spaces";
  const styleRules = part.manualStyleRules?.trim() || DEFAULT_STYLE_RULES;
  const partPlan =
    part.manualPartPlan?.trim() ||
    part.sourcePartPlan?.trim() ||
    "[CURRENT PART PLAN IS EMPTY]";
  const previousPartsContext = buildPreviousWrittenPartsPreview(parts, selectedIndex);
  const extra = part.manualExtraInstruction?.trim() || "No extra instruction.";

  return `=== STYLE RULES — READ BEFORE WRITING ANYTHING ===
${styleRules}

=== PART TO WRITE ===
Part ${part.partNumber} — ${part.partTitle}

Target length: ${target}

=== CURRENT PART PLAN ===
${partPlan}

=== PREVIOUS WRITTEN PARTS CONTEXT ===
${previousPartsContext}

Use previous parts only as continuity memory. Do not rewrite them in the answer.

=== EXTRA INSTRUCTION ===
${extra}

=== COMMAND ===
Write the full Part ${part.partNumber}.
Use ONLY Current Part Plan as the foundation.
Do not use Scene Cards. Do not mention Scene Cards.
Follow the style rules and target length.

FINAL CHECK before outputting:
- Scan your first 10 sentences. Does any sentence exceed 10 words? Split it.
- Scan your paragraphs. Is any paragraph over 220 characters? Break it.
- Fix any placeholder residue (Main, Show, ONE, STYLE, Card, Face, Hook, Exit).

Output only the finished clean script text in English.`;
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
  onGenerateAllParts,
  onStopBatchGeneration,
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
    if (selectedIndex >= parts.length) setSelectedIndex(Math.max(0, parts.length - 1));
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
  const promptPreview = buildManualPromptPreview(parts, selectedIndex);
  const manualPartPlanValue = part.manualPartPlan ?? part.sourcePartPlan ?? "";
  const manualStyleValue = part.manualStyleRules ?? DEFAULT_STYLE_RULES;
  const manualTargetValue = part.manualTargetChars ?? "12,000-15,000 characters including spaces";
  const previousPartsContext = buildPreviousWrittenPartsPreview(parts, selectedIndex);

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
            <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">Plan-Only Full Part Writer</div>
            <div className="text-sm text-slate-600 mt-1">
              One request writes one complete part using only the current part plan. Scene Cards are disabled for writing.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onInitScriptParts} className="px-3 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-xs font-bold uppercase tracking-wide flex items-center gap-2 rounded-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Sync Parts
            </button>
            <button onClick={onGenerateAllParts} disabled={isBatchGenerating} className="px-3 py-2 bg-slate-900 text-white border border-slate-900 hover:bg-slate-800 text-xs font-bold uppercase tracking-wide flex items-center gap-2 rounded-sm disabled:opacity-50">
              <Wand2 className="w-3.5 h-3.5" /> Auto Generate Missing
            </button>
            {isBatchGenerating && (
              <button onClick={onStopBatchGeneration} className="px-3 py-2 bg-white text-orange-700 border border-orange-200 hover:bg-orange-50 text-xs font-bold uppercase tracking-wide rounded-sm">
                Stop
              </button>
            )}
            <button onClick={onClearAllParts} disabled={isBatchGenerating} className="px-3 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 text-xs font-bold uppercase tracking-wide flex items-center gap-2 rounded-sm disabled:opacity-50">
              <Eraser className="w-3.5 h-3.5" /> Clear All Outputs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
          <div className="border border-slate-200 rounded-sm overflow-hidden bg-slate-50 max-h-64 overflow-y-auto">
            {parts.map((p, idx) => (
              <button key={p.partNumber} onClick={() => setSelectedIndex(idx)} className={`w-full text-left p-3 border-b border-slate-200 last:border-b-0 transition ${idx === selectedIndex ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50 text-slate-700"}`}>
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-70">Part {p.partNumber}</div>
                    <div className="text-xs font-bold line-clamp-2 mt-1">{p.partTitle}</div>
                  </div>
                  <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-sm ${p.draftText?.trim() ? idx === selectedIndex ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700" : idx === selectedIndex ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-400"}`}>
                    {p.draftText?.trim() ? p.status : "empty"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm"><div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Parts</div><div className="font-black text-lg text-slate-900">{parts.length}</div></div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm"><div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Written</div><div className="font-black text-lg text-slate-900">{writtenParts}</div></div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm"><div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Approved</div><div className="font-black text-lg text-slate-900">{approvedParts}</div></div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm"><div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Stage</div><div className="font-black text-lg text-slate-900 uppercase">{stageStatus}</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto pr-1 pb-6">
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">Current Part Plan</label>
            <textarea value={manualPartPlanValue} onChange={(e) => updatePart(selectedIndex, { manualPartPlan: e.target.value })} className="w-full h-64 p-3 border border-slate-200 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-slate-900" placeholder="Auto-filled from Story Plan, or paste the current part plan manually." />
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">Previous Written Parts Context</label>
            <textarea value={previousPartsContext} readOnly className="w-full h-36 p-3 border border-slate-200 bg-slate-50 text-xs font-mono leading-relaxed resize-y text-slate-600" />
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">Style Rules</label>
            <textarea value={manualStyleValue} onChange={(e) => updatePart(selectedIndex, { manualStyleRules: e.target.value })} className="w-full h-72 p-3 border border-slate-200 text-xs font-mono leading-relaxed resize-y focus:outline-none focus:border-slate-900" />
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">Target Characters</label>
              <input value={manualTargetValue} onChange={(e) => updatePart(selectedIndex, { manualTargetChars: e.target.value })} className="w-full p-3 border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">Part Status</label>
              <select value={part.status} onChange={(e) => updatePart(selectedIndex, { status: e.target.value as StageStatus })} className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:outline-none focus:border-slate-900 bg-white">
                <option value="not_started">not_started</option>
                <option value="generated">generated</option>
                <option value="needs_repair">needs_repair</option>
                <option value="approved">approved</option>
                <option value="locked">locked</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">Extra Instruction</label>
              <textarea value={part.manualExtraInstruction ?? ""} onChange={(e) => updatePart(selectedIndex, { manualExtraInstruction: e.target.value })} className="w-full h-28 p-3 border border-slate-200 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-slate-900" placeholder="Optional: exact locked names, extra style notes, or current correction for this part." />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Prompt Preview</label>
              <button onClick={copyPrompt} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm"><Clipboard className="w-3 h-3" />{copiedPrompt ? "Copied" : "Copy Prompt"}</button>
            </div>
            <textarea value={promptPreview} readOnly className="w-full h-72 p-3 border border-slate-200 bg-slate-50 text-[11px] font-mono leading-relaxed resize-y text-slate-600" />
            <button onClick={() => onGeneratePart(selectedIndex)} disabled={isBatchGenerating} className="mt-3 w-full px-4 py-3 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-sm disabled:opacity-50"><Wand2 className="w-4 h-4" /> Generate Full Part</button>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Generated / Editable Output</label>
              <div className="flex items-center gap-2">
                <button onClick={copyOutput} disabled={!part.draftText} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm disabled:opacity-40"><Clipboard className="w-3 h-3" />{copiedOutput ? "Copied" : "Copy"}</button>
                <button onClick={() => downloadText(`part-${part.partNumber}.txt`, part.draftText || "")} disabled={!part.draftText} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm disabled:opacity-40"><Download className="w-3 h-3" />Part</button>
                <button onClick={() => onClearPart(selectedIndex)} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 rounded-sm"><Trash2 className="w-3 h-3" />Clear</button>
              </div>
            </div>
            <textarea value={part.draftText || ""} onChange={(e) => updatePart(selectedIndex, { draftText: e.target.value })} className="w-full h-[520px] p-4 border border-slate-200 text-sm leading-relaxed resize-y focus:outline-none focus:border-slate-900" placeholder="Generated full part will appear here. You can edit it manually before approving." />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => updatePart(selectedIndex, { status: "approved" })} disabled={!part.draftText?.trim()} className="flex-1 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 border-none text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-sm disabled:opacity-50"><Check className="w-4 h-4" />Approve Manually</button>
              <button onClick={() => onGeneratePart(selectedIndex)} disabled={isBatchGenerating} className="px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 rounded-sm disabled:opacity-50"><RefreshCw className="w-4 h-4" />Regenerate</button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Full Written Script Preview</label>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadText("written-parts.txt", fullScript)} disabled={!fullScript.trim()} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm disabled:opacity-40"><Download className="w-3 h-3" />Written</button>
                <button onClick={onAssembleScript} disabled={!allApproved} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1 rounded-sm disabled:opacity-40">Assemble Approved</button>
              </div>
            </div>
            <textarea value={fullScript} readOnly className="w-full h-96 p-3 border border-slate-200 bg-slate-50 text-xs font-mono leading-relaxed resize-y text-slate-600" placeholder="All written parts will appear here immediately, even before the full script is approved." />
          </div>
        </div>
      </div>
    </div>
  );
}
