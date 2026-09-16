#!/usr/bin/env node
/**
 * Class Feud scope sentinel.
 *
 * Scans the repository for strong contamination signatures from unrelated
 * projects (Math Presenter / Saxon Math / lesson-renderer). It intentionally
 * avoids generic educational words ("lesson", "math", "teacher", "student")
 * so legitimate Class Feud content is never flagged.
 *
 * Exit code 0 = clean, 1 = contamination found.
 * Deterministic, dependency-free (Node built-ins only).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)

// Directories that are never scanned.
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.vite',
  '.next',
  '.cursor', // scope-guard rules live here (prohibited signatures are expected)
])

// Scope-guard files that legitimately cite prohibited signatures.
const SKIP_FILES = new Set([
  'AGENTS.md',
  'scripts/check-project-scope.mjs',
])

// Strong, project-specific contamination signatures. Deliberately NOT generic
// words like "lesson", "math", "teacher", or "student".
const CONTENT_SIGNATURES = [
  /Math Presenter/i,
  /saxon-?g5-?teacher/i,
  /saxon-?g5-?student/i,
  /saxon5_?section2/i,
  /Notability/i,
  /source_fidelity/i,
  /lesson[-_ ]renderer/i,
  /deckgen/i,
  /deck_adapter/i,
  /build_lesson/i,
  /seed_lesson/i,
  /curriculum\/specs/i,
  /Lesson 3[123]\b/,
  /Teacher Edition/i,
  /Student Book/i,
]

// Strong file/directory-name signatures.
const NAME_SIGNATURES = [
  /saxon/i,
  /math[-_ ]presenter/i,
  /notability/i,
  /deckgen/i,
  /deck_adapter/i,
  /source_fidelity/i,
  /build_lesson/i,
  /seed_lesson/i,
  /lesson-?renderer/i,
]

const offenses = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (SKIP_DIRS.has(entry)) continue
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full)
      continue
    }
    const rel = relative(ROOT, full)
    if (SKIP_FILES.has(rel)) continue
    if (NAME_SIGNATURES.some((re) => re.test(entry))) {
      offenses.push(`${rel} (filename matches unrelated-project signature)`)
      continue
    }
    // Only scan plausible text files.
    if (st.size > 2_000_000) continue
    let text
    try {
      text = readFileSync(full, 'utf8')
    } catch {
      continue // binary or unreadable — skip
    }
    for (const re of CONTENT_SIGNATURES) {
      if (re.test(text)) {
        offenses.push(`${rel} (content matches ${re.source})`)
        break
      }
    }
  }
}

walk(ROOT)

if (offenses.length > 0) {
  console.error('CLASS FEUD SCOPE CHECK — CONTAMINATION FOUND:')
  for (const o of offenses) console.error(`  - ${o}`)
  console.error(`\n${offenses.length} offending path(s).`)
  process.exit(1)
}

console.log('Class Feud scope check: PASS (no unrelated project content found).')
