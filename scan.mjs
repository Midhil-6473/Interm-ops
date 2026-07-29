#!/usr/bin/env node

/**
 * scan.mjs ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ Zero-token portal scanner with a plugin-based provider layer.
 *
 * Providers live in providers/*.mjs and are loaded at startup. Each provider
 * exports a default object with:
 *   - id: string ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ matched against `provider:` in portals.yml
 *   - detect(entry): {url}|null ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ optional auto-detection from careers_url
 *   - fetch(entry, ctx): [{title,url,company,location}] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ required
 *
 * Files prefixed with _ are shared helpers (e.g. _http.mjs) and are never
 * loaded as providers. Adding a new HTTP/API source = drop a *.mjs into
 * providers/. Local executable parsers use `providers/local-parser.mjs` when
 * `parser.command` + `parser.script` are set in portals.yml.
 *
 * A tracked_companies entry can set `provider:` explicitly to bypass
 * URL-based auto-detection. The `transport:` field is reserved for future
 * transports ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ Phase A only ships the http transport.
 *
 * Zero Claude API tokens ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ pure HTTP + JSON.
 *
 * Usage:
 *   node scan.mjs                  # scan all enabled companies
 *   node scan.mjs --dry-run        # preview without writing files
 *   node scan.mjs --company Cohere # scan a single company
 *   node scan.mjs --verify         # Playwright-check each new URL; drop expired postings
 *   node scan.mjs --verify --headed-fallback  # retry anti-bot-blocked URLs in a headed browser (needs a display)
 *   node scan.mjs --verify --throttle          # jittered ~5-10s gap between checks (stay under rate limits)
 *   node scan.mjs --verify --throttle=8000     # custom base gap in ms (waits base..2*base)
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
import yaml from 'js-yaml';

import { makeHttpCtx } from './providers/_http.mjs';
import readline from 'node:readline';

const parseYaml = yaml.load;

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Config ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬

const PORTALS_PATH = process.env.CAREER_OPS_PORTALS || 'portals.yml';
const PROFILE_PATH = process.env.CAREER_OPS_PROFILE || 'config/profile.yml';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH = 'data/pipeline.md';
const APPLICATIONS_PATH = 'data/applications.md';
const SCAN_REPORT_PATH = 'data/internship-scan-report.md';
const PROVIDERS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'providers');

// Ensure required directories exist (fresh setup)
mkdirSync('data', { recursive: true });

const CONCURRENCY = 10;

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Provider loading ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬

async function loadProviders(dir) {
  const providers = new Map();
  if (!existsSync(dir)) return providers;
  // Alphabetical order so detect() priority is deterministic across machines.
  const entries = readdirSync(dir)
    .filter(f => f.endsWith('.mjs') && !f.startsWith('_'))
    .sort();
  for (const file of entries) {
    const full = path.join(dir, file);
    let mod;
    try {
      mod = await import(pathToFileURL(full).href);
    } catch (err) {
      console.error(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚  ${file}: failed to load ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ ${err.message}`);
      continue;
    }
    const p = mod.default;
    if (!p || typeof p.fetch !== 'function' || !p.id) {
      console.error(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚  ${file}: skipping ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ default export must be { id, fetch }`);
      continue;
    }
    if (providers.has(p.id)) {
      console.error(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚  ${file}: duplicate provider id "${p.id}" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ keeping first`);
      continue;
    }
    providers.set(p.id, p);
  }
  return providers;
}

// Resolve which provider handles a tracked_companies entry.
// 1. Explicit `provider:` field wins (skips detect()).
// 2. local-parser when parser.command + script are configured (before API detect).
// 3. Otherwise each provider's detect() runs in load order; first hit wins.
function resolveProvider(entry, providers, { skipIds = [] } = {}) {
  if (entry.provider) {
    const p = providers.get(entry.provider);
    if (!p) return { error: `unknown provider: ${entry.provider}` };
    return { provider: p };
  }

  const localParser = providers.get('local-parser');
  if (localParser && !skipIds.includes('local-parser')) {
    try {
      const hit = localParser.detect?.(entry);
      if (hit) return { provider: localParser };
    } catch (err) {
      console.error(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚  local-parser: detect() threw for "${entry.name}" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ ${err.message}`);
    }
  }

  for (const p of providers.values()) {
    if (skipIds.includes(p.id)) continue;
    let hit;
    try {
      hit = p.detect?.(entry);
    } catch (err) {
      console.error(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚  ${p.id}: detect() threw for "${entry.name}" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ ${err.message}`);
      continue;
    }
    if (hit) return { provider: p };
  }
  return null;
}

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Title filter ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬

export function buildTitleFilter(titleFilter) {
  const normalize = (value) => (Array.isArray(value) ? value : value ? [value] : [])
    .filter(k => typeof k === 'string')
    .map(k => k.toLowerCase().trim())
    .filter(Boolean);

  const positive = normalize(titleFilter?.positive);
  const negative = normalize(titleFilter?.negative);
  const internshipKeywords = normalize(titleFilter?.internship_keywords);
  const roleKeywords = normalize(titleFilter?.role_keywords);
  const internshipRequired = titleFilter?.internship_required === true;

  return (title) => {
    const lower = String(title || '').toLowerCase();
    const hasNegative = negative.some(k => lower.includes(k));
    if (hasNegative) return false;

    if (internshipRequired) {
      const hasInternshipSignal = internshipKeywords.length === 0 || internshipKeywords.some(k => lower.includes(k));
      const hasRoleSignal = roleKeywords.length === 0 || roleKeywords.some(k => lower.includes(k));
      return hasInternshipSignal && hasRoleSignal;
    }

    return positive.length === 0 || positive.some(k => lower.includes(k));
  };
}
// Ã¢â€â‚¬Ã¢â€â‚¬ Location filter ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬
// Optional. If `location_filter` is absent from portals.yml, all locations pass.
// Semantics (case-insensitive substring, in this order):
//   - Empty / whitespace-only / non-string location ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ pass (don't penalize
//     missing or malformed provider data)
//   - `always_allow` matches ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ pass (takes precedence over `block` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ lets a
//     multi-location string like "Remote, Belgium or France" through because
//     the home region is an option, even though "france" is blocked)
//   - `block` matches ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ reject
//   - `allow` empty ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ pass (already cleared block)
//   - `allow` non-empty ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ must match at least one keyword

// Normalize a keyword list from portals.yml: tolerates a bare string
// (wrapped to a 1-item array), null/undefined (ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ []), and non-string
// entries (filtered out). Survivors are lowercased, trimmed, and any
// resulting empty strings are dropped ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ an empty keyword would otherwise
// match every location via String.includes(''), silently bypassing the
// other tiers.
function normalizeKeywordList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .filter(k => typeof k === 'string')
    .map(k => k.toLowerCase().trim())
    .filter(Boolean);
}

function profileLocationKeywords(profile = {}) {
  const location = profile.location && typeof profile.location === 'object' ? profile.location : {};
  const candidate = profile.candidate && typeof profile.candidate === 'object' ? profile.candidate : {};
  return normalizeKeywordList([
    candidate.location,
    location.city,
    location.state,
    location.region,
    location.country,
    location.timezone,
    ...(Array.isArray(location.preferred_locations) ? location.preferred_locations : []),
    ...(Array.isArray(location.nearby_locations) ? location.nearby_locations : []),
  ]);
}

function expandLocationFilter(locationFilter = {}, profile = {}) {
  const includeRemote = locationFilter.include_remote !== false;
  const remoteKeywords = includeRemote
    ? normalizeKeywordList(locationFilter.remote_keywords || ['remote', 'hybrid', 'worldwide', 'global'])
    : [];

  if (locationFilter.use_profile_location === true) {
    const profileKeywords = profileLocationKeywords(profile);
    return {
      always_allow: [
        ...profileKeywords,
        ...remoteKeywords,
        ...normalizeKeywordList(locationFilter.extra_allow),
        ...normalizeKeywordList(locationFilter.always_allow),
      ],
      allow: [
        ...profileKeywords,
        ...remoteKeywords,
        ...normalizeKeywordList(locationFilter.extra_allow),
        ...normalizeKeywordList(locationFilter.allow),
      ],
      block: normalizeKeywordList(locationFilter.block),
    };
  }

  return {
    always_allow: normalizeKeywordList(locationFilter.always_allow),
    allow: normalizeKeywordList(locationFilter.allow),
    block: normalizeKeywordList(locationFilter.block),
  };
}

export function buildLocationFilter(locationFilter, profile = {}) {
  if (!locationFilter) return () => true;
  const expanded = expandLocationFilter(locationFilter, profile);
  const alwaysAllow = expanded.always_allow;
  const allow = expanded.allow;
  const block = expanded.block;

  return (location) => {
    if (typeof location !== 'string' || location.trim() === '') return true;
    const lower = location.toLowerCase();
    if (alwaysAllow.length > 0 && alwaysAllow.some(k => lower.includes(k))) return true;
    if (block.length > 0 && block.some(k => lower.includes(k))) return false;
    if (allow.length === 0) return true;
    return allow.some(k => lower.includes(k));
  };
}

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Salary filter ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬
// Optional. If `salary_filter` is absent from portals.yml, all salaries pass.
// Semantics:
//   - min/max are annual compensation filters (use annualized values)
//   - max: 0 means "no upper limit"
//   - If no salary data exists on a job, it passes (conservative behavior)
//   - If both currencies are known and mismatch (e.g., USD filter, EUR job), it fails
//   - Partial ranges (min only or max only) work correctly via overlap logic
// Uses null-safe checks (!= null, ??) to preserve 0 values correctly.

export function buildSalaryFilter(salaryFilter) {
  if (!salaryFilter) return () => true;

  // Coerce and validate bounds ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ malformed YAML must not silently mis-filter
  const min = Number(salaryFilter.min ?? 0);
  const max = Number(salaryFilter.max ?? 0);
  const filterCurrency = (salaryFilter.currency || '').trim().toUpperCase();

  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
    console.error('Warning: salary_filter.min/max must be non-negative numbers ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ salary filter disabled');
    return () => true;
  }
  if (max > 0 && min > max) {
    console.error('Warning: salary_filter.min cannot exceed salary_filter.max ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ salary filter disabled');
    return () => true;
  }

  // If both min and max are 0, no filtering applied
  if (min === 0 && max === 0) return () => true;

  return (salary) => {
    // If no salary data exists, pass (conservative - many providers don't expose salary)
    if (!salary) return true;

    const jobMin = salary.min ?? salary.max ?? null;
    const jobMax = salary.max ?? salary.min ?? null;

    // If we have no usable salary values, pass conservatively
    if (jobMin == null && jobMax == null) return true;

    // Currency handling - reject only if BOTH currencies exist and mismatch
    const jobCurrency = (salary.currency || '').trim().toUpperCase();
    if (filterCurrency && jobCurrency && filterCurrency !== jobCurrency) {
      return false;
    }

    // Range overlap logic - reject ONLY if job is completely outside filter range
    // Job entirely below user minimum
    if (min > 0 && jobMax != null && jobMax < min) {
      return false;
    }
    // Job entirely above user maximum
    if (max > 0 && jobMin != null && jobMin > max) {
      return false;
    }

    // Otherwise pass (overlap exists or no valid range to compare)
    return true;
  };
}

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ URL rediscovery (--rediscover-404) ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬
// When a tracked company's job URL returns 404/410, the role may have just
// moved to a new URL (Workday/Greenhouse rotate URLs without closing roles).
// These helpers back an opt-in search-and-reverify fallback before giving up.

// extractCareersUrlDomain returns the hostname of a company's careers_url, or
// null when it's missing/unparseable. The presence of a domain is what gates
// the fallback ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ broad-discovery offers without a careers_url stay ineligible.
export function extractCareersUrlDomain(careersUrl) {
  if (!careersUrl) return null;
  try {
    return new URL(careersUrl).hostname;
  } catch {
    return null;
  }
}

// resolveSearchHref unwraps a DuckDuckGo HTML redirect (`/l/?uddg=<encoded>`)
// to its real destination, so domain matching sees the actual host instead of
// duckduckgo.com. Non-redirect hrefs pass through unchanged.
function resolveSearchHref(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const isDdgHost = u.hostname === 'duckduckgo.com' || u.hostname.endsWith('.duckduckgo.com');
    if (isDdgHost && u.pathname === '/l/') {
      const target = u.searchParams.get('uddg');
      if (target) return target;
    }
  } catch {
    /* fall through to the raw href */
  }
  return href;
}

// pickRediscoveredUrl chooses the first result whose hostname *exactly* equals
// the careers domain (no substring/look-alike matches), unwrapping search-engine
// redirects first. Pure + exported so result-matching is unit-testable without
// driving a real browser. Returns null when nothing matches.
export function pickRediscoveredUrl(hrefs, domain) {
  if (!domain || !Array.isArray(hrefs)) return null;
  for (const raw of hrefs) {
    const href = resolveSearchHref(raw);
    let host;
    try {
      host = new URL(href).hostname;
    } catch {
      continue;
    }
    if (host === domain) return href;
  }
  return null;
}

// REDISCOVER_TIMEOUT_MS bounds the single fallback search so a slow or blocked
// search engine can't stall the sequential verify loop.
const REDISCOVER_TIMEOUT_MS = 10_000;

// searchForNewUrl runs one site-scoped search for a moved tracked role and
// returns a same-domain URL if found, else null. Every failure path returns
// null ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ the fallback must never throw into the verify loop. Leaves the page on
// a blank document so the next checkUrlLiveness call starts clean.
async function searchForNewUrl(page, offer) {
  const domain = offer.careersUrlDomain;
  if (!domain) return null;
  const query = `"${offer.title}" "${offer.company}" site:${domain}`;
  try {
    await page.goto(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: REDISCOVER_TIMEOUT_MS },
    );
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a.result__a'))
        .map((a) => a.getAttribute('href'))
        .filter(Boolean),
    );
    return pickRediscoveredUrl(hrefs, domain);
  } catch {
    return null;
  } finally {
    try {
      await page.goto('about:blank');
    } catch {
      /* ignore ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ best-effort cleanup */
    }
  }
}

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Dedup ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬

const PERMANENT_SCAN_HISTORY_STATUSES = new Set([
  'skipped_invalid_url',
  'skipped_blocked_host',
]);

function daysBetweenIsoDates(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end) return null;
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
}

export function shouldDedupScanHistoryRow({ firstSeen, status = 'added' }, { recheckAfterDays = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (PERMANENT_SCAN_HISTORY_STATUSES.has(status)) return true;
  if (status !== 'added') return true;
  if (recheckAfterDays == null) return true;
  const ageDays = daysBetweenIsoDates(firstSeen, today);
  if (ageDays == null) return true;
  return ageDays < recheckAfterDays;
}

function scanHistoryPolicy(config = {}) {
  const raw = config.scan_history?.recheck_after_days;
  const parsed = Number.parseInt(raw, 10);
  return {
    recheckAfterDays: Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
  };
}

export function loadSeenUrls(policy = {}) {
  const seen = new Set();
  let recheckEligible = 0;

  // scan-history.tsv
  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) { // skip header
      const [url, firstSeen, , , , status = 'added'] = line.split('\t');
      if (!url) continue;
      if (shouldDedupScanHistoryRow({ firstSeen, status }, policy)) seen.add(url);
      else recheckEligible++;
    }
  }

  // pipeline.md ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ extract URLs from checkbox lines
  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const match of text.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(match[1]);
    }
  }

  // applications.md ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ extract URLs from report links and any inline URLs
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0]);
    }
  }

  return { seen, recheckEligible };
}

function loadSeenCompanyRoles() {
  const seen = new Set();
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    // Parse markdown table rows: | # | Date | Company | Role | ...
    for (const match of text.matchAll(/\|[^|]+\|[^|]+\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)) {
      const company = match[1].trim().toLowerCase();
      const role = match[2].trim().toLowerCase();
      if (company && role && company !== 'company') {
        seen.add(`${company}::${role}`);
      }
    }
  }
  return seen;
}

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Pipeline writer ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬

export function appendToPipeline(offers) {
  if (offers.length === 0) return;

  let text = readFileSync(PIPELINE_PATH, 'utf-8');

  // Find "## Pendientes" section and append after it
  const marker = '## Pendientes';
  const idx = text.indexOf(marker);
  if (idx === -1) {
    // No Pendientes section ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ append at end before Procesadas
    const procIdx = text.indexOf('## Procesadas');
    const insertAt = procIdx === -1 ? text.length : procIdx;
    const block = `\n${marker}\n\n` + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n\n';
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  } else {
    // Find the end of existing Pendientes content (next ## or end)
    const afterMarker = idx + marker.length;
    const nextSection = text.indexOf('\n## ', afterMarker);
    const insertAt = nextSection === -1 ? text.length : nextSection;

    const block = '\n' + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n';
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  }

  writeFileSync(PIPELINE_PATH, text, 'utf-8');
}

export function appendToScanHistory(offers, date, status = 'added') {
  // Ensure file + header exist. Location appended as 7th column for non-breaking
  // backward compat - older scan-history.tsv files with 6 columns still parse fine
  // since loadSeenUrls only reads column 0. `status` is parameterized so callers
  // can record verify outcomes (`skipped_expired`, etc.) without the legacy
  // `(expired)` suffix in `source`.
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n', 'utf-8');
  }

  const lines = offers.map(o =>
    `${o.url}\t${date}\t${o.source}\t${o.title}\t${o.company}\t${status}\t${o.location || ''}`
  ).join('\n') + '\n';

  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

function escapeMarkdownCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

export function formatStipend(salary) {
  if (!salary) return 'Not listed';
  if (typeof salary === 'string') return salary.trim() || 'Not listed';
  if (typeof salary !== 'object') return 'Not listed';
  if (typeof salary.text === 'string' && salary.text.trim()) return salary.text.trim();
  if (typeof salary.raw === 'string' && salary.raw.trim()) return salary.raw.trim();

  const min = salary.min ?? salary.max ?? null;
  const max = salary.max ?? salary.min ?? null;
  const currency = typeof salary.currency === 'string' && salary.currency.trim()
    ? `${salary.currency.trim().toUpperCase()} `
    : '';
  const fmt = (n) => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : null;
  const minText = fmt(min);
  const maxText = fmt(max);
  if (minText && maxText && minText !== maxText) return `${currency}${minText}-${maxText}`;
  if (minText || maxText) return `${currency}${minText || maxText}`;
  return 'Not listed';
}

export function classifyWorkMode(location = '') {
  const lower = String(location || '').toLowerCase();
  if (!lower.trim()) return 'Not specified';
  if (/\bhybrid\b/.test(lower)) return 'Hybrid';
  if (/\b(remote|work from home|wfh|anywhere|worldwide|global)\b/.test(lower)) return 'Remote';
  if (/\b(on-?site|office|in-office)\b/.test(lower)) return 'Onsite';
  return 'Not specified';
}

function profileLocationSummary(profile = {}) {
  const location = profile.location && typeof profile.location === 'object' ? profile.location : {};
  const candidate = profile.candidate && typeof profile.candidate === 'object' ? profile.candidate : {};
  const parts = [
    candidate.location,
    location.city && location.city !== 'TBD' ? location.city : '',
    location.state && location.state !== 'TBD' ? location.state : '',
    location.country,
  ].filter(Boolean);
  const nearby = Array.isArray(location.nearby_locations) ? location.nearby_locations.filter(Boolean) : [];
  const preferred = Array.isArray(location.preferred_locations) ? location.preferred_locations.filter(Boolean) : [];
  return {
    base: [...new Set(parts)].join(', ') || 'Not specified',
    preferred: [...new Set(preferred)].join(', ') || 'Not specified',
    nearby: [...new Set(nearby)].join(', ') || 'Not specified',
  };
}

export function buildInternshipScanReport({ date, profile = {}, summary = {}, offers = [], candidates = [], warnings = [] } = {}) {
  const loc = profileLocationSummary(profile);
  const lines = [
    '# Internship Scan Report',
    '',
    `Date: ${date || new Date().toISOString().slice(0, 10)}`,
    '',
    '## Location Scope',
    '',
    `- Candidate location: ${loc.base}`,
    `- Preferred scan locations: ${loc.preferred}`,
    `- Nearby regions/countries: ${loc.nearby}`,
    '- Remote/global internships are included when the location filter allows remote work.',
    '',
    '## Summary',
    '',
    `- Companies scanned: ${summary.companiesScanned ?? 0}`,
    `- Internship boards scanned: ${summary.boardsScanned ?? 0}`,
    `- Total postings scanned: ${summary.totalFound ?? 0}`,
    `- Internship title matches before location/stipend filters: ${summary.titleMatches ?? 0}`,
    `- Filtered out by internship/title mismatch: ${summary.filteredTitle ?? 0}`,
    `- Filtered out by location: ${summary.filteredLocation ?? 0}`,
    `- Filtered out by stipend: ${summary.filteredSalary ?? 0}`,
    `- Duplicates skipped: ${summary.duplicates ?? 0}`,
    `- New internships added: ${offers.length}`,
    '',
    '## Detailed Internships',
    '',
  ];

  const detailedOffers = candidates.length > 0 ? candidates : offers;
  if (detailedOffers.length === 0) {
    lines.push('No internship postings matched the internship title filter in this scan.');
  } else {
    lines.push('| Company | Internship Role | Stipend | Location | Work Mode | Match Status | URL |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const offer of detailedOffers) {
      const company = escapeMarkdownCell(offer.company || 'Unknown');
      const role = escapeMarkdownCell(offer.title || 'Unknown');
      const stipend = escapeMarkdownCell(formatStipend(offer.salary));
      const location = escapeMarkdownCell(offer.location || 'Not listed');
      const workMode = escapeMarkdownCell(classifyWorkMode(offer.location));
      const matchStatus = escapeMarkdownCell(offer.matchStatus || 'Internship title match');
      const url = offer.url ? '[Open](' + offer.url + ')' : 'Not listed';
      lines.push(`| ${company} | ${role} | ${stipend} | ${location} | ${workMode} | ${matchStatus} | ${url} |`);
    }
  }

  if (warnings.length > 0) {
    lines.push('', '## Provider Warnings', '');
    for (const warning of warnings) {
      lines.push(`- ${escapeMarkdownCell(warning.company || 'Unknown')}: ${escapeMarkdownCell(warning.error || warning.message || '')}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function writeInternshipScanReport(payload) {
  const report = buildInternshipScanReport(payload);
  writeFileSync(SCAN_REPORT_PATH, report, 'utf-8');
  return SCAN_REPORT_PATH;
}

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Parallel fetch with concurrency limit ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬

async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;

  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ Main ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬Ã¢â€šÂ¬

async function verifyOffers(offers, { headedFallback = false, throttleBaseMs = 0, rediscover = false } = {}) {
  // Dynamic imports keep the default zero-token path free of Playwright startup
  let chromium;
  let checkUrlLiveness;
  let checkUrlLivenessWithFallback;
  let createHeadedPageProvider;
  let newLivenessPage;
  let jitteredDelayMs;
  let sleep;
  try {
    ({ chromium } = await import('playwright'));
    ({ checkUrlLiveness, checkUrlLivenessWithFallback, createHeadedPageProvider, newLivenessPage, jitteredDelayMs, sleep } = await import('./liveness-browser.mjs'));
  } catch (err) {
    throw new Error(
      `--verify requires Playwright with Chromium (run "npx playwright install chromium"): ${err.message}`,
      { cause: err },
    );
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    throw new Error(
      `--verify could not launch Chromium (run "npx playwright install chromium" or re-run without --verify): ${err.message}`,
      { cause: err },
    );
  }

  // Three permanent buckets + one transient passthrough:
  //   verified  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ active pages and transient nav errors (retry next scan)
  //   expired   ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ classifier-confirmed dead postings (HTTP 4xx, redirect markers,
  //               body patterns, listing pages, insufficient content)
  //   dropped   ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ page loaded but classifier saw no Apply control. --verify is an
  //               opt-in stricter filter; keeping these defeats the purpose.
  //   invalid   ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ up-front URL guard rejections (malformed / non-http / private)
  const verified = [];
  const expired = [];
  const dropped = [];
  const invalid = [];
  const migrated = [];

  const headed = headedFallback ? createHeadedPageProvider(chromium) : null;
  const getHeadedPage = headed ? () => headed.get() : undefined;

  try {
    const page = await newLivenessPage(browser);
    // Sequential ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ project rule: never Playwright in parallel
    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      const { result, code, reason } = headed
        ? await checkUrlLivenessWithFallback(page, offer.url, { getHeadedPage })
        : await checkUrlLiveness(page, offer.url);
      if (result === 'expired') {
        // 404/410 on a tracked company may just be a moved role ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ run one
        // search + re-verify before giving up (opt-in via --rediscover-404).
        // Only http_gone (HTTP 404/410) qualifies; soft-expiry signals
        // (redirect/body/listing) are real closures, not URL moves.
        if (rediscover && code === 'http_gone' && offer.tracked && offer.careersUrlDomain) {
          const newUrl = await searchForNewUrl(page, offer);
          if (newUrl) {
            // Mirror the primary check: without the headed fallback, a
            // challenge-prone domain would flag the rediscovered URL as
            // expired just because the recheck hit the same anti-bot wall.
            const recheck = headed
              ? await checkUrlLivenessWithFallback(page, newUrl, { getHeadedPage })
              : await checkUrlLiveness(page, newUrl);
            // Require a *confirmed* live page before migrating. A transient
            // 'uncertain' (timeout/DNS/5xx) must not commit an unverified URL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬
            // fall through to expired (the original 404/410 is a real closure).
            if (recheck.result === 'active') {
              migrated.push({ ...offer, url: newUrl, previousUrl: offer.url });
              console.log(`  ÃƒÂ°Ã…Â¸Ã¢â‚¬Ã¢â‚¬Å¾ migrated  ${offer.company} | ${offer.title} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ${newUrl}`);
              continue;
            }
          }
        }
        expired.push({ ...offer, reason });
        console.log(`  ÃƒÂ¢Ã‚Ã…â€™ expired   ${offer.company} | ${offer.title} (${reason})`);
      } else if (result === 'uncertain' && GUARD_CODES.has(code)) {
        // Guard failures are permanent (not transient like a timeout) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ record them
        // separately so they don't end up in pipeline.md but DO appear in scan-history
        // with a precise status, dedup-blocking them on subsequent scans.
        invalid.push({ ...offer, code, reason });
        console.log(`  ÃƒÂ¢Ã¢â‚¬ÂºÃ¢â‚¬ invalid   ${offer.company} | ${offer.title} (${reason})`);
      } else if (result === 'uncertain' && code === 'no_apply_control') {
        // Page loaded but classifier could not find an Apply control. Treat like
        // expired for routing ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ drop from pipeline AND record in scan-history so
        // we don't burn a verify cycle on the same URL next scan.
        dropped.push({ ...offer, reason });
        console.log(`  ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚ no-apply  ${offer.company} | ${offer.title} (${reason})`);
      } else {
        // 'active' or 'uncertain' due to navigation_error (transient ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ retry next scan)
        verified.push(offer);
        const icon = result === 'active' ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚';
        console.log(`  ${icon} ${result.padEnd(9)} ${offer.company} | ${offer.title}`);
      }

      const wait = i < offers.length - 1 ? jitteredDelayMs(throttleBaseMs) : 0;
      if (wait) await sleep(wait);
    }
  } finally {
    if (headed) await headed.close();
    await browser.close();
  }

  return { verified, expired, dropped, invalid, migrated };
}

// Stable codes from liveness-browser's up-front URL guard. Routing dispatches
// on these codes (not on regex over reason strings) so wording can change
// without breaking the pipeline.
const GUARD_CODES = new Set(['invalid_url', 'unsupported_protocol', 'blocked_host']);

// guardStatusFor maps a guard code to the canonical scan-history status string.
function guardStatusFor(code) {
  if (code === 'blocked_host') return 'skipped_blocked_host';
  // invalid_url and unsupported_protocol both surface as malformed input
  return 'skipped_invalid_url';
}

const NEARBY_COUNTRIES = new Map([
  ['india', ['Pakistan', 'China', 'Nepal', 'Bhutan', 'Bangladesh', 'Myanmar', 'Sri Lanka']],
  ['singapore', ['Malaysia', 'Indonesia', 'Thailand', 'Vietnam']],
  ['malaysia', ['Singapore', 'Indonesia', 'Thailand', 'Vietnam', 'Brunei']],
  ['indonesia', ['Malaysia', 'Singapore', 'Thailand', 'Vietnam', 'Philippines']],
  ['united arab emirates', ['Oman', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait']],
  ['uae', ['Oman', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait']],
  ['united states', ['Canada', 'Mexico']], ['canada', ['United States', 'Mexico']],
  ['united kingdom', ['Ireland', 'France', 'Belgium', 'Netherlands']],
  ['australia', ['New Zealand', 'Indonesia', 'Singapore']],
  ['germany', ['France', 'Poland', 'Austria', 'Netherlands', 'Belgium', 'Czech Republic']],
  ['france', ['Belgium', 'Luxembourg', 'Germany', 'Spain', 'Italy', 'Switzerland']],
  ['japan', ['South Korea', 'China', 'Taiwan']],
]);
const LOCATION_ALIASES = new Map([['uae', 'United Arab Emirates'], ['usa', 'United States'], ['us', 'United States'], ['uk', 'United Kingdom'], ['u.a.e.', 'United Arab Emirates']]);
const KNOWN_COUNTRIES = ['United Arab Emirates', 'United States', 'United Kingdom', 'Saudi Arabia', 'South Korea', 'New Zealand', 'Czech Republic', 'India', 'Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Vietnam', 'Australia', 'Canada', 'Mexico', 'Ireland', 'France', 'Germany', 'Japan', 'China', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka', 'Pakistan', 'Myanmar', 'Philippines', 'Poland', 'Austria', 'Netherlands', 'Belgium', 'Spain', 'Italy', 'Switzerland', 'Taiwan'];
function getFlagValue(args, name) {
  const exact = args.indexOf(name); if (exact !== -1) return String(args[exact + 1] || '').trim();
  const prefix = args.find((arg) => arg.startsWith(name + '=')); return prefix ? prefix.slice(name.length + 1).trim() : '';
}
function locationProfile(profile, locationInput) {
  const value = String(locationInput || '').trim(); if (!value) return profile;
  const lower = value.toLowerCase();
  const matchedCountry = KNOWN_COUNTRIES.find((country) => lower.includes(country.toLowerCase()));
  const country = matchedCountry || LOCATION_ALIASES.get(lower) || value;
  const nearby = NEARBY_COUNTRIES.get(country.toLowerCase()) || [];
  const oldLocation = profile.location && typeof profile.location === 'object' ? profile.location : {};
  return { ...profile, location: { ...oldLocation, country, city: value.includes(',') ? value.split(',')[0].trim() : (oldLocation.city || 'TBD'), preferred_locations: [country, value, ...nearby], nearby_locations: nearby } };
}
async function askForLocation(args, profile) {
  const supplied = getFlagValue(args, '--location'); if (supplied) return supplied;
  if (!process.stdin.isTTY) { const saved = profile.location && profile.location.country; return saved && saved !== 'TBD' ? saved : ''; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return await new Promise((resolve) => rl.question('What is your location? (city and country, or country): ', resolve)); } finally { rl.close(); }
}
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');
  // Opt-in: on an anti-bot challenge (e.g. pracuj.pl Cloudflare wall), retry the
  // URL in a headed browser. Off by default ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ headed Chromium needs a display, so
  // scheduled/unattended scans should not rely on it.
  const headedFallback = args.includes('--headed-fallback');
  // --throttle or --throttle=<ms>: jittered gap between --verify checks to stay
  // under rate-based WAF limits (pracuj.pl flags the session after a few rapid
  // hits). Default base 5000ms. Off by default ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ most ATS feeds don't need it.
  const throttleArg = args.find((a) => a === '--throttle' || a.startsWith('--throttle='));
  const throttleBaseMs = throttleArg ? (Number(throttleArg.split('=')[1]) || 5000) : 0;
  // --rediscover-404: when a tracked company's URL 404/410s, search for the
  // moved role and re-verify before marking it expired. Opt-in; rides on --verify.
  const rediscover = args.includes('--rediscover-404');
  const companyFlag = args.indexOf('--company');
  const filterCompany = companyFlag !== -1 ? args[companyFlag + 1]?.toLowerCase() : null;


  // 1. Load providers
  const providers = await loadProviders(PROVIDERS_DIR);
  if (providers.size === 0) {
    console.error('Error: no providers loaded from providers/');
    process.exit(1);
  }

  // 2. Read portals.yml
  if (!existsSync(PORTALS_PATH)) {
    console.error('Error: portals.yml not found. Run onboarding first.');
    process.exit(1);
  }

  let rawConfig;
  try {
    rawConfig = parseYaml(readFileSync(PORTALS_PATH, 'utf-8'));
  } catch (err) {
    console.error(`Error: failed to parse ${PORTALS_PATH}: ${err.message}`);
    process.exit(1);
  }
  const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  let profile = {};
  if (existsSync(PROFILE_PATH)) {
    try {
      const parsedProfile = parseYaml(readFileSync(PROFILE_PATH, 'utf-8'));
      profile = parsedProfile && typeof parsedProfile === 'object' ? parsedProfile : {};
    } catch (err) {
      console.error(`Warning: failed to parse ${PROFILE_PATH}: ${err.message}`);
    }
  }
  const locationInput = await askForLocation(args, profile);
  profile = locationProfile(profile, locationInput);
  if (locationInput) console.log('Location scope: ' + locationInput + ' plus nearby countries');

  const companies = Array.isArray(config.tracked_companies) ? config.tracked_companies : [];
  const boards = Array.isArray(config.job_boards) ? config.job_boards : [];
  const titleFilter = buildTitleFilter(config.title_filter);
  const locationFilter = buildLocationFilter(config.location_filter, profile);
  const salaryFilter = buildSalaryFilter(config.salary_filter);

  // 3. Resolve a provider for each enabled company / board
  const targets = [];
  let skippedCount = 0;
  let boardCount = 0;
  const resolveErrors = [];
  const agentHandoff = [];

  /**
   * Processes a list of configuration entries, resolves their appropriate data providers,
   * and appends valid entries to the global scanning targets list.
   * @param {Array<{ name?: string, enabled?: boolean, [key: string]: unknown }>} entries - List of entries.
   * @param {{ isBoard?: boolean }} [options={}] - Configuration options.
   */
  function resolveEntries(entries, { isBoard = false } = {}) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.enabled === false) continue;
      if (typeof entry.name !== 'string' || !entry.name.trim()) {
        console.error(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚  Skipping entry ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ missing or non-string 'name' field: ${JSON.stringify(entry)}`);
        continue;
      }
      if (filterCompany && !entry.name.toLowerCase().includes(filterCompany)) continue;
      
      const resolved = resolveProvider(entry, providers);
      if (!resolved) {
        skippedCount++;
        if (entry.scan_method === 'websearch') {
          agentHandoff.push({
            company: entry.name,
            method: 'websearch',
            query: entry.scan_query || entry.search_query || entry.careers_url || '',
          });
        }
        continue;
      }
      
      if (resolved.error) { 
        resolveErrors.push({ company: entry.name, error: resolved.error }); 
        continue; 
      }
      
      targets.push({ ...entry, _provider: resolved.provider, _isBoard: isBoard });
      if (isBoard) boardCount++;
    }
  }

  resolveEntries(companies);
  resolveEntries(boards, { isBoard: true });

  const localParserCount = targets.filter(t => t._provider.id === 'local-parser').length;
  const companyCount = targets.length - boardCount;
  const parts = [`${companyCount} companies`];
  if (boardCount > 0) parts.push(`${boardCount} internship boards`);
  parts.push(`${localParserCount} local parser`);
  parts.push(`${skippedCount} skipped - no provider matched`);
  console.log(`Scanning ${parts.join('; ')} via providers`);
  if (dryRun) console.log('(dry run - no files will be written)\n');

  // 4. Load dedup sets
  const historyPolicy = scanHistoryPolicy(config);
  const seenUrlState = loadSeenUrls(historyPolicy);
  const seenUrls = seenUrlState.seen;
  const seenCompanyRoles = loadSeenCompanyRoles();

  // 5. Fetch from each target
  const date = new Date().toISOString().slice(0, 10);
  let totalFound = 0;
  let totalFilteredTitle = 0;
  let totalFilteredLocation = 0;
  let totalFilteredSalary = 0;
  let totalDupes = 0;
  const newOffers = [];
  const internshipCandidates = [];
  const errors = [...resolveErrors];

  const tasks = targets.map(company => async () => {
    let provider = company._provider;
    const ctx = makeHttpCtx();
    let sourceName = provider.id === 'local-parser' ? 'local-parser' : `${provider.id}-api`;
    try {
      let jobs;
      try {
        jobs = await provider.fetch(company, ctx);
      } catch (parserErr) {
        if (provider.id !== 'local-parser') throw parserErr;
        const fallback = resolveProvider(company, providers, { skipIds: ['local-parser'] });
        if (!fallback || fallback.error) throw parserErr;
        provider = fallback.provider;
        sourceName = `${provider.id}-api`;
        jobs = await provider.fetch(company, ctx);
        errors.push({
          company: company.name,
          error: `local parser failed, used API fallback: ${parserErr.message}`,
        });
      }
      if (!Array.isArray(jobs)) {
        throw new Error(`${provider.id}: fetch() did not return an array`);
      }
      totalFound += jobs.length;

      for (const job of jobs) {
        if (!titleFilter(job.title)) {
          totalFilteredTitle++;
          continue;
        }
        const candidate = { ...job, source: sourceName, matchStatus: 'Internship title match' };
        internshipCandidates.push(candidate);
        if (!locationFilter(job.location)) {
          candidate.matchStatus = 'Outside location scope';
          totalFilteredLocation++;
          continue;
        }
        if (!salaryFilter(job.salary)) {
          candidate.matchStatus = 'Outside stipend criteria';
          totalFilteredSalary++;
          continue;
        }
        if (seenUrls.has(job.url)) {
          candidate.matchStatus = 'Already seen';
          totalDupes++;
          continue;
        }
        const key = `${job.company.toLowerCase()}::${job.title.toLowerCase()}`;
        if (seenCompanyRoles.has(key)) {
          candidate.matchStatus = 'Already seen';
          totalDupes++;
          continue;
        }
        // Mark as seen to avoid intra-scan dupes
        seenUrls.add(job.url);
        seenCompanyRoles.add(key);
        // Tag with the company's careers domain so verify can offer a 404/410
        // rediscovery fallback. A null domain (no careers_url) marks the offer
        // as broad-discovery ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ ineligible for the fallback, per the issue scope.
        const careersUrlDomain = extractCareersUrlDomain(company.careers_url);
        newOffers.push({
          ...job,
          source: sourceName,
          tracked: Boolean(careersUrlDomain),
          careersUrlDomain,
        });
      }
    } catch (err) {
      errors.push({ company: company.name, error: err.message });
    }
  });

  await parallelFetch(tasks, CONCURRENCY);

  // 5.5. Optional liveness verification ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ drop expired and guard-rejected postings
  let verifiedOffers = newOffers;
  let expiredOffers = [];
  let droppedOffers = [];
  let invalidOffers = [];
  let migratedOffers = [];
  if (verify && newOffers.length > 0) {
    console.log(`\nVerifying liveness of ${newOffers.length} new offer(s) with Playwright (sequential)...`);
    const result = await verifyOffers(newOffers, { headedFallback, throttleBaseMs, rediscover });
    verifiedOffers = result.verified;
    expiredOffers = result.expired;
    droppedOffers = result.dropped;
    invalidOffers = result.invalid;
    migratedOffers = result.migrated;
    // Migrated offers re-enter the pipeline at their newly discovered URL.
    if (migratedOffers.length > 0) {
      verifiedOffers = [...verifiedOffers, ...migratedOffers];
    }
  }

  // 6. Write results
  if (!dryRun && verifiedOffers.length > 0) {
    appendToPipeline(verifiedOffers);
    appendToScanHistory(verifiedOffers, date);
  }
  // Expired postings ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ plus the old URLs of migrated offers ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ are recorded as
  // skipped_expired so subsequent scans dedup-skip the dead URLs.
  const expiredForHistory = [
    ...expiredOffers,
    ...migratedOffers.map(o => ({ ...o, url: o.previousUrl })),
  ];
  if (!dryRun && expiredForHistory.length > 0) {
    appendToScanHistory(expiredForHistory, date, 'skipped_expired');
  }
  // Pages that loaded but had no Apply control: record so we don't re-verify
  // them next scan, but never let them reach pipeline.md.
  if (!dryRun && droppedOffers.length > 0) {
    appendToScanHistory(droppedOffers, date, 'skipped_no_apply_control');
  }
  // Guard-rejected URLs (invalid / unsupported protocol / blocked host) are
  // recorded with a precise status so subsequent scans dedup-skip them via
  // loadSeenUrls, but they never reach pipeline.md.
  if (!dryRun && invalidOffers.length > 0) {
    // Group by code so the TSV reflects the actual reason category.
    const byStatus = new Map();
    for (const o of invalidOffers) {
      const status = guardStatusFor(o.code);
      if (!byStatus.has(status)) byStatus.set(status, []);
      byStatus.get(status).push(o);
    }
    for (const [status, group] of byStatus) {
      appendToScanHistory(group, date, status);
    }
  }

  // 7. Print summary and write the latest internship report
  const summaryCompanies = targets.filter(t => !t._isBoard).length;
  const summaryBoards = targets.filter(t => t._isBoard).length;
  const titleMatches = Math.max(0, totalFound - totalFilteredTitle);
  const summary = {
    companiesScanned: summaryCompanies,
    boardsScanned: summaryBoards,
    totalFound,
    titleMatches,
    filteredTitle: totalFilteredTitle,
    filteredLocation: totalFilteredLocation,
    filteredSalary: totalFilteredSalary,
    duplicates: totalDupes,
  };
  const reportPath = dryRun ? SCAN_REPORT_PATH : writeInternshipScanReport({
    date,
    profile,
    summary,
    offers: verifiedOffers,
    candidates: internshipCandidates,
    warnings: errors,
  });

  console.log(`\n${'-'.repeat(45)}`);
  console.log(`Internship Portal Scan - ${date}`);
  console.log(`${'-'.repeat(45)}`);
  console.log(`Companies scanned:       ${summaryCompanies}`);
  if (summaryBoards > 0) console.log(`Internship boards scanned:${String(summaryBoards).padStart(5)}`);
  console.log(`Total postings scanned:  ${totalFound}`);
  console.log(`Internship title matches:${String(titleMatches).padStart(5)}`);
  console.log(`Filtered non-internship: ${totalFilteredTitle} removed`);
  console.log(`Filtered by location:    ${totalFilteredLocation} removed`);
  console.log(`Filtered by stipend:     ${totalFilteredSalary} removed`);
  console.log(`Duplicates:              ${totalDupes} skipped`);
  if (historyPolicy.recheckAfterDays != null) {
    console.log(`Recheck eligible:        ${seenUrlState.recheckEligible} old scan-history URL(s)`);
  }
  if (verify) {
    console.log(`Expired (verified):      ${expiredOffers.length} dropped`);
    console.log(`Rediscovered (moved):    ${migratedOffers.length} migrated`);
    console.log(`No apply control:        ${droppedOffers.length} dropped`);
    console.log(`Invalid (guarded):       ${invalidOffers.length} dropped`);
  }
  console.log(`New internships added:   ${verifiedOffers.length}`);

  if (agentHandoff.length > 0) {
    console.log(`Agent/WebSearch handoff: ${agentHandoff.length} compan${agentHandoff.length === 1 ? 'y' : 'ies'} not handled by zero-token providers`);
    for (const item of agentHandoff.slice(0, 25)) {
      const hint = item.query ? ` - ${item.query}` : '';
      console.log(`  - ${item.company} (${item.method})${hint}`);
    }
    if (agentHandoff.length > 25) {
      console.log(`  ... ${agentHandoff.length - 25} more omitted; narrow with --company or inspect portals.yml`);
    }
  }

  if (errors.length > 0) {
    console.log(`\nProvider warnings (${errors.length}, non-fatal):`);
    for (const e of errors) {
      console.log(`  [warn] ${e.company}: ${e.error}`);
    }
  }

  if (verifiedOffers.length > 0) {
    console.log('\nNew internships:');
    for (const o of verifiedOffers) {
      console.log(`  + ${o.company} | ${o.title} | stipend: ${formatStipend(o.salary)} | ${o.location || 'N/A'} | ${classifyWorkMode(o.location)}`);
    }
    if (dryRun) {
      console.log('\n(dry run - run without --dry-run to save results and write the detailed report)');
    } else {
      console.log(`\nResults saved to ${PIPELINE_PATH}, ${SCAN_HISTORY_PATH}, and ${reportPath}`);
    }
  } else if (!dryRun) {
    console.log(`\nDetailed report saved to ${reportPath}`);
  }

  console.log(`\n-> Run /interm-ops pipeline to evaluate new internships.`);
}

// Only run main() when invoked directly (`node scan.mjs`), not when imported by tests.
// `|| ''` guards the case where Node is invoked without a script arg (e.g. `node -e`).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}



