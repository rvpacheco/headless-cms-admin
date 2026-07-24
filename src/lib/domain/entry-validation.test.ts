import { describe, it, expect } from 'vitest';
import { validateEntryData } from '@/lib/domain/entry-validation';
import type { Field, Schema } from '@/lib/domain/types';

const schema = (fields: Field[]): Schema => ({
  id: 's1',
  name: 'S',
  fields,
  version: 1,
  createdAt: 'now',
  updatedAt: 'now',
});

const field = (
  name: string,
  type: Field['type'],
  required = false,
  targetSchemaId = 'T',
): Field =>
  type === 'reference'
    ? { id: name, name, type, required, targetSchemaId }
    : { id: name, name, type, required };

describe('validateEntryData', () => {
  it('errors on a blank required field, allows a blank optional one', () => {
    const s = schema([field('title', 'text', true), field('note', 'text', false)]);
    const r = validateEntryData(s, { title: '', note: '' }, { validTargetIds: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.title).toContain('required');
    expect(r.errors.note).toBeUndefined();
  });

  it('parses numbers and rejects non-numeric input', () => {
    const s = schema([field('n', 'number')]);
    expect(validateEntryData(s, { n: '42' }, { validTargetIds: {} }).data).toEqual({
      n: 42,
    });
    const bad = validateEntryData(s, { n: 'abc' }, { validTargetIds: {} });
    expect(bad.valid).toBe(false);
    expect(bad.errors.n).toContain('number');
  });

  it('treats a required boolean as always satisfied (false is valid)', () => {
    const s = schema([field('flag', 'boolean', true)]);
    const r = validateEntryData(s, { flag: false }, { validTargetIds: {} });
    expect(r.valid).toBe(true);
    expect(r.data).toEqual({ flag: false });
  });

  it('validates dates and rejects unparseable ones', () => {
    const s = schema([field('d', 'date')]);
    expect(validateEntryData(s, { d: '2022-01-01' }, { validTargetIds: {} }).valid).toBe(
      true,
    );
    expect(validateEntryData(s, { d: 'nope' }, { validTargetIds: {} }).valid).toBe(false);
  });

  it('accepts a reference only when it points to a known target id', () => {
    const s = schema([field('owner', 'reference', true)]);
    const good = validateEntryData(
      s,
      { owner: 'p1' },
      { validTargetIds: { owner: ['p1', 'p2'] } },
    );
    expect(good.valid).toBe(true);

    const dangling = validateEntryData(
      s,
      { owner: 'gone' },
      { validTargetIds: { owner: ['p1'] } },
    );
    expect(dangling.valid).toBe(false);
    expect(dangling.errors.owner).toContain('existing entry');
  });

  it('drops unknown keys and builds data only from schema fields', () => {
    const s = schema([field('a', 'text')]);
    const r = validateEntryData(
      s,
      { a: 'x', stale: 'ignored' },
      { validTargetIds: {} },
    );
    expect(r.valid).toBe(true);
    expect(r.data).toEqual({ a: 'x' });
    expect(r.data).not.toHaveProperty('stale');
  });

  it('normalizes empty optional values to null', () => {
    const s = schema([field('n', 'number'), field('t', 'text')]);
    const r = validateEntryData(s, { n: '', t: '' }, { validTargetIds: {} });
    expect(r.data).toEqual({ n: null, t: null });
  });
});
