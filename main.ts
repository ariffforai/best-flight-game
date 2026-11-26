// Ring Runner Ridge — the entry program (Node 22, standard library only).
//
// The game itself is plain static files under game/ (index.html plus ES
// modules, no library, no network request), and the screenshots in
// screenshots/ are real renders of that game taken in a headless browser.
// This program hands both in: it copies them into the grader's output
// directory and writes dossier.json there, using the vendored make.fun
// library to build the dossier the judge reads.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program runs twice and both runs must write the same bytes, so it
// does nothing time- or order-dependent: plain recursive copies, then one
// deterministic dossier write.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the playable game and its screenshots into the output directory.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), {
    recursive: true,
  });
}

// Write the dossier with the same caps the gate enforces, so a dossier this
// program writes is the dossier the gate accepts: at most 160 KiB of source
// text, at most 4 screenshots of at most 256 KiB each, and game/ within its
// file, byte and path caps.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
