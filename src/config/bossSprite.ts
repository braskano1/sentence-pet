import type { CheckpointBoss } from '../content/model';
import { spriteSrc } from './sprites';
import { ELEMENT_EMOJI } from './petDisplay';

/** A boss reuses a pet sprite (sad mood = angry-ish face) scaled up by the UI. */
export function bossSpriteSrc(boss: CheckpointBoss): string {
  return spriteSrc(boss.rivalSprite.species, boss.rivalSprite.stage, 'sad');
}

export function bossElementEmoji(boss: CheckpointBoss): string {
  return ELEMENT_EMOJI[boss.element];
}
