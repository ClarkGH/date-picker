import { describe, expect, it } from 'vitest';
import { DEFAULT_STRINGS, resolveStrings } from './strings.js';

describe('resolveStrings', () => {
  it('returns the defaults with no overrides', () => {
    expect(resolveStrings()).toEqual(DEFAULT_STRINGS);
  });

  it('overrides one error without dropping the others', () => {
    const strings = resolveStrings({ errors: { required: 'Obligatoire.' } });
    expect(strings.errors.required).toBe('Obligatoire.');
    expect(strings.errors.month).toBe(DEFAULT_STRINGS.errors.month);
  });

  it('does not mutate the defaults', () => {
    resolveStrings({ hint: 'x', errors: { format: 'y' } });
    expect(DEFAULT_STRINGS.hint).toBe('Format: MM/DD/YYYY');
    expect(DEFAULT_STRINGS.errors.format).toContain('MM/DD/YYYY');
  });
});
