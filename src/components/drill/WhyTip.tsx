import { motion } from 'framer-motion';

/** Inline "why it's wrong" banner shown on a slip. */
export function WhyTip({ text }: { text: string }) {
  return (
    <motion.p
      data-testid="why-tip"
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm font-semibold text-rose-700"
    >
      {text}
    </motion.p>
  );
}
