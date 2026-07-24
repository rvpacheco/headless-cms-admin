import Link from 'next/link';
import { deleteEntryAction } from '@/lib/actions/entries';
import { entryLabel } from '@/lib/domain/entry-label';
import type { Entry, Field, FieldValue, Schema } from '@/lib/domain/types';
import { DeleteEntryButton } from './DeleteEntryButton';

interface EntryTableProps {
  schema: Schema;
  entries: Entry[];
  /** targetSchemaId → (entryId → label), from buildReferenceLabelMap. */
  referenceLabels: Map<string, Map<string, string>>;
}

// Keep the table calm: show the label column plus the first few fields. The
// edit page shows every field; the container scrolls if it still overflows.
const MAX_FIELD_COLUMNS = 4;

/** Render one cell for a field's stored value. */
function EntryCell({
  field,
  value,
  referenceLabels,
}: {
  field: Field;
  value: FieldValue;
  referenceLabels: Map<string, Map<string, string>>;
}) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  }

  switch (field.type) {
    case 'boolean':
      return <span>{value ? 'Yes' : 'No'}</span>;

    case 'reference': {
      const id = String(value);
      const label = referenceLabels.get(field.targetSchemaId)?.get(id);
      if (!label) {
        return (
          <span className="italic text-zinc-400">Missing entry</span>
        );
      }
      return (
        <Link
          href={`/schemas/${field.targetSchemaId}/entries/${id}/edit`}
          className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {label}
        </Link>
      );
    }

    case 'text':
    case 'number':
    case 'date':
      return (
        <span className="block max-w-[16rem] truncate">{String(value)}</span>
      );
  }
}

export function EntryTable({
  schema,
  entries,
  referenceLabels,
}: EntryTableProps) {
  const columns = schema.fields.slice(0, MAX_FIELD_COLUMNS);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">Entry</th>
            {columns.map((field) => (
              <th key={field.id} className="px-4 py-2.5 font-medium">
                {field.name}
              </th>
            ))}
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-2.5">
                <Link
                  href={`/schemas/${schema.id}/entries/${entry.id}/edit`}
                  className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {entryLabel(schema, entry)}
                </Link>
              </td>
              {columns.map((field) => (
                <td
                  key={field.id}
                  className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400"
                >
                  <EntryCell
                    field={field}
                    value={entry.data[field.name] ?? null}
                    referenceLabels={referenceLabels}
                  />
                </td>
              ))}
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/schemas/${schema.id}/entries/${entry.id}/edit`}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Edit
                  </Link>
                  <DeleteEntryButton
                    action={deleteEntryAction.bind(null, schema.id, entry.id)}
                    entryLabel={entryLabel(schema, entry)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
