import { describe, it, expect } from 'vitest';
import {
  validateSchemaDraft,
  type DraftField,
  type DraftSchema,
} from '@/lib/domain/schema-validation';

const draftField = (over: Partial<DraftField>): DraftField => ({
  rowId: over.id ?? over.rowId ?? 'r1',
  id: over.id ?? 'f1',
  name: over.name ?? 'field',
  type: over.type ?? 'text',
  required: over.required ?? false,
  targetSchemaId: over.targetSchemaId ?? '',
});

const ctx = (over: Partial<Parameters<typeof validateSchemaDraft>[1]> = {}) => ({
  takenNamesLower: over.takenNamesLower ?? [],
  knownSchemaIds: over.knownSchemaIds ?? [],
});

const draft = (name: string, fields: DraftField[]): DraftSchema => ({ name, fields });

describe('validateSchemaDraft', () => {
  it('requires a non-empty schema name', () => {
    const r = validateSchemaDraft(draft('  ', []), ctx());
    expect(r.valid).toBe(false);
    expect(r.errors.name).toBeTruthy();
  });

  it('rejects a duplicate name case-insensitively', () => {
    const r = validateSchemaDraft(draft('Car', []), ctx({ takenNamesLower: ['car'] }));
    expect(r.valid).toBe(false);
    expect(r.errors.name).toContain('already exists');
  });

  it('requires a non-empty field name', () => {
    const r = validateSchemaDraft(
      draft('S', [draftField({ id: 'f1', name: '  ' })]),
      ctx(),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.fields.f1.name).toBeTruthy();
  });

  it('flags duplicate field names (case-insensitive) on the second row', () => {
    const r = validateSchemaDraft(
      draft('S', [
        draftField({ id: 'f1', name: 'Year' }),
        draftField({ id: 'f2', name: 'year' }),
      ]),
      ctx(),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.fields.f2.name).toContain('unique');
    expect(r.errors.fields.f1).toBeUndefined();
  });

  it('requires a target on a reference field, and rejects unknown targets', () => {
    const missingTarget = validateSchemaDraft(
      draft('S', [draftField({ id: 'f1', name: 'owner', type: 'reference' })]),
      ctx(),
    );
    expect(missingTarget.errors.fields.f1.targetSchemaId).toContain('Choose');

    const unknownTarget = validateSchemaDraft(
      draft('S', [
        draftField({ id: 'f1', name: 'owner', type: 'reference', targetSchemaId: 'ghost' }),
      ]),
      ctx({ knownSchemaIds: ['real'] }),
    );
    expect(unknownTarget.errors.fields.f1.targetSchemaId).toContain('no longer exists');
  });

  it('returns normalized (trimmed) domain fields when valid', () => {
    const r = validateSchemaDraft(
      draft('  Car ', [draftField({ id: 'f1', name: '  make  ', type: 'text' })]),
      ctx(),
    );
    expect(r.valid).toBe(true);
    expect(r.fields).toEqual([{ id: 'f1', name: 'make', type: 'text', required: false }]);
  });

  it('carries targetSchemaId only for reference fields', () => {
    const r = validateSchemaDraft(
      draft('S', [
        draftField({ id: 'f1', name: 'owner', type: 'reference', targetSchemaId: 'A' }),
      ]),
      ctx({ knownSchemaIds: ['A'] }),
    );
    expect(r.fields?.[0]).toEqual({
      id: 'f1',
      name: 'owner',
      type: 'reference',
      required: false,
      targetSchemaId: 'A',
    });
  });
});
