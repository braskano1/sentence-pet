import { motion, useReducedMotion } from 'framer-motion';
import fullDemo from '../../assets/titles/00_full-demo.png';
import glitter from '../../assets/titles/04_glitter.png';

/**
 * Hero logo for the title screen — the partner's watercolor "Sentence Pet"
 * wordmark + hatching chick (src/assets/titles/00_full-demo.png), with a glitter
 * overlay that twinkles and a gentle idle float. Reduced-motion → static.
 */
export function TitleLogo() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="relative w-[min(72vw,20rem)] select-none"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.95 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.img
        src={fullDemo}
        alt="Sentence Pet"
        className="w-full drop-shadow-[0_10px_28px_rgba(0,0,0,0.4)]"
        draggable={false}
        animate={reduce ? undefined : { y: [0, -8, 0], rotate: [-1, 1, -1] }}
        transition={reduce ? undefined : { repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 0.7 }}
      />

      {!reduce && (
        <motion.img
          src={glitter}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -inset-x-4 -top-6 bottom-0 m-auto h-auto w-[112%] max-w-none object-contain"
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut', delay: 0.5 }}
        />
      )}
    </motion.div>
  );
}
