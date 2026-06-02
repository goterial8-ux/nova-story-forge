import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(/one hundred twenty and two hundred twenty/g, 'ninety and two hundred');
content = content.replace(/one hundred twenty to two hundred twenty/g, 'ninety to two hundred');
content = content.replace(/shorter than one hundred twenty/g, 'shorter than ninety');
content = content.replace(/longer than two hundred twenty/g, 'longer than two hundred');

fs.writeFileSync('src/types.ts', content);
console.log('done');
