# Admin UI/UX — Phase 0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable admin UI primitive kit (`src/components/admin/ui/`) — Button, Field, inputs, Card, ValidationSummary, SaveBar — each tested, so later phases re-skin the tabs by composition instead of ad-hoc classes.

**Architecture:** Each primitive is a small, prop-driven, store-agnostic component styled with Tailwind v4 default utilities (slate/indigo/emerald/red — the "neutral SaaS" palette). The primitives centralize class strings, which **is** the admin token layer in a utility-first setup. No global `@theme` change (would re-skin the game). Admin-scoped CSS vars + the playful header land in Phase 1, where the gradient needs them.

**Tech Stack:** React 18 + TypeScript, Tailwind v4, Vitest + @testing-library/react (globals on, setup `src/test/setup.ts`).

---

## Reference: spec

`docs/superpowers/specs/2026-06-29-admin-uiux-redesign-design.md`. This plan covers **P0 only**. P1 (Shell chrome + AdminHeader + Tabs), P2 (PetsTab), P3 (Bosses), P4 (rest) each get their own plan after a handoff. Primitives not needed until a later phase — `Tabs`, `AdminHeader`, `EmptyState`, `MultiSelect`, `Toggle` — are intentionally deferred to the phase that first uses them.

## File structure (created this phase)

- `src/components/admin/ui/Button.tsx` — variant button (primary/ghost/danger)
- `src/components/admin/ui/Field.tsx` — label + control + hint + error wrapper
- `src/components/admin/ui/TextInput.tsx` — styled text input
- `src/components/admin/ui/NumberInput.tsx` — styled number input with NaN-guarded numeric callback
- `src/components/admin/ui/Select.tsx` — styled select
- `src/components/admin/ui/Checkbox.tsx` — checkbox + inline label
- `src/components/admin/ui/Card.tsx` — `Card` + `SectionLabel` (uppercase eyebrow)
- `src/components/admin/ui/ValidationSummary.tsx` — error list box, `aria-live`
- `src/components/admin/ui/SaveBar.tsx` — Save button + status + dirty/validity state
- `src/components/admin/ui/index.ts` — barrel re-export
- Co-located `*.test.tsx` for each component

## Conventions (match the codebase)

- Test imports: `import { describe, it, expect, vi } from 'vitest';` and `import { render, screen, fireEvent } from '@testing-library/react';` (see `src/components/admin/PoolTab.test.tsx`).
- Components are named exports (no default exports), matching every existing admin component.
- Verify gate per task: `npx vitest run <file>` green; final task also runs `npx tsc -b` and `npx vite build`.
- Stage explicit files in every commit — **never `git add -A`**.

---

### Task 1: Button

**Files:**
- Create: `src/components/admin/ui/Button.tsx`
- Test: `src/components/admin/ui/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('defaults to type="button" so it never submits a form', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
  });

  it('applies the danger variant class', () => {
    render(<Button variant="danger">Del</Button>);
    expect(screen.getByRole('button', { name: 'Del' }).className).toMatch(/red/);
  });

  it('passes through disabled', () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole('button', { name: 'Nope' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/Button.test.tsx`
Expected: FAIL — cannot find module `./Button`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/Button.tsx
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40',
  ghost: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-40',
};

export function Button({
  variant = 'primary',
  type,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type ?? 'button'}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/Button.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/Button.tsx src/components/admin/ui/Button.test.tsx
git commit -m "feat(admin-ui): Button primitive with primary/ghost/danger variants"
```

---

### Task 2: Field

**Files:**
- Create: `src/components/admin/ui/Field.tsx`
- Test: `src/components/admin/ui/Field.test.tsx`

`Field` wraps a control in a `<label>` (preserving the codebase's label-wraps-input idiom — no id plumbing) and renders an optional hint and an optional error.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/Field.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('renders the label text and the child control', () => {
    render(
      <Field label="Name">
        <input aria-label="name-input" />
      </Field>,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('name-input')).toBeInTheDocument();
  });

  it('renders a hint when provided', () => {
    render(<Field label="Gen" hint="1–9"><input /></Field>);
    expect(screen.getByText('1–9')).toBeInTheDocument();
  });

  it('renders an error with role="alert" when provided', () => {
    render(<Field label="Gen" error="must be a number"><input /></Field>);
    expect(screen.getByRole('alert')).toHaveTextContent('must be a number');
  });

  it('renders no alert when there is no error', () => {
    render(<Field label="Gen"><input /></Field>);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/Field.test.tsx`
Expected: FAIL — cannot find module `./Field`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/Field.tsx
import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/Field.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/Field.tsx src/components/admin/ui/Field.test.tsx
git commit -m "feat(admin-ui): Field wrapper (label + hint + error)"
```

---

### Task 3: TextInput

**Files:**
- Create: `src/components/admin/ui/TextInput.tsx`
- Test: `src/components/admin/ui/TextInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/TextInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextInput } from './TextInput';

describe('TextInput', () => {
  it('shows the value and fires onChange on typing', () => {
    const onChange = vi.fn();
    render(<TextInput aria-label="name" value="Sprout" onChange={onChange} />);
    const input = screen.getByLabelText('name');
    expect(input).toHaveValue('Sprout');
    fireEvent.change(input, { target: { value: 'Sproutling' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('marks aria-invalid when invalid', () => {
    render(<TextInput aria-label="name" value="" onChange={() => {}} invalid />);
    expect(screen.getByLabelText('name')).toHaveAttribute('aria-invalid', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/TextInput.test.tsx`
Expected: FAIL — cannot find module `./TextInput`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/TextInput.tsx
import type { InputHTMLAttributes } from 'react';

export function TextInput({
  invalid,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      type="text"
      aria-invalid={invalid || undefined}
      className={`rounded-md border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 ${invalid ? 'border-red-400' : 'border-slate-300'} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/TextInput.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/TextInput.tsx src/components/admin/ui/TextInput.test.tsx
git commit -m "feat(admin-ui): TextInput primitive"
```

---

### Task 4: NumberInput

**Files:**
- Create: `src/components/admin/ui/NumberInput.tsx`
- Test: `src/components/admin/ui/NumberInput.test.tsx`

Centralizes the repeated `valueAsNumber` + `Number.isNaN` guard from PetsTab/JourneyTab/BossesTab. Exposes `onValueChange(n: number)` that fires only for valid numbers.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/NumberInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  it('fires onValueChange with the parsed number', () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="gen" value={1} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('gen'), { target: { value: '4' } });
    expect(onValueChange).toHaveBeenCalledWith(4);
  });

  it('does not fire onValueChange when the field is cleared (NaN)', () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="gen" value={1} onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText('gen'), { target: { value: '' } });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/NumberInput.test.tsx`
Expected: FAIL — cannot find module `./NumberInput`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/NumberInput.tsx
import type { InputHTMLAttributes } from 'react';

export function NumberInput({
  onValueChange,
  invalid,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & {
  onValueChange: (n: number) => void;
  invalid?: boolean;
}) {
  return (
    <input
      type="number"
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        const n = e.target.valueAsNumber;
        if (!Number.isNaN(n)) onValueChange(n);
      }}
      className={`w-20 rounded-md border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 ${invalid ? 'border-red-400' : 'border-slate-300'} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/NumberInput.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/NumberInput.tsx src/components/admin/ui/NumberInput.test.tsx
git commit -m "feat(admin-ui): NumberInput with NaN-guarded onValueChange"
```

---

### Task 5: Select

**Files:**
- Create: `src/components/admin/ui/Select.tsx`
- Test: `src/components/admin/ui/Select.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/Select.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  it('renders options and fires onChange', () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="element" value="leaf" onChange={onChange}>
        <option value="leaf">leaf</option>
        <option value="fire">fire</option>
      </Select>,
    );
    const select = screen.getByLabelText('element');
    expect(select).toHaveValue('leaf');
    fireEvent.change(select, { target: { value: 'fire' } });
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/Select.test.tsx`
Expected: FAIL — cannot find module `./Select`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/Select.tsx
import type { SelectHTMLAttributes } from 'react';

export function Select({
  invalid,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`rounded-md border bg-white px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 ${invalid ? 'border-red-400' : 'border-slate-300'} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/Select.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/Select.tsx src/components/admin/ui/Select.test.tsx
git commit -m "feat(admin-ui): Select primitive"
```

---

### Task 6: Checkbox

**Files:**
- Create: `src/components/admin/ui/Checkbox.tsx`
- Test: `src/components/admin/ui/Checkbox.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/Checkbox.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders the label and reflects checked', () => {
    render(<Checkbox label="enabled" checked onChange={() => {}} />);
    expect(screen.getByLabelText('enabled')).toBeChecked();
  });

  it('fires onChange when toggled', () => {
    const onChange = vi.fn();
    render(<Checkbox label="enabled" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('enabled'));
    expect(onChange).toHaveBeenCalled();
  });

  it('passes through disabled', () => {
    render(<Checkbox label="starter" checked={false} disabled onChange={() => {}} />);
    expect(screen.getByLabelText('starter')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/Checkbox.test.tsx`
Expected: FAIL — cannot find module `./Checkbox`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/Checkbox.tsx
import type { InputHTMLAttributes } from 'react';

export function Checkbox({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        aria-label={label}
        className={`h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500 ${className}`}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/Checkbox.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/Checkbox.tsx src/components/admin/ui/Checkbox.test.tsx
git commit -m "feat(admin-ui): Checkbox with inline label"
```

---

### Task 7: Card + SectionLabel

**Files:**
- Create: `src/components/admin/ui/Card.tsx`
- Test: `src/components/admin/ui/Card.test.tsx`

One file exports two related layout primitives: `Card` (the soft container) and `SectionLabel` (the uppercase eyebrow).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/Card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, SectionLabel } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>inner</p></Card>);
    expect(screen.getByText('inner')).toBeInTheDocument();
  });
});

describe('SectionLabel', () => {
  it('renders its text', () => {
    render(<SectionLabel>Identity</SectionLabel>);
    expect(screen.getByText('Identity')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/Card.test.tsx`
Expected: FAIL — cannot find module `./Card`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/Card.tsx
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/Card.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/Card.tsx src/components/admin/ui/Card.test.tsx
git commit -m "feat(admin-ui): Card + SectionLabel layout primitives"
```

---

### Task 8: ValidationSummary

**Files:**
- Create: `src/components/admin/ui/ValidationSummary.tsx`
- Test: `src/components/admin/ui/ValidationSummary.test.tsx`

Replaces the raw red `<ul aria-live="polite">` repeated in AdminShell and PetsTab. When there are no errors it stays in the DOM as `sr-only` (matching PetsTab's current pattern, so the live region is stable).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/ValidationSummary.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationSummary } from './ValidationSummary';

describe('ValidationSummary', () => {
  it('lists each error', () => {
    render(<ValidationSummary errors={['bad gen', 'dup dexNo']} />);
    expect(screen.getByText(/bad gen/)).toBeInTheDocument();
    expect(screen.getByText(/dup dexNo/)).toBeInTheDocument();
  });

  it('renders an sr-only live region (no visible error box) when there are no errors', () => {
    const { container } = render(<ValidationSummary errors={[]} />);
    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list!.className).toMatch(/sr-only/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/ValidationSummary.test.tsx`
Expected: FAIL — cannot find module `./ValidationSummary`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/ValidationSummary.tsx
export function ValidationSummary({ errors }: { errors: string[] }) {
  const hasErrors = errors.length > 0;
  return (
    <ul
      aria-live="polite"
      className={hasErrors ? 'rounded-md bg-red-50 p-3 text-sm text-red-700' : 'sr-only'}
    >
      {hasErrors && errors.map((e) => <li key={e}>• {e}</li>)}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/ValidationSummary.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/ValidationSummary.tsx src/components/admin/ui/ValidationSummary.test.tsx
git commit -m "feat(admin-ui): ValidationSummary live-region error list"
```

---

### Task 9: SaveBar

**Files:**
- Create: `src/components/admin/ui/SaveBar.tsx`
- Test: `src/components/admin/ui/SaveBar.test.tsx`

The shared save affordance used by both domains (course in P1, pet-defs in P2). Prop-driven: `valid` gates the Save button, `status` shows `saving…`/`saved ✓`/`save failed: …`, optional `dirty` dot, optional `errorCount` badge, customizable `saveLabel`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/ui/SaveBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveBar } from './SaveBar';

describe('SaveBar', () => {
  it('fires onSave when valid and clicked', () => {
    const onSave = vi.fn();
    render(<SaveBar valid status="" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('disables Save when invalid', () => {
    render(<SaveBar valid={false} status="" onSave={() => {}} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('shows the status text', () => {
    render(<SaveBar valid status="saved ✓" onSave={() => {}} />);
    expect(screen.getByText('saved ✓')).toBeInTheDocument();
  });

  it('shows the error count when invalid', () => {
    render(<SaveBar valid={false} status="" errorCount={3} onSave={() => {}} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/SaveBar.test.tsx`
Expected: FAIL — cannot find module `./SaveBar`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/admin/ui/SaveBar.tsx
import { Button } from './Button';

export function SaveBar({
  valid,
  status,
  onSave,
  dirty = false,
  errorCount = 0,
  saveLabel = 'Save',
}: {
  valid: boolean;
  status: string;
  onSave: () => void;
  dirty?: boolean;
  errorCount?: number;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {dirty && <span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" title="unsaved changes" />}
      {!valid && errorCount > 0 && (
        <span className="text-xs text-red-600">{errorCount} error{errorCount === 1 ? '' : 's'}</span>
      )}
      <Button variant="primary" onClick={onSave} disabled={!valid}>{saveLabel}</Button>
      {status && <span className="font-mono text-xs text-slate-600">{status}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ui/SaveBar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/SaveBar.tsx src/components/admin/ui/SaveBar.test.tsx
git commit -m "feat(admin-ui): SaveBar (dirty/validity/status, shared by both domains)"
```

---

### Task 10: Barrel export + full verify gate

**Files:**
- Create: `src/components/admin/ui/index.ts`
- Test: `src/components/admin/ui/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/admin/ui/index.test.ts
import { describe, it, expect } from 'vitest';
import * as ui from './index';

describe('admin ui barrel', () => {
  it('re-exports every primitive', () => {
    for (const name of [
      'Button', 'Field', 'TextInput', 'NumberInput', 'Select',
      'Checkbox', 'Card', 'SectionLabel', 'ValidationSummary', 'SaveBar',
    ]) {
      expect(ui[name as keyof typeof ui], `missing export: ${name}`).toBeTypeOf('function');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ui/index.test.ts`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Write the barrel**

```ts
// src/components/admin/ui/index.ts
export { Button } from './Button';
export type { ButtonVariant } from './Button';
export { Field } from './Field';
export { TextInput } from './TextInput';
export { NumberInput } from './NumberInput';
export { Select } from './Select';
export { Checkbox } from './Checkbox';
export { Card, SectionLabel } from './Card';
export { ValidationSummary } from './ValidationSummary';
export { SaveBar } from './SaveBar';
```

- [ ] **Step 4: Run the barrel test, the whole ui suite, typecheck, and build**

Run: `npx vitest run src/components/admin/ui/index.test.ts`
Expected: PASS (1 test).

Run: `npx vitest run src/components/admin/ui`
Expected: PASS — all primitive suites green (Button 4, Field 4, TextInput 2, NumberInput 2, Select 1, Checkbox 3, Card 2, ValidationSummary 2, SaveBar 4, barrel 1).

Run: `npx tsc -b`
Expected: no errors.

Run: `npx vite build`
Expected: build succeeds.

> Windows note: if Vitest reports "Worker exited unexpectedly", re-run the command — it is a known worker-fork flake on this machine, not a real failure.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui/index.ts src/components/admin/ui/index.test.ts
git commit -m "feat(admin-ui): barrel export for admin ui primitive kit"
```

---

## Phase exit

- `src/components/admin/ui/` holds 10 tested primitives, exported from the barrel.
- `npx vitest run`, `npx tsc -b`, `npx vite build` all green.
- No tab wired yet (intentional) and **no game-facing change** — pure additive foundation.
- **Handoff:** write a Phase-1 handoff doc (Shell chrome + `AdminHeader` playful gradient + admin-scoped CSS vars + `Tabs` + wire course-domain `SaveBar`/`ValidationSummary` into `AdminShell`), then start a fresh session for P1.

## Self-review notes

- **Spec coverage (P0 slice):** tokens-as-centralized-classes ✓ (Button/inputs/Card), Field ✓, inputs ✓ (TextInput/NumberInput/Select/Checkbox), Button ✓, Card+SectionLabel ✓, SaveBar ✓, ValidationSummary ✓. Deferred-by-design and noted: `Tabs`, `AdminHeader`, `EmptyState`, `MultiSelect`, `Toggle`, and the admin-scoped CSS-var block (→ P1, where the header gradient first needs them).
- **Type consistency:** `ButtonVariant` defined in Task 1, re-exported in Task 10; `SaveBar` imports `Button` from Task 1; `onValueChange` (NumberInput) is the only numeric callback name used. No forward references to undefined symbols.
- **No placeholders:** every code/test step is complete and runnable.
