import type { ContentItem } from '../../../data/types';
import { isDragDrop } from '../../../data/types';

/** Best-effort human label for a pool item (items have no title field). */
export function itemLabel(it: ContentItem): string {
  switch (it.kind) {
    case 'flashcard':
      return it.front || it.back || it.id;
    case 'matching':
      return it.pairs[0] ? `${it.pairs[0].left} → ${it.pairs[0].right}` : it.id;
    case 'dragdrop':
      return it.answer.join(' ') || it.thaiHint || it.id;
    case 'fillblank':
      return it.template || it.id;
  }
}

/** Lowercase search haystack: label + id + kind + drill/kind meta. */
export function itemSearchText(it: ContentItem): string {
  const meta = isDragDrop(it) ? it.drill : it.kind;
  return `${itemLabel(it)} ${it.id} ${it.kind} ${meta}`.toLowerCase();
}
