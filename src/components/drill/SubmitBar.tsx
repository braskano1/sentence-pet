import { motion } from 'framer-motion';

export function SubmitBar({ onSubmit, disabled = false }: { onSubmit: () => void; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onSubmit}
      disabled={disabled}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full rounded-2xl bg-emerald-500 py-3.5 text-lg font-bold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[.98] disabled:opacity-50"
    >
      Submit ✓
    </motion.button>
  );
}
