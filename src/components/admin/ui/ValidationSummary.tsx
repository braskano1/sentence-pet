export function ValidationSummary({ errors }: { errors: string[] }) {
  const hasErrors = errors.length > 0;
  return (
    <ul
      aria-live="polite"
      className={hasErrors ? 'rounded-md bg-red-50 p-3 text-sm text-red-700' : 'sr-only'}
    >
      {hasErrors && errors.map((e, i) => <li key={`${e}-${i}`}>• {e}</li>)}
    </ul>
  );
}
