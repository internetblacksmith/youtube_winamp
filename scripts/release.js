#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { resolve } = require('node:path');

const MANIFEST_PATH = resolve(__dirname, '..', 'manifest.json');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: resolve(__dirname, '..') });
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
const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
if (branch !== 'main') {
  fatal(`Must be on main branch (currently on "${branch}")`);
}

const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (status) {
  fatal('Working tree is not clean. Commit or stash changes first.');
}

// --- Bump version ---
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const [major, minor, patch] = manifest.version.split('.').map(Number);

let newVersion;
switch (bump) {
  case 'major': newVersion = `${major + 1}.0.0`; break;
  case 'minor': newVersion = `${major}.${minor + 1}.0`; break;
  case 'patch': newVersion = `${major}.${minor}.${patch + 1}`; break;
}

manifest.version = newVersion;
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Bumped version: ${major}.${minor}.${patch} → ${newVersion}`);

// --- Commit, tag, push ---
const tag = `v${newVersion}`;

run('git add manifest.json');
run(`git commit -m "release: ${tag}"`);
run(`git tag ${tag}`);
run('git push && git push --tags');

console.log(`\nReleased ${tag}`);
console.log('Watch the release workflow: https://github.com/internetblacksmith/youtube_winamp/actions');
