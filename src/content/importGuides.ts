// Bundles the authoring guides (docs/authoring/*.md) as downloadable text so an
// author can grab the guide next to a template and hand BOTH to an AI: the guide
// says how to author, the template is the file to fill. Raw-imported via Vite's
// `?raw` so the download IS the repo guide — one source, no drift.
import readme from '../../docs/authoring/README.md?raw';
import courseUnits from '../../docs/authoring/course-and-units.md?raw';
import items from '../../docs/authoring/lessons-and-items.md?raw';
import bosses from '../../docs/authoring/bosses.md?raw';
import pets from '../../docs/authoring/pets.md?raw';
import type { TemplateSurface } from './importTemplates';

export interface GuideDoc {
  filename: string;
  content: string;
}

/** The single guide that documents each per-surface drawer's columns.
 *  (Course has no drawer of its own — it lives in the whole-course flow below.) */
export const SURFACE_GUIDES: Record<Exclude<TemplateSurface, 'Course'>, GuideDoc> = {
  Units: { filename: 'course-and-units-guide.md', content: courseUnits },
  Items: { filename: 'items-and-lessons-guide.md', content: items },
  Bosses: { filename: 'bosses-guide.md', content: bosses },
  Pets: { filename: 'pets-guide.md', content: pets },
};

/** The whole-course download bundles the README (shared rules + output format)
 *  with the three sheet guides a course needs — Course/Units, Items, Bosses. */
export const COURSE_GUIDE: GuideDoc = {
  filename: 'course-authoring-guide.md',
  content: [readme, courseUnits, items, bosses].join('\n\n---\n\n'),
};
