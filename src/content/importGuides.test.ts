import { describe, it, expect } from 'vitest';
import { SURFACE_GUIDES, COURSE_GUIDE } from './importGuides';

describe('importGuides', () => {
  it('exposes a non-empty guide for each drawer surface', () => {
    for (const surface of ['Units', 'Items', 'Bosses', 'Pets'] as const) {
      const g = SURFACE_GUIDES[surface];
      expect(g.filename).toMatch(/\.md$/);
      expect(g.content.length).toBeGreaterThan(200);
    }
  });

  it('each surface guide is the real authoring guide (carries its sheet name)', () => {
    expect(SURFACE_GUIDES.Items.content).toMatch(/Items/);
    expect(SURFACE_GUIDES.Bosses.content).toMatch(/Bosses/);
    expect(SURFACE_GUIDES.Pets.content).toMatch(/Pets/);
    expect(SURFACE_GUIDES.Units.content).toMatch(/Units/);
  });

  it('the course guide bundles the README plus the three sheet guides', () => {
    // README's distinctive heading + a column from each bundled guide.
    expect(COURSE_GUIDE.content).toMatch(/content authoring guides/i); // README title
    expect(COURSE_GUIDE.content).toMatch(/`l1Ready`/);   // course-and-units
    expect(COURSE_GUIDE.content).toMatch(/`thaiHint`/);  // items
    expect(COURSE_GUIDE.content).toMatch(/`reviewsUnits`/); // bosses
    expect(COURSE_GUIDE.filename).toBe('course-authoring-guide.md');
  });
});
