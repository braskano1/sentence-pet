import { useRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useAudio } from '../hooks/useAudio';

type PressButtonProps = HTMLMotionProps<'button'>;

/**
 * A button with a consistent press-squish that plays a debounced tap SFX.
 * Forwards all native button props; whileTap is suppressed when disabled.
 */
export function PressButton({ disabled, type = 'button', onClick, ...props }: PressButtonProps) {
  const { play } = useAudio();
  const last = useRef(-Infinity);

  const handleClick: PressButtonProps['onClick'] = (e) => {
    const now = e.timeStamp ?? 0;
    if (now - last.current > 60) { last.current = now; play('tap'); }
    onClick?.(e);
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      onClick={handleClick}
      {...props}
    />
  );
}
