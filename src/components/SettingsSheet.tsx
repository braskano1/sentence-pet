import { useGameStore } from '../state/gameStore';
import type { ChannelName } from '../audio/mixer';
import { PressButton } from './PressButton';

const CHANNELS: { key: 'master' | ChannelName; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'sfx', label: 'SFX' },
  { key: 'music', label: 'Music' },
  { key: 'voice', label: 'Voice' },
];

/** Bottom-sheet audio mixer: mute-all + per-channel slider & mute. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const audio = useGameStore((s) => s.audio);
  const setChannelLevel = useGameStore((s) => s.setChannelLevel);
  const toggleChannelMute = useGameStore((s) => s.toggleChannelMute);
  const toggleMuteAll = useGameStore((s) => s.toggleMuteAll);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Audio settings"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Sound</h2>
          <PressButton
            onClick={toggleMuteAll}
            className={`rounded-lg px-3 py-1 text-sm font-semibold ${audio.allMuted ? 'bg-red-500 text-white' : 'bg-slate-200'}`}
          >
            {audio.allMuted ? 'Muted — Unmute all' : 'Mute all'}
          </PressButton>
        </div>

        <ul className="space-y-4">
          {CHANNELS.map(({ key, label }) => {
            const ch = audio[key];
            const id = `vol-${key}`;
            return (
              <li key={key} className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`${label} ${ch.muted ? 'unmute' : 'mute'}`}
                  onClick={() => toggleChannelMute(key)}
                  className="w-8 text-xl"
                >
                  {ch.muted ? '🔇' : '🔊'}
                </button>
                <label htmlFor={id} className="w-16 text-sm font-medium">{label}</label>
                <input
                  id={id}
                  aria-label={`${label} volume`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={ch.level}
                  aria-valuetext={`${Math.round(ch.level * 100)}%`}
                  disabled={audio.allMuted || (key !== 'master' && audio.master.muted)}
                  onChange={(e) => setChannelLevel(key, Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
              </li>
            );
          })}
        </ul>

        <PressButton onClick={onClose} className="mt-5 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white">
          Done
        </PressButton>
      </div>
    </div>
  );
}
