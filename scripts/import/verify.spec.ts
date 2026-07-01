/**
 * Import-catalog verification: confirm 345 imported petDefs render as Dex cards.
 *
 * Boot pattern mirrors p4d-evolution-full-ui.spec.ts (hermetic-auth + real menu).
 *
 * Two known emulator-connectivity hurdles handled here:
 *
 *   1. EggHatch guard: App.tsx renders <EggHatch /> when pet.hatched=false regardless
 *      of screen state. We inject a hatched pet via store.setState (same pattern as
 *      e2e/support/p4d-evolution.ts) before calling setScreen('collection').
 *
 *   2. Firestore emulator unreachable from Playwright Chromium: the Firebase Firestore
 *      SDK fails to connect to VITE_EMULATOR_HOST:8080 in the browser launched by
 *      Playwright (gRPC/WebChannel issues). We work around this by fetching the
 *      petDefs document directly via the Firestore emulator REST API from Node.js
 *      (where the connection works), then injecting the defs into the live app via
 *      window.petDefs.set() — the same harness hook used by existing e2e specs.
 */

import { test, expect } from '@playwright/test';
import { stubFirebaseAuth, enterGameViaMenu } from '../../e2e/support/hermetic-auth';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, 'out');

// Firestore emulator REST base — use 127.0.0.1 (always loopback-reachable).
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;
const PROJECT_ID = 'demo-sentence-pet';

/** Fetch petDefs from the Firestore emulator via REST (Node.js side, not browser).
 *  Returns the parsed PetDef array, or throws if the doc is absent / fetch fails. */
async function fetchPetDefsFromEmulator(): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const url = `http://${EMULATOR_HOST}:${EMULATOR_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents/content/petDefs`;
    http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          // Firestore REST value format: { fields: { defs: { arrayValue: { values: [...] } } } }
          const values = body?.fields?.defs?.arrayValue?.values ?? [];
          // Each value is a mapValue with string/integer/etc. fields. We need to convert
          // the Firestore REST encoding back to plain objects that match the PetDef shape.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          function unwrap(v: any): any {
            if (!v || typeof v !== 'object') return v;
            if ('stringValue' in v) return v.stringValue;
            if ('integerValue' in v) return Number(v.integerValue);
            if ('doubleValue' in v) return v.doubleValue;
            if ('booleanValue' in v) return v.booleanValue;
            if ('nullValue' in v) return null;
            if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(unwrap);
            if ('mapValue' in v) {
              const m: Record<string, unknown> = {};
              for (const [k, fv] of Object.entries(v.mapValue?.fields ?? {})) {
                m[k] = unwrap(fv);
              }
              return m;
            }
            return v;
          }
          resolve(values.map(unwrap));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Mirrors waitForHarness from e2e/support/p4d-evolution.ts
async function waitForHarness(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => {
      const w = window as unknown as Record<string, unknown>;
      const store = w['store'] as { getState?: () => unknown } | undefined;
      const petDefs = w['petDefs'] as { set?: unknown; builtins?: unknown[] } | undefined;
      return (
        typeof store?.getState === 'function' &&
        typeof petDefs?.set === 'function' &&
        Array.isArray(petDefs?.builtins)
      );
    },
    null,
    { timeout: 30_000 },
  );
}

test('imported catalog renders > 100 Dex cards', async ({ page }) => {
  // Ensure output directory exists for screenshot.
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Fetch the petDefs from the emulator on the Node side before mounting the browser.
  const petDefs = await fetchPetDefsFromEmulator();
  expect(petDefs.length, `Emulator should have defs seeded; got ${petDefs.length}`).toBeGreaterThan(100);

  // 1. Stub auth BEFORE goto so emulator Identity Toolkit requests resolve.
  await stubFirebaseAuth(page);

  // 2. Navigate + wait for the harness.
  await waitForHarness(page);

  // 3. Walk the real menu to mount the game (anon → Play as guest → Skip intro).
  await enterGameViaMenu(page);

  // 4. Inject a hatched pet so App.tsx routes past the EggHatch guard, inject the
  //    emulator petDefs, then navigate to Collection.
  await page.evaluate((defs) => {
    const w = window as unknown as {
      store: {
        setState: (s: object) => void;
        getState: () => { setScreen: (s: string) => void };
      };
      petDefs: { set: (defs: unknown[]) => void };
    };

    // Inject petDefs into the live registry (triggers useSyncExternalStore re-renders).
    w.petDefs.set(defs);

    // Inject a hatched pet (builtin def-leaf is always valid).
    w.store.setState({
      pets: [{
        id: 'verify-pet',
        defId: 'def-leaf',
        species: 'leaf',
        hatched: true,
        xp: 0,
        happiness: 50,
        bars: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
        stats: { hp: 30, atk: 30, def: 30, spd: 30, luk: 30 },
        growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
        rarity: 'common',
        name: '',
      }],
      activePetId: 'verify-pet',
    });

    // Navigate to Collection.
    w.store.getState().setScreen('collection');
  }, petDefs);

  // 5. Wait for the Collection screen — the tab list is the stable landmark.
  await page.waitForSelector('[role="tablist"][aria-label="Collection view"]', { timeout: 10_000 });

  // 6. Click the Dex tab.
  await page.getByRole('tab', { name: 'Dex' }).click();

  // 7. Wait for Dex cards to render.
  //    DexGrid renders .grid.grid-cols-3 with one <button aria-label> per enabled line.
  await page.waitForFunction(
    () => {
      const grid = document.querySelector('.grid.grid-cols-3');
      if (!grid) return false;
      return grid.querySelectorAll('button[aria-label]').length > 100;
    },
    null,
    { timeout: 10_000 },
  );

  // 8. Screenshot the full Dex grid.
  const screenshotPath = path.join(OUT_DIR, 'verify-dex-grid.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // 9. Count and assert cards.
  const cardCount = await page.evaluate(() => {
    const grid = document.querySelector('.grid.grid-cols-3');
    if (!grid) return 0;
    return grid.querySelectorAll('button[aria-label]').length;
  });

  expect(cardCount, `Expected > 100 Dex cards but found ${cardCount}`).toBeGreaterThan(100);
});
