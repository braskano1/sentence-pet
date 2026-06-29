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
