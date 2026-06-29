import { describe, it, expect } from 'vitest';
import * as ui from './index';

describe('admin ui barrel', () => {
  it('re-exports every primitive', () => {
    for (const name of [
      'Button', 'Field', 'TextInput', 'NumberInput', 'Select',
      'Checkbox', 'Card', 'SectionLabel', 'ValidationSummary', 'SaveBar',
      'AdminHeader', 'Tabs', 'FilterChips',
    ]) {
      expect(ui[name as keyof typeof ui], `missing export: ${name}`).toBeTypeOf('function');
    }
  });
});
