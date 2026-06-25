import { motion } from 'framer-motion';

/** Named speech bubble shown above the pet; tail points down to it. */
export function SpeechBubble({ name, line }: { name: string; line: string }) {
  return (
    <motion.div
      key={line}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative max-w-[72%] rounded-2xl border-2 border-amber-900/15 bg-[#fffaf0] px-3 py-2 text-sm font-semibold text-amber-950 shadow-lg"
    >
      <span className="block text-[8px] font-extrabold uppercase tracking-wide text-violet-500">{name}</span>
      {line}
      <span aria-hidden className="absolute -bottom-[9px] left-9 border-[9px] border-transparent border-t-[#fffaf0] border-b-0" />
    </motion.div>
  );
}
