// =========================================================
// Awara Banjara — GitHub-backed CMS data persistence
// =========================================================
// Several hosting platforms (Render's free tier, Hostinger's Node.js Web
// App redeploys) run this app on a filesystem that gets rebuilt from the
// last GitHub commit on every deploy/restart - any CMS edit saved to the
// local data/*.json files since then is silently lost.
//
// This module uses GitHub's REST Contents API directly (plain fetch, no
// git binary or .git checkout required - both are uncertain to exist in
// a given host's Node runtime) to:
//   1. Pull the latest committed CMS data into data/*.json on boot, before
//      the local database is loaded, so a fresh/rebuilt filesystem starts
//      from whatever was last saved live rather than a stale deploy snapshot.
//   2. Push data/*.json to a dedicated branch (never `main`, so this never
//      triggers a redeploy loop or conflicts with real code changes) a
//      short debounce window after each CMS write, so rapid edits collapse
//      into one commit instead of spamming history.
//
// Entirely opt-in: with no GITHUB_SYNC_TOKEN configured, every function
// here is a silent no-op and the app behaves exactly as it did before.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILES = [
  'awarabanjara.json',
  'trips.json',
  'destinations.json',
  'reviews.json',
  'inquiries.json',
  'postcards.json',
  'site_config.json',
  'packages.json'
];

const GITHUB_TOKEN = process.env.GITHUB_SYNC_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_SYNC_REPO || '';
const SYNC_BRANCH = process.env.GIT_SYNC_BRANCH || 'live-data';
const DEBOUNCE_MS = 20 * 1000;
const API_BASE = 'https://api.github.com';

const enabled = !!(GITHUB_TOKEN && GITHUB_REPO);

let debounceTimer = null;
let syncInFlight = false;
let syncQueuedAgain = false;

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'awara-banjara-cms-sync'
  };
}

async function ensureBranchExists() {
  const branchRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/branches/${SYNC_BRANCH}`, {
    headers: ghHeaders()
  });
  if (branchRes.ok) return true;
  if (branchRes.status !== 404) {
    console.warn(`⚠️ Git-sync: could not check branch '${SYNC_BRANCH}' (HTTP ${branchRes.status})`);
    return false;
  }

  // Branch doesn't exist yet - create it off the default branch's current commit.
  const repoRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}`, { headers: ghHeaders() });
  if (!repoRes.ok) return false;
  const repoInfo = await repoRes.json();
  const defaultBranch = repoInfo.default_branch || 'main';

  const refRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/ref/heads/${defaultBranch}`, {
    headers: ghHeaders()
  });
  if (!refRes.ok) return false;
  const refInfo = await refRes.json();

  const createRes = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/git/refs`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${SYNC_BRANCH}`, sha: refInfo.object.sha })
  });
  if (!createRes.ok) {
    // 422 here almost always means another server instance won the race and created
    // the branch a moment ago - that's success from this instance's point of view too.
    if (createRes.status === 422) return true;
    console.warn(`⚠️ Git-sync: could not create branch '${SYNC_BRANCH}' (HTTP ${createRes.status})`);
    return false;
  }
  console.log(`✅ Git-sync: created '${SYNC_BRANCH}' branch for CMS data sync`);
  return true;
}

async function getRemoteFile(filename) {
  const res = await fetch(
    `${API_BASE}/repos/${GITHUB_REPO}/contents/data/${filename}?ref=${SYNC_BRANCH}`,
    { headers: ghHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET data/${filename} failed (HTTP ${res.status})`);
  const json = await res.json();
  return { sha: json.sha, content: Buffer.from(json.content, 'base64').toString('utf-8') };
}

async function putRemoteFile(filename, content, sha) {
  const res = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/contents/data/${filename}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Auto-sync CMS data: ${filename} — ${new Date().toISOString()}`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: SYNC_BRANCH,
      ...(sha ? { sha } : {})
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PUT data/${filename} failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
}

/**
 * Pull the latest committed CMS data down into local data/*.json before the
 * local database loads. Call this once at server startup, before db.js reads
 * any files from disk. Never throws - a failure here just means the app
 * boots from whatever is already on local disk, same as before this feature.
 */
async function pullLatestOnBoot() {
  if (!enabled) return;
  console.log(`🔄 Git-sync: pulling latest CMS data from '${SYNC_BRANCH}' branch...`);

  // Fetch all files in parallel, not sequentially - some hosts (Hostinger's Node.js
  // Web App runtime included) expect listen() to be called within a few seconds of
  // startup, and 8 sequential GitHub API round-trips can eat into that budget enough
  // to trip a "didn't call listen() in time" warning.
  const results = await Promise.allSettled(DATA_FILES.map((filename) => getRemoteFile(filename)));

  let pulled = 0;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  results.forEach((result, i) => {
    const filename = DATA_FILES[i];
    if (result.status === 'fulfilled' && result.value) {
      fs.writeFileSync(path.join(DATA_DIR, filename), result.value.content, 'utf-8');
      pulled++;
    } else if (result.status === 'rejected') {
      console.warn(`⚠️ Git-sync: failed to pull data/${filename} -`, result.reason.message);
    }
  });

  if (pulled > 0) {
    console.log(`✅ Git-sync: pulled ${pulled} data file(s) from GitHub`);
  } else {
    console.log(`ℹ️ Git-sync: nothing to pull yet (branch/files not created on GitHub)`);
  }
}

async function doSync() {
  if (syncInFlight) {
    syncQueuedAgain = true;
    return;
  }
  syncInFlight = true;
  try {
    const branchReady = await ensureBranchExists();
    if (!branchReady) return;

    let pushed = 0;
    for (const filename of DATA_FILES) {
      const localPath = path.join(DATA_DIR, filename);
      if (!fs.existsSync(localPath)) continue;
      const localContent = fs.readFileSync(localPath, 'utf-8');
      try {
        const remote = await getRemoteFile(filename);
        if (remote && remote.content === localContent) continue; // unchanged
        try {
          await putRemoteFile(filename, localContent, remote ? remote.sha : undefined);
        } catch (e) {
          // Multiple server instances can boot around the same time and race to push
          // the same file - a "sha required"/conflict error here usually just means
          // another instance's push landed first. Re-fetch the current sha and retry
          // once before giving up.
          if (/HTTP 409|HTTP 422/.test(e.message)) {
            const latest = await getRemoteFile(filename);
            await putRemoteFile(filename, localContent, latest ? latest.sha : undefined);
          } else {
            throw e;
          }
        }
        pushed++;
      } catch (e) {
        console.warn(`⚠️ Git-sync: failed to push data/${filename} -`, e.message);
      }
    }
    if (pushed > 0) {
      console.log(`✅ Git-sync: pushed ${pushed} changed data file(s) to '${SYNC_BRANCH}' branch`);
    }
  } catch (e) {
    console.warn('⚠️ Git-sync: sync failed -', e.message);
  } finally {
    syncInFlight = false;
    if (syncQueuedAgain) {
      syncQueuedAgain = false;
      doSync();
    }
  }
}

/**
 * Debounced trigger - call this at the end of every CMS write (saveDatabase()).
 * Collapses rapid successive saves into one commit ~DEBOUNCE_MS after the last one.
 */
function scheduleSync() {
  if (!enabled) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    doSync();
  }, DEBOUNCE_MS);
}

if (!enabled) {
  console.log('ℹ️ Git-sync: disabled (set GITHUB_SYNC_TOKEN and GITHUB_SYNC_REPO to enable)');
}

module.exports = { pullLatestOnBoot, scheduleSync, enabled };
