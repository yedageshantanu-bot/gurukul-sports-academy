import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const jsonPath = 'C:/Users/ADMIN/.gemini/antigravity-ide/brain/73a7666f-19aa-4fe9-9179-21108af4e8b3/.system_generated/steps/179/output.txt';
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

const screens = data.screens || [];
console.log(`Found ${screens.length} screens in Stitch project.`);

function sanitize(name) {
  return name
    .toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const htmlDir = path.resolve('stitch-designs/html');
const imgDir = path.resolve('stitch-designs/screens');

if (!fs.existsSync(htmlDir)) fs.mkdirSync(htmlDir, { recursive: true });
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const manifest = [];

for (const s of screens) {
  const title = s.title || 'untitled';
  const cleanName = sanitize(title);
  const screenId = s.name ? s.name.split('/').pop() : 'unknown';

  const item = {
    title,
    screenId,
    slug: cleanName,
    screenshotPath: null,
    htmlPath: null,
  };

  // Download screenshot
  if (s.screenshot && s.screenshot.downloadUrl) {
    const outImg = path.join(imgDir, `${cleanName}.png`);
    try {
      console.log(`Downloading screenshot for: ${title}`);
      execSync(`curl.exe -L -s -o "${outImg}" "${s.screenshot.downloadUrl}"`);
      item.screenshotPath = `stitch-designs/screens/${cleanName}.png`;
    } catch (e) {
      console.error(`Failed to download screenshot for ${title}:`, e.message);
    }
  }

  // Download HTML
  if (s.htmlCode && s.htmlCode.downloadUrl) {
    const outHtml = path.join(htmlDir, `${cleanName}.html`);
    try {
      console.log(`Downloading HTML for: ${title}`);
      execSync(`curl.exe -L -s -o "${outHtml}" "${s.htmlCode.downloadUrl}"`);
      item.htmlPath = `stitch-designs/html/${cleanName}.html`;
    } catch (e) {
      console.error(`Failed to download HTML for ${title}:`, e.message);
    }
  }

  manifest.push(item);
}

fs.writeFileSync('stitch-designs/manifest.json', JSON.stringify(manifest, null, 2));
console.log('🎉 Done downloading all screens and created stitch-designs/manifest.json!');
