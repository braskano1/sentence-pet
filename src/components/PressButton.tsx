import { motion, type HTMLMotionProps } from 'framer-motion';

type PressButtonProps = HTMLMotionProps<'button'>;

/**
 * A button with a consistent press-squish. Forwards all native button props
 * (className, onClick, disabled, children, ...). whileTap is suppressed when disabled.
 */
export function PressButton({ disabled, type = 'button', ...props }: PressButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      {...props}
    />
  );
}
