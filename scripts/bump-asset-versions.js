// =========================================================
// Awara Banjara — Automatic cache-busting for static assets
// =========================================================
// Every <link>/<script> tag that points at a versioned asset (assets/js/*.js,
// assets/css/*.css) uses a ?v=<hash> query string. Browsers and Hostinger's
// hCDN edge cache these aggressively (CSS alone is cached for 7 days), so if
// a file's content changes but its ?v= stays the same, visitors keep getting
// the stale copy under that exact URL indefinitely - a hard refresh doesn't
// even help, since the URL itself never changed.
//
// This used to be done by hand (bump a version number, remember every file
// that references the asset) and was missed at least twice in one day.
// Instead this script hashes each asset's actual content and rewrites every
// reference to that hash, so the URL can only be stale if the file itself is
// identical. Runs automatically via the "prestart" npm script - npm runs
// prestart before every `npm start`, which is the app's boot command on
// every deploy, so this can't be forgotten again.
//
// Safe to run any number of times: with no content changes, it produces no
// diff at all.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const HASH_LENGTH = 10;

const ASSET_FILES = [
  'assets/css/style.css',
  'assets/js/card-stack.js',
  'assets/js/db-engine.js',
  'assets/js/main.js',
  'assets/js/postcards-loader.js',
  'assets/js/reviews-loader.js',
  'assets/js/site-config-loader.js',
  'assets/js/trip-detail-loader.js',
  'assets/js/trips-loader.js'
];

function findHtmlFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function hashFile(relPath) {
  const abs = path.join(ROOT, relPath);
  const content = fs.readFileSync(abs);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, HASH_LENGTH);
}

function run() {
  const hashes = {};
  for (const relPath of ASSET_FILES) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) {
      console.warn(`⚠️  Asset-version: ${relPath} not found, skipping`);
      continue;
    }
    hashes[relPath] = hashFile(relPath);
  }

  const htmlFiles = findHtmlFiles(ROOT, []);
  let filesChanged = 0;
  let refsChanged = 0;

  for (const absPath of htmlFiles) {
    let content = fs.readFileSync(absPath, 'utf-8');
    let changed = false;

    for (const [relPath, hash] of Object.entries(hashes)) {
      const filename = path.basename(relPath);
      // Matches "assets/js/main.js?v=22.0" or "../assets/js/main.js?v=abc123"
      // - path prefix varies (root pages vs trips/*.html), filename+query
      // doesn't.
      const re = new RegExp(
        `(${filename.replace(/\./g, '\\.')})\\?v=[0-9a-zA-Z.]+`,
        'g'
      );
      const next = content.replace(re, (match, name) => {
        const replacement = `${name}?v=${hash}`;
        if (replacement !== match) refsChanged++;
        return replacement;
      });
      if (next !== content) changed = true;
      content = next;
    }

    if (changed) {
      fs.writeFileSync(absPath, content, 'utf-8');
      filesChanged++;
    }
  }

  console.log(`✅ Asset-version: hashed ${Object.keys(hashes).length} asset file(s), updated ${refsChanged} reference(s) across ${filesChanged} HTML file(s)`);
}

run();
