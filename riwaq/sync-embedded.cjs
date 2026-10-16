// Keep the standalone file:// page in step with the three JSX source files.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const pagePath = path.join(root, 'رواق.html');
let html = fs.readFileSync(pagePath, 'utf8');
for (const name of ['components', 'screens', 'app']) {
  const marker = `     ${name}.jsx (مدموج)`;
  const start = html.indexOf(marker);
  const scriptStart = html.indexOf('<script type="text/babel" data-presets="react">', start);
  const contentStart = scriptStart + '<script type="text/babel" data-presets="react">'.length;
  const end = html.indexOf('</script>', contentStart);
  if (start < 0 || scriptStart < 0 || end < 0) throw new Error(`Missing ${name} block`);
  const source = fs.readFileSync(path.join(root, `${name}.jsx`), 'utf8').trim();
  html = html.slice(0, contentStart) + '\n' + source + '\n' + html.slice(end);
}
fs.writeFileSync(pagePath, html);
console.log('Synchronized student page JSX.');
