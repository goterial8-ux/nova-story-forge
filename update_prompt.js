import * as fs from 'fs';
const content = fs.readFileSync('src/lib/PromptBuilder.ts', 'utf8');
const updated = content.replace(/\.replace\('\{\{/g, ".replaceAll('{{");
fs.writeFileSync('src/lib/PromptBuilder.ts', updated);
console.log("Updated PromptBuilder.ts");
