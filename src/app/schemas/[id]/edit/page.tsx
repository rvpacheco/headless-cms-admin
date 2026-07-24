import { notFound } from 'next/navigation';
import { saveSchemaAction } from '@/lib/actions/schemas';
import { getSchema, listSchemas } from '@/lib/db/schemas';
import type { DraftField } from '@/lib/domain/schema-validation';
import { SchemaBuilder } from '@/components/schema-builder/SchemaBuilder';

export default async function EditSchemaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schema = getSchema(id);
  if (!schema) {
    notFound();
  }

  // Map the stored fields into editable draft rows, preserving their stable ids.
  const initialFields: DraftField[] = schema.fields.map((field) => ({
    rowId: field.id,
    id: field.id,
    name: field.name,
    type: field.type,
    required: field.required,
    targetSchemaId: field.type === 'reference' ? field.targetSchemaId : '',
  }));

  const all = listSchemas();
  // A schema may reference itself, so targets include this schema; name
  // uniqueness excludes it (renaming to its own name is fine).
  const availableTargets = all.map((s) => ({ id: s.id, name: s.name }));
  const takenNamesLower = all
    .filter((s) => s.id !== schema.id)
    .map((s) => s.name.toLowerCase());

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Edit schema
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Version {schema.version}. Saving increments the version.
        </p>
      </header>

      {/*
        PHASE-5 BOUNDARY — schema evolution is intentionally not built yet.
        Right now, saving an edit (including removing or retyping a field) is
        applied straight through and bumps the schema version. It does NOT yet
        warn about affected entries, surface a preview, or offer to migrate
        existing data. That risk-communication + migration flow is priority 5.
      */}
      <SchemaBuilder
        action={saveSchemaAction.bind(null, schema.id)}
        initialName={schema.name}
        initialFields={initialFields}
        availableTargets={availableTargets}
        takenNamesLower={takenNamesLower}
        submitLabel="Save changes"
        cancelHref={`/schemas/${schema.id}`}
        schemaId={schema.id}
        version={schema.version}
      />
    </div>
  );
}
