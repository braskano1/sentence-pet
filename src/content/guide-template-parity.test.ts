// Guards docs/authoring/*.md against drifting from the import templates.
// Every column in SURFACE_TEMPLATES[surface] must be documented (as a backticked
// `code` token) in that surface's authoring guide. If a template column is added
// or renamed without updating the guide, this fails — so the guide an author
// pastes into an AI always matches the .xlsx the drawer hands them.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SURFACE_TEMPLATES, type TemplateSurface } from './importTemplates';

// Which guide documents each surface's columns.
const GUIDE: Record<TemplateSurface, string> = {
  Course: 'docs/authoring/course-and-units.md',
  Units: 'docs/authoring/course-and-units.md',
  Items: 'docs/authoring/lessons-and-items.md',
  Bosses: 'docs/authoring/bosses.md',
  Pets: 'docs/authoring/pets.md',
};

describe('authoring guide ↔ template column parity', () => {
  for (const surface of Object.keys(SURFACE_TEMPLATES) as TemplateSurface[]) {
    it(`${surface}: its guide documents every template column`, () => {
      const md = readFileSync(GUIDE[surface], 'utf8');
      const missing = SURFACE_TEMPLATES[surface].columns.filter((c) => !md.includes(`\`${c}\``));
      expect(missing, `${GUIDE[surface]} is missing backticked column(s)`).toEqual([]);
    });
  }
});
