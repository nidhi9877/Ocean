// Regenerates the web version of the Terms & Conditions from the Word document.
//
//   cd server && node legal/build-terms.mjs [path-to-docx]
//
// Requires pandoc (https://pandoc.org) on the machine running the script — not on the server.
// Output: legal/terms-and-conditions.html (+ terms-meta.json). Commit both files.
// The server derives the terms version from the HTML content, so any wording change
// produces a new version and new acceptances are recorded against it.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || path.join(here, '..', '..', 'terms&conditions.docx'));

let html = execFileSync('pandoc', [source, '-t', 'html5', '--wrap=none'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

html = html
  // Title block — the page renders its own header with these details
  .replace(/^<h1[^>]*>MASTER TERMS[\s\S]*?<\/h1>\s*(<hr \/>)?\s*/, '')
  // Empty headings Word leaves behind as spacing
  .replace(/<h[1-6][^>]*>\s*<\/h[1-6]>\s*/g, '')
  // Sub-clauses accidentally styled as headings (e.g. "14.5. ...")
  .replace(/<h2[^>]*>(\d+\.\d+\.[\s\S]*?)<\/h2>/g, '<p>$1</p>')
  // Images (signature scan) are not published on the website
  .replace(/<img[^>]*>/g, '')
  // Blank counter-signature form — acceptance is captured electronically at registration
  .replace(/<p><strong>Supplier \/ Buyer, as applicable<\/strong><\/p>[\s\S]*$/, '')
  .replace(/<p>Date:\s*<\/p>\s*/g, '')
  .replace(/<p>Authorised Signatory:\s*<\/p>\s*/g, '')
  // External links open in a new tab
  .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"')
  .trim();

fs.writeFileSync(path.join(here, 'terms-and-conditions.html'), html + '\n');
fs.writeFileSync(path.join(here, 'terms-meta.json'), JSON.stringify({
  title: 'Master Terms & Conditions, Supplier Agreement and Buyer Terms',
  operator: 'Khalasi Marine OPC Private Limited',
  platform: 'www.marinestockhub.com',
  jurisdiction: 'Mumbai, Maharashtra, India',
  effectiveDate: new Date().toISOString().slice(0, 10),
}, null, 2) + '\n');

console.log(`✅ Terms rebuilt from ${source} (${html.length} chars)`);
