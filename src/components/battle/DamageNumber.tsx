import { motion } from 'framer-motion';

export function DamageNumber({ id, dmg, crit }: { id: number; dmg: number; crit: boolean }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 1, y: 0, scale: crit ? 1.4 : 1 }}
      animate={{ opacity: 0, y: -48 }}
      transition={{ duration: 0.8 }}
      className={`pointer-events-none absolute font-extrabold ${crit ? 'text-amber-300 text-3xl' : 'text-white text-xl'}`}
    >
      {crit ? `${dmg}!` : dmg}
    </motion.div>
  );
}
