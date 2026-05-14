#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = resolve(ROOT, 'manifest.json');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function capture(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim();
}

function fatal(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// --- Validate arguments ---
const bump = process.argv[2];
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: npm run release -- patch|minor|major');
  process.exit(1);
}

// --- Validate git state ---
const branch = capture('git branch --show-current');
if (branch !== 'main') {
  fatal(`Must be on main branch (currently on "${branch}")`);
}

if (capture('git status --porcelain')) {
  fatal('Working tree is not clean. Commit or stash changes first.');
}

run('git fetch origin main --tags');
if (capture('git rev-parse HEAD') !== capture('git rev-parse origin/main')) {
  fatal('Local main is not up-to-date with origin/main. Pull first.');
}

// --- Compute new version ---
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const [major, minor, patch] = manifest.version.split('.').map(Number);

let newVersion;
switch (bump) {
  case 'major': newVersion = `${major + 1}.0.0`; break;
  case 'minor': newVersion = `${major}.${minor + 1}.0`; break;
  case 'patch': newVersion = `${major}.${minor}.${patch + 1}`; break;
}
const tag = `v${newVersion}`;

// --- Verify tag does not already exist (locally or on remote) ---
if (capture(`git tag -l ${tag}`)) {
  fatal(`Tag ${tag} already exists locally`);
}
if (capture(`git ls-remote --tags origin refs/tags/${tag}`)) {
  fatal(`Tag ${tag} already exists on origin`);
}

// --- Bump manifest ---
manifest.version = newVersion;
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Bumped version: ${major}.${minor}.${patch} → ${newVersion}`);

// --- Commit, tag, push (signed; --follow-tags pushes both atomically) ---
run('git add manifest.json');
run(`git commit -S -m "release: ${tag}"`);
run(`git tag -s ${tag} -m "Release ${tag}"`);
run('git push --follow-tags');

console.log(`\nReleased ${tag}`);
console.log('Watch the release workflow: https://github.com/internetblacksmith/youtube_winamp/actions');
