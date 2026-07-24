import { saveSchemaAction } from '@/lib/actions/schemas';
import { listSchemas } from '@/lib/db/schemas';
import { SchemaBuilder } from '@/components/schema-builder/SchemaBuilder';

export default function NewSchemaPage() {
  const schemas = listSchemas();
  // A brand-new schema has no id yet, so it can only reference existing schemas.
  const availableTargets = schemas.map((s) => ({ id: s.id, name: s.name }));
  const takenNamesLower = schemas.map((s) => s.name.toLowerCase());

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          New schema
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Define a content type and its typed fields.
        </p>
      </header>

      <SchemaBuilder
        action={saveSchemaAction.bind(null, null)}
        availableTargets={availableTargets}
        takenNamesLower={takenNamesLower}
        submitLabel="Create schema"
        cancelHref="/"
      />
    </div>
  );
}
