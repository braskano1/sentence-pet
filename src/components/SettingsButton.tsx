import { useUiStore } from '../state/uiStore';
import { PressButton } from './PressButton';

/**
 * The global Settings entry. A frosted gear pill that sits inside each hub
 * screen's top-right control cluster (next to coins / stars / Room), so it
 * reads as a peer of that screen's own chrome instead of a floating orphan.
 * Opens the single SettingsSheet that App renders off the shared UI store.
 * `className` lets a screen match its neighbours' exact size/treatment.
 */
export function SettingsButton({ className = '' }: { className?: string }) {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  return (
    <PressButton
      onClick={() => setSettingsOpen(true)}
      aria-label="Settings"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/90 text-base shadow ring-1 ring-black/5 ${className}`}
    >
      ⚙️
    </PressButton>
  );
}
