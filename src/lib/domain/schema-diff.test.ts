import { describe, it, expect } from 'vitest';
import { diffSchema } from '@/lib/domain/schema-diff';
import type { Field } from '@/lib/domain/types';

// Small builders keep the field literals readable and correctly typed.
const text = (id: string, name: string, required = false): Field => ({
  id,
  name,
  type: 'text',
  required,
});
const num = (id: string, name: string, required = false): Field => ({
  id,
  name,
  type: 'number',
  required,
});
const ref = (id: string, name: string, targetSchemaId: string): Field => ({
  id,
  name,
  type: 'reference',
  required: false,
  targetSchemaId,
});

const schema = (name: string, fields: Field[]) => ({ name, fields });

function bySeverity(before: Field[], after: Field[]) {
  const diff = diffSchema(schema('S', before), schema('S', after));
  return Object.fromEntries(diff.fields.map((f) => [f.fieldId, f.severity]));
}

describe('diffSchema', () => {
  it('reports no field changes for an identical schema', () => {
    const fields = [text('f1', 'a')];
    const diff = diffSchema(schema('S', fields), schema('S', fields));
    expect(diff.fields).toHaveLength(0);
    expect(diff.hasStructuralChange).toBe(false);
  });

  it('detects a schema rename without any field change', () => {
    const fields = [text('f1', 'a')];
    const diff = diffSchema(schema('Old', fields), schema('New', fields));
    expect(diff.schemaRename).toEqual({ before: 'Old', after: 'New' });
    expect(diff.hasStructuralChange).toBe(false);
  });

  it('classifies add-optional as safe, add-required as warning', () => {
    const sev = bySeverity(
      [text('f1', 'a')],
      [text('f1', 'a'), text('f2', 'b'), text('f3', 'c', true)],
    );
    expect(sev.f2).toBe('safe');
    expect(sev.f3).toBe('warning');
  });

  it('classifies removal as warning', () => {
    expect(bySeverity([text('f1', 'a'), text('f2', 'b')], [text('f1', 'a')]))
      .toMatchObject({ f2: 'warning' });
  });

  it('treats a rename as safe (matched by id, not name)', () => {
    const diff = diffSchema(
      schema('S', [text('f1', 'old')]),
      schema('S', [text('f1', 'new')]),
    );
    expect(diff.fields).toHaveLength(1);
    expect(diff.fields[0].changes).toContain('renamed');
    expect(diff.fields[0].severity).toBe('safe');
  });

  it('does NOT treat a same-name-different-id pair as a rename', () => {
    // f1 removed, f2 added — even though the name "a" is reused.
    const diff = diffSchema(
      schema('S', [text('f1', 'a')]),
      schema('S', [text('f2', 'a')]),
    );
    const kinds = diff.fields.flatMap((f) => f.changes).sort();
    expect(kinds).toEqual(['added', 'removed']);
  });

  it('marks a retype as conflict severity', () => {
    expect(bySeverity([text('f1', 'year')], [num('f1', 'year')])).toMatchObject({
      f1: 'conflict',
    });
  });

  it('distinguishes required tighten (warning) from loosen (safe)', () => {
    expect(
      bySeverity([text('f1', 'a', false)], [text('f1', 'a', true)]),
    ).toMatchObject({ f1: 'warning' });
    expect(
      bySeverity([text('f1', 'a', true)], [text('f1', 'a', false)]),
    ).toMatchObject({ f1: 'safe' });
  });

  it('detects a reference retarget as warning', () => {
    const diff = diffSchema(
      schema('S', [ref('f1', 'owner', 'A')]),
      schema('S', [ref('f1', 'owner', 'B')]),
    );
    expect(diff.fields[0].changes).toContain('reference-retargeted');
    expect(diff.fields[0].severity).toBe('warning');
  });

  it('captures multiple changes on one field (rename + retype)', () => {
    const diff = diffSchema(
      schema('S', [text('f1', 'old')]),
      schema('S', [num('f1', 'new')]),
    );
    expect(diff.fields[0].changes.sort()).toEqual(['renamed', 'retyped']);
    expect(diff.fields[0].severity).toBe('conflict'); // highest wins
  });
});
