import React, { useState, useEffect, useRef } from "react";
import {
  INITIAL_STATE,
  ProjectState,
  StageId,
  StageStatus,
  SupervisorReport,
  CleanExportSettings,
  ScriptPart,
  STAGES,
} from "./types";
import { TopBar } from "./components/TopBar";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { SupervisorPanel } from "./components/SupervisorPanel";
import { Bug, X } from "lucide-react";
import { saveProjectState, loadProjectState } from "./lib/db";
import {
  mergeSupervisorReportWithValidation,
  normalizeScriptDraft,
  validateScriptText,
  validationIssueSummary,
} from "./lib/scriptValidation";

function getScriptPartValidationPatch(draftText: string, isClaudeLite?: boolean): Partial<ScriptPart> {
  const normalizedDraftText = normalizeScriptDraft(draftText);
  const validation = validateScriptText(
    normalizedDraftText,
    "script_part",
    isClaudeLite,
  );
  return {
    wordOrCharacterCount: validation.characterCount,
    avatarCount: validation.avatarCount,
    hasGenerationResidue: validation.hasGenerationResidue,
    hasDuplicateBlocks: validation.hasDuplicateBlocks,
    isComplete: validation.ok,
    validationIssues: validation.issues.map(
      (issue) =>
        `${issue.severity.toUpperCase()} [${issue.code}] ${issue.message}`,
    ),
  };
}

function compactStateForStorage(inputState: ProjectState): ProjectState {
  // Return a shallow copy to prevent modifying active react state
  const compacted = { ...inputState };

  if (compacted.promptHistory) {
    compacted.promptHistory = compacted.promptHistory.map((entry) => {
      let promptPreview = entry.promptUsed;
      if (typeof promptPreview === "string" && promptPreview.length > 800) {
        promptPreview =
          promptPreview.substring(0, 800) +
          "...\n[PROMPT TRUNCATED FOR STORAGE EFFICIENCY]";
      }
      return {
        ...entry,
        promptUsed: promptPreview,
      };
    });

    // Limit history list size to last 15 items to avoid storage bloat
    if (compacted.promptHistory.length > 15) {
      compacted.promptHistory = compacted.promptHistory.slice(0, 15);
    }
  }

  return compacted;
}

export default function App() {
  const [state, setState] = useState<ProjectState>(() => {
    const saved = localStorage.getItem("studio_writer_project");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure registry is always present from template even if old state didn't have it
        if (!parsed.promptRegistry) {
          parsed.promptRegistry = INITIAL_STATE.promptRegistry;
        } else {
          // Force upgrade core rules if missing new genre anchors
          if (
            !parsed.promptRegistry.globalRulesPrompt.includes(
              "GENERAL STORY AND SCENE QUALITY MODULE",
            ) ||
            !parsed.promptRegistry.globalRulesPrompt.includes(
              "ЗАПРЕТ НА СКУКУ",
            ) ||
            !parsed.promptRegistry.globalRulesPrompt.includes(
              "УНИВЕРСАЛЬНОЕ ПРАВИЛО: ЖИВОЙ РАССКАЗЧИК ОТ ПЕРВОГО ЛИЦА",
            ) ||
            !parsed.promptRegistry.globalRulesPrompt.includes(
              "TENSION RHYTHM — NON-NEGOTIABLE",
            ) ||
            !parsed.promptRegistry.globalRulesPrompt.includes(
              "MAGIC, REAL KNOWLEDGE AND LIVING PROTAGONIST RULE",
            )
          ) {
            parsed.promptRegistry.globalRulesPrompt =
              INITIAL_STATE.promptRegistry.globalRulesPrompt;
          }
          if (
            !parsed.promptRegistry.aiSupervisorPrompt.includes(
              "GENRE DRIFT FIX FORMAT",
            ) ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes(
              "STYLE CRITIC PASS",
            ) ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes("всесильный") ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes(
              "Скучно/уныло?",
            ) ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes(
              "adjective soup",
            ) ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes(
              "detached robot",
            ) ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes("lazy") ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes("Raw Idea") ||
            !parsed.promptRegistry.aiSupervisorPrompt.includes("TEXTBOOK TRAP")
          ) {
            parsed.promptRegistry.aiSupervisorPrompt =
              INITIAL_STATE.promptRegistry.aiSupervisorPrompt;
          }
          if (!parsed.promptRegistry.stageStyleAnalyzerPrompt) {
            parsed.promptRegistry.stageStyleAnalyzerPrompt =
              INITIAL_STATE.promptRegistry.stageStyleAnalyzerPrompt;
            parsed.promptRegistry.stageStyleAnalyzerExampleResponse =
              INITIAL_STATE.promptRegistry.stageStyleAnalyzerExampleResponse;
          }
          if (
            !parsed.promptRegistry.stageFiveScriptWriterPrompt ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "ADJECTIVE DISCIPLINE",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "АНТИ-ИМБА",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "ЗАПРЕТ НА СКУКУ И УНЫЛОСТЬ",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "COMPETITOR NARRATIVE STYLE",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "ZERO TOLERANCE FOR FLUFF",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "HOW TO REACH 10,000+ CHARACTERS WITHOUT FLUFF",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "TEXTBOOK",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "ЖИВОЙ РАССКАЗЧИК",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "SENTENCE RULES — NON-NEGOTIABLE",
            ) ||
            !parsed.promptRegistry.stageFiveScriptWriterPrompt.includes(
              "FACE SLAP / PAYOFF CHECKLIST (ADAPT TO SCENE)",
            )
          ) {
            parsed.promptRegistry.stageFiveScriptWriterPrompt =
              INITIAL_STATE.promptRegistry.stageFiveScriptWriterPrompt;
          }
          if (!parsed.autopilotState) {
            parsed.autopilotState = INITIAL_STATE.autopilotState;
          } else {
            if (parsed.autopilotState.repairAttemptsByPart === undefined) parsed.autopilotState.repairAttemptsByPart = {};
            if (parsed.autopilotState.rebuildAttemptsByPart === undefined) parsed.autopilotState.rebuildAttemptsByPart = {};
            if (parsed.autopilotState.cleanupAttemptsByPart === undefined) parsed.autopilotState.cleanupAttemptsByPart = {};
            if (parsed.autopilotState.rateLimitAttempts === undefined) parsed.autopilotState.rateLimitAttempts = 0;
            if (parsed.autopilotState.retryAfterAt === undefined) parsed.autopilotState.retryAfterAt = null;
            if (parsed.autopilotState.lastError === undefined) parsed.autopilotState.lastError = null;
            if (parsed.autopilotState.lastSupervisorReport === undefined) parsed.autopilotState.lastSupervisorReport = null;
          }
          if (parsed.claudeLiteMode === undefined) {
            parsed.claudeLiteMode = true;
          }
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse saved state", e);
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });
  const stateRef = useRef<ProjectState>(state);

  const [currentStageId, setCurrentStageId] = useState<StageId>(() => {
    return (
      (localStorage.getItem("studio_writer_stage") as StageId) || "idea_market"
    );
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    stopRequestedRef.current = stopRequested;
  }, [stopRequested]);
  const [warningMessage, setWarningMessageRaw] = useState<string | null>(null);
  const setWarningMessage = (msg: any) => {
    if (msg === null) {
      setWarningMessageRaw(null);
    } else if (typeof msg === "object") {
      try {
        const actualMsg =
          msg.message && typeof msg.message === "string"
            ? msg.message
            : JSON.stringify(msg);
        setWarningMessageRaw(actualMsg);
      } catch {
        setWarningMessageRaw(String(msg));
      }
    } else {
      setWarningMessageRaw(String(msg));
    }
  };
  const [showDebug, setShowDebug] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle",
  );
  const [generationAttempt, setGenerationAttempt] = useState<number>(0);
  const [generationMaxAttempts] = useState<number>(10);

  const fetchWithRetry = async (
    url: string,
    options: RequestInit,
    maxAttempts = 10,
    timeoutMs = 300000,
  ): Promise<any> => {
    let attempt = 0;
    const actualTimeoutMs =
      typeof timeoutMs === "number" && !isNaN(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : 300000;

    while (attempt < maxAttempts) {
      attempt++;
      setGenerationAttempt(attempt);
      console.log(`Fetch attempt ${attempt} of ${maxAttempts} for ${url}`);

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, actualTimeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const raw = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error("Backend non-JSON response on attempt", attempt, raw);
          throw new Error(
            "Backend returned non-JSON response. Intermediary service timeout. Retrying...",
          );
        }

        if (!response.ok) {
          const errMsg =
            typeof parsed.error === "object"
              ? JSON.stringify(parsed.error)
              : parsed.error || `HTTP ${response.status} Error`;
          throw new Error(errMsg);
        }

        if (parsed.success === false) {
          const errMsg =
            typeof parsed.error === "object"
              ? JSON.stringify(parsed.error)
              : parsed.error || "Generation failed";
          throw new Error(errMsg);
        }

        // Success!
        setGenerationAttempt(0);
        return parsed;
      } catch (err: any) {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        console.warn(`Attempt ${attempt} failed after ${elapsed}ms:`, err);

        // If batch or user stopped, abort
        if (stopRequestedRef.current) {
          setGenerationAttempt(0);
          throw new Error("Generation stopped by user.");
        }

        if (attempt >= maxAttempts) {
          setGenerationAttempt(0);
          throw err;
        }

        // Show a temporary visual message of retrying
        const errorMessage = String(err.message || err);
        let waitTime = 2000;

        // A transient abort is an AbortError that happened before the actual timeout period (e.g. browser tab suspended, server restarted)
        const isTransientAbort =
          (err.name === "AbortError" ||
            errorMessage.includes("abort") ||
            errorMessage.includes("Abort")) &&
          elapsed < actualTimeoutMs - 5000;

        if (
          errorMessage.includes("429") ||
          errorMessage.includes("RESOURCE_EXHAUSTED")
        ) {
          waitTime = Math.min(5000 * Math.pow(2, attempt - 1), 60000);
          setWarningMessage(
            `Rate limit hit. Retrying in ${waitTime / 1000}s... (Attempt ${attempt} of ${maxAttempts})`,
          );
        } else if (!isTransientAbort || attempt > 2) {
          // Suppress visual warnings for early transient browser/server-reconnect aborts so it doesn't alarm the user
          setWarningMessage(
            `Attempt ${attempt} of ${maxAttempts} timed out or failed. Retrying...`,
          );
        }

        setTimeout(
          () => setWarningMessage(null),
          waitTime > 500 ? waitTime - 500 : 3500,
        );

        // Wait with a dynamic backoff before retrying
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
    setGenerationAttempt(0);
    throw new Error("Maximum generation attempts reached.");
  };

  const [isLoadingReferences, setIsLoadingReferences] = useState(false);

  const handleLoadBuiltInReferences = async (force = false) => {
    if (isLoadingReferences) return;
    const current = stateRef.current;
    if (
      !force &&
      (current.referenceLibraryLoaded || current.competitors.trim())
    )
      return;

    setIsLoadingReferences(true);
    try {
      const { loadBuiltInReferencePack } =
        await import("./lib/referenceLibrary");
      const referencePack = await loadBuiltInReferencePack();
      updateState({
        competitors: referencePack,
        referenceLibraryLoaded: true,
      });
    } catch (err: any) {
      console.error("Failed to load built-in references:", err);
      setWarningMessage(err.message || "Failed to load built-in references.");
      setTimeout(() => setWarningMessage(null), 5000);
    } finally {
      setIsLoadingReferences(false);
    }
  };

  useEffect(() => {
    if (
      !state.referenceLibraryLoaded &&
      !state.competitors.trim() &&
      !isLoadingReferences
    ) {
      handleLoadBuiltInReferences(false);
    }
  }, [state.referenceLibraryLoaded, state.competitors, isLoadingReferences]);

  useEffect(() => {
    loadProjectState("studio_writer_project")
      .then((dbState) => {
        if (dbState && dbState.promptHistory) {
          console.log("Restored project state from IndexedDB backup.");
          if (dbState.referenceLibraryLoaded === undefined) {
            dbState.referenceLibraryLoaded = Boolean(
              dbState.competitors && dbState.competitors.trim(),
            );
          }
          if (dbState.ideaMode === undefined) {
            dbState.ideaMode = "develop_raw_idea";
            dbState.marketResearch = "";
          }
          let needsUpdate = false;
          if (dbState.claudeLiteMode === undefined) {
            dbState.claudeLiteMode = true;
            needsUpdate = true;
          }
          if (dbState.autopilotState === undefined) {
            dbState.autopilotState = {
              enabled: false,
              currentPartIndex: 0,
              currentStep: "generate",
              retryAfterAt: null,
              repairAttemptsByPart: {},
              rebuildAttemptsByPart: {},
              cleanupAttemptsByPart: {},
              rateLimitAttempts: 0,
              lastError: null,
              lastSupervisorReport: null,
            };
            needsUpdate = true;
          } else {
            if (dbState.autopilotState.repairAttemptsByPart === undefined) {
              dbState.autopilotState.repairAttemptsByPart = {};
              needsUpdate = true;
            }
            if (dbState.autopilotState.rebuildAttemptsByPart === undefined) {
              dbState.autopilotState.rebuildAttemptsByPart = {};
              needsUpdate = true;
            }
            if (dbState.autopilotState.cleanupAttemptsByPart === undefined) {
              dbState.autopilotState.cleanupAttemptsByPart = {};
              needsUpdate = true;
            }
            if (dbState.autopilotState.rateLimitAttempts === undefined) {
              dbState.autopilotState.rateLimitAttempts = 0;
              needsUpdate = true;
            }
            if (dbState.autopilotState.retryAfterAt === undefined) {
              dbState.autopilotState.retryAfterAt = null;
              needsUpdate = true;
            }
            if (dbState.autopilotState.lastError === undefined) {
              dbState.autopilotState.lastError = null;
              needsUpdate = true;
            }
            if (dbState.autopilotState.lastSupervisorReport === undefined) {
              dbState.autopilotState.lastSupervisorReport = null;
              needsUpdate = true;
            }
          }
          ["idea_market"].forEach((stage) => {
            if (!(stage in dbState.supervisorReports)) {
              dbState.supervisorReports[stage] = null;
              dbState.stageStatuses[stage] = "not_started";
              dbState.handoffSummaries[stage] = "";
              dbState.lastGeneratedAt[stage] = null;
              dbState.lastEditedAt[stage] = null;
              needsUpdate = true;
            }
          });
          setState(dbState);
          stateRef.current = dbState;
          if (needsUpdate) {
            saveProjectState("studio_writer_project", dbState);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to restore state from IndexedDB:", err);
      });
  }, []);

  const autopilotTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autopilotRunningRef = useRef(false);

  useEffect(() => {
    // Determine if autopilot should run
    if (!state.autopilotState?.enabled) {
      if (autopilotTimeoutRef.current)
        clearTimeout(autopilotTimeoutRef.current);
      setIsBatchGenerating(false);
      return;
    }

    if (autopilotRunningRef.current) {
      return;
    }

    const runAutopilotStep = async () => {
      if (!stateRef.current.autopilotState?.enabled) return;
      autopilotRunningRef.current = true;
      try {
        const currentAP = stateRef.current.autopilotState;
        if (!currentAP || !currentAP.enabled) return;

        const {
          currentPartIndex,
          currentStep,
          retryAfterAt,
          repairAttemptsByPart,
          rateLimitAttempts,
        } = currentAP;
        const parts = stateRef.current.scriptParts;

        if (currentPartIndex >= parts.length) {
          // Autopilot finished all parts
          const allApproved = parts.every((p) => p.status === "approved");
          if (allApproved) {
            updateState({
              autopilotState: {
                ...currentAP,
                enabled: false,
                currentStep: "approved",
              },
            });
            handleAssembleScript();
          } else {
            updateState({
              autopilotState: {
                ...currentAP,
                enabled: false,
                currentStep: "blocked",
                lastError: "Some parts are not approved.",
              },
            });
            setWarningMessage(
              "Autopilot stopped. Some parts could not be approved.",
            );
          }
          return;
        }

        const currentPart = parts[currentPartIndex];

        if (currentStep === "cooldown") {
          if (retryAfterAt && Date.now() >= retryAfterAt) {
            updateState({
              autopilotState: {
                ...currentAP,
                currentStep:
                  currentPart.status === "not_started" || !currentPart.draftText
                    ? "generate"
                    : "check",
                retryAfterAt: null,
              },
            });
          }
          return;
        }

        if (stopRequestedRef.current) {
          updateState({
            autopilotState: {
              ...currentAP,
              enabled: false,
              currentStep: "blocked",
              lastError: "Stopped by user.",
            },
          });
          setWarningMessage(
            `Autopilot stopped safely at Part ${currentPart.partNumber}.`,
          );
          return;
        }

        setIsBatchGenerating(true);

        if (currentStep === "generate") {
          if (!currentPart.draftText || currentPart.draftText.length === 0) {
            const success = await handleGeneratePart(currentPartIndex);
            if (!success) throw new Error("Generation returned false");
          }

          updateState({
            autopilotState: { ...currentAP, currentStep: "check" },
          });
          // Batch delay after gen
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } else if (currentStep === "check" || currentStep === "recheck") {
          const { buildSupervisorPrompt } = await import("./lib/PromptBuilder");
          const promptUsed = buildSupervisorPrompt(
            "script_writer",
            stateRef.current.scriptParts[currentPartIndex].draftText,
            stateRef.current,
          );

          const analyzeData = await fetchWithRetry("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptUsed, type: "supervisor" }),
          });

          let aiReport = analyzeData.parsed as SupervisorReport;
          if (!aiReport) {
            throw new Error("AI supervisor report cannot be parsed");
          }

          const { validateScriptText } = await import("./lib/scriptValidation");
          const normalizedCurrentPartText = normalizeScriptDraft(
            stateRef.current.scriptParts[currentPartIndex].draftText,
          );
          const localScriptVal = validateScriptText(
            normalizedCurrentPartText,
            "script_part",
            stateRef.current.claudeLiteMode !== false,
          );
          import("./lib/stageValidation").then((mod) => {
            const { mergeSupervisorReportWithValidation } = mod as any;
            if (typeof mergeSupervisorReportWithValidation !== "undefined") {
              // Not used directly here since types changed, we do it inline:
            }
          });

          // Custom merge since we don't safely expose `mergeSupervisorReportWithValidation` easily from App, actually we do via import:
          const validationMod = await import("./lib/scriptValidation");
          let mergedReport = validationMod.mergeSupervisorReportWithValidation(
            aiReport,
            localScriptVal,
            stateRef.current.claudeLiteMode,
          );

          const isApproved =
            mergedReport.status === "ok" &&
            mergedReport.canContinue === true;

          if (isApproved) {
            updateScriptPart(currentPartIndex, {
              status: "approved",
              supervisorReport: mergedReport,
            });
            updateState({
              autopilotState: {
                ...stateRef.current.autopilotState,
                currentStep: "approved",
                lastSupervisorReport: mergedReport,
              },
            });
          } else {
            const hasHardDrift = validationMod.detectHardDrift(localScriptVal, aiReport);
            const nextStep = (hasHardDrift || stateRef.current.claudeLiteMode)
              ? "rebuild"
              : mergedReport.status === "needs_small_repair"
                ? "soft_cleanup"
                : "repair";
            mergedReport.canContinue = false;
            updateScriptPart(currentPartIndex, {
              status: "needs_repair",
              supervisorReport: mergedReport,
            });
            updateState({
              autopilotState: {
                ...stateRef.current.autopilotState,
                currentStep: nextStep,
                lastSupervisorReport: mergedReport,
              },
            });
          }
        } else if (currentStep === "soft_cleanup") {
          const attempts =
            currentAP.cleanupAttemptsByPart[currentPartIndex] || 0;
          if (attempts >= 1) {
            // Upgrade to repair if cleanup failed
            updateState({
              autopilotState: { ...currentAP, currentStep: "repair" },
            });
            return;
          }

          const { buildSoftCleanupPrompt } =
            await import("./lib/PromptBuilder");
          const cleanPrompt = buildSoftCleanupPrompt(
            currentPart.draftText,
            currentAP.lastSupervisorReport,
          );
          const cleanData = await fetchWithRetry("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: cleanPrompt,
              type: "text",
              stageId: "script_writer",
            }),
          });

          const newText = normalizeScriptDraft(cleanData.text);
          const patch = getScriptPartValidationPatch(newText, stateRef.current.claudeLiteMode !== false);
          updateScriptPart(currentPartIndex, {
            status: "generated",
            draftText: newText,
            ...patch,
          });
          updateState({
            autopilotState: {
              ...stateRef.current.autopilotState,
              currentStep: "recheck",
              cleanupAttemptsByPart: {
                ...currentAP.cleanupAttemptsByPart,
                [currentPartIndex]: attempts + 1,
              },
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 20000));
        } else if (currentStep === "repair") {
          const attempts =
            currentAP.repairAttemptsByPart[currentPartIndex] || 0;
          if (attempts >= 1) {
            updateState({
              autopilotState: { ...currentAP, currentStep: "rebuild" },
            });
            return;
          }

          const { buildRepairPrompt } = await import("./lib/PromptBuilder");
          const repPrompt = buildRepairPrompt(
            "script_writer",
            currentPart.draftText,
            currentAP.lastSupervisorReport as SupervisorReport,
            stateRef.current,
            currentPart.partNumber,
          );
          const repairData = await fetchWithRetry("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: repPrompt,
              type: "text",
              stageId: "script_writer",
            }),
          });

          const newText = normalizeScriptDraft(repairData.text);
          const patch = getScriptPartValidationPatch(newText, stateRef.current.claudeLiteMode !== false);
          updateScriptPart(currentPartIndex, {
            status: "generated",
            draftText: newText,
            ...patch,
          });
          updateState({
            autopilotState: {
              ...stateRef.current.autopilotState,
              currentStep: "recheck",
              repairAttemptsByPart: {
                ...currentAP.repairAttemptsByPart,
                [currentPartIndex]: attempts + 1,
              },
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } else if (currentStep === "rebuild") {
          const attempts =
            currentAP.rebuildAttemptsByPart[currentPartIndex] || 0;
          const maxRebuilds = stateRef.current.claudeLiteMode ? 1 : 2;
          if (attempts >= maxRebuilds) {
            updateState({
              autopilotState: {
                ...currentAP,
                enabled: false,
                currentStep: "blocked",
                lastError: `Max rebuild attempts (${maxRebuilds}) exceeded for Part ${currentPart.partNumber}.`,
              },
            });
            setWarningMessage(
              `Autopilot stopped. Part ${currentPart.partNumber} blocked after hard failure.`,
            );
            setIsBatchGenerating(false);
            return;
          }

          const { buildRebuildPrompt } = await import("./lib/PromptBuilder");
          const rebPrompt = buildRebuildPrompt(
            currentPart.partNumber,
            stateRef.current,
            currentAP.lastSupervisorReport,
          );
          const rebuildData = await fetchWithRetry("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: rebPrompt,
              type: "text",
              stageId: "script_writer",
            }),
          });

          const newText = normalizeScriptDraft(rebuildData.text);
          const patch = getScriptPartValidationPatch(newText, stateRef.current.claudeLiteMode !== false);
          updateScriptPart(currentPartIndex, {
            status: "generated",
            draftText: newText,
            ...patch,
          });
          updateState({
            autopilotState: {
              ...stateRef.current.autopilotState,
              currentStep: "recheck",
              rebuildAttemptsByPart: {
                ...currentAP.rebuildAttemptsByPart,
                [currentPartIndex]: attempts + 1,
              },
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } else if (currentStep === "approved") {
          updateState({
            autopilotState: {
              ...currentAP,
              currentStep: "generate",
              currentPartIndex: currentPartIndex + 1,
              rateLimitAttempts: 0,
            },
          });
          // Batch delay after approve
          await new Promise((resolve) => setTimeout(resolve, 60000));
        }
      } catch (err: any) {
        const currentAP = stateRef.current.autopilotState;
        const currentPart =
          stateRef.current.scriptParts[currentAP?.currentPartIndex || 0];
        const msg = String(err.message || err);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
          const limits = (currentAP?.rateLimitAttempts || 0) + 1;
          let backoff = 60000;
          if (limits === 2) backoff = 90000;
          if (limits >= 3) backoff = 180000;

          console.log(
            "Autopilot caught 429 rate limit. Cooling down for",
            backoff,
            "ms",
          );
          setWarningMessage(
            `Quota cooling down. Work is saved. Autopilot will retry automatically in ${backoff / 1000}s.`,
          );

          if (currentAP) {
            updateState({
              autopilotState: {
                ...currentAP,
                currentStep: "cooldown",
                retryAfterAt: Date.now() + backoff,
                rateLimitAttempts: limits,
                lastError: msg,
              },
            });
          }
        } else {
          console.error("Autopilot error:", err);
          if (currentAP) {
            updateState({
              autopilotState: {
                ...currentAP,
                enabled: false,
                currentStep: "blocked",
                lastError: msg,
              },
            });
          }
          setWarningMessage(
            `Autopilot stopped safely at Part ${currentPart?.partNumber || 1}. Reason: ${msg}`,
          );
        }
      } finally {
        autopilotRunningRef.current = false;
        if (!stateRef.current.autopilotState?.enabled) {
          setIsBatchGenerating(false);
        } else {
          // If still enabled, schedule next evaluation tick instead of relying on state change
          if (autopilotTimeoutRef.current)
            clearTimeout(autopilotTimeoutRef.current);
          autopilotTimeoutRef.current = setTimeout(runAutopilotStep, 1000);
        }
      }
    };

    autopilotTimeoutRef.current = setTimeout(runAutopilotStep, 1000);
  }, [state.autopilotState]);

  useEffect(() => {
    setSaveStatus("saving");

    // 1. Save to localStorage with Try/Catch and Compacting
    try {
      const compacted = compactStateForStorage(state);
      localStorage.setItem("studio_writer_project", JSON.stringify(compacted));
      localStorage.setItem("studio_writer_stage", currentStageId);
    } catch (err) {
      console.error(
        "localStorage saving failed, but backup in IndexedDB is active:",
        err,
      );
    }

    // 2. Clearer and larger master backup to IndexedDB
    saveProjectState("studio_writer_project", state)
      .then(() => {
        setSaveStatus("saved");
      })
      .catch((err) => {
        console.error("IndexedDB save failed:", err);
      });

    const timer = setTimeout(() => {
      setSaveStatus("saved");
    }, 500);

    return () => clearTimeout(timer);
  }, [state, currentStageId]);

  const handleResetProject = () => {
    if (
      window.confirm(
        "Are you sure you want to start a new project? This will clear all current work.",
      )
    ) {
      try {
        localStorage.removeItem("studio_writer_project");
        localStorage.removeItem("studio_writer_stage");
      } catch (err) {
        console.error("Failed to clean localStorage:", err);
      }

      saveProjectState("studio_writer_project", INITIAL_STATE)
        .then(() => {
          setState(INITIAL_STATE);
          stateRef.current = INITIAL_STATE;
          setCurrentStageId("idea_market");
        })
        .catch(() => {
          setState(INITIAL_STATE);
          stateRef.current = INITIAL_STATE;
          setCurrentStageId("idea_market");
        });
    }
  };

  const handleUnlockStage = (stageId: StageId) => {
    updateStageStatus(stageId, "generated");
    updateState({
      lockedData: { ...stateRef.current.lockedData, [stageId]: false },
    });
  };

  const updateState = (partial: Partial<ProjectState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      stateRef.current = next;
      return next;
    });
  };

  const updateStageStatus = (stageId: StageId, status: StageStatus) => {
    setState((prev) => {
      const next = {
        ...prev,
        stageStatuses: { ...prev.stageStatuses, [stageId]: status },
      };
      stateRef.current = next;
      return next;
    });
  };

  const updateExportSettings = (partial: Partial<CleanExportSettings>) => {
    setState((prev) => {
      const next = {
        ...prev,
        cleanExportSettings: { ...prev.cleanExportSettings, ...partial },
      };
      stateRef.current = next;
      return next;
    });
  };

  const getStageContent = (stageId: StageId): string => {
    switch (stageId) {
      case "idea_market":
        return state.marketResearch;
      case "raw_idea":
        return state.developedIdea;
      case "style_analyzer":
        return state.styleDna;
      case "story_dna":
        return state.storyContract;
      case "story_plan":
        return state.storyPlan;
      case "scene_cards":
        return state.sceneCards;
      case "script_writer":
        return state.fullScript;
      case "clean_export":
        return state.finalCleanScript;
      default:
        return "";
    }
  };

  const setStageContent = (stageId: StageId, content: string) => {
    updateState({
      supervisorReports: {
        ...state.supervisorReports,
        [stageId]: null,
      },
    });

    switch (stageId) {
      case "idea_market":
        updateState({ marketResearch: content });
        break;
      case "raw_idea":
        updateState({ developedIdea: content });
        break;
      case "style_analyzer":
        updateState({ styleDna: content });
        break;
      case "story_dna":
        updateState({ storyContract: content });
        break;
      case "story_plan":
        updateState({ storyPlan: content });
        break;
      case "scene_cards":
        updateState({ sceneCards: content });
        break;
      case "script_writer":
        updateState({ fullScript: content });
        break;
      case "clean_export":
        updateState({ finalCleanScript: content });
        break;
    }
  };

  const canProceedToStage = (
    stageId: StageId,
  ): { allowed: boolean; warning?: string } => {
    if (
      stageId === "style_analyzer" &&
      state.stageStatuses["raw_idea"] !== "locked"
    )
      return {
        allowed: false,
        warning:
          "Stage One (Raw Idea) must be locked before starting Style Analyzer.",
      };
    if (
      stageId === "story_dna" &&
      (state.stageStatuses["style_analyzer"] !== "locked" ||
        state.stageStatuses["raw_idea"] !== "locked")
    )
      return {
        allowed: false,
        warning:
          "Previous stages (Raw Idea and Style Analyzer) must be locked.",
      };
    if (
      stageId === "story_plan" &&
      state.stageStatuses["story_dna"] !== "locked"
    )
      return {
        allowed: false,
        warning: "Story Contract must be locked before starting Story Plan.",
      };
    if (
      stageId === "scene_cards" &&
      state.stageStatuses["story_plan"] !== "locked"
    )
      return {
        allowed: false,
        warning: "Story Plan must be locked before generating Scene Cards.",
      };
    if (
      stageId === "script_writer" &&
      state.stageStatuses["scene_cards"] !== "locked"
    )
      return {
        allowed: false,
        warning: "Scene Cards must be locked before writing Script.",
      };
    return { allowed: true };
  };

  const handleGenerate = async () => {
    const check = canProceedToStage(currentStageId);
    if (!check.allowed) {
      setWarningMessage(check.warning || "Check previous stages.");
      setTimeout(() => setWarningMessage(null), 4000);
      return;
    }

    setIsGenerating(true);

    import("./lib/PromptBuilder").then(({ buildPrompt }) => {
      const promptUsed = buildPrompt(currentStageId, state);

      fetchWithRetry("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptUsed,
          type: "text",
          stageId: currentStageId,
        }),
      })
        .then((data) => {
          const textOutput = data.text;
          setStageContent(currentStageId, textOutput);
          updateStageStatus(currentStageId, "generated");

          const newHistoryEntry = {
            id: Date.now().toString(),
            stageId: currentStageId,
            promptUsed:
              promptUsed.length > 800
                ? promptUsed.substring(0, 800) +
                  "...\n[TRUNCATED TO PREVENT QUOTA EXCEEDED]"
                : promptUsed,
            inputDataSummary: `Generated for ${currentStageId}`,
            outputPreview:
              textOutput.substring(0, 300) +
              (textOutput.length > 300 ? "..." : ""),
            createdAt: Date.now(),
            supervisorStatus: null,
            repairApplied: false,
            lockedStatus: false,
          };

          updateState({
            supervisorReports: {
              ...state.supervisorReports,
              [currentStageId]: null,
            },
            promptHistory: [newHistoryEntry, ...state.promptHistory],
          });
        })
        .catch((err) => {
          console.error("Generation failed:", err);
          setWarningMessage(err.message || "Error occurred during generation.");
          setTimeout(() => setWarningMessage(null), 5000);
        })
        .finally(() => {
          setIsGenerating(false);
        });
    });
  };

  const handleApproveAndLock = () => {
    if (currentStageId === "script_writer") {
      const allPartsApproved =
        state.scriptParts.length > 0 &&
        state.scriptParts.every((p) => p.status === "approved");
      if (!allPartsApproved) {
        setWarningMessage(
          "All script parts must be approved before locking the Script Writer stage.",
        );
        setTimeout(() => setWarningMessage(null), 5000);
        return;
      }
      const assembledContent = state.scriptParts
        .map((p) => `## Part ${p.partNumber}: ${p.partTitle}\n\n${p.draftText}`)
        .join("\n\n");
      updateState({
        fullScript: assembledContent,
        stageStatuses: {
          ...state.stageStatuses,
          script_writer: "locked" as const,
        },
        lockedData: { ...state.lockedData, script_writer: true },
      });
    } else {
      const report = state.supervisorReports[currentStageId];
      if (!report || report.status !== "ok" || report.canContinue !== true) {
        setWarningMessage(
          "Run AI Supervisor and pass quality check before locking this stage.",
        );
        setTimeout(() => setWarningMessage(null), 5000);
        return;
      }
      updateStageStatus(currentStageId, "locked");
      updateState({
        lockedData: { ...state.lockedData, [currentStageId]: true },
      });
    }
  };

  const handleSendToNext = () => {
    const currentState = stateRef.current;
    if (currentState.stageStatuses[currentStageId] !== "locked") {
      setWarningMessage(
        "Current stage must be approved and locked before moving forward.",
      );
      setTimeout(() => setWarningMessage(null), 5000);
      return;
    }
    const currentIndex = STAGES.findIndex((s) => s.id === currentStageId);
    if (currentIndex >= 0 && currentIndex < STAGES.length - 1) {
      const nextStage = STAGES[currentIndex + 1].id;
      setCurrentStageId(nextStage);
    }
  };

  // --- Supervisor --
  const handleAnalyze = () => {
    import("./lib/PromptBuilder").then(({ buildSupervisorPrompt }) => {
      const promptUsed = buildSupervisorPrompt(
        currentStageId,
        getStageContent(currentStageId),
        state,
      );

      setIsGenerating(true);
      fetchWithRetry("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptUsed,
          type: "supervisor",
          stageId: currentStageId,
        }),
      })
        .then((data) => {
          let report: SupervisorReport = data.parsed;
          if (!report) {
            report = {
              status: "needs_serious_repair",
              whatIsGood: "",
              problems: ["AI supervisor report cannot be parsed"],
              requiredFixes: ["Retry analysis"],
              recommendation: "Validation failed or parsed object was empty.",
              canContinue: false,
            };
          }

          const stageContent = getStageContent(currentStageId);
          let mergedReport = report;

          // Apply robust stage constraints
          return import("./lib/stageValidation").then((mod) => {
            const { validateStageContent, mergeWithStageValidation } = mod;
            const localVal = validateStageContent(
              stageContent,
              currentStageId as any,
              state,
            );
            mergedReport = mergeWithStageValidation(report, localVal);

            // existing script checks
            if (
              currentStageId === "script_writer" ||
              currentStageId === "clean_export"
            ) {
              const scope =
                currentStageId === "clean_export"
                  ? "clean_export"
                  : "script_part";
              const textForScriptValidation =
                currentStageId === "script_writer"
                  ? normalizeScriptDraft(stageContent)
                  : stageContent;
              const localScriptVal = validateScriptText(
                textForScriptValidation,
                scope,
                stateRef.current.claudeLiteMode !== false,
              );
              mergedReport = mergeSupervisorReportWithValidation(
                mergedReport,
                localScriptVal,
                stateRef.current.claudeLiteMode !== false,
              );
            }

            const shortQualityGateSummary = [
              `=== QUALITY GATE SUMMARY ===`,
              `Checked Stage: ${currentStageId}`,
              `AI Status: ${report.status.toUpperCase()}`,
              `Local Validation OK: ${localVal.ok}`,
              `Final Status: ${mergedReport.status.toUpperCase()}`,
              `What Passed: ${mergedReport.whatIsGood || "None Specified"}`,
              `Remaining Risks: ${mergedReport.problems.length > 0 ? mergedReport.problems.join(", ") : "None detected"}`,
              `Next Safe Action: ${mergedReport.canContinue ? "Approve & lock this stage to proceed." : mergedReport.requiredFixes.join(", ") || "Repair and check again."}`,
            ].join("\n");

            const newHistoryEntry = {
              id: Date.now().toString(),
              stageId: currentStageId,
              promptUsed:
                promptUsed.length > 800
                  ? promptUsed.substring(0, 800) +
                    "...\n[TRUNCATED TO PREVENT QUOTA EXCEEDED]"
                  : promptUsed,
              inputDataSummary: `Analyze output for ${currentStageId}`,
              outputPreview: `${JSON.stringify(mergedReport, null, 2)}\n\n${shortQualityGateSummary}`,
              createdAt: Date.now(),
              supervisorStatus: mergedReport.status,
              repairApplied: false,
              lockedStatus: false,
            };

            updateState({
              supervisorReports: {
                ...state.supervisorReports,
                [currentStageId]: mergedReport,
              },
              promptHistory: [newHistoryEntry, ...state.promptHistory],
            });

            if (mergedReport.canContinue && mergedReport.status === "ok") {
              updateStageStatus(currentStageId, "generated");
            } else {
              updateStageStatus(currentStageId, "needs_repair");
            }
          });
        })
        .catch((err) => {
          console.error("Analysis failed:", err);
          setWarningMessage(
            err.message || "Error occurred during supervisor analysis.",
          );
          setTimeout(() => setWarningMessage(null), 5000);
        })
        .finally(() => {
          setIsGenerating(false);
        });
    });
  };

  const handleApplyRepair = () => {
    import("./lib/PromptBuilder").then(
      async ({ buildRepairPrompt, buildSupervisorPrompt }) => {
        const mockReport = state.supervisorReports[currentStageId];
        const promptUsed = buildRepairPrompt(
          currentStageId,
          getStageContent(currentStageId),
          mockReport,
          state,
        );

        setIsGenerating(true);
        try {
          const data = await fetchWithRetry("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptUsed,
              type: "text",
              stageId: currentStageId,
            }),
          });

          const textOutput =
            currentStageId === "script_writer"
              ? normalizeScriptDraft(data.text)
              : data.text;
          setStageContent(currentStageId, textOutput);

          // Immediately run supervisor analysis again on the repaired output
          const supervisorPrompt = buildSupervisorPrompt(
            currentStageId,
            textOutput,
            state,
          );
          const analyzeData = await fetchWithRetry("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: supervisorPrompt,
              type: "supervisor",
              stageId: currentStageId,
            }),
          });

          let aiReport = analyzeData.parsed as SupervisorReport;
          if (!aiReport) {
            aiReport = {
              status: "needs_serious_repair",
              whatIsGood: "",
              problems: [
                "AI supervisor report could not be parsed after repair.",
              ],
              requiredFixes: ["Re-generate or repair the stage content."],
              recommendation:
                "Check failed. Missing supervisor report response.",
              canContinue: false,
            };
          }

          let mergedReport = aiReport;

          const mod = await import("./lib/stageValidation");
          const { validateStageContent, mergeWithStageValidation } = mod;
          const localVal = validateStageContent(
            textOutput,
            currentStageId as any,
            state,
          );
          mergedReport = mergeWithStageValidation(aiReport, localVal);

          // For script_writer or clean_export, also apply local validateScriptText checks before allowing approval
          if (
            currentStageId === "script_writer" ||
            currentStageId === "clean_export"
          ) {
            const scope =
              currentStageId === "clean_export"
                ? "clean_export"
                : "script_part";
            const textForScriptValidation =
              currentStageId === "script_writer"
                ? normalizeScriptDraft(textOutput)
                : textOutput;
            const localScriptVal = validateScriptText(
              textForScriptValidation,
              scope,
              stateRef.current.claudeLiteMode !== false,
            );
            mergedReport = mergeSupervisorReportWithValidation(
              mergedReport,
              localScriptVal,
              stateRef.current.claudeLiteMode !== false,
            );
          }

          const shortQualityGateSummary = [
            `=== QUALITY GATE SUMMARY (AFTER REPAIR) ===`,
            `Checked Stage: ${currentStageId}`,
            `AI Status: ${aiReport.status.toUpperCase()}`,
            `Local Validation OK: ${localVal.ok}`,
            `Final Status: ${mergedReport.status.toUpperCase()}`,
            `What Passed: ${mergedReport.whatIsGood || "None Specified"}`,
            `Remaining Risks: ${mergedReport.problems.length > 0 ? mergedReport.problems.join(", ") : "None detected"}`,
            `Next Safe Action: ${mergedReport.canContinue ? "Approve & lock this stage to proceed." : mergedReport.requiredFixes.join(", ") || "Repair and check again."}`,
          ].join("\n");

          const newHistoryEntry = {
            id: Date.now().toString(),
            stageId: currentStageId,
            promptUsed:
              promptUsed.length > 800
                ? promptUsed.substring(0, 800) +
                  "...\n[TRUNCATED TO PREVENT QUOTA EXCEEDED]"
                : promptUsed,
            inputDataSummary: `Repair output & Re-analysis for ${currentStageId}`,
            outputPreview: `[OUTPUT PREVIEW]:\n${textOutput.substring(0, 300) + (textOutput.length > 300 ? "..." : "")}\n\n[SUPERVISOR REPORT]:\n${JSON.stringify(mergedReport, null, 2)}\n\n${shortQualityGateSummary}`,
            createdAt: Date.now(),
            supervisorStatus: mergedReport.status,
            repairApplied: true,
            lockedStatus: false,
          };

          updateState({
            supervisorReports: {
              ...state.supervisorReports,
              [currentStageId]: mergedReport,
            },
            promptHistory: [newHistoryEntry, ...state.promptHistory],
          });

          if (mergedReport.canContinue && mergedReport.status === "ok") {
            updateStageStatus(currentStageId, "generated"); // Set back to generated only if solid
          } else {
            updateStageStatus(currentStageId, "needs_repair");
          }
        } catch (err: any) {
          console.error("Repair failed:", err);
          setWarningMessage(err.message || "Error occurred during repair.");
          setTimeout(() => setWarningMessage(null), 5000);
        } finally {
          setIsGenerating(false);
        }
      },
    );
  };

  const handleApproveAnyway = () => {
    updateStageStatus(currentStageId, "approved");
  };

  // --- Script Part Actions ---
  const updateScriptPart = (index: number, partial: Partial<ScriptPart>) => {
    setState((prev) => {
      const updatedParts = [...prev.scriptParts];
      updatedParts[index] = { ...updatedParts[index], ...partial };
      const next = { ...prev, scriptParts: updatedParts };
      stateRef.current = next;
      return next;
    });
  };

  const handleInitScriptParts = () => {
    // Try to parse parts from storyPlan
    const parts: ScriptPart[] = [];
    const currentState = stateRef.current;

    // Crop story plan to exclude everything from Section 13 / HIDDEN CARD TIMING MAP onwards
    let planText = currentState.storyPlan || "";
    const cutOffRegex =
      /(?:\r?\n|^)\s*(?:Thirteen|13|Тринадцать|Тринадцатая)\s*[:.-—\s]\s*(?:HIDDEN\s+CARD|RESOURCE|ESCALATION|TIMING)/i;
    const cutOffMatch = planText.match(cutOffRegex);
    if (cutOffMatch && cutOffMatch.index !== undefined) {
      planText = planText.substring(0, cutOffMatch.index);
    }

    // Supporting spelled-out parts (e.g., "PART ONE", "ЧАСТЬ ОДИН", "Part 1")
    const wordToNum: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      один: 1,
      два: 2,
      три: 3,
      четыре: 4,
      пять: 5,
      шесть: 6,
      семь: 7,
      восемь: 8,
      девять: 9,
      десять: 10,
      первая: 1,
      вторая: 2,
      третья: 3,
      четвертая: 4,
      пятая: 5,
      шестая: 6,
      седьмая: 7,
      восьмая: 8,
      девятая: 9,
      десятая: 10,
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
      ix: 9,
      x: 10,
    };

    // Robust line matcher supporting optional list prefixes
    // Captures group 1 (part number/word) and group 2 (title)
    const partListRegex =
      /(?:^|\n)[^\n]*(?:Part|Часть)\s*(one|two|three|four|five|six|seven|eight|nine|ten|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|первая|вторая|третья|четвертая|пятая|шестая|седьмая|восьмая|девятая|десятая|i|ii|iii|iv|v|vi|vii|viii|ix|x|\d+)\s*[:.-—]\s*([^\n]+)/gi;
    let match;
    const matches: { number: number; title: string }[] = [];
    const seenNumbers = new Set<number>();

    while ((match = partListRegex.exec(planText)) !== null) {
      const pstr = match[1].toLowerCase();
      const num = wordToNum[pstr] || parseInt(pstr) || 0;
      if (num > 0) {
        if (!seenNumbers.has(num)) {
          seenNumbers.add(num);
          matches.push({ number: num, title: match[2].trim() });
        }
      }
    }

    // Sort matches by part number to ensure correct order
    matches.sort((a, b) => a.number - b.number);

    if (matches.length > 0) {
      matches.forEach((m) => {
        parts.push({
          partNumber: m.number,
          partTitle: m.title,
          sourceSceneCards: `Scenes for ${m.title}`,
          draftText: "",
          status: "not_started",
          supervisorReport: null,
          isComplete: false,
          wordOrCharacterCount: 0,
          hasGenerationResidue: false,
          hasDuplicateBlocks: false,
          avatarCount: 0,
        });
      });
    } else {
      // 2. Try to find explicit count: "Number of Parts: X" or "Количество частей: X"
      const countRegex =
        /(?:Number of Parts|Количество частей|Parts|Частей)\s*[:.-]?\s*(\d+|Девять|Восемь|Семь|Шесть|Пять|Четыре|Три|Два|Один)/i;
      const countMatch = currentState.storyPlan.match(countRegex);

      let numParts = 9; // default fallback if everything fails (canon is 9 parts)
      if (countMatch) {
        const val = countMatch[1].toLowerCase();
        const russianMap: Record<string, number> = {
          один: 1,
          два: 2,
          три: 3,
          четыре: 4,
          пять: 5,
          шесть: 6,
          семь: 7,
          восемь: 8,
          девять: 9,
          десять: 10,
        };
        numParts = russianMap[val] || parseInt(val) || 9;
      }

      for (let i = 1; i <= numParts; i++) {
        parts.push({
          partNumber: i,
          partTitle: i === 1 ? "Introduction & Hook" : `Part ${i}`,
          sourceSceneCards: `Scenes for Part ${i}`,
          draftText: "",
          status: "not_started",
          supervisorReport: null,
          isComplete: false,
          wordOrCharacterCount: 0,
          hasGenerationResidue: false,
          hasDuplicateBlocks: false,
          avatarCount: 0,
        });
      }
    }

    updateState({ scriptParts: parts });
    updateStageStatus("script_writer", "generated");
  };

  const handleGeneratePart = async (index: number) => {
    try {
      const { buildPartPrompt } = await import("./lib/PromptBuilder");
      const currentState = stateRef.current;
      const partNum = currentState.scriptParts[index].partNumber;

      const promptUsed = buildPartPrompt(partNum, currentState);

      setIsGenerating(true);
      const data = await fetchWithRetry("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptUsed,
          type: "text",
          stageId: "script_writer",
        }),
      });

      const textOutput = normalizeScriptDraft(data.text);

      const newHistoryEntry = {
        id: Date.now().toString(),
        stageId: "script_writer" as StageId,
        promptUsed:
          promptUsed.length > 800
            ? promptUsed.substring(0, 800) +
              "...\n[TRUNCATED TO PREVENT QUOTA EXCEEDED]"
            : promptUsed,
        inputDataSummary: `Generated for Script Part ${partNum}`,
        outputPreview:
          textOutput.substring(0, 300) + (textOutput.length > 300 ? "..." : ""),
        createdAt: Date.now(),
        supervisorStatus: null,
        repairApplied: false,
        lockedStatus: false,
      };

      const validationPatch = getScriptPartValidationPatch(textOutput, state.claudeLiteMode !== false);
      updateScriptPart(index, {
        status: "generated",
        draftText: textOutput,
        ...validationPatch,
      });
      updateState({
        promptHistory: [newHistoryEntry, ...stateRef.current.promptHistory],
      });
      return true;
    } catch (err: any) {
      console.error("Part generation failed:", err);
      setWarningMessage(
        err.message || "Error occurred during part generation.",
      );
      setTimeout(() => setWarningMessage(null), 5000);
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAllParts = async () => {
    const currentAP = stateRef.current.autopilotState;
    if (!currentAP) return;

    // Find the first non-approved part
    const firstNotApproved = stateRef.current.scriptParts.findIndex(
      (p) => p.status !== "approved",
    );
    if (firstNotApproved === -1) {
      setWarningMessage("All parts are already approved.");
      setTimeout(() => setWarningMessage(null), 3000);
      return;
    }

    setStopRequested(false);
    stopRequestedRef.current = false;
    setIsBatchGenerating(true);

    updateState({
      autopilotState: {
        ...currentAP,
        enabled: true,
        currentPartIndex: firstNotApproved,
        currentStep: stateRef.current.scriptParts[firstNotApproved].draftText
          ? "check"
          : "generate",
        lastError: null,
        retryAfterAt: null,
      },
    });
  };

  const handleStopBatchGeneration = () => {
    setStopRequested(true);
    setIsBatchGenerating(false);
    if (stateRef.current.autopilotState) {
      updateState({
        autopilotState: {
          ...stateRef.current.autopilotState,
          enabled: false,
          currentStep: "blocked",
          lastError: "Stopped by user.",
        },
      });
    }
  };

  const handleClearAllParts = () => {
    handleStopBatchGeneration();
    const cleared = stateRef.current.scriptParts.map((p) => ({
      ...p,
      draftText: "",
      status: "not_started" as const,
      wordOrCharacterCount: 0,
    }));
    updateState({ scriptParts: cleared, fullScript: "" });
  };

  const handleRebuildPart = async (index: number) => {
    handleStopBatchGeneration();
    try {
      const { buildRebuildPrompt } = await import("./lib/PromptBuilder");
      const currentState = stateRef.current;
      const part = currentState.scriptParts[index];
      const rep = part.supervisorReport || {
        problems: ["Manual rebuild requested"],
      };
      const promptUsed = buildRebuildPrompt(part.partNumber, currentState, rep);

      setIsGenerating(true);
      const data = await fetchWithRetry("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptUsed,
          type: "text",
          stageId: "script_writer",
        }),
      });

      const newText = normalizeScriptDraft(data.text);
      const patch = getScriptPartValidationPatch(newText, currentState.claudeLiteMode !== false);
      updateScriptPart(index, {
        status: "generated",
        draftText: newText,
        ...patch,
        supervisorReport: undefined,
      });
    } catch (err: any) {
      console.error(err);
      setWarningMessage(`Failed to rebuild part: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearPart = (index: number) => {
    handleStopBatchGeneration();
    updateScriptPart(index, {
      draftText: "",
      status: "not_started",
      wordOrCharacterCount: 0,
    });
  };

  const handleCheckPart = async (
    index: number,
    maxAttempts = 2,
  ): Promise<boolean> => {
    try {
      const { buildSupervisorPrompt, buildRepairPrompt } =
        await import("./lib/PromptBuilder");
      setIsGenerating(true);

      let attempt = 0;
      let currentState = stateRef.current;
      let part = currentState.scriptParts[index];

      while (attempt < maxAttempts) {
        attempt++;
        const promptUsed = buildSupervisorPrompt(
          "script_writer",
          part.draftText,
          currentState,
        );

        // Step 1: Supervisor Analysis
        const analyzeData = await fetchWithRetry("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptUsed, type: "supervisor" }),
        });

        let aiReport = analyzeData.parsed as SupervisorReport;
        if (!aiReport) {
          aiReport = {
            status: "needs_serious_repair",
            whatIsGood: "",
            problems: ["AI supervisor report is missing or failed to parse."],
            requiredFixes: ["Re-generate this part."],
            recommendation:
              "Validation failed due to empty supervisor response.",
            canContinue: false,
          };
        }

        // Step 2: Local Validation
        const normalizedPartText = normalizeScriptDraft(part.draftText);
        const localValidation = validateScriptText(
          normalizedPartText,
          "script_part",
          currentState.claudeLiteMode !== false,
        );

        // Step 3: Merge
        const mergedReport = mergeSupervisorReportWithValidation(
          aiReport,
          localValidation,
          currentState.claudeLiteMode !== false,
        );

        updateState({
          supervisorReports: {
            ...currentState.supervisorReports,
            script_writer: mergedReport,
          },
        });

        const isApproved =
          mergedReport.status === "ok" &&
          mergedReport.canContinue === true;

        if (!isApproved) {
          updateScriptPart(index, {
            status: "needs_repair",
            validationIssues: mergedReport.problems,
          });

          if (attempt >= maxAttempts) {
            setWarningMessage(
              `Part ${part.partNumber} failed after ${maxAttempts} attempts.`,
            );
            setTimeout(() => setWarningMessage(null), 4000);
            return false;
          }

          // Repair
          const repairPrompt = buildRepairPrompt(
            "script_writer",
            part.draftText,
            mergedReport,
            currentState,
            part.partNumber,
          );
          const repairData = await fetchWithRetry("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: repairPrompt,
              type: "text",
              stageId: "script_writer",
            }),
          });

          const newText = normalizeScriptDraft(repairData.text);
          const patch = getScriptPartValidationPatch(newText, currentState.claudeLiteMode !== false);
          updateScriptPart(index, {
            status: "generated",
            draftText: newText,
            ...patch,
          });

          currentState = stateRef.current;
          part = currentState.scriptParts[index];
          setWarningMessage(
            `Checking repaired Part ${part.partNumber} (Attempt ${attempt + 1})...`,
          );
        } else {
          // Approved
          const patch = getScriptPartValidationPatch(part.draftText, currentState.claudeLiteMode !== false);
          updateScriptPart(index, { status: "approved", ...patch });
          return true;
        }
      }
      return false;
    } catch (err: any) {
      console.error("Check/Repair Part failed:", err);
      setWarningMessage(err.message || "Error occurred during part check.");
      setTimeout(() => setWarningMessage(null), 4000);
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAssembleScript = () => {
    const allApproved =
      state.scriptParts.length > 0 &&
      state.scriptParts.every((p) => p.status === "approved");
    if (!allApproved) {
      setWarningMessage(
        "All script parts must pass Check & Approve before assembly.",
      );
      setTimeout(() => setWarningMessage(null), 5000);
      return;
    }
    const assembledContent = state.scriptParts
      .map((p) => `## Part ${p.partNumber}: ${p.partTitle}\n\n${p.draftText}`)
      .join("\n\n");
    updateState({ fullScript: assembledContent });
  };

  const stageStatus = state.stageStatuses[currentStageId];
  const stageName = STAGES.find((s) => s.id === currentStageId)?.name || "";
  const currentReport = state.supervisorReports[currentStageId];

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans relative">
      <TopBar
        currentStage={currentStageId}
        stageStatuses={state.stageStatuses}
        onSelectStage={setCurrentStageId}
      />

      {warningMessage && (
        <div className="bg-amber-100 text-amber-900 px-6 py-3 text-sm font-bold border-b border-amber-200">
          ⚠️ {warningMessage}
        </div>
      )}

      {generationAttempt > 0 && (
        <div className="bg-sky-600 text-white px-6 py-3 text-sm font-semibold border-b border-sky-700 flex justify-between items-center animate-pulse shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block animate-spin mr-1">⏳</span>
            <span>
              Nova is thinking... Attempt {generationAttempt} of{" "}
              {generationMaxAttempts}
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider bg-sky-700 px-2 py-0.5 rounded font-black">
            Vertex AI Retry Mode
          </span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <LeftPanel
          state={state}
          updateState={updateState}
          onResetProject={handleResetProject}
          saveStatus={saveStatus}
          onLoadBuiltInReferences={handleLoadBuiltInReferences}
          isLoadingReferences={isLoadingReferences}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <RightPanel
            currentStageId={currentStageId}
            stageName={stageName}
            stageStatus={stageStatus}
            stageContent={getStageContent(currentStageId)}
            updateStageContent={(content) => {
              setStageContent(currentStageId, content);
              const currentStatus = state.stageStatuses[currentStageId];
              if (currentStatus !== "locked") {
                updateState({
                  stageStatuses: {
                    ...state.stageStatuses,
                    [currentStageId]: "generated",
                  },
                  supervisorReports: {
                    ...state.supervisorReports,
                    [currentStageId]: null,
                  },
                });
              }
            }}
            onGenerate={handleGenerate}
            onApproveAndLock={handleApproveAndLock}
            onUnlockStage={() => handleUnlockStage(currentStageId)}
            onSendToNext={handleSendToNext}
            exportSettings={state.cleanExportSettings}
            updateExportSettings={updateExportSettings}
            scriptParts={state.scriptParts}
            updateScriptPart={updateScriptPart}
            onInitScriptParts={handleInitScriptParts}
            onGeneratePart={handleGeneratePart}
            onGenerateAllParts={handleGenerateAllParts}
            onStopBatchGeneration={handleStopBatchGeneration}
            onClearAllParts={handleClearAllParts}
            onClearPart={handleClearPart}
            isBatchGenerating={isBatchGenerating}
            onCheckPart={handleCheckPart}
            onRebuildPart={handleRebuildPart}
            onAssembleScript={handleAssembleScript}
            hasSupervisorReport={!!state.supervisorReports[currentStageId]}
            autopilotState={state.autopilotState}
          />

          <SupervisorPanel
            report={currentReport}
            isGenerating={isGenerating}
            onAnalyze={handleAnalyze}
            onApplyRepair={handleApplyRepair}
            onApproveAnyway={handleApproveAnyway}
            onProceed={handleSendToNext}
          />
        </div>
      </div>

      {/* Dev Bug Tool */}
      <button
        onClick={() => setShowDebug(true)}
        className="absolute bottom-4 right-4 p-2 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 transition-colors z-40 opacity-70 hover:opacity-100"
        title="Debug Project State"
      >
        <Bug className="w-4 h-4" />
      </button>

      {/* Debug Modal */}
      {showDebug && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-slate-900 text-slate-300 w-full max-w-6xl h-full flex flex-col border border-slate-700 shadow-2xl rounded-sm overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 text-white shrink-0">
              <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                <Bug className="w-4 h-4 text-emerald-500" /> SYSTEM STATE
                (Developer Mode)
              </h3>
              <button
                onClick={() => setShowDebug(false)}
                className="hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/4 border-r border-slate-800 flex flex-col">
                <div className="p-3 border-b border-slate-800 bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-400">
                  Prompt Registry
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {Object.entries(state.promptRegistry).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-slate-400">
                        {key}
                      </label>
                      <textarea
                        className="bg-slate-800 border border-slate-700 text-slate-300 text-xs p-2 rounded-sm focus:border-blue-500 focus:outline-none min-h-[60px]"
                        value={value}
                        onChange={(e) =>
                          updateState({
                            promptRegistry: {
                              ...state.promptRegistry,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col border-r border-slate-800">
                <div className="p-3 border-b border-slate-800 bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-400 flex justify-between items-center">
                  <span>Active Prompts (Phase Four)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        import("./lib/PromptBuilder").then(
                          ({ buildSupervisorPrompt }) => {
                            const built = buildSupervisorPrompt(
                              currentStageId,
                              "[DRAFT OUTPUT]",
                              state,
                            );
                            alert("Built Supervisor Prompt:\n\n" + built);
                          },
                        );
                      }}
                      className="px-3 py-1 bg-amber-900/30 text-amber-500 hover:text-amber-400 text-[10px] border border-amber-900/50 rounded-sm hover:-translate-y-px transition-transform"
                    >
                      Test Supervisor Prompt
                    </button>
                    <button
                      onClick={() => {
                        import("./lib/PromptBuilder").then(
                          ({ buildPrompt }) => {
                            const built = buildPrompt(currentStageId, state);
                            alert("Built Prompt Preview:\n\n" + built);
                          },
                        );
                      }}
                      className="px-3 py-1 bg-blue-900/30 text-blue-400 hover:text-blue-300 text-[10px] border border-blue-900/50 rounded-sm hover:-translate-y-px transition-transform"
                    >
                      Test Script Prompt
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-emerald-500">
                      Active Global Rules Prompt
                    </label>
                    <pre className="bg-slate-950 p-2 rounded border border-slate-800 whitespace-pre-wrap">
                      {state.promptRegistry.globalRulesPrompt}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-emerald-500">
                      Active AI Supervisor Prompt
                    </label>
                    <pre className="bg-slate-950 p-2 rounded border border-slate-800 whitespace-pre-wrap">
                      {state.promptRegistry.aiSupervisorPrompt}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-blue-400">
                      Last Built Prompt
                    </label>
                    <pre className="bg-slate-950 p-2 rounded border border-slate-800 whitespace-pre-wrap text-blue-300">
                      {state.promptHistory.find(
                        (h) => h.supervisorStatus === null,
                      )?.promptUsed || "No generated prompts yet."}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-amber-500">
                      Last Supervisor Prompt
                    </label>
                    <pre className="bg-slate-950 p-2 rounded border border-slate-800 whitespace-pre-wrap text-amber-300">
                      {state.promptHistory.find(
                        (h) => h.supervisorStatus !== null,
                      )?.promptUsed || "No supervisor prompts yet."}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-amber-500">
                      Last Supervisor Response
                    </label>
                    <pre className="bg-slate-950 p-2 rounded border border-slate-800 whitespace-pre-wrap text-amber-300">
                      {state.promptHistory.find(
                        (h) => h.supervisorStatus !== null,
                      )?.outputPreview || "No supervisor responses yet."}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="w-1/4 flex flex-col">
                <div className="p-3 border-b border-slate-800 bg-slate-900/50 font-bold text-xs uppercase tracking-wider text-slate-400">
                  State JSON
                </div>
                <div className="flex-2 overflow-y-auto p-4 border-b border-slate-800 font-mono text-[11px] leading-relaxed">
                  <pre>{JSON.stringify(state, null, 2)}</pre>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-[10px] text-slate-500">
                  <h4 className="text-slate-400 mb-2 uppercase tracking-wide">
                    Prompt History ({state.promptHistory.length})
                  </h4>
                  {state.promptHistory.length === 0 && (
                    <p className="opacity-50">No generations yet.</p>
                  )}
                  {state.promptHistory.map((h) => (
                    <div
                      key={h.id}
                      className="mb-2 p-2 border border-slate-800 rounded-sm"
                    >
                      <span className="text-emerald-700 font-bold">
                        {h.stageId}
                      </span>{" "}
                      - Date: {new Date(h.createdAt).toLocaleTimeString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
