import { describe, it, expect } from 'vitest';
import { convertValue, migrateEntryData } from '@/lib/domain/entry-migration';
import type { Field } from '@/lib/domain/types';

const field = (
  id: string,
  name: string,
  type: Field['type'],
  targetSchemaId = 'T',
): Field =>
  type === 'reference'
    ? { id, name, type, required: false, targetSchemaId }
    : { id, name, type, required: false };

describe('convertValue', () => {
  it('converts empty/null to null cleanly for any target', () => {
    expect(convertValue('text', 'number', '')).toEqual({ ok: true, value: null });
    expect(convertValue('text', 'number', null)).toEqual({ ok: true, value: null });
  });

  it('text → number: clean when numeric, conflict otherwise (the vintage case)', () => {
    expect(convertValue('text', 'number', '1998')).toEqual({ ok: true, value: 1998 });
    expect(convertValue('text', 'number', 'vintage')).toEqual({ ok: false });
  });

  it('anything → text is clean, with boolean spelled out', () => {
    expect(convertValue('number', 'text', 2022)).toEqual({ ok: true, value: '2022' });
    expect(convertValue('boolean', 'text', true)).toEqual({ ok: true, value: 'true' });
  });

  it('text → boolean maps known tokens, conflicts on the rest', () => {
    expect(convertValue('text', 'boolean', 'yes')).toEqual({ ok: true, value: true });
    expect(convertValue('text', 'boolean', 'no')).toEqual({ ok: true, value: false });
    expect(convertValue('text', 'boolean', 'maybe')).toEqual({ ok: false });
  });

  it('number → boolean only accepts 0 and 1', () => {
    expect(convertValue('number', 'boolean', 0)).toEqual({ ok: true, value: false });
    expect(convertValue('number', 'boolean', 1)).toEqual({ ok: true, value: true });
    expect(convertValue('number', 'boolean', 2)).toEqual({ ok: false });
  });

  it('text → date validates parseability', () => {
    expect(convertValue('text', 'date', '2022-01-01')).toEqual({
      ok: true,
      value: '2022-01-01',
    });
    expect(convertValue('text', 'date', 'not-a-date')).toEqual({ ok: false });
  });

  it('any → reference is always a conflict', () => {
    expect(convertValue('text', 'reference', 'x')).toEqual({ ok: false });
    expect(convertValue('number', 'reference', 1)).toEqual({ ok: false });
  });
});

describe('migrateEntryData', () => {
  it('carries an unchanged field through', () => {
    const f = [field('f1', 'a', 'text')];
    expect(migrateEntryData(f, f, { a: 'hi' })).toEqual({ a: 'hi' });
  });

  it('migrates the data key on rename (via stable id)', () => {
    const before = [field('f1', 'owner', 'text')];
    const after = [field('f1', 'driver', 'text')];
    expect(migrateEntryData(before, after, { owner: 'Ada' })).toEqual({ driver: 'Ada' });
  });

  it('handles a two-field name swap correctly', () => {
    const before = [field('a', 'x', 'text'), field('b', 'y', 'text')];
    const after = [field('a', 'y', 'text'), field('b', 'x', 'text')];
    expect(migrateEntryData(before, after, { x: '1', y: '2' })).toEqual({
      y: '1',
      x: '2',
    });
  });

  it('drops a removed field and defaults an added field to null', () => {
    const before = [field('f1', 'a', 'text'), field('f2', 'b', 'text')];
    const after = [field('f1', 'a', 'text'), field('f3', 'c', 'text')];
    expect(migrateEntryData(before, after, { a: 'x', b: 'y' })).toEqual({
      a: 'x',
      c: null,
    });
  });

  it('auto-converts a clean retype and nulls an unconverted one', () => {
    const before = [field('f1', 'year', 'text')];
    const after = [field('f1', 'year', 'number')];
    expect(migrateEntryData(before, after, { year: '1998' })).toEqual({ year: 1998 });
    expect(migrateEntryData(before, after, { year: 'vintage' })).toEqual({
      year: null,
    });
  });

  it('applies a user fix for a conflicting retype (keyed by field id)', () => {
    const before = [field('f1', 'year', 'text')];
    const after = [field('f1', 'year', 'number')];
    expect(
      migrateEntryData(before, after, { year: 'vintage' }, { f1: 2000 }),
    ).toEqual({ year: 2000 });
  });

  it('ignores orphaned keys not present in the new schema', () => {
    const before = [field('f1', 'a', 'text')];
    const after = [field('f1', 'a', 'text')];
    expect(migrateEntryData(before, after, { a: 'x', stale: 'gone' })).toEqual({
      a: 'x',
    });
  });
});
