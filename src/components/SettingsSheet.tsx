import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useAuth } from '../auth/useAuth';
import type { ChannelName } from '../audio/mixer';
import { PressButton } from './PressButton';
import { SignUpForm } from './account/SignUpForm';

const CHANNELS: { key: 'master' | ChannelName; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'sfx', label: 'SFX' },
  { key: 'music', label: 'Music' },
  { key: 'voice', label: 'Voice' },
];

/**
 * Settings page (bottom sheet): Account section + per-channel audio mixer.
 * Account branches on the explicit `isAnonymous` flag (never derived from
 * `user`): a guest gets "Save your progress" (links the anon account) and
 * "Exit to menu"; a real user gets their email + "Sign out". Every sign-out /
 * exit calls `onExitToMenu` so PlayerRoot's guestPlay flag is reset.
 */
export function SettingsSheet({ onClose, onReplayIntro, onExitToMenu }: {
  onClose: () => void;
  onReplayIntro?: () => void;
  onExitToMenu?: () => void;
}) {
  const { isAnonymous, user, signOut } = useAuth();
  const [saving, setSaving] = useState(false); // guest tapped "Save your progress"
  const audio = useGameStore((s) => s.audio);
  const setChannelLevel = useGameStore((s) => s.setChannelLevel);
  const toggleChannelMute = useGameStore((s) => s.toggleChannelMute);

  const replay = () => { onClose(); onReplayIntro?.(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" aria-hidden="true" />

        <h2 className="mb-5 text-xl font-black tracking-tight text-slate-900">Settings</h2>

        {/* ── Account ── */}
        <section aria-label="Account" className="mb-6">
          {isAnonymous ? (
            saving ? (
              <SignUpForm onDone={onClose} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-snug text-slate-500">
                  You&rsquo;re playing as a guest. Create an account to keep your pets safe.
                </p>
                <PressButton
                  onClick={() => setSaving(true)}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 text-base font-black text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600"
                >
                  Save your progress
                </PressButton>
                <button
                  type="button"
                  onClick={() => { onExitToMenu?.(); onClose(); }}
                  className="rounded-xl py-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                >
                  Exit to menu
                </button>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-400">Signed in</p>
                <span className="block truncate text-sm font-semibold text-slate-700">{user?.email}</span>
              </div>
              <button
                type="button"
                onClick={async () => { await signOut(); onExitToMenu?.(); }}
                className="shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          )}

          {onReplayIntro && (
            <button
              type="button"
              onClick={replay}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 transition-colors hover:text-slate-600"
            >
              <span aria-hidden="true">↺</span> Replay intro
            </button>
          )}
        </section>

        <hr className="mb-5 border-slate-100" />

        {/* ── Sound ── */}
        <section aria-label="Sound">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Sound</h3>
          <ul className="space-y-4">
            {CHANNELS.map(({ key, label }) => {
              const ch = audio[key];
              const id = `vol-${key}`;
              // A channel greys when its own mute is on, or — for non-master channels —
              // when Master (the global mute) is muted.
              const disabled = ch.muted || (key !== 'master' && audio.master.muted);
              return (
                <li key={key} className={`flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}>
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
                    disabled={disabled}
                    onChange={(e) => setChannelLevel(key, Number(e.target.value))}
                    className={`flex-1 ${disabled ? 'accent-slate-400' : 'accent-emerald-500'}`}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <PressButton onClick={onClose} className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 font-black text-white hover:bg-slate-800">
          Done
        </PressButton>
      </div>
    </div>
  );
}
