import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteSchemaAction } from '@/lib/actions/schemas';
import { getSchema, listSchemas } from '@/lib/db/schemas';
import { listEntries } from '@/lib/db/entries';
import { FIELD_TYPE_LABELS } from '@/lib/domain/schema-validation';
import { buildReferenceLabelMap } from '@/lib/entries/reference-labels';
import { DeleteSchemaButton } from '@/components/schema-builder/DeleteSchemaButton';
import { EntryTable } from '@/components/entry-editor/EntryTable';

export default async function SchemaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schema = getSchema(id);
  if (!schema) {
    notFound();
  }

  const entries = listEntries(schema.id);
  const referenceLabels = buildReferenceLabelMap(schema);
  // Map target ids to names for displaying reference fields in the summary.
  const namesById = new Map(listSchemas().map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {schema.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Version {schema.version} · {schema.fields.length}{' '}
            {schema.fields.length === 1 ? 'field' : 'fields'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/schemas/${schema.id}/edit`}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
          <DeleteSchemaButton
            action={deleteSchemaAction.bind(null, schema.id)}
            schemaName={schema.name}
            entryCount={entries.length}
          />
        </div>
      </header>

      {/* Entries — the primary content of this page. */}
      <section className="mb-12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Entries
          </h2>
          {schema.fields.length > 0 && (
            <Link
              href={`/schemas/${schema.id}/entries/new`}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              New entry
            </Link>
          )}
        </div>

        {schema.fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Add a field to this schema before creating entries.
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No entries yet — create the first one.
            </p>
          </div>
        ) : (
          <EntryTable
            schema={schema}
            entries={entries}
            referenceLabels={referenceLabels}
          />
        )}
      </section>

      {/* Fields — a compact reference to how entries are shaped. */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Fields
        </h2>
        {schema.fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This schema has no fields yet.
            </p>
            <Link
              href={`/schemas/${schema.id}/edit`}
              className="mt-2 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
            >
              Add fields
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Field</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {schema.fields.map((field) => (
                  <tr key={field.id}>
                    <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {field.name}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {FIELD_TYPE_LABELS[field.type]}
                      {field.type === 'reference' && (
                        <span className="text-zinc-400">
                          {' → '}
                          {namesById.get(field.targetSchemaId) ?? 'Unknown'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {field.required ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
