import { notFound } from 'next/navigation';
import { saveEntryAction } from '@/lib/actions/entries';
import { getSchema } from '@/lib/db/schemas';
import { getEntry } from '@/lib/db/entries';
import { referenceOptionsForSchema } from '@/lib/entries/reference-labels';
import { EntryForm } from '@/components/entry-editor/EntryForm';

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const schema = getSchema(id);
  const entry = getEntry(entryId);
  // The entry must exist and belong to this schema.
  if (!schema || !entry || entry.schemaId !== schema.id) {
    notFound();
  }

  const referenceOptions = referenceOptionsForSchema(schema);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Edit {schema.name} entry
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Fields are generated from the current schema.
        </p>
      </header>

      <EntryForm
        action={saveEntryAction.bind(null, schema.id, entry.id)}
        schema={schema}
        initialData={entry.data}
        initialUpdatedAt={entry.updatedAt}
        referenceOptions={referenceOptions}
        submitLabel="Save changes"
        cancelHref={`/schemas/${schema.id}`}
      />
    </div>
  );
}
