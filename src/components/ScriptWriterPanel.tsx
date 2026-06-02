import React from "react";
import { ScriptPart, StageStatus, AutopilotState } from "../types";
import {
  Check,
  Edit3,
  Trash2,
  RefreshCw,
  Layers,
  Play,
  Square,
  Eraser,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
  onCheckPart,
  onRebuildPart,
  onAssembleScript,
  stageStatus,
  autopilotState,
}: ScriptWriterPanelProps) {
  const [expandedParts, setExpandedParts] = React.useState<
    Record<number, boolean>
  >({});

  // Helper to toggle a part
  const toggleExpand = (idx: number) => {
    setExpandedParts((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Helper to check if a part is expanded
  const isExpanded = (idx: number) => {
    if (expandedParts[idx] !== undefined) {
      return expandedParts[idx];
    }
    const part = parts[idx];
    const isCurrentlyGenerating =
      isBatchGenerating &&
      !part.draftText &&
      idx === parts.findIndex((p) => !p.draftText);
    if (isCurrentlyGenerating) return true;

    // Default: start collapsed if draft text is already present
    return idx === 0 && !part.draftText;
  };

  const toggleExpandAll = (expand: boolean) => {
    const next: Record<number, boolean> = {};
    parts.forEach((_, i) => {
      next[i] = expand;
    });
    setExpandedParts(next);
  };

  const activeGeneratingIdx = isBatchGenerating
    ? parts.findIndex((p) => !p.draftText)
    : -1;

  React.useEffect(() => {
    if (activeGeneratingIdx !== -1) {
      setExpandedParts((prev) => ({ ...prev, [activeGeneratingIdx]: true }));
    }
  }, [activeGeneratingIdx, isBatchGenerating]);

  if (parts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 border border-slate-200 mt-4 shadow-sm p-8 text-center flex-col gap-4">
        <Layers className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 font-medium">
          No script parts found. Ensure Story Plan is approved.
        </p>
      </div>
    );
  }

  const completedParts = parts.filter(
    (p) => p.draftText && p.draftText.length > 0,
  ).length;
  const totalParts = parts.length;
  const progressPercent = (completedParts / totalParts) * 100;
  const allApproved =
    parts.length > 0 && parts.every((p) => p.status === "approved");

  const hasContaminatedParts = parts.some((p) => {
    const text = (p.draftText || "").toLowerCase();
    const report = JSON.stringify(p.supervisorReport || {}).toLowerCase();
    const driftKeywords = [
      "facility",
      "toxic trench",
      "proctor",
      "plasma battery",
      "exoskeleton",
      "dungeon/facility",
    ];
    return driftKeywords.some((kw) => text.includes(kw) || report.includes(kw));
  });

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-4 mt-4 relative">
      {/* Script Progress Toolbar */}
      <div className="sticky top-0 z-10 bg-white border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
              Script Progress
            </span>
            <span className="text-lg font-mono font-bold text-slate-900">
              {completedParts} <span className="text-slate-300">/</span>{" "}
              {totalParts}{" "}
              <span className="text-xs text-slate-500 font-normal ml-1 tracking-tight">
                Parts Written
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isBatchGenerating ? (
              <button
                onClick={onGenerateAllParts}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all shadow-sm cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />{" "}
                {completedParts > 0 ? "Resume Batch" : "Generate All"}
              </button>
            ) : (
              <button
                onClick={onStopBatchGeneration}
                className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all shadow-sm cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" /> Stop
              </button>
            )}
            <button
              onClick={() => toggleExpandAll(true)}
              className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200 cursor-pointer"
              title="Expand all"
            >
              Expand All
            </button>
            <button
              onClick={() => toggleExpandAll(false)}
              className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200 cursor-pointer"
              title="Collapse all"
            >
              Collapse All
            </button>
            <button
              onClick={onClearAllParts}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200 cursor-pointer"
            >
              <Eraser className="w-3 h-3" /> Clear All
            </button>
            <button
              onClick={onInitScriptParts}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider rounded-sm transition-all border border-slate-200 cursor-pointer"
              title="Sync parts list with Story Plan"
            >
              <RefreshCw className="w-3 h-3" /> Sync with Plan
            </button>
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {hasContaminatedParts && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-xs font-medium rounded-sm flex items-start gap-2.5 shadow-sm mx-1">
          <span className="text-sm shrink-0">⚠️</span>
          <div>
            Current script parts were generated before the latest prompt rules. Clear or rebuild them before continuing.
          </div>
        </div>
      )}

      {parts.map((part, idx) => {
        const expanded = isExpanded(idx);
        return (
          <div
            key={idx}
            className="bg-white border border-slate-200 shadow-sm p-4 flex flex-col gap-3 relative overflow-hidden rounded-md"
          >
            {/* Active Generation Overlay */}
            {isBatchGenerating &&
              !part.draftText &&
              idx === parts.findIndex((p) => !p.draftText) && (
                <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 animate-[shimmer_2s_infinite]" />
              )}

            <div
              onClick={() => toggleExpand(idx)}
              className="flex justify-between items-center border-b border-transparent pb-1 cursor-pointer select-none hover:bg-slate-50 transition-colors -mx-4 -mt-4 px-4 py-3 min-w-0"
            >
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0 flex-1 pr-4">
                <span className="shrink-0 text-slate-400 font-mono text-xs font-bold bg-slate-100 px-1 py-0.5 rounded">
                  Part {part.partNumber}
                </span>
                <span
                  className="truncate flex-1 text-slate-850"
                  title={part.partTitle}
                >
                  {part.partTitle}
                </span>
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-[10px] font-normal flex items-center gap-1 text-slate-500 font-sans tracking-normal ml-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={part.isComplete}
                    onChange={(e) =>
                      updatePart(idx, { isComplete: e.target.checked })
                    }
                    className="rounded-sm border-slate-300"
                  />
                  Done?
                </label>
              </h3>
              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  let badgeText = part.status.replace("_", " ");
                  let badgeClass =
                    "bg-slate-50 text-slate-500 border-slate-200";

                  if (
                    autopilotState &&
                    autopilotState.enabled &&
                    autopilotState.currentPartIndex === idx
                  ) {
                    const stepTextMap: Record<string, string> = {
                      generate: "generating part",
                      check: "evaluating",
                      recheck: "evaluating",
                      soft_cleanup: "soft cleanup",
                      repair: "repairing drift",
                      rebuild: "rebuilding from plan",
                      cooldown: "quota cooldown",
                      approved: "approved",
                      blocked: "blocked",
                    };
                    badgeText =
                      stepTextMap[autopilotState.currentStep] ||
                      autopilotState.currentStep;
                    badgeClass =
                      "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse";
                  } else {
                    if (
                      autopilotState &&
                      !autopilotState.enabled &&
                      autopilotState.currentStep === "blocked" &&
                      autopilotState.currentPartIndex === idx
                    ) {
                      badgeText = "blocked after max attempts";
                      badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                    } else if (part.status === "locked") {
                      badgeClass =
                        "bg-emerald-50 text-emerald-700 border-emerald-200";
                    } else if (part.status === "approved") {
                      badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                    } else if (part.status === "needs_repair") {
                      badgeClass =
                        "bg-amber-50 text-amber-700 border-amber-200";
                      if (
                        part.supervisorReport?.status === "needs_serious_repair"
                      ) {
                        badgeText = "hard drift found";
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                      }
                    } else if (
                      part.status === "not_started" &&
                      autopilotState &&
                      autopilotState.enabled &&
                      idx > autopilotState.currentPartIndex
                    ) {
                      badgeText = "waiting";
                    }
                  }

                  return (
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border rounded-sm ${badgeClass}`}
                    >
                      {badgeText}
                    </span>
                  );
                })()}

                <div className="flex items-center gap-1 ml-2">
                  {onRebuildPart &&
                    part.status === "needs_repair" &&
                    part.supervisorReport?.status ===
                      "needs_serious_repair" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRebuildPart(idx);
                        }}
                        className="px-2 py-1 text-[10px] font-bold tracking-wide uppercase bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-sm transition-colors cursor-pointer mr-1"
                        title="Rebuild This Part From Plan"
                      >
                        Rebuild From Plan
                      </button>
                    )}
                  {part.status !== "locked" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onGeneratePart(idx);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      title="Generate Part"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {part.draftText && part.status !== "locked" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearPart(idx);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Clear Part"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(idx);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer ml-1"
                >
                  {expanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            {expanded && (
              <>
                <div className="text-[12px] text-slate-600 bg-slate-50 p-3 border border-slate-100 rounded leading-relaxed mt-1">
                  <span className="font-bold text-slate-800">Part Focus:</span>{" "}
                  {part.partTitle}
                </div>
                <div className="relative group mt-2">
                  <textarea
                    className="w-full min-h-[140px] text-[13px] text-slate-700 leading-relaxed resize-y focus:outline-none focus:border-blue-500 p-2 border border-slate-200 hover:border-slate-300 rounded bg-slate-50/50 font-serif"
                    value={part.draftText}
                    onChange={(e) => {
                      const updates: Partial<ScriptPart> = {
                        draftText: e.target.value,
                      };
                      if (part.status === "approved") {
                        updates.status = "generated";
                      }
                      updates.validationIssues = [];
                      updates.supervisorReport = undefined;
                      updatePart(idx, updates);
                      onStopBatchGeneration();
                    }}
                    placeholder={`Draft content for Part ${part.partNumber}...`}
                    disabled={part.status === "locked"}
                  />
                  {((isBatchGenerating &&
                    !part.draftText &&
                    idx === parts.findIndex((p) => !p.draftText)) ||
                    (autopilotState?.enabled &&
                      autopilotState.currentPartIndex === idx)) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] z-10">
                      <div className="flex items-center gap-3 bg-white px-6 py-3 shadow-xl border border-slate-200 rounded-full">
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                          {autopilotState?.enabled &&
                          autopilotState.currentPartIndex === idx
                            ? `${autopilotState.currentStep} Part ${part.partNumber}...`
                            : `Writing Part ${part.partNumber}...`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-[10px] font-mono text-slate-400">
                    {part.wordOrCharacterCount} chars | {part.avatarCount}{" "}
                    avatars |
                    {part.hasGenerationResidue ? (
                      <span className="text-rose-500 ml-1">
                        Residue Detected
                      </span>
                    ) : (
                      <span className="text-emerald-500 ml-1">No Residue</span>
                    )}
                  </div>
                  {part.draftText && part.status !== "locked" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onCheckPart(idx)}
                        className="text-[11px] font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200 transition-colors"
                      >
                        Check & Approve
                      </button>
                    </div>
                  )}
                </div>

                {part.validationIssues && part.validationIssues.length > 0 && (
                  <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded">
                    <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">
                      Validation Issues
                    </div>
                    <ul className="text-[11px] text-rose-600 list-disc list-inside space-y-0.5">
                      {part.validationIssues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      <div className="pt-4 pb-12 flex flex-col items-center gap-2">
        {!allApproved && (
          <div className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-4 py-2 rounded shadow-sm text-center">
            ⚠️ All script parts must pass Check & Approve before assembly.
          </div>
        )}
        <button
          onClick={onAssembleScript}
          disabled={!allApproved}
          title={
            !allApproved
              ? "All script parts must pass Check & Approve before assembly."
              : "Assemble Full Script"
          }
          className="px-8 py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
        >
          <Layers className="w-4 h-4" /> Assemble Full Script
        </button>
      </div>
    </div>
  );
}
