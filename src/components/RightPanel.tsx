import React from 'react';
import { StageId, StageStatus, CleanExportSettings, ScriptPart, AutopilotState } from '../types';
import { Check, Edit3, RefreshCw, Lock, Sparkles, Download } from 'lucide-react';
import { ScriptWriterPanel } from './ScriptWriterPanel';
import { validateScriptText, validationIssueSummary } from '../lib/scriptValidation';

export function generateCleanScript(scriptParts: ScriptPart[], exportSettings: CleanExportSettings): string {
  if (!scriptParts || scriptParts.length === 0) return '';
  const finalParts: string[] = [];

  for (const part of scriptParts) {
    if (!part.draftText || part.draftText.trim().length === 0) continue;

    const cleanParagraphs: string[] = [];
    const rawParagraphs = part.draftText.split(/\r?\n/);

    for (const rawPara of rawParagraphs) {
      const para = rawPara.trim();
      if (!para) {
        if (cleanParagraphs.length > 0 && cleanParagraphs[cleanParagraphs.length - 1] !== '') {
          cleanParagraphs.push('');
        }
        continue;
      }

      // 1. Remove systemic or generation residue phrases / lines
      const lowerPara = para.toLowerCase();
      const isResidue = [
        '[идет генерация]', 'идет генерация', '[generating part]', 'generating part',
        'writing part', 'continue from', 'draft continues', 'unfinished',
        'placeholder', 'debug', 'stage output', 'scene card',
        'linter report', 'qa notes', '=== part', '----', '***', '###',
        'scene one', 'scene two', 'stage five', 'output start', 'output end'
      ].some(phrase => lowerPara.includes(phrase)) 
      || /^\s*[-*=]{3,}\s*$/.test(para); // decorative lines like --- or === or ***

      const shouldRemoveResidue = exportSettings.removeTechnicalResidue !== false;
      if (shouldRemoveResidue && isResidue) continue;

      // 2. Avatar logic
      const avatarRegex = /^\s*\[(AVATAR|АВАТАР|Аватар|Person|[A-Za-zА-Яа-яЁё0-9_\s-]+)\]\s*:?\s*/i;
      const hasAvatarTag = avatarRegex.test(para);

      if (hasAvatarTag) {
        if (exportSettings.removeAvatarTextCompletely) {
          // Skip this paragraph entirely
          continue;
        } else if (exportSettings.removeAvatarMarkersButKeepText) {
          // Replace matching marker but keep the rest of the text
          const cleanedText = para.replace(avatarRegex, '');
          if (cleanedText.trim()) {
            cleanParagraphs.push(cleanedText.trim());
          }
          continue;
        }
      }

      // Default: add original paragraph (or slightly trimmed)
      cleanParagraphs.push(para);
    }

    // Now if this part has active text, add it
    const partBody = cleanParagraphs.join('\n').trim();
    if (partBody) {
      if (exportSettings.keepPartHeadings) {
        finalParts.push(`Part ${part.partNumber}: ${part.partTitle}\n\n${partBody}`);
      } else {
        finalParts.push(partBody);
      }
    }
  }

  return finalParts.join('\n\n\n');
}


interface RightPanelProps {
  currentStageId: StageId;
  stageName: string;
  stageStatus: StageStatus;
  stageContent: string;
  updateStageContent: (content: string) => void;
  onGenerate: () => void;
  onApproveAndLock: () => void;
  onUnlockStage: () => void;
  onSendToNext: () => void;
  exportSettings: CleanExportSettings;
  updateExportSettings: (updates: Partial<CleanExportSettings>) => void;
  // Specific to Script Writer
  scriptParts: ScriptPart[];
  updateScriptPart: (index: number, partial: Partial<ScriptPart>) => void;
  onInitScriptParts: () => void;
  onGeneratePart: (index: number) => void;
  onGenerateAllParts: () => void;
  onStopBatchGeneration: () => void;
  onClearAllParts: () => void;
  onClearPart: (index: number) => void;
  isBatchGenerating: boolean;
  onCheckPart: (index: number) => void;
  onRebuildPart?: (index: number) => void;
  onAssembleScript: () => void;
  hasSupervisorReport?: boolean;
  autopilotState?: AutopilotState;
}

export function RightPanel({ 
  currentStageId, 
  stageName,
  stageStatus,
  stageContent,
  updateStageContent,
  onGenerate, 
  onApproveAndLock, 
  onUnlockStage,
  onSendToNext,
  exportSettings,
  updateExportSettings,
  scriptParts,
  updateScriptPart,
  onInitScriptParts,
  onGeneratePart,
  onGenerateAllParts,
  onStopBatchGeneration,
  onClearAllParts,
  onClearPart,
  isBatchGenerating,
  onCheckPart,
  onRebuildPart,
  onAssembleScript,
  hasSupervisorReport,
  autopilotState
}: RightPanelProps) {
  
  const isExportStage = currentStageId === 'clean_export';
  const isScriptStage = currentStageId === 'script_writer';

  const [activeTab, setActiveTab] = React.useState<'parts' | 'full'>('parts');
  const [copied, setCopied] = React.useState(false);
  const [cleanExportValidation, setCleanExportValidation] = React.useState<any>(null);

  const allPartsApproved = scriptParts && scriptParts.length > 0 && scriptParts.every(p => p.status === 'approved');

  React.useEffect(() => {
    setActiveTab('parts');
  }, [currentStageId]);

  const cleanedScriptText = React.useMemo(() => {
    return generateCleanScript(scriptParts, exportSettings);
  }, [scriptParts, exportSettings]);

  const handleDownload = () => {
    const text = generateCleanScript(scriptParts, exportSettings);
    if (!text) {
      alert("Script is empty! Please write script parts first.");
      return;
    }
    const validation = validateScriptText(text, 'clean_export');
    if (!validation.ok) {
      setCleanExportValidation(validation);
      alert("Cannot export: Validation failed. See details on the screen.");
      return;
    }
    setCleanExportValidation(null);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clean_script_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    const text = generateCleanScript(scriptParts, exportSettings);
    if (!text) return;
    const validation = validateScriptText(text, 'clean_export');
    if (!validation.ok) {
      setCleanExportValidation(validation);
      alert("Cannot copy: Validation failed. See details on the screen.");
      return;
    }
    setCleanExportValidation(null);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy text", err);
    });
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-slate-100">
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center bg-slate-100 shrink-0">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900 flex items-center gap-2 m-0">
            {stageName}
            {stageStatus === 'locked' && <Lock className="w-4 h-4 text-emerald-500" />}
          </h2>
          <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 tracking-widest">
            {stageStatus === 'not_started' && 'No content generated yet'}
            {stageStatus === 'generated' && 'Content generated / pending review'}
            {stageStatus === 'needs_repair' && 'Content needs repair'}
            {stageStatus === 'approved' && 'Content approved / ready to lock'}
            {stageStatus === 'locked' && 'Content locked / structure safe'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {!isExportStage && !isScriptStage && (
            <>
              <button 
                onClick={onGenerate}
                disabled={stageStatus === 'locked'}
                className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-50 border border-slate-200 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Regenerate Stage
              </button>
              
              {stageContent && stageStatus !== 'locked' && (
                <button 
                  onClick={onApproveAndLock}
                  className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-semibold transition-all shadow-sm"
                >
                  Approve & Lock
                </button>
              )}

              {stageStatus === 'locked' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={onUnlockStage}
                    className="px-4 py-2 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                  >
                    Unlock to edit
                  </button>
                  <button 
                    onClick={onSendToNext}
                    className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
                  >
                    Next Stage &rarr;
                  </button>
                </div>
              )}
            </>
          )}

          {isScriptStage && (
            <>
              {scriptParts.length === 0 ? (
                 <button 
                   onClick={onInitScriptParts}
                   className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-semibold transition-all shadow-sm"
                 >
                   Initialize Script Parts
                 </button>
              ) : (
                <>
                  {stageStatus !== 'locked' && (
                    <button 
                      onClick={onApproveAndLock}
                      disabled={!allPartsApproved}
                      className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve & Lock Full Script
                    </button>
                  )}
                  {stageStatus === 'locked' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={onUnlockStage}
                        className="px-4 py-2 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                      >
                        Unlock script
                      </button>
                      <button 
                        onClick={onSendToNext}
                        className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 border-none text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
                      >
                        Next Stage &rarr;
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {isExportStage && (
            <button 
                onClick={handleDownload}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Clean Script
              </button>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-6 pb-6">
        {isScriptStage && (
          <div className="flex items-center gap-2 border-b border-slate-200 mb-2 shrink-0">
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'parts' 
                  ? 'border-slate-950 text-slate-950 font-black' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              🛠️ Parts Editor ({scriptParts.filter(p => p.draftText && p.draftText.length > 0).length} / {scriptParts.length})
            </button>
            <button
              onClick={() => {
                if (allPartsApproved) {
                  onAssembleScript();
                  setActiveTab('full');
                }
              }}
              disabled={!allPartsApproved}
              title={!allPartsApproved ? "All parts must be 'approved' to assemble." : "Assemble the full script"}
              className={`px-4 py-3 text-[10px] uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'full' 
                  ? 'border-slate-950 text-slate-950 font-black' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              } ${!allPartsApproved ? 'opacity-50 cursor-not-allowed' : 'font-bold cursor-pointer'}`}
            >
              📝 Full Assembled Script ({stageContent ? stageContent.length : 0} chars)
            </button>
          </div>
        )}

        {isExportStage ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full min-h-0 w-full mt-4 overflow-hidden">
            {/* Left Column: Settings and Rules */}
            <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto pr-1">
              <div className="bg-white border border-slate-200 p-6 shadow-sm rounded">
                <h3 className="text-xs font-bold text-slate-850 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                  ⚙️ Export Options
                </h3>
                <div className="flex flex-col gap-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={exportSettings.keepPartHeadings} 
                      onChange={e => {
                        updateExportSettings({ 
                          keepPartHeadings: e.target.checked,
                          removePartHeadings: !e.target.checked
                        });
                      }} 
                      className="mt-0.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Include Part Headings</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Keep headings like "Part X: Title" in the final document.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={exportSettings.removeTechnicalResidue !== false} 
                      onChange={e => {
                        updateExportSettings({ 
                          removeTechnicalResidue: e.target.checked
                        });
                      }} 
                      className="mt-0.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Удалить технический мусор / Filter Technical Residue</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Automatically remove QA summaries, debug/technical notes, and decorative dividers from the output.</span>
                    </div>
                  </label>

                  <div className="border-t border-slate-150 my-2 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Avatar Commentary Options</span>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={exportSettings.keepAvatarMarkers} 
                          onChange={e => {
                            if (e.target.checked) {
                              updateExportSettings({ 
                                keepAvatarMarkers: true,
                                removeAvatarMarkersButKeepText: false,
                                removeAvatarTextCompletely: false
                              });
                            }
                          }} 
                          className="mt-0.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Keep Avatar Markers</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Keep commentary lines fully styled, e.g., "[AVATAR] commentary message"</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={exportSettings.removeAvatarMarkersButKeepText} 
                          onChange={e => {
                            if (e.target.checked) {
                              updateExportSettings({ 
                                keepAvatarMarkers: false,
                                removeAvatarMarkersButKeepText: true,
                                removeAvatarTextCompletely: false
                              });
                            }
                          }} 
                          className="mt-0.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Remove Markers, Keep Text</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Remove "[AVATAR]" prefix but keep the commentary prose text in.</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={exportSettings.removeAvatarTextCompletely} 
                          onChange={e => {
                            if (e.target.checked) {
                              updateExportSettings({ 
                                keepAvatarMarkers: false,
                                removeAvatarMarkersButKeepText: false,
                                removeAvatarTextCompletely: true
                              });
                            }
                          }} 
                          className="mt-0.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Remove Avatar Comments Completely</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Discard all bracketed commentary blocks, exporting prose script only.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 p-4 rounded text-slate-650">
                <p className="text-[11px] font-bold text-slate-800 mb-2 uppercase tracking-wide">Clean exports run auto-filters for:</p>
                <ul className="list-disc pl-4 text-[10px] text-slate-500 flex flex-col gap-1.5 leading-normal">
                  <li><span className="font-semibold text-slate-700">QA Reports & planning templates</span></li>
                  <li><span className="font-semibold text-slate-700">Internal debug or status logs</span></li>
                  <li><span className="font-semibold text-slate-700">Excess generation fragments</span> (e.g., "[идет генерация]")</li>
                  <li><span className="font-semibold text-slate-700">Decorative separators</span> (e.g., "=== PART ONE ===" or "---")</li>
                </ul>
              </div>

              <button 
                onClick={handleDownload}
                className="w-full py-3 bg-slate-900 hover:bg-slate-850 active:bg-black text-white rounded font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Save Clean Script (.txt)
              </button>
            </div>

            {/* Right Column: Live Clean Script Preview */}
            <div className="lg:col-span-3 flex flex-col border border-slate-200 bg-white rounded shadow-sm overflow-hidden h-full min-h-0">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-150 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Live Clean Preview</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                    {cleanedScriptText.length} chars | {cleanedScriptText.split(/\s+/).filter(Boolean).length} words
                  </span>
                  <button
                    onClick={handleCopyToClipboard}
                    className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-500 cursor-pointer"
                  >
                    {copied ? '✅ Copied!' : '📋 Copy All'}
                  </button>
                </div>
              </div>
              
              {cleanExportValidation && !cleanExportValidation.ok && (
                <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-col gap-2 shrink-0">
                  <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider">Export Validation Failed</h4>
                  <ul className="text-xs text-rose-600 list-disc list-inside space-y-1">
                    {cleanExportValidation.failures.slice(0, 5).map((f: any, i: number) => (
                      <li key={i}><strong>[{f.code}]</strong> {f.message}</li>
                    ))}
                    {cleanExportValidation.failures.length > 5 && (
                      <li>...and {cleanExportValidation.failures.length - 5} more issues.</li>
                    )}
                  </ul>
                </div>
              )}
              
              <textarea
                readOnly
                className="flex-1 w-full h-full p-6 text-[13px] text-slate-700 leading-relaxed font-sans bg-slate-50/50 resize-none focus:outline-none overflow-y-auto"
                value={cleanedScriptText || "Awaiting story contents..."}
                placeholder="The compiled clean script will appear here as you write parts..."
              />
            </div>
          </div>
        ) : isScriptStage && activeTab === 'parts' ? (
          <ScriptWriterPanel 
             parts={scriptParts}
             updatePart={updateScriptPart}
             onGeneratePart={onGeneratePart}
             onGenerateAllParts={onGenerateAllParts}
             onStopBatchGeneration={onStopBatchGeneration}
             onClearAllParts={onClearAllParts}
             onInitScriptParts={onInitScriptParts}
             onClearPart={onClearPart}
             isBatchGenerating={isBatchGenerating}
             onCheckPart={onCheckPart}
             onRebuildPart={onRebuildPart}
             onAssembleScript={() => {
                onAssembleScript();
                setActiveTab('full');
             }}
             stageStatus={stageStatus}
             autopilotState={autopilotState}
          />
        ) : (
          <div className="flex-1 relative border border-slate-200 bg-white overflow-hidden group shadow-sm mt-4 flex flex-col">
            <textarea
              disabled={stageStatus === 'locked'}
              className="w-full h-full bg-transparent p-8 text-[14px] text-slate-700 leading-[1.6] font-sans resize-none focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              value={stageContent}
              onChange={e => updateStageContent(e.target.value)}
              placeholder={stageStatus === 'not_started' ? `Click "Regenerate Stage" to create ${stageName.toLowerCase()}...` : "Edit content directly here..."}
            />
            {stageStatus !== 'locked' && stageStatus !== 'not_started' && (
              <div className="absolute top-4 right-4 z-10">
                <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 border shadow-sm rounded-sm ${
                  hasSupervisorReport 
                    ? "bg-slate-100 text-slate-600 border-slate-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {hasSupervisorReport ? "✓ Checked & Stable" : "⚠️ Needs recheck after manual edit"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
