import { ProjectState, StageId } from "../types";
import {
  clipForWriter,
  extractPartSlice,
  summarizeApprovedPartForContinuity,
} from "./partUtils";

const DRAFT_SCRIPT_CONTRACT = `=== DRAFT SCRIPT CONTRACT ===
Draft script output format and goals:
- Final script language is English only.
- Prioritize correct story progression, survival premise, first-person voice, continuity, and complete part generation.
- The story must be told in a living first-person recap voice using "I", "my", and "we" naturally.
- Each normal narrator paragraph represents one visual frame.
- Every normal narrator paragraph must be 120-220 characters including spaces.
- Short punch lines are allowed only for dialogue, system notifications, impact lines, or cliffhanger beats.
- Do not stack many short lines. Most narration paragraphs must stay inside 120-220 characters.
- Each paragraph must contain one concrete visual beat: action, image, reaction, decision, danger, resource use, or payoff.
- Explain tactics/plans through action and immediate consequence, not through long textbook exposition.
- Do not copy competitor paragraph formatting. Convert reference rhythm into frame-sized narration.
- Do not use stage labels, scene labels, markdown tables, bullet lists, debug notes, or unfinished markers in the final script.`;

const HARD_RECAP_STYLE_LOCK = `=== HARD RECAP STYLE LOCK ===

You are writing a YouTube manga/manhwa recap script.

The style must be simple, direct, fast, and visual.

This is not a novel.
This is not literary prose.
This is not atmospheric writing.
This is not a character psychology essay.
This is not a technical explanation.

Sentence rules:
- Maximum twelve words per sentence whenever possible.
- Never use long chained sentences.
- Avoid sentences with three or more commas.
- Avoid poetic metaphors.
- Avoid slow descriptions of nature, smell, weather, or mood.
- Avoid internal monologue longer than two short sentences.
- Use simple action verbs.
- Keep every sentence easy to read aloud.

Core rhythm:
- Action.
- Reaction.
- Next action.
- Result.
- New pressure.

Scene structure:
- One sentence shows the situation.
- One sentence shows the threat or problem.
- One sentence shows what I notice.
- One sentence shows what I do.
- One sentence shows the result.
- One sentence shows the enemy, ally, crowd, or environment reaction.
- Then move forward.

Every scene must contain:
- a visible problem;
- a practical action;
- a concrete result;
- a reaction from someone or something;
- a reason to continue watching.

Forbidden style:
- No long literary description.
- No beautiful sadness prose.
- No philosophical monologue.
- No abstract emotional explanation.
- No slow inner reflection.
- No academic or technical report tone.
- No scene labels.
- No bullet points.
- No markdown.
- No explanations before or after the script.

Use this rhythm for every part:
I see the problem.
I notice one useful detail.
I act.
The world reacts.
Someone doubts, fears, laughs, or panics.
The result becomes visible.
A new problem appears.

Length lock:
For a nine-part script targeting 120,000-130,000 total characters, each part must be 12,500-14,500 characters including spaces.
Absolute maximum per part: 15,000 characters.
Never exceed 15,000 characters for one part.
When the part reaches about 14,000 characters, finish the current beat and stop.
Do not expand previous recap into new narration.
Do not become literary to increase length.
Compress events into short recap beats instead.`;

const PART_WRITING_PREFLIGHT_LOCK = `=== PART WRITING PREFLIGHT LOCK ===

Before writing this part, silently verify these rules:

1. Current part only:
- Write only the current part.
- Follow the current part plan slice.
- Follow the current part scene cards.
- Do not jump ahead.
- Do not import future events.
- Do not expand previous recap into new scenes.

2. Style:
- Write in direct YouTube manga/manhwa recap style.
- Use short, clear sentences.
- Prefer action -> reaction -> next action.
- Do not write literary prose.
- Do not write slow atmosphere.
- Do not write long inner monologue.
- Do not explain emotions abstractly.
- Show emotions through action, face, body, crowd, enemy, ally, or result.

3. Paragraph length:
- Every normal narrator paragraph must be 120-220 characters including spaces.
- Aim for 150-190 characters for most paragraphs.
- Shorter lines are allowed only for dialogue, impact, system messages, or cliffhangers.
- Do not create many one-sentence micro-paragraphs.
- Do not create long blocks above 220 characters.
- If a paragraph becomes too long, split it into two visual beats.
- If a paragraph is too short, merge it with the next action or reaction.

4. Scene rhythm:
- Situation.
- Threat.
- What I notice.
- What I do.
- Result.
- Reaction.
- Next pressure.

5. Length:
- Keep this part inside the required part length.
- Do not exceed the hard maximum for the part.
- Compress events instead of becoming literary.

Return only the script text.
No notes.
No markdown.
No scene labels.
No explanation.`;

const FINAL_POLISH_CONTRACT = `=== FINAL POLISH CONTRACT ===
Strict final polish format and cleanup rules:
- Final script language is English only.
- The story must be told in a living first-person recap voice using "I", "my", and "we" naturally.
- Each normal narrator paragraph represents one visual frame.
- Every normal non-avatar paragraph MUST be strictly between 120 and 220 characters including spaces. Hard limit.
- Each paragraph must contain one concrete visual beat: action, image, reaction, decision, danger, resource use, or payoff.
- Explain tactics through action and immediate consequence, not through long textbook exposition.
- Remove all repeated adjectives, passive fluff, and clean up the export for smooth voiceover.
- Ensure all scientific/technical/lecture style terms are replaced with visual survival language.
- Keep the exact plot and scene order unchanged.
- Do not use stage labels, scene labels, markdown tables, bullet lists, debug notes, or unfinished markers in the final script.`;

const SCRIPT_VOICE_RULES_CONTRACT = `=== STRICT WRITER VOICE LOCK CONTRACT ===
Write like a human manga/manhwa recap screenwriter. Do not write like a scientist or technical analyst.
The script must NOT sound like a science report, engineering textbook, game design document, or AI analysis. It must sound like a fast, visual YouTube manga/manhwa recap narration:
- Direct, visual, emotional, fast-moving, easy to hear in voiceover.
- Focused on action, reaction, humiliation, payoff, and escalation.

Forbidden tone details to AVOID:
- Technical reports, engineering lectures, academic explanations, raw physics explanations, sci-fi system manuals, dry technical analysis, over-explaining mechanics.
- Do NOT use these scientific or technical terms unless absolutely necessary: structural, structural weak point, thermal signature, conductive, pressure system, optimized, resource loop, tactical analysis, calculated trajectory, energy source, mechanism efficiency, biological sample, facility, proctor, test subject, exoskeleton, plasma, laser, military armory, calculation, physics explanation.

Instead, replace technical language with simple, visual physical language, focusing on what the protagonist sees, what they do, what changes on screen, and how allies/enemies react:
- Bad: "The protagonist identified the structural weak point in the unstable coastal formation."
- Good: "I saw one cracked stone holding the whole slope together. If that stone moved, the cliff would fall."
- Bad: "The thermal signature confirmed a subterranean heat source."
- Good: "A thin shimmer rose from the rocks. Something warm was hiding beneath."
- Bad: "He calculated the optimal load distribution."
- Good: "I tied the rope lower, shifted the weight, and the log finally rose without breaking my back."
- Bad: "The system created a sustainable resource loop."
- Good: "Water dripped into the bottle by itself. Food was secure. For the first time, I could rest."

GENERATION / PROGRESSION SEQUENCE:
Before writing any script part, structure your paragraph sequence to apply this rhythm:
problem appears -> protagonist notices one useful detail -> simple action -> visible result -> rival/ally reacts -> payoff lands -> new pressure appears.

Explanation constraints:
- Keep explanations short.
- Every technical idea must become a visual action within one or two sentences.
- Follow the approved story contract, approved story plan, and current part scene cards.
- Do not import setting, vocabulary, enemies, resources, names, or mechanics from another project.
- Use only the current project’s approved setting, protagonist, resources, conflict, and progression logic.

REPAIR RULE:
- If a generated part has scientific or technical tone, discard that wording. Do not repair around the wrong vocabulary; rewrite it completely into visual human recap narration.

HARD DRIFT RULE:
- If the part introduces sci-fi/facility/dungeon/test vocabulary not in the approved plan, discard the part and rebuild it from scratch using the plan and scene cards.`;

const STYLE_REFERENCE_USE_CONTRACT = `Competitor/reference usage contract:
- References are used only for abstract style DNA: narration rhythm, first-person voice, pressure cadence, action explanation, payoff timing, and transition energy.
- Do not copy competitor plots, titles, names, powers, scene concepts, world mechanics, or unique twists.
- Preserve the locked project premise and niche rules even when a reference has a tempting structure.
- If style conflicts with the locked story contract, the locked story contract wins.`;

const NARRATIVE_DYNAMICS_CONTRACT = `Narrative dynamics contract:
- Do not write scenes as straight task completion. Every scene needs resistance, reaction, and a small change in direction.
- Use micro-turns every few paragraphs: a new obstacle, a misunderstood detail, a hidden cost, ally doubt, enemy reaction, resource shortage, timing pressure, public humiliation, partial reveal, or small failure that forces adaptation.
- A micro-turn must change what the protagonist does next. Do not add random twists that do not affect action.
- Keep the rhythm: pressure -> choice -> action -> complication -> adaptation -> visible payoff -> new pressure.
- The protagonist should not simply know and win. Let execution be risky, incomplete, physical, social, or time-limited.
- Enemies should react intelligently. Allies should create friction or solve specific micro-problems.
- Avoid robotic narration patterns such as "I did X. Then I did Y. Then I did Z." Each beat needs cause, consequence, and emotional pressure.`;

const REFERENCE_STYLE_BLUEPRINT = `Reference style blueprint:
- Open with pressure, danger, humiliation, or a concrete impossible image. Do not open with neutral lore.
- Keep a living first-person narrator: tactical, observant, wounded, pragmatic, and biased by survival pressure.
- Build paragraphs as visual frames. Each frame must add a new action, calculation, consequence, reaction, or resource decision.
- Explanations must be short and attached to danger. Explain only enough for the viewer to understand why the action works.
- Let the narrator think on the page: options, risk, cost, timing, what fails, what might work, and why there is no clean choice.
- Use reference scripts for cadence: pressure, practical action, quick analysis, visible payoff, and a new hook.
- Strong scenes feel authored because the protagonist has a specific worldview, not because the prose is decorative.
- Face-slap payoff should land as one sharp image or public reaction, then move forward. Do not over-explain the victory.
- Do not imitate one-paragraph competitor formatting. Convert the voice rhythm into frame-sized paragraphs for this pipeline.`;

const AUTHOR_VOICE_PASS_CONTRACT = `Author voice pass contract:
- Before returning any script part or clean export, silently perform an Author Voice Pass.
- Preserve plot, facts, names, scene order, paragraph format, and continuity. Rewrite style only unless a scene is broken.
- Remove robotic summary rhythm. The text must not read like "I did this, then I did that, then the next thing happened."
- Give the narrator a human tactical bias: what they notice first, what they ignore, what they fear, what they calculate, what they refuse to say aloud.
- Replace generic emotional labels with physical reaction, decision, or observation.
- Replace abstract drama with concrete pressure: a tool slipping, a crowd reacting, a resource running out, an enemy changing tactics.
- Every paragraph needs a reason to exist: new information, new action, new risk, new consequence, new joke, or new payoff.
- If a paragraph could fit any random fantasy recap, rewrite it until it belongs only to this story.
- The final read should feel like a real YouTube manga/manhwa recap writer shaped the voice, not a neutral model summarizing events.`;

const MANGA_SCREENWRITER_TECHNIQUE_CONTRACT = `Manga screenwriter technique contract:
- Think like a manga/manhwa screenwriter, not a novelist. The unit of storytelling is a visible panel, reaction, turn, and hook.
- Panel logic: each script paragraph should imply one clear panel or camera beat with a subject, action, emotion, object, scale, and visual focus.
- Page-turn hooks: every few paragraphs must create a reason to continue: danger, humiliation, hidden cost, strange object, enemy reaction, ally doubt, resource limit, or a new tactical question.
- Reaction shot discipline: after every important action, show one specific reaction from an enemy, ally, crowd, creature, machine, system, or environment. Do not explain the reaction in abstract terms.
- Setup/payoff ledger: if a resource, flaw, rule, tool, wound, debt, promise, hidden path, or weakness appears, mark how it can return later. Payoffs must feel planted, not random.
- False victory: do not let scenes end as simple success. A win should reveal a larger problem, create a debt, expose the hero, attract enemies, damage a resource, or force a harder choice.
- Status reversal: whenever the protagonist is mocked, make the later payoff reverse that exact insult in public or through a visible consequence.
- Signature scene rule: every major part needs one scene a viewer can remember in one sentence, such as "he turned trash into shelter while nobles froze."
- Character function beats: allies must create friction, solve a specific micro-problem, or change the execution. They are not background witnesses.
- Antagonist pressure beats: enemies should adapt after being fooled once. They can be arrogant, but not brainless.
- Visual escalation ladder: each part should upgrade what the viewer can see: shelter, tool, map, weapon, wall, farm, clan, machine, route, army, city, public status, or final reversal.
- Quiet panel rule: after a loud payoff, use one short visual beat of silence, damage, stunned reaction, or exhausted work. Then hook into the next threat.
- Do not overuse the same trick. Vary hooks, reactions, face-slaps, ally functions, and false victories across the story.`;

const RETENTION_MAP_CONTRACT = `Retention map contract:
- Treat the script as a YouTube retention engine, not only a story summary.
- Part One must begin with immediate pressure, humiliation, danger, impossible survival math, or a visually strange problem. No slow lore opening.
- Every scene cluster needs a viewer question: What is the trick? Will the resource work? Who noticed? What did the enemy miss? What breaks next?
- Every thirty to forty-five seconds of voiceover should contain at least one retention beat: threat, reveal, choice, reversal, cost, visual payoff, status shift, comedy beat, or cliffhanger.
- Do not let two calm explanation paragraphs stand back-to-back. Insert physical action, dialogue, reaction, deadline, resource loss, or enemy movement.
- Use open loops deliberately. Plant a detail, let the viewer remember it, then pay it off later in a visible way.
- End each part with forward pull: a new enemy response, a resource shortage, a larger map reveal, a public rumor, a broken tool, or a worse version of the same problem.
- The final payoff must close the strongest open loops from earlier, not appear as a random final upgrade.`;

const REPETITION_KILLER_CONTRACT = `Repetition killer contract:
- Do not repeat the same part engine. Each part needs a different dominant pressure type, resource problem, ally function, antagonist move, and payoff image.
- Track variety across the story: survival pressure, social pressure, resource pressure, engineering pressure, moral cost, public humiliation, hidden betrayal, weather/terrain pressure, logistics pressure, and enemy adaptation.
- Face-slaps must vary. Do not always use the same pattern of "enemy mocks, hero builds, enemy is shocked." Change the insult, preparation, public witness, visual result, and consequence.
- Progression must vary visually. Avoid repeated upgrades that feel like the same wall, shelter, weapon, or machine with a new label.
- Ally beats must rotate: one ally doubts, one solves a micro-task, one causes friction, one notices a clue, one protects time, one manages people, one pays a cost.
- Enemy reactions must escalate. After being humiliated once, enemies should adapt, sabotage, copy badly, bait the hero, attack supply lines, manipulate public opinion, or force a deadline.
- If a scene feels like a previous scene with renamed objects, rebuild it around a new pressure source and a different payoff shape.
- Before approving any plan or script, check whether the middle has unique functions instead of repeated problem-solution loops.`;

const STYLE_FAILURE_CHECKLIST = `Style failure checklist:
- Fail if the script is technically correct but sounds generic, sterile, or interchangeable with another story.
- Fail if several paragraphs start with the same flat transition such as "Then I", "After that", "I started", "I began", or "I realized".
- Fail if the narrator reports events without real-time analysis, tradeoffs, pressure, or a specific survival worldview.
- Fail if action has no resistance: no cost, no pushback, no mistake, no enemy reaction, no ally doubt, no resource limit.
- Fail if payoffs are explained instead of shown through one concrete image or public reaction.
- Fail if style references are copied as plot, names, powers, scenes, or unique twists.
- Repair style problems with a targeted Author Voice Pass, not a full plot rewrite.`;

function clipText(value: string, maxChars: number): string {
  if (!value || value.length <= maxChars) return value || "";
  const head = Math.floor(maxChars * 0.62);
  const tail = Math.floor(maxChars * 0.33);
  return `${value.slice(0, head)}\n\n[...TRUNCATED FOR PROMPT SIZE...]\n\n${value.slice(-tail)}`;
}

function referenceExamples(state: ProjectState, maxChars = 45_000): string {
  return clipText(state.competitors || "None", maxChars);
}

function authorialStyleBlock(): string {
  return [
    `=== STRICT WRITER VOICE LOCK CONTRACT ===\n${SCRIPT_VOICE_RULES_CONTRACT}`,
    `=== REFERENCE STYLE BLUEPRINT ===\n${REFERENCE_STYLE_BLUEPRINT}`,
    `=== AUTHOR VOICE PASS CONTRACT ===\n${AUTHOR_VOICE_PASS_CONTRACT}`,
    `=== MANGA SCREENWRITER TECHNIQUE CONTRACT ===\n${MANGA_SCREENWRITER_TECHNIQUE_CONTRACT}`,
    `=== RETENTION MAP CONTRACT ===\n${RETENTION_MAP_CONTRACT}`,
    `=== REPETITION KILLER CONTRACT ===\n${REPETITION_KILLER_CONTRACT}`,
    `=== STYLE FAILURE CHECKLIST ===\n${STYLE_FAILURE_CHECKLIST}`,
  ].join("\n\n");
}

export function buildPrompt(stageId: StageId, state: ProjectState): string {
  let prompt = "";

  if (
    stageId !== "idea_market" &&
    stageId !== "raw_idea" &&
    stageId !== "story_dna" &&
    stageId !== "story_plan"
  ) {
    prompt += `=== GLOBAL RULES ===\n${state.promptRegistry.globalRulesPrompt}\n\n`;

    if (state.styleDna) {
      prompt += `=== APPROVED STYLE DNA (LOCKED INSTRUCTION) ===\n${state.styleDna}\n\n`;
    }

    if (state.stageStatuses["story_dna"] === "locked") {
      prompt += `=== LOCKED STORY CONTRACT ===\n${state.storyContract}\n${state.characterBible}\n\n`;
    }

    prompt += `=== PREVIOUS STAGE CONTEXT ===\n`;
  }

  switch (stageId) {
    case "scene_cards":
      prompt += `Story Plan (Stage 3): ${state.storyPlan}\n`;
      break;
    case "script_writer":
      prompt += `Story Plan (Stage 3): ${state.storyPlan}\nScene Cards (Stage 4): ${state.sceneCards}\n`;
      break;
    case "clean_export":
      prompt += `Final Script: ${state.fullScript}\nClean Export Mode: ${JSON.stringify(state.cleanExportSettings)}\n`;
      break;
  }
  prompt += `\n=== STAGE TASK ===\n`;

  switch (stageId) {
    case "idea_market":
      let stage0Prompt = state.promptRegistry.stageZeroIdeaMarketPrompt || "";
      stage0Prompt = stage0Prompt.replaceAll(
        "{{IDEA_MODE}}",
        state.ideaMode || "develop_raw_idea",
      );
      stage0Prompt = stage0Prompt.replaceAll(
        "{{RAW_IDEA}}",
        state.rawIdea || "None",
      );
      stage0Prompt = stage0Prompt.replaceAll(
        "{{GENRE}}",
        state.genre || "None",
      );
      stage0Prompt = stage0Prompt.replaceAll(
        "{{FORBIDDEN_ELEMENTS}}",
        state.forbiddenElements || "None",
      );
      stage0Prompt = stage0Prompt.replaceAll(
        "{{COMPETITOR_REFERENCE_EXAMPLES}}",
        referenceExamples(state),
      );
      stage0Prompt = stage0Prompt.replaceAll(
        "{{COMPETITOR_STYLE_BLUEPRINT}}",
        authorialStyleBlock(),
      );
      stage0Prompt = stage0Prompt.replaceAll(
        "{{GLOBAL_RULES}}",
        state.promptRegistry.globalRulesPrompt,
      );
      prompt +=
        stage0Prompt +
        `\n\n` +
        (state.promptRegistry.stageZeroIdeaMarketExampleResponse || "");
      break;

    case "raw_idea":
      let stage1Prompt = state.promptRegistry.stageOneRawIdeaPrompt;
      stage1Prompt = stage1Prompt.replaceAll(
        "{{PROJECT_TITLE}}",
        state.projectTitle || "None",
      );
      stage1Prompt = stage1Prompt.replaceAll(
        "{{RAW_IDEA}}",
        state.rawIdea || "None",
      );
      stage1Prompt = stage1Prompt.replaceAll(
        "{{GENRE}}",
        state.genre || "None",
      );
      stage1Prompt = stage1Prompt.replaceAll("{{OUTPUT_LANGUAGE}}", "Russian");
      stage1Prompt = stage1Prompt.replaceAll(
        "{{TARGET_LENGTH}}",
        state.targetLength || "None",
      );
      stage1Prompt = stage1Prompt.replaceAll(
        "{{STYLE_NOTES}}",
        state.styleNotes || "None",
      );
      stage1Prompt = stage1Prompt.replaceAll(
        "{{FORBIDDEN_ELEMENTS}}",
        state.forbiddenElements || "None",
      );
      stage1Prompt = stage1Prompt.replaceAll(
        "{{COMPETITOR_STYLE_NOTES}}",
        referenceExamples(state),
      );
      stage1Prompt = stage1Prompt.replaceAll(
        "{{GLOBAL_RULES}}",
        state.promptRegistry.globalRulesPrompt,
      );
      prompt +=
        stage1Prompt + `\n\n` + state.promptRegistry.stageOneExampleResponse;
      break;

    case "style_analyzer":
      let stylePrompt =
        (state.promptRegistry as any).stageStyleAnalyzerPrompt || "";
      stylePrompt = stylePrompt.replaceAll(
        "{{COMPETITORS}}",
        referenceExamples(state),
      );
      stylePrompt = stylePrompt.replaceAll(
        "{{RAW_IDEA}}",
        state.rawIdea || state.developedIdea || "None",
      );
      stylePrompt = stylePrompt.replaceAll(
        "{{GLOBAL_RULES}}",
        state.promptRegistry.globalRulesPrompt,
      );
      prompt +=
        stylePrompt +
        `\n\n` +
        ((state.promptRegistry as any).stageStyleAnalyzerExampleResponse ||
          "") +
        `\n\nIMPORTANT: Output the extracted Style DNA and analysis in Russian language.`;
      break;

    case "story_dna":
      let stage2Prompt = state.promptRegistry.stageTwoStoryDNAPrompt;
      stage2Prompt = stage2Prompt.replaceAll(
        "{{PROJECT_TITLE}}",
        state.projectTitle || "None",
      );
      stage2Prompt = stage2Prompt.replaceAll(
        "{{DEVELOPED_IDEA}}",
        state.developedIdea || "None",
      );
      stage2Prompt = stage2Prompt.replaceAll(
        "{{STAGE_ONE_HANDOFF}}",
        "Refer to the Handoff Summary in the Developed Idea above.",
      );
      stage2Prompt = stage2Prompt.replaceAll(
        "{{GENRE}}",
        state.genre || "None",
      );
      stage2Prompt = stage2Prompt.replaceAll("{{OUTPUT_LANGUAGE}}", "Russian");
      stage2Prompt = stage2Prompt.replaceAll(
        "{{TARGET_LENGTH}}",
        state.targetLength || "None",
      );
      stage2Prompt = stage2Prompt.replaceAll(
        "{{STYLE_NOTES}}",
        state.styleNotes || "None",
      );
      stage2Prompt = stage2Prompt.replaceAll(
        "{{FORBIDDEN_ELEMENTS}}",
        state.forbiddenElements || "None",
      );
      stage2Prompt = stage2Prompt.replaceAll(
        "{{GLOBAL_RULES}}",
        state.promptRegistry.globalRulesPrompt,
      );
      const stage2SupervisorNotes =
        state.promptHistory
          .filter((h) => h.stageId === "story_dna" && h.supervisorStatus)
          .map((h) => h.outputPreview)
          .join("\\n") || "None";
      stage2Prompt = stage2Prompt.replaceAll(
        "{{SUPERVISOR_NOTES}}",
        stage2SupervisorNotes,
      );
      prompt +=
        stage2Prompt + `\n\n` + state.promptRegistry.stageTwoExampleResponse;
      break;

    case "story_plan":
      let stage3Prompt = state.promptRegistry.stageThreeStoryPlanPrompt;
      stage3Prompt = stage3Prompt.replaceAll(
        "{{PROJECT_TITLE}}",
        state.projectTitle || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{DEVELOPED_IDEA}}",
        state.developedIdea || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{STORY_CONTRACT}}",
        state.storyContract || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{CHARACTER_BIBLE}}",
        state.characterBible || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{GENRE}}",
        state.genre || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll("{{OUTPUT_LANGUAGE}}", "Russian");
      stage3Prompt = stage3Prompt.replaceAll(
        "{{TARGET_LENGTH}}",
        state.targetLength || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{STYLE_NOTES}}",
        state.styleNotes || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{FORBIDDEN_ELEMENTS}}",
        state.forbiddenElements || "None",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{COMPETITOR_REFERENCE_EXAMPLES}}",
        referenceExamples(state),
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{COMPETITOR_STYLE_BLUEPRINT}}",
        authorialStyleBlock(),
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{AVATAR_COMMENTARY_SETTING}}",
        state.useAvatars ? "Enabled" : "Disabled",
      );
      stage3Prompt = stage3Prompt.replaceAll(
        "{{GLOBAL_RULES}}",
        state.promptRegistry.globalRulesPrompt,
      );
      const stage3SupervisorNotes =
        state.promptHistory
          .filter((h) => h.stageId === "story_plan" && h.supervisorStatus)
          .map((h) => h.outputPreview)
          .join("\\n") || "None";
      stage3Prompt = stage3Prompt.replaceAll(
        "{{SUPERVISOR_NOTES}}",
        stage3SupervisorNotes,
      );
      prompt +=
        stage3Prompt + `\n\n` + state.promptRegistry.stageThreeExampleResponse;
      break;

    case "scene_cards":
      let stage4Prompt = state.promptRegistry.stageFourSceneCardsPrompt;
      stage4Prompt = stage4Prompt.replaceAll(
        "{{PROJECT_TITLE}}",
        state.projectTitle || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll("{{OUTPUT_LANGUAGE}}", "Russian");
      stage4Prompt = stage4Prompt.replaceAll(
        "{{GENRE}}",
        state.genre || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{TARGET_LENGTH}}",
        state.targetLength || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{DEVELOPED_IDEA}}",
        state.developedIdea || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{STORY_CONTRACT}}",
        state.storyContract || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{CHARACTER_BIBLE}}",
        state.characterBible || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{STORY_PLAN}}",
        state.storyPlan || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll("{{CURRENT_PART_NUMBER}}", "None");
      stage4Prompt = stage4Prompt.replaceAll("{{CURRENT_PART_PLAN}}", "None");
      stage4Prompt = stage4Prompt.replaceAll(
        "{{SCRIPT_FORMATTING_CONTRACT}}",
        DRAFT_SCRIPT_CONTRACT,
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{AVATAR_COMMENTARY_MAP}}",
        state.useAvatars ? "Enabled" : "Disabled",
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{COMPETITOR_REFERENCE_EXAMPLES}}",
        referenceExamples(state),
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{COMPETITOR_STYLE_BLUEPRINT}}",
        authorialStyleBlock(),
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{FORBIDDEN_ELEMENTS}}",
        state.forbiddenElements || "None",
      );
      stage4Prompt = stage4Prompt.replaceAll(
        "{{GLOBAL_RULES}}",
        state.promptRegistry.globalRulesPrompt,
      );
      const stage4SupervisorNotes =
        state.promptHistory
          .filter((h) => h.stageId === "scene_cards" && h.supervisorStatus)
          .map((h) => h.outputPreview)
          .join("\\n") || "None";
      stage4Prompt = stage4Prompt.replaceAll(
        "{{SUPERVISOR_NOTES}}",
        stage4SupervisorNotes,
      );
      prompt +=
        stage4Prompt + `\n\n` + state.promptRegistry.stageFourExampleResponse;
      break;

    case "script_writer":
      let stage5Prompt = state.promptRegistry.stageFiveScriptWriterPrompt;
      stage5Prompt = stage5Prompt.replaceAll(
        "{{PROJECT_TITLE}}",
        state.projectTitle || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll("{{OUTPUT_LANGUAGE}}", "English");
      stage5Prompt = stage5Prompt.replaceAll(
        "{{GENRE}}",
        state.genre || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{TARGET_LENGTH}}",
        state.targetLength || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{DEVELOPED_IDEA}}",
        state.developedIdea || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{STORY_CONTRACT}}",
        state.storyContract || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{CHARACTER_BIBLE}}",
        state.characterBible || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{STORY_PLAN}}",
        state.storyPlan || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{SCENE_CARDS}}",
        state.sceneCards || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll("{{CURRENT_PART_NUMBER}}", "None");
      stage5Prompt = stage5Prompt.replaceAll("{{CURRENT_PART_TITLE}}", "None");
      stage5Prompt = stage5Prompt.replaceAll(
        "{{CURRENT_PART_SCENE_CARDS}}",
        "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{PREVIOUS_APPROVED_SCRIPT_PARTS_SUMMARY}}",
        "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{REMAINING_PARTS_SUMMARY}}",
        "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{AVATAR_COMMENTARY_SETTING}}",
        state.useAvatars ? "Enabled" : "Disabled",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{AVATAR_SLOT_FOR_CURRENT_PART}}",
        "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{COMPETITOR_REFERENCE_EXAMPLES}}",
        referenceExamples(state),
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{COMPETITOR_STYLE_BLUEPRINT}}",
        authorialStyleBlock(),
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{SCRIPT_FORMATTING_CONTRACT}}",
        DRAFT_SCRIPT_CONTRACT,
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{FORBIDDEN_ELEMENTS}}",
        state.forbiddenElements || "None",
      );
      stage5Prompt = stage5Prompt.replaceAll(
        "{{GLOBAL_RULES}}",
        state.promptRegistry.globalRulesPrompt,
      );
      const stage5SupervisorNotes = "None";
      stage5Prompt = stage5Prompt.replaceAll(
        "{{SUPERVISOR_NOTES}}",
        stage5SupervisorNotes,
      );
      prompt += stage5Prompt;
      break;

    case "clean_export":
      let stage6Prompt = state.promptRegistry.stageSixCleanExportPrompt;
      stage6Prompt = stage6Prompt.replaceAll("{{OUTPUT_LANGUAGE}}", "English");
      prompt += stage6Prompt;
      prompt += `\n\n=== AUTHORIAL STYLE BLOCK ===\n${authorialStyleBlock()}`;
      prompt += `\n\n=== SCRIPT FORMATTING CONTRACT ===\n${FINAL_POLISH_CONTRACT}`;
      break;
  }

  return prompt;
}


function buildPreviousWrittenPartsContext(partNumber: number, state: ProjectState): string {
  const previousParts = state.scriptParts
    .filter((p) => p.partNumber < partNumber && p.draftText && p.draftText.trim().length > 0)
    .sort((a, b) => a.partNumber - b.partNumber);

  if (previousParts.length === 0) {
    return "None. This is the first written part.";
  }

  return previousParts
    .map((p) => {
      const paragraphs = p.draftText
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const opening = paragraphs.slice(0, 2).join(" ");
      const ending = paragraphs.slice(-3).join(" ");

      return [
        `Part ${p.partNumber}: ${p.partTitle}`,
        `Status: ${p.status}`,
        `Opening context: ${clipForWriter(opening, 450) || "Not available."}`,
        `Latest ending / continuity state: ${clipForWriter(ending, 900) || "Not available."}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export function buildManualFullPartPrompt(
  partNumber: number,
  state: ProjectState,
): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);
  const partTitle = part?.partTitle || `Part ${partNumber}`;
  const manualPlan = (part?.manualPartPlan || part?.sourcePartPlan || "").trim();
  const manualSceneCards = (part?.manualSceneCards || part?.sourceSceneCards || "").trim();
  const manualStyleRules = (part?.manualStyleRules || "").trim();
  const manualExtraInstruction = (part?.manualExtraInstruction || "").trim();
  const manualTargetChars = (part?.manualTargetChars || "12,000-15,000 characters including spaces").trim();
  const previousWrittenPartsContext = buildPreviousWrittenPartsContext(partNumber, state);

  const cleanDefaultStyleRules = `Ты сценарист YouTube manga/manhwa recap.

Я дам тебе Story Plan и Scene Cards. Используй их как единственный источник сценария.

Когда я прошу написать Part 1, Part 2 и так далее, ты пишешь полную часть сценария по соответствующей части плана и scene cards.

Не придумывай новую структуру.
Не переписывай план.
Не сокращай часть до пересказа.
Не объясняй, что ты делаешь.
Выдавай только готовый текст сценария.

Формат сценария:
- Язык сценария: English.
- Основной голос: first person от лица главного героя.
- Третье лицо разрешено, когда нужно показать действия других персонажей, реакцию врагов, толпы, семьи, армии, правителя или событие, которое герой не видит напрямую.
- Стиль: YouTube manga/manhwa recap.
- Текст должен звучать как voiceover для видео.

Объём:
- Одна команда = одна полная часть.
- Обычная длина части: 12,000-15,000 characters including spaces, если я не укажу другой диапазон.
- Не заканчивай часть слишком рано.
- Если ты просто перечислил события из плана, это плохо.
- Каждую сцену раскрывай через действия, реакции, последствия и напряжение.

Стиль:
- Пиши просто, ясно, драматично и визуально.
- Не пиши как сухой пересказ.
- Не пиши как отчёт.
- Не пиши как анализ.
- Ритм: давление → действие → реакция → результат → новое давление.

Абзацы:
- Каждый обычный абзац должен быть удобным для озвучки.
- Ориентир: 120-220 characters including spaces.
- Один абзац обычно содержит 2-4 коротких предложения.
- Не делай огромные абзацы.
- Не ставь каждое короткое предложение с новой строки.
- Абзац = один визуальный beat.

Раскрытие сцен:
- Каждую важную scene card раскрывай последовательностью beat-ов.
- Покажи ситуацию, угрозу, что герой замечает, что герой делает, что меняется, кто реагирует, какой результат и какое новое напряжение появляется.
- Не выкидывай важный бэкграунд из плана.
- Если в плане есть детство, отец, бедность, долги, унижение, опыт, обучение, страх или личная травма, используй это через действие и ситуацию.

Запрещено:
- Не выводи технические слова и мусор: WRITER, STAGE, STORY, CORE, FINAL, HARD, THIS, PART.
- Не выводи системные сообщения.
- Не выводи китайские или служебные сообщения об остановке генерации.
- Не меняй имена персонажей.`;

  return `Ты сценарист YouTube manga/manhwa recap.

Пиши только выбранную часть сценария.

Часть:
Part ${partNumber} — ${partTitle}

Объём:
${manualTargetChars}

=== CURRENT PART PLAN ===
${manualPlan || "[CURRENT PART PLAN IS EMPTY]"}

=== CURRENT PART SCENE CARDS ===
${manualSceneCards || "[CURRENT PART SCENE CARDS ARE EMPTY]"}

=== PREVIOUS WRITTEN PARTS CONTEXT ===
${previousWrittenPartsContext}

Используй предыдущие части только как память о том, что уже произошло. Не переписывай их в ответе.

=== STYLE RULES ===
${manualStyleRules || cleanDefaultStyleRules}

=== EXTRA INSTRUCTION ===
${manualExtraInstruction || "No extra instruction."}

Команда:
Напиши полную Part ${partNumber}.
Используй Current Part Plan и Current Part Scene Cards как основу.
Соблюдай стиль и объём.
Выдай только готовый текст сценария на English.`;
}


export function buildPartPrompt(
  partNumber: number,
  state: ProjectState,
): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);

  // Script Writer now uses manual full-part generation by default.
  // The old automatic PromptBuilder path remains below as a fallback only
  // if a part record cannot be found.
  if (part) {
    return buildManualFullPartPrompt(partNumber, state);
  }

  if (state.claudeLiteMode !== false) {
    return buildClaudeLitePartPrompt(partNumber, state);
  }

  let stage5Prompt = state.promptRegistry.stageFiveScriptWriterPrompt;
  stage5Prompt = stage5Prompt.replaceAll(
    "{{PROJECT_TITLE}}",
    state.projectTitle || "None",
  );
  stage5Prompt = stage5Prompt.replaceAll("{{OUTPUT_LANGUAGE}}", "English");
  stage5Prompt = stage5Prompt.replaceAll("{{GENRE}}", state.genre || "None");
  stage5Prompt = stage5Prompt.replaceAll(
    "{{TARGET_LENGTH}}",
    state.targetLength || "None",
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{DEVELOPED_IDEA}}",
    state.developedIdea || "None",
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{STORY_CONTRACT}}",
    state.storyContract || "None",
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{CHARACTER_BIBLE}}",
    state.characterBible || "None",
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{STORY_PLAN}}",
    clipForWriter(extractPartSlice(state.storyPlan, partNumber), 7000) ||
      clipForWriter(state.storyPlan || "None", 7000),
  );
  const currentSceneCardsSlice =
    clipForWriter(extractPartSlice(state.sceneCards, partNumber), 9000) ||
    clipForWriter(part?.sourceSceneCards || "None", 9000);

  stage5Prompt = stage5Prompt.replaceAll(
    "{{SCENE_CARDS}}",
    currentSceneCardsSlice || "None",
  );

  stage5Prompt = stage5Prompt.replaceAll(
    "{{CURRENT_PART_NUMBER}}",
    partNumber.toString(),
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{CURRENT_PART_TITLE}}",
    part?.partTitle || `Part ${partNumber}`,
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{CURRENT_PART_SCENE_CARDS}}",
    currentSceneCardsSlice || "None",
  );

  const previousParts = state.scriptParts.filter(
    (p) => p.partNumber < partNumber && p.status === "approved" && p.draftText && p.draftText.length > 0,
  );
  const previousSummary =
    previousParts.length > 0
      ? previousParts
          .map((p) => summarizeApprovedPartForContinuity(p))
          .join("\n\n------\n\n")
      : "None. This is the first part.";
  stage5Prompt = stage5Prompt.replaceAll(
    "{{PREVIOUS_APPROVED_SCRIPT_PARTS_SUMMARY}}",
    previousSummary,
  );

  const remainingParts = state.scriptParts.filter(
    (p) => p.partNumber > partNumber,
  );
  const remainingSummary =
    remainingParts.length > 0
      ? remainingParts
          .map((p) => `Part ${p.partNumber}: ${p.partTitle}`)
          .join("\n")
      : "None. This is the last part.";
  stage5Prompt = stage5Prompt.replaceAll(
    "{{REMAINING_PARTS_SUMMARY}}",
    remainingSummary,
  );

  stage5Prompt = stage5Prompt.replaceAll(
    "{{AVATAR_COMMENTARY_SETTING}}",
    state.useAvatars ? "Enabled" : "Disabled",
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{AVATAR_SLOT_FOR_CURRENT_PART}}",
    "Unknown/Not specified",
  );

  stage5Prompt = stage5Prompt.replaceAll(
    "{{COMPETITOR_REFERENCE_EXAMPLES}}",
    referenceExamples(state),
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{COMPETITOR_STYLE_BLUEPRINT}}",
    authorialStyleBlock(),
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{SCRIPT_FORMATTING_CONTRACT}}",
    DRAFT_SCRIPT_CONTRACT,
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{FORBIDDEN_ELEMENTS}}",
    state.forbiddenElements || "None",
  );
  stage5Prompt = stage5Prompt.replaceAll(
    "{{GLOBAL_RULES}}",
    state.promptRegistry.globalRulesPrompt,
  );

  const stage5SupervisorNotes = "None";
  stage5Prompt = stage5Prompt.replaceAll(
    "{{SUPERVISOR_NOTES}}",
    stage5SupervisorNotes,
  );

  const forbiddenDriftBlock = `\n\n=== STRICT FORBIDDEN DRIFT WARNING ===
Follow the approved story contract, approved story plan, and current part scene cards. Do not import settings, vocabulary, enemies, resources, names, or mechanics from another project. Use only the current project’s approved setting, protagonist, resources, conflict, and progression logic.`;
  stage5Prompt += forbiddenDriftBlock;

  const voiceLockBlock = `\n\n=== STRICT WRITER VOICE LOCK ===\n${SCRIPT_VOICE_RULES_CONTRACT}`;
  stage5Prompt += voiceLockBlock;

  // Add the CURRENT PART ANCHOR
  stage5Prompt += buildCurrentPartAnchor(partNumber, state);

  stage5Prompt += `\n\n=== HARD RECAP STYLE LOCK ===\n${HARD_RECAP_STYLE_LOCK}`;

  stage5Prompt += `\n\n=== SCRIPT FORMATTING CONTRACT ===\n${DRAFT_SCRIPT_CONTRACT}`;

  stage5Prompt += `\n\n=== PART WRITING PREFLIGHT LOCK ===\n${PART_WRITING_PREFLIGHT_LOCK}`;

  stage5Prompt += `\n\nFINAL PART WRITING COMMAND:
Write only the current part.
Follow the current part plan slice.
Follow the current part scene cards.
Use direct YouTube manga/manhwa recap narration.
Every normal narrator paragraph must be 120-220 characters including spaces.
Output only the script text.`;

  return stage5Prompt;
}

export function buildSupervisorPrompt(
  stageId: StageId,
  output: string,
  state: ProjectState,
): string {
  const contract = stageId === "clean_export" ? FINAL_POLISH_CONTRACT : DRAFT_SCRIPT_CONTRACT;
  const lengthCheckInstruction =
    stageId === "clean_export"
      ? "For clean_export, strictly enforce 120-220 character paragraph rules and remove any technical/scientific tone."
      : stageId === "script_writer"
        ? "For script_writer drafts, do NOT block approval for paragraph length, short punchy lines, or removable Part/Scene labels. Treat paragraph length as a Clean Export / Final Polish task. Only block for story drift, continuity break, incomplete output, wrong POV, passive protagonist, generic AI prose, weak progression, or severe report-like tone."
        : "For planning stages, do not apply script paragraph length rules.";

  const stageFailureInstruction =
    stageId === "clean_export"
      ? "For clean_export, FAIL if output contains headings, technical residue, broken formatting, duplicate scenes, wrong paragraph lengths, story drift, or non-voiceover text."
      : stageId === "script_writer"
        ? "For script_writer, FAIL only if output drifts from manga/manhwa recap, protagonist is passive or overpowered, parts repeat functions, no visual payoff, no face-slap, flat allies, stupid enemies, generic AI text, lacks first-person authored voice, breaks continuity, or sounds like a report instead of a story."
        : stageId === "scene_cards"
          ? "For scene_cards, PASS if the cards are usable for script writing, visually clear, aligned with the Story Plan, and not truncated. Do NOT fail because labels like scale, what must be shown, what must not be shown, or continuity details are missing."
          : "For story_plan, block only for missing story structure, missing progression, obvious drift, or incomplete output.";

  const sceneCardsSoftRule =
    stageId === "scene_cards"
      ? `\n\n=== SCENE CARDS SOFT FIELD RULE ===
Do not require exact field names.
Do not block for missing labels such as scale, what must be shown, what must not be shown, continuity details, visual focus, emotion, or location.
Those fields are helpful, but they are not mandatory.
Only block Stage Four if the scene cards are empty, truncated, unrelated to the plan, impossible to write from, missing most planned parts, or clearly drift into the wrong story.
If the scene cards are detailed and usable, return status: ok and canContinue: true.`
      : "";
  const scriptContractBlock =
    stageId === "script_writer" || stageId === "clean_export"
      ? `\n\n=== SCRIPT FORMATTING CONTRACT ===\n${contract}`
      : "";

  const additionalInstructions = `Supervisor MUST NOT trust words like "approved", "complete", "ready", or "final". Judge ONLY the actual text.\n${stageFailureInstruction}\n${lengthCheckInstruction}${sceneCardsSoftRule}\n\n\n=== NARRATIVE DYNAMICS CONTRACT ===\n${NARRATIVE_DYNAMICS_CONTRACT}\n\n=== AUTHORIAL STYLE BLOCK ===\n${authorialStyleBlock()}${scriptContractBlock}\n\n=== LOCKED STORY CONTRACT ===\n${state.storyContract}`;

  return `=== AI SUPERVISOR ===\n${state.promptRegistry.aiSupervisorPrompt}\n\n${additionalInstructions}\n\nSTAGE: ${stageId}\n\n=== OUTPUT TO CHECK ===\n${output}\n\nIMPORTANT: Provide your analysis and report in Russian.`;
}

export function buildRepairPrompt(
  stageId: StageId,
  brokenOutput: string,
  report: any,
  state: ProjectState,
  partNumber?: number,
): string {
  const lang =
    stageId === "script_writer" || stageId === "clean_export"
      ? "English"
      : "Russian";

  const contract = stageId === "clean_export" ? FINAL_POLISH_CONTRACT : DRAFT_SCRIPT_CONTRACT;

  // Check if we have hard drift
  const reportString = JSON.stringify(report || {}).toLowerCase();
  const hasHardDrift =
    reportString.includes("drift") ||
    reportString.includes("premise") ||
    reportString.includes("genre") ||
    reportString.includes("setting") ||
    reportString.includes("hard_story_drift") ||
    reportString.includes("toxic trench") ||
    reportString.includes("proctor") ||
    reportString.includes("plasma battery") ||
    reportString.includes("exoskeleton") ||
    reportString.includes("dungeon/facility");

  let cleanedReport = { ...report };

  if (cleanedReport.problems && Array.isArray(cleanedReport.problems)) {
    let prghProblemCount = 0;
    const filteredProblems = cleanedReport.problems.filter((p: string) => {
      const lower = p.toLowerCase();
      if (
        lower.includes("paragraph") &&
        (lower.includes("length") ||
          lower.includes("trim") ||
          lower.includes("character") ||
          lower.includes("size"))
      ) {
        prghProblemCount++;
        return false;
      }
      return true;
    });

    if (hasHardDrift) {
      // Discard paragraph problems completely if hard drift is present
    } else if (prghProblemCount > 0 && stageId !== "script_writer") {
      filteredProblems.push(
        `Fix paragraph lengths: ${prghProblemCount} paragraphs are slightly outside the target range (120-220 characters). Clean them up with compact trimming.`,
      );
    } else if (prghProblemCount > 0) {
      filteredProblems.push(
        "Paragraph length is a draft warning only. Do not repair Script Writer for length alone; preserve story voice and leave strict sizing for Clean Export.",
      );
    }
    cleanedReport.problems = Array.from(new Set(filteredProblems));
  }

  if (
    cleanedReport.requiredFixes &&
    Array.isArray(cleanedReport.requiredFixes)
  ) {
    let prghFixCount = 0;
    const filteredFixes = cleanedReport.requiredFixes.filter((f: string) => {
      const lower = f.toLowerCase();
      if (
        lower.includes("paragraph") &&
        (lower.includes("length") ||
          lower.includes("trim") ||
          lower.includes("character") ||
          lower.includes("size"))
      ) {
        prghFixCount++;
        return false;
      }
      return true;
    });

    if (hasHardDrift) {
      // Discard paragraph fixes completely if hard drift is present
    } else if (prghFixCount > 0 && stageId !== "script_writer") {
      filteredFixes.push(
        "Fix paragraph lengths to strictly 120-220 characters without changing events.",
      );
    } else if (prghFixCount > 0) {
      filteredFixes.push(
        "Ignore paragraph length as a repair target for Script Writer unless the text is fragmented or incomplete.",
      );
    }
    cleanedReport.requiredFixes = Array.from(new Set(filteredFixes));
  }

  let extraAnchor = "";
  if (stageId === "script_writer" && partNumber !== undefined) {
    extraAnchor = buildCurrentPartAnchor(partNumber, state);
  }

  const paragraphFormat = `Paragraph format:
Every normal narrator paragraph must be 120-220 characters including spaces.
Preserve plot and scene order.
Fix paragraph size by splitting long blocks or merging short adjacent beats.
Do not become literary while fixing length.`;

  const strictInstructions = `=== AUTHORIAL STYLE BLOCK ===\n${authorialStyleBlock()}\n\n=== SCRIPT FORMATTING CONTRACT ===\n${contract}\n\n=== PARAGRAPH FORMAT ===\n${paragraphFormat}\n\n=== NARRATIVE DYNAMICS CONTRACT ===\n${NARRATIVE_DYNAMICS_CONTRACT}\n\nSTRICT INSTRUCTION: Preserve plot, facts, names, and scene order exactly. Repair style and length only.${extraAnchor}`;

  return `=== TARGETED REPAIR ===\n${state.promptRegistry.repairPrompt}\n\n${strictInstructions}\n\nBROKEN OUTPUT:\n${brokenOutput}\n\nSUPERVISOR REPORT:\n${JSON.stringify(cleanedReport, null, 2)}\n\nIMPORTANT: Output the repaired version in ${lang}. Ensure all structural rules are preserved.`;
}

export function buildSoftCleanupPrompt(
  brokenOutput: string,
  report: any,
): string {
  return `=== SOFT CLEANUP ===
You are the final polish editor.

Paragraph format:
Normal narrator paragraphs must be 120-220 characters including spaces.
Dialogue, impact lines, system notifications, and cliffhanger lines may be shorter.
Fix long literary blocks by splitting them into visual action/reaction beats.
Preserve plot and scene order.
Do not become literary while fixing length.
  
SUPERVISOR REPORT:
${JSON.stringify(report, null, 2)}

Apply compact trimming or slight expansion. Do NOT rewrite the plot, do NOT alter the character voice, and do NOT change fact sequence. Output only the cleaned script part in English.
BROKEN OUTPUT:
${brokenOutput}`;
}

export function buildRebuildPrompt(
  partNumber: number,
  state: ProjectState,
  report: any,
): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);
  const partTitle = part?.partTitle || `Part ${partNumber}`;
  const partPrompt = buildPartPrompt(partNumber, state);

  const reportString = JSON.stringify(report || {}).toLowerCase();
  const hasDrift = [
    "drift",
    "genre",
    "setting",
    "premise",
    "world",
    "sci-fi",
    "facility",
    "toxic trench",
    "proctors",
    "proctor",
    "plasma battery",
    "plasma batteries",
    "exoskeleton",
    "exoskeletons",
    "dungeon/facility",
    "hard_story_drift",
  ].some((kw) => reportString.includes(kw));

  const cleanReportText = hasDrift
    ? "Previous attempt drifted away from the locked premise. Rebuild from approved plan and scene cards only."
    : JSON.stringify(report, null, 2);

  return `=== FULL PART REBUILD ===
The previous attempt completely failed, drifted into the wrong genre/sci-fi terms, or violated formatting rules.
We are completely throwing away that failed version. Do NOT base your output on any previous draft of this part. 
You must synthesize a completely new version from scratch using ONLY the locked raw idea, approved Story DNA, approved Story Plan, and approved Scene Cards.

SUPERVISOR REJECTION REPORT:
${cleanReportText}

STRICT REBUILD INSTRUCTIONS:
1. Discard the failed version's text and vocabulary completely.
2. Under no circumstances use any sci-fi facility or technical laboratory vocabulary (tests, proctors, plasma batteries, exoskeletons, toxic trenches, military armories, lasers, structural weak points, thermal signatures, conductive, optimized, energy sources, etc.).
3. Stick strictly to the approved story contract, approved story plan, and current part scene cards. Use only the current project's approved setting, protagonist, resources, enemies, mechanics, conflicts, and progression logic. Do not import setting, vocabulary, names, mechanics, or resources from any previous project or style sample.
4. Every normal narrator paragraph must be 120-220 characters including spaces. Fix paragraph size by splitting long blocks or merging short adjacent beats.
5. Rewrite this part from scratch according to the original approved instructions below, strictly respecting the SCRIPT VOICE RULES (write like a human YouTube manga recap storyteller, fast-paced, highly visual, direct, action-focused):

Original Part Prompt:
${partPrompt}`;
}

export function buildClaudeLitePartPrompt(
  partNumber: number,
  state: ProjectState,
): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);

  // 1. Locked story contract, compat
  const lockedContract = state.storyContract || "None specified.";

  // 2. Current part story plan slice only
  const storyPlanCompact =
    clipForWriter(extractPartSlice(state.storyPlan, partNumber), 7000) ||
    clipForWriter(state.storyPlan || "None specified.", 7000);

  // 3. Current part title and purpose
  const currentPartTitle = part?.partTitle || `Part ${partNumber}`;
  const purpose = `Write the full voiceover draft for Part ${partNumber}: "${currentPartTitle}". This is a crucial section of the overarching story plan, driving key progression.`;

  // 4. Current part scene cards only
  const currentPartSceneCards =
    clipForWriter(extractPartSlice(state.sceneCards, partNumber), 9000) ||
    clipForWriter(part?.sourceSceneCards || "No scene cards specified.", 9000) ||
    "No scene cards specified.";

  // 5. Summary of previous approved parts only
  const previousParts = state.scriptParts.filter(
    (p) => p.partNumber < partNumber && p.status === "approved" && p.draftText && p.draftText.length > 0,
  );
  const previousSummary = previousParts.length > 0
    ? previousParts
        .map((p) => summarizeApprovedPartForContinuity(p))
        .join("\n\n")
    : "None. This is the first part of the script.";

  // 6. Short style DNA
  const shortStyleDna = `- Write strictly in the first-person voice and perspective of our live protagonist ("I", "my", "we"). Keep it conversational, active, and immediate.
- Fast, visual, emotional, and practical. Avoid descriptive fluff or clinical analysis.
- Every paragraph should feel like an active, sequence-driven manga panel (representing one visual wave or camera shot).
- No dry lectures. Incorporate any technical moves directly into intense physical actions and quick visual outcomes.
- No sci-fi/dungeon/facility drift unless specifically authorized by the plan. Ground everything strictly on approved progression, strategy, and human conflict.
- Prioritize story flow, suspense, emotional payoff, satisfying character clashes (face-slaps), and solid narrative continuity.`;

  // 7. Short style sample, three to six paragraphs
  const styleSample = `Use this rhythm only. Do not copy setting, premise, names, objects, or events.
Pressure hits first. I notice one practical detail everyone else ignores. I act before explaining myself. The result becomes visible on the page, the doubter reacts, and the scene ends by opening a stronger problem.

Each beat should feel like a manga recap panel: danger, choice, physical action, visible payoff, public reaction, new pressure. Keep the language simple, sharp, and story-first.`;

  // 8. Minimal hard rules
  const minimalHardRules = `- All narrative blocks must be written strictly in English.
- Use direct voiceover tone: no markdown section headers, no bullet lists, no stage directions, and no brackets of any form.
- The output must contain ONLY the flowing script draft paragraphs, ready for a seamless voice narration read.
- Ensure that the narration contains no technical or scientific residue (avoid words like: optimized, parameters, calculated trajectory, resource loops). Replace with simple physical descriptions.`;

  const anchorBlock = buildCurrentPartAnchor(partNumber, state);

  return `=== CLAUDE SCRIPT WRITER LITE MODE ===

### 1. LOCKED STORY CONTRACT
${lockedContract}

### 2. CURRENT PART PLAN SLICE ONLY
${storyPlanCompact}

### 3. CURRENT PART TITLE & PURPOSE
Title: ${currentPartTitle}
Purpose: ${purpose}

### 4. CURRENT PART SCENE CARDS ONLY
${currentPartSceneCards}

### 5. PREVIOUS APPROVED PARTS RECAP
${previousSummary}

### 6. STYLE DNA
${shortStyleDna}

### 7. SHAPED VOICE STYLE SAMPLE
${styleSample}

### 8. HARD RECAP STYLE LOCK
${HARD_RECAP_STYLE_LOCK}

### 9. SCRIPT FORMATTING CONTRACT
${DRAFT_SCRIPT_CONTRACT}

### 10. PART WRITING PREFLIGHT LOCK
${PART_WRITING_PREFLIGHT_LOCK}

### 11. MINIMAL HARD RULES
${minimalHardRules}

${anchorBlock}

Begin drafting the text for Part ${partNumber} below:
Write only this part.
Follow the current part plan slice.
Follow the current part scene cards.
Use the HARD RECAP STYLE LOCK.
Keep every normal narrator paragraph between 120 and 220 characters.
Output only the script text for this part.`;
}

export function buildCurrentPartAnchor(
  partNumber: number,
  state: ProjectState,
): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);
  const partTitle = part?.partTitle || `Part ${partNumber}`;
  const sceneCards =
    clipForWriter(extractPartSlice(state.sceneCards, partNumber), 4000) ||
    part?.sourceSceneCards ||
    "No scene cards specified.";

  // Tone of this part: infer briefly from current part title and current part scene cards.
  let toneOfPart = "Fast, visual, tense, practical, with humiliation/reversal energy.";
  const titleLower = partTitle.toLowerCase();
  const sceneLower = sceneCards.toLowerCase();
  if (
    titleLower.includes("combat") ||
    titleLower.includes("fight") ||
    titleLower.includes("confront") ||
    sceneLower.includes("punch") ||
    sceneLower.includes("fight")
  ) {
    toneOfPart = "High-tension physical clash, rapid-fire strikes, sharp emotional payout, satisfying face-slap.";
  } else if (
    titleLower.includes("build") ||
    titleLower.includes("craft") ||
    titleLower.includes("trap") ||
    sceneLower.includes("weave") ||
    sceneLower.includes("build") ||
    sceneLower.includes("water") ||
    sceneLower.includes("fish")
  ) {
    toneOfPart = "Intense practical craft, step-by-step physical survival, high-satisfaction mechanical payoff, shut up the doubters.";
  } else if (
    titleLower.includes("revelation") ||
    titleLower.includes("discovery") ||
    titleLower.includes("secret")
  ) {
    toneOfPart = "Suspenseful, calculated, sharp psychological edge, quiet intensity building to an eye-opening twist.";
  }

  // Previous continuity: use only approved previous parts.
  const previousParts = state.scriptParts.filter(
    (p) => p.partNumber < partNumber && p.status === "approved" && p.draftText && p.draftText.length > 0,
  );

  let previousInterlock = "None. This is the first part.";
  if (previousParts.length > 0) {
    const lastPart = previousParts[previousParts.length - 1];
    const compactSummary = previousParts
      .map((p) => `Part ${p.partNumber} ("${p.partTitle}")`)
      .join(" -> ");

    let lastSegment = "";
    if (lastPart.draftText) {
      const paragraphs = lastPart.draftText
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (paragraphs.length > 0) {
        lastSegment = paragraphs[paragraphs.length - 1];
      }
    }

    previousInterlock = `- One compact summary of previous approved parts: ${compactSummary}\n- Last paragraph of the previous approved part (${lastPart.partNumber}):\n  "${lastSegment}"`;
  }

  return `\n\n=== CURRENT PART ANCHOR ===
1. GENRE
Strategy survival / manga-manhwa recap / first-person survival progression.

2. TONE OF THIS PART
${toneOfPart}

3. TASK OF THIS PART
Write only the current part.
Follow only the approved scene cards for this part.
Do not jump ahead.
Do not invent future events.

4. PREVIOUS CONTINUITY
${previousInterlock}

5. RHYTHM LOCK
Open with pressure already moving.
Show what I notice.
Make me act with a practical resource.
Show the result through the world, not through explanation.
Give the enemy or doubter a visible reaction.
End with either a payoff or a new threat.

6. FORBIDDEN FOR THIS PART
Do not use sci-fi/facility/test/proctor/dungeon language.
Do not use technical report language.
Do not write like a science explanation.
Do not copy competitor plots.
Do not write a summary.
Do not write paragraphs longer than 220 characters.
Do not write many short broken lines.
Do not use literary paragraphing.

7. PARAGRAPH SIZE LOCK
Every normal narrator paragraph must be 120-220 characters including spaces.
Aim for 150-190 characters for most paragraphs.
Shorter lines are allowed only for dialogue, system notifications, impact lines, or cliffhanger beats.
Never create long literary blocks.
If a paragraph goes above 220 characters, split it into two visual beats.
If a paragraph is below 120 characters, merge it with the next action or reaction unless it is dialogue or impact.
Write visual first-person narration.`;
}
