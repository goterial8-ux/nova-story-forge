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

I will give you the Story Plan and Scene Cards. Use them as the only source for the script.

When I ask you to write Part 1, Part 2, and so on, write the full script for that exact part using the matching plan and scene cards.

Do not create a new structure.
Do not rewrite the plan.
Do not compress the part into a short summary.
Do not explain what you are doing.
Output only the finished script text.

Script format:
- Script language: English.
- Main voice: first person from the main character when the scene follows his direct experience, actions, thoughts, fear, decisions, or observations.
- Third person is allowed when showing other characters, enemy reactions, crowd reactions, family reactions, political consequences, large events, or things happening outside the main character's direct view.
- Style: YouTube manga/manhwa recap voiceover.
- The script must sound dramatic, visual, clear, emotional, and easy to hear in a video.

Length:
- One command = one complete part.
- Normal part length: 12,000-15,000 characters including spaces, unless I give another range.
- Do not finish too early.
- If you only mention each planned event once, that is not enough.
- Each important scene must be expanded through action, reaction, consequence, pressure, and payoff.

Style:
- Write simply, clearly, dramatically, and visually.
- Do not write a dry summary.
- Do not write like a report.
- Do not write like analysis.
- Do not write decorative novel prose that describes things only for beauty.
- Do not remove dramatic atmosphere when it increases hunger, danger, fear, family pressure, memory, humiliation, survival tension, or the cost of a decision.
- Rhythm: pressure -> action -> reaction -> result -> new pressure.

Paragraphs:
- Each normal paragraph should be comfortable for voiceover.
- Target paragraph length: 120-220 characters including spaces.
- One paragraph usually contains 2-4 short sentences.
- Do not write giant paragraphs.
- Do not put every short sentence on a new line.
- One paragraph = one visual beat.

Scene expansion:
- Do not turn scene cards into a checklist.
- Each important scene card should become a sequence of beats.
- Show the situation, threat, what the character notices, what the character does, what changes, who reacts, what result appears, and what new pressure begins.
- Do not remove important background from the plan.
- If the plan mentions childhood, father, mother, family, poverty, debt, humiliation, training, fear, old wounds, personal failure, or past lessons, use it through action and situation.

Clean output rule:
- Do not output broken placeholder words or prompt residue.
- These words are allowed only when they naturally belong to the sentence: main, show, one, style, card, face, hook, exit.
- Never use them as broken placeholders, character-name replacements, uppercase residue, or random standalone fragments.

Bad examples:
Main turned around.
Show looked at me.
ONE string.
STYLE breathing too fast.
Card, clean water.
Leave. Now. Face.
Hook the deer shifted routes.
Exit spirits.

Good examples:
Mio turned around.
She looked at me.
One string hung loose from the bow.
I was breathing too fast.
The water was clean.
I had to leave now.
The deer shifted routes before a storm.
The old path led toward the exit.

Before sending the final script, silently scan the whole output.
If Main appears as a character name, replace it with the correct locked name.
If Show appears instead of she/her, rewrite the sentence.
If ONE, STYLE, Card, Face, Hook, or Exit appears as residue, rewrite that sentence naturally.

Do not output system messages.
Do not output provider error messages.
Do not output Chinese termination messages.
Do not change character names.
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

  if (previousParts.length === 0) {
    return "None. This is the first written part.";
  }

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
  const sceneCards =
    part.manualSceneCards?.trim() ||
    part.sourceSceneCards?.trim() ||
    "[CURRENT PART SCENE CARDS ARE EMPTY]";
  const previousPartsContext = buildPreviousWrittenPartsPreview(parts, selectedIndex);
  const extra = part.manualExtraInstruction?.trim() || "No extra instruction.";

  return `You are a YouTube manga/manhwa recap scriptwriter.

Write only the selected script part.

Part:
Part ${part.partNumber} — ${part.partTitle}

Target length:
${target}

=== CURRENT PART PLAN ===
${partPlan}

=== CURRENT PART SCENE CARDS ===
${sceneCards}

=== PREVIOUS WRITTEN PARTS CONTEXT ===
${previousPartsContext}

Use previous parts only as continuity memory. Do not rewrite them in the answer.

=== STYLE RULES ===
${styleRules}

=== EXTRA INSTRUCTION ===
${extra}

Command:
Write the full Part ${part.partNumber}.
Use Current Part Plan and Current Part Scene Cards as the foundation.
Follow the style rules and target length.
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
  const promptPreview = buildManualPromptPreview(parts, selectedIndex);
  const manualPartPlanValue = part.manualPartPlan ?? part.sourcePartPlan ?? "";
  const manualSceneCardsValue = part.manualSceneCards ?? part.sourceSceneCards ?? "";
  const manualStyleValue = part.manualStyleRules ?? DEFAULT_STYLE_RULES;
  const manualTargetValue = part.manualTargetChars ?? "12,000-15,000 characters including spaces";

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

  const previousPartsContext = buildPreviousWrittenPartsPreview(parts, selectedIndex);

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
              className="px-3 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-xs font-bold uppercase tracking-wide flex items-center gap-2 rounded-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Parts
            </button>
            <button
              onClick={onClearAllParts}
              disabled={isBatchGenerating}
              className="px-3 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 text-xs font-bold uppercase tracking-wide flex items-center gap-2 rounded-sm disabled:opacity-50"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear All Outputs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
          <div className="border border-slate-200 rounded-sm overflow-hidden bg-slate-50 max-h-64 overflow-y-auto">
            {parts.map((p, idx) => (
              <button
                key={p.partNumber}
                onClick={() => setSelectedIndex(idx)}
                className={`w-full text-left p-3 border-b border-slate-200 last:border-b-0 transition ${
                  idx === selectedIndex ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <div className="text-[10px] uppercase font-black tracking-widest opacity-70">
                      Part {p.partNumber}
                    </div>
                    <div className="text-xs font-bold line-clamp-2 mt-1">{p.partTitle}</div>
                  </div>
                  <span
                    className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-sm ${
                      p.draftText?.trim()
                        ? idx === selectedIndex
                          ? "bg-white/20 text-white"
                          : "bg-emerald-50 text-emerald-700"
                        : idx === selectedIndex
                        ? "bg-white/10 text-white/80"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {p.draftText?.trim() ? p.status : "empty"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
              <div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Parts</div>
              <div className="font-black text-lg text-slate-900">{parts.length}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
              <div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Written</div>
              <div className="font-black text-lg text-slate-900">{writtenParts}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
              <div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Approved</div>
              <div className="font-black text-lg text-slate-900">{approvedParts}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
              <div className="uppercase text-[9px] tracking-widest text-slate-400 font-black">Stage</div>
              <div className="font-black text-lg text-slate-900 uppercase">{stageStatus}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto pr-1 pb-6">
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Current Part Plan
            </label>
            <textarea
              value={manualPartPlanValue}
              onChange={(e) => updatePart(selectedIndex, { manualPartPlan: e.target.value })}
              className="w-full h-44 p-3 border border-slate-200 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-slate-900"
              placeholder="Auto-filled from Story Plan, or paste the current part plan manually."
            />
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Current Part Scene Cards
            </label>
            <textarea
              value={manualSceneCardsValue}
              onChange={(e) => updatePart(selectedIndex, { manualSceneCards: e.target.value })}
              className="w-full h-56 p-3 border border-slate-200 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-slate-900"
              placeholder="Auto-filled from Scene Cards, or paste the current part scene cards manually."
            />
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Previous Written Parts Context
            </label>
            <textarea
              value={previousPartsContext}
              readOnly
              className="w-full h-36 p-3 border border-slate-200 bg-slate-50 text-xs font-mono leading-relaxed resize-y text-slate-600"
            />
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Style Rules
            </label>
            <textarea
              value={manualStyleValue}
              onChange={(e) => updatePart(selectedIndex, { manualStyleRules: e.target.value })}
              className="w-full h-72 p-3 border border-slate-200 text-xs font-mono leading-relaxed resize-y focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
                Target Characters
              </label>
              <input
                value={manualTargetValue}
                onChange={(e) => updatePart(selectedIndex, { manualTargetChars: e.target.value })}
                className="w-full p-3 border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
                Part Status
              </label>
              <select
                value={part.status}
                onChange={(e) => updatePart(selectedIndex, { status: e.target.value as StageStatus })}
                className="w-full p-3 border border-slate-200 text-sm font-bold uppercase focus:outline-none focus:border-slate-900 bg-white"
              >
                <option value="not_started">not_started</option>
                <option value="generated">generated</option>
                <option value="needs_repair">needs_repair</option>
                <option value="approved">approved</option>
                <option value="locked">locked</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
                Extra Instruction
              </label>
              <textarea
                value={part.manualExtraInstruction ?? ""}
                onChange={(e) => updatePart(selectedIndex, { manualExtraInstruction: e.target.value })}
                className="w-full h-28 p-3 border border-slate-200 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-slate-900"
                placeholder="Optional: exact locked names, extra style notes, or current correction for this part."
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                Prompt Preview
              </label>
              <button
                onClick={copyPrompt}
                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm"
              >
                <Clipboard className="w-3 h-3" />
                {copiedPrompt ? "Copied" : "Copy Prompt"}
              </button>
            </div>
            <textarea
              value={promptPreview}
              readOnly
              className="w-full h-72 p-3 border border-slate-200 bg-slate-50 text-[11px] font-mono leading-relaxed resize-y text-slate-600"
            />
            <button
              onClick={() => onGeneratePart(selectedIndex)}
              disabled={isBatchGenerating}
              className="mt-3 w-full px-4 py-3 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-sm disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4" />
              Generate Full Part
            </button>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                Generated / Editable Output
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyOutput}
                  disabled={!part.draftText}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm disabled:opacity-40"
                >
                  <Clipboard className="w-3 h-3" />
                  {copiedOutput ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => downloadText(`part-${part.partNumber}.txt`, part.draftText || "")}
                  disabled={!part.draftText}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm disabled:opacity-40"
                >
                  <Download className="w-3 h-3" />
                  Part
                </button>
                <button
                  onClick={() => onClearPart(selectedIndex)}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 rounded-sm"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              </div>
            </div>
            <textarea
              value={part.draftText || ""}
              onChange={(e) => updatePart(selectedIndex, { draftText: e.target.value })}
              className="w-full h-[520px] p-4 border border-slate-200 text-sm leading-relaxed resize-y focus:outline-none focus:border-slate-900"
              placeholder="Generated full part will appear here. You can edit it manually before approving."
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => updatePart(selectedIndex, { status: "approved" })}
                disabled={!part.draftText?.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 border-none text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-sm disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Approve Manually
              </button>
              <button
                onClick={() => onGeneratePart(selectedIndex)}
                disabled={isBatchGenerating}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 rounded-sm disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                Full Written Script Preview
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadText("written-parts.txt", fullScript)}
                  disabled={!fullScript.trim()}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-200 hover:bg-slate-50 flex items-center gap-1 rounded-sm disabled:opacity-40"
                >
                  <Download className="w-3 h-3" />
                  Written
                </button>
                <button
                  onClick={onAssembleScript}
                  disabled={!allApproved}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1 rounded-sm disabled:opacity-40"
                >
                  Assemble Approved
                </button>
              </div>
            </div>
            <textarea
              value={fullScript}
              readOnly
              className="w-full h-96 p-3 border border-slate-200 bg-slate-50 text-xs font-mono leading-relaxed resize-y text-slate-600"
              placeholder="All written parts will appear here immediately, even before the full script is approved."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
