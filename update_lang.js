import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

// Replace all occurrences of Output Language block with additional constraints
content = content.replace(
  /Output Language:\n\{\{OUTPUT_LANGUAGE\}\}/g,
  'Output Language:\n{{OUTPUT_LANGUAGE}}\n\nCRITICAL LANGUAGE RULE:\n- You MUST generate your story, character thoughts, and all narrative text strictly in the Output Language ({{OUTPUT_LANGUAGE}}).\n- All structural limits, pacing, adjective rules ("ONE ADJECTIVE PER NOUN"), and "No Fluff" rules must be natively applied to this Output Language.'
);

fs.writeFileSync('src/types.ts', content);
console.log('updated language rules');
