import { notFound } from 'next/navigation';
import { saveEntryAction } from '@/lib/actions/entries';
import { getSchema } from '@/lib/db/schemas';
import { referenceOptionsForSchema } from '@/lib/entries/reference-labels';
import { EntryForm } from '@/components/entry-editor/EntryForm';

export default async function NewEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schema = getSchema(id);
  if (!schema) {
    notFound();
  }

  const referenceOptions = referenceOptionsForSchema(schema);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          New {schema.name} entry
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Fields are generated from the schema.
        </p>
      </header>

      <EntryForm
        action={saveEntryAction.bind(null, schema.id, null)}
        schema={schema}
        referenceOptions={referenceOptions}
        submitLabel="Create entry"
        cancelHref={`/schemas/${schema.id}`}
      />
    </div>
  );
}
