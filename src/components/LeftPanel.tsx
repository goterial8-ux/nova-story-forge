import React from 'react';
import { ProjectState } from '../types';
import { Settings, FileText, Anchor, Save, Download, Upload, Server, RefreshCw } from 'lucide-react';


const CHARACTER_NAME_STOPWORDS = new Set([
  "About", "Action", "After", "Again", "All", "And", "Antagonist", "Approved",
  "Before", "Character", "Characters", "Chapter", "Contract", "Current",
  "English", "Engine", "Final", "First", "Forbidden", "From", "Genre", "Global",
  "Hook", "Idea", "Input", "Language", "Main", "Name", "Names", "Output",
  "Part", "Plan", "Power", "Project", "Raw", "Ready", "Role", "Scene", "Script",
  "Show", "Stage", "Story", "Style", "The", "This", "Title", "Writer", "Writing",
  "PART", "WRITER", "STYLE", "CARD", "Card", "Face", "Exit"
]);

function addCandidateName(map: Map<string, number>, rawName: string) {
  const cleaned = rawName
    .replace(/[`*_#>\[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return;

  const normalized = words
    .filter((word) => /^[A-Z][A-Za-z'-]{1,24}$/.test(word))
    .join(" ")
    .trim();

  if (!normalized) return;
  if (normalized.split(/\s+/).some((word) => CHARACTER_NAME_STOPWORDS.has(word))) return;

  map.set(normalized, (map.get(normalized) || 0) + 3);
}

function formatAutoCharacterNames(state: ProjectState): string {
  const source = [
    state.storyContract,
    state.characterBible,
    state.storyPlan,
    state.developedIdea,
    state.rawIdea,
    state.projectTitle,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!source.trim()) return "";

  const candidates = new Map<string, number>();

  const labeledPatterns = [
    /\b(?:Name|Placeholder Name|Protagonist|Main Character|Narrator|Wife|Husband|Friend|Ally|Antagonist|Lord|Enemy|Creature|Entity)\s*(?:or Placeholder Name)?\s*[:\-]\s*([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2})/gi,
    /\b([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2})\s*[,—-]\s*(?:main character|protagonist|narrator|wife|husband|antagonist|lord|ally|enemy|creature|entity)\b/gi,
  ];

  for (const pattern of labeledPatterns) {
    for (const match of source.matchAll(pattern)) {
      addCandidateName(candidates, match[1]);
    }
  }

  for (const match of source.matchAll(/\b[A-Z][A-Za-z'-]{2,24}(?:\s+[A-Z][A-Za-z'-]{2,24}){0,2}\b/g)) {
    addCandidateName(candidates, match[0]);
  }

  const sorted = Array.from(candidates.entries())
    .filter(([name, score]) => score >= 2 && !/^(Part|Chapter|Story|Scene|Stage)\b/i.test(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([name]) => `- ${name}: auto-detected project character/entity`);

  if (sorted.length === 0) return "";

  return ["LOCKED CHARACTER NAMES:", ...sorted].join("\n");
}


interface LeftPanelProps {
  state: ProjectState;
  updateState: (partial: Partial<ProjectState>) => void;
  onResetProject: () => void;
  saveStatus?: 'saved' | 'saving' | 'idle';
  onLoadBuiltInReferences: (force?: boolean) => void;
  isLoadingReferences?: boolean;
}

export function LeftPanel({ state, updateState, onResetProject, saveStatus, onLoadBuiltInReferences, isLoadingReferences }: LeftPanelProps) {
  const autoDetectedCharacterNames = React.useMemo(
    () => formatAutoCharacterNames(state),
    [
      state.storyContract,
      state.characterBible,
      state.storyPlan,
      state.developedIdea,
      state.rawIdea,
      state.projectTitle,
    ],
  );

  React.useEffect(() => {
    if (!String(state.characterNames || "").trim() && autoDetectedCharacterNames.trim()) {
      updateState({ characterNames: autoDetectedCharacterNames });
    }
  }, [autoDetectedCharacterNames, state.characterNames, updateState]);

  
  return (
    <aside className="w-[280px] h-full border-r border-slate-200 bg-white flex flex-col pt-4 overflow-hidden shrink-0">
      <div className="px-4 pb-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          Project Control
        </h2>
        <div className="flex items-center gap-2">
          {saveStatus && saveStatus !== 'idle' && (
            <span className={`text-[9px] font-bold uppercase transition-all duration-300 ${saveStatus === 'saving' ? 'text-blue-500 animate-pulse' : 'text-emerald-500 opacity-60'}`}>
              {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          )}
          <button className="p-1 rounded-none text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors" title="Save Project Settings">
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-600">Project Title</label>
          <input
            className="bg-white border border-slate-200 rounded-[2px] px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
            value={state.projectTitle}
            onChange={e => updateState({ projectTitle: e.target.value })}
            placeholder="Untitled Drama..."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex bg-slate-100 p-1 rounded-sm border border-slate-200">
            <button
              onClick={() => updateState({ ideaMode: 'develop_raw_idea' })}
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-sm transition-all ${state.ideaMode === 'develop_raw_idea' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              My Idea
            </button>
            <button
              onClick={() => updateState({ ideaMode: 'generate_from_references' })}
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-sm transition-all ${state.ideaMode === 'generate_from_references' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              Idea Lab
            </button>
          </div>
          
          <label className="text-[11px] font-semibold text-slate-600 mt-2">
            {state.ideaMode === 'develop_raw_idea' ? 'Raw Idea' : 'Seed / Direction (Optional)'}
          </label>
          <textarea
            className="bg-white border border-slate-200 rounded-[2px] px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-blue-500 min-h-24 resize-y leading-relaxed"
            value={state.rawIdea}
            onChange={e => updateState({ rawIdea: e.target.value })}
            placeholder={state.ideaMode === 'develop_raw_idea' 
              ? "A billionaire CEO goes undercover as a..." 
              : "E.g., Something about a medical genius..."}
          />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-600">Genre / Style</label>
          <input
            className="bg-white border border-slate-200 rounded-[2px] px-3 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:border-blue-500"
            value={state.genre}
            onChange={e => updateState({ genre: e.target.value })}
            placeholder="Drama / Revenge"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-600">Language</label>
            <select
              className="bg-white border border-slate-200 rounded-[2px] px-3 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:border-blue-500"
              value={state.language}
              onChange={e => updateState({ language: e.target.value })}
            >
              <option>English</option>
              <option>Korean</option>
              <option>Spanish</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-600">Target Length</label>
            <select
              className="bg-white border border-slate-200 rounded-[2px] px-3 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:border-blue-500"
              value={state.targetLength}
              onChange={e => updateState({ targetLength: e.target.value })}
            >
              <option>10-15 minutes</option>
              <option>15-20 minutes</option>
              <option>20-30 minutes</option>
              <option>30+ minutes</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
            Forbidden Elements
            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
          </label>
          <input
            className="bg-white border border-slate-200 rounded-[2px] px-3 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:border-blue-500"
            value={state.forbiddenElements}
            onChange={e => updateState({ forbiddenElements: e.target.value })}
            placeholder="No magic, no time travel..."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
            Locked Character Names
            <span className="text-[10px] text-slate-400 font-normal">Auto-filled</span>
          </label>
          <textarea
            className="bg-white border border-slate-200 rounded-[2px] px-3 py-2 text-[12px] text-slate-900 focus:outline-none focus:border-blue-500 min-h-28 resize-y leading-relaxed"
            value={state.characterNames || autoDetectedCharacterNames}
            onChange={e => updateState({ characterNames: e.target.value })}
            placeholder={"LOCKED CHARACTER NAMES:\n- Character Name: role / description"}
          />
          <p className="text-[10px] text-slate-400 leading-normal">
            Auto-filled from Story DNA / Story Plan when empty. Edit manually only if the detection is wrong.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
            Competitor Style References
            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
          </label>
          <textarea
            className="bg-white border border-slate-200 rounded-[2px] px-3 py-1.5 text-[12px] text-slate-900 focus:outline-none focus:border-blue-500 h-24 resize-y"
            value={state.competitors}
            onChange={e => updateState({ competitors: e.target.value, referenceLibraryLoaded: false })}
            placeholder="Paste competitor scripts here for style reference (do not copy meaning)..."
          />
        </div>

        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-[2px] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-tight flex items-center gap-1.5">
              <span>✍️ Claude Script Writer</span>
            </span>
            <input
              id="claudeLiteToggle"
              type="checkbox"
              checked={state.claudeLiteMode !== false}
              onChange={e => updateState({ claudeLiteMode: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-indigo-200 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>
          <p className="text-[10px] text-indigo-700/80 leading-normal">
            <strong>Lite Mode Enabled:</strong> Claude uses short, high-signal drafting prompts. Heavy rules and multi-step supervisor repair loops are stripped to keep prose clean & authorial.
          </p>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-[2px] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">Strategy Library</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${state.referenceLibraryLoaded ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {state.referenceLibraryLoaded ? 'Built-in loaded' : 'Optional'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Injects 6 professional competitor strategy scripts as rich style guidelines during AI text generation.
          </p>
          <button
            type="button"
            onClick={() => onLoadBuiltInReferences(true)}
            disabled={isLoadingReferences}
            className="mb-1 px-2 py-1.5 bg-slate-900 disabled:bg-slate-300 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-all"
          >
            {isLoadingReferences ? 'Loading References...' : 'Restore Built-in References'}
          </button>
        </div>

        {state.stageStatuses['story_dna'] === 'locked' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
             <h3 className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-2">
               Locked Story Contract
             </h3>
             <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 border-dashed rounded-[2px] p-4 leading-relaxed">
               <strong>Protagonist power source</strong> and <strong>emotional engine</strong> are locked. AI is restricted from drifting.
             </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-2 shrink-0">
        <div className="grid grid-cols-2 gap-2">
           <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider transition-all">
             <Save className="w-3 h-3" /> Save Draft
           </button>
           <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider transition-all">
             <Server className="w-3 h-3" /> Load Draft
           </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
           <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider transition-all">
             <Upload className="w-3 h-3" /> Import
           </button>
           <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider transition-all">
             <Download className="w-3 h-3" /> Export
           </button>
        </div>
        <button 
          onClick={onResetProject}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-[11px] font-black uppercase tracking-widest transition-all mt-2"
        >
          <RefreshCw className="w-4 h-4" /> Reset Project
        </button>
      </div>
    </aside>
  );
}
