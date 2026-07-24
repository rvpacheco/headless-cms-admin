'use client';

import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type DraftField,
  type FieldErrors,
} from '@/lib/domain/schema-validation';
import type { FieldType } from '@/lib/domain/types';

export interface SchemaOption {
  id: string;
  name: string;
}

interface FieldRowProps {
  field: DraftField;
  availableTargets: SchemaOption[];
  errors?: FieldErrors;
  disabled: boolean;
  onChange: (rowId: string, patch: Partial<DraftField>) => void;
  onRemove: (rowId: string) => void;
}

const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-700';

export function FieldRow({
  field,
  availableTargets,
  errors,
  disabled,
  onChange,
  onRemove,
}: FieldRowProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Field name */}
        <div className="flex-1">
          <label className="sr-only">Field name</label>
          <input
            type="text"
            value={field.name}
            placeholder="Field name"
            disabled={disabled}
            aria-invalid={Boolean(errors?.name)}
            className={inputClass}
            onChange={(e) => onChange(field.rowId, { name: e.target.value })}
          />
          {errors?.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Field type */}
        <div className="sm:w-40">
          <label className="sr-only">Field type</label>
          <select
            value={field.type}
            disabled={disabled}
            className={inputClass}
            onChange={(e) =>
              onChange(field.rowId, { type: e.target.value as FieldType })
            }
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {FIELD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Required toggle */}
        <label className="flex h-10 select-none items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:w-28">
          <input
            type="checkbox"
            checked={field.required}
            disabled={disabled}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            onChange={(e) =>
              onChange(field.rowId, { required: e.target.checked })
            }
          />
          Required
        </label>

        {/* Remove — red is reserved for destructive actions */}
        <button
          type="button"
          disabled={disabled}
          aria-label="Remove field"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
          onClick={() => onRemove(field.rowId)}
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>

      {/* Reference target — only shown for reference fields */}
      {field.type === 'reference' && (
        <div className="mt-3 sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            References
          </label>
          <select
            value={field.targetSchemaId}
            disabled={disabled}
            aria-invalid={Boolean(errors?.targetSchemaId)}
            className={inputClass}
            onChange={(e) =>
              onChange(field.rowId, { targetSchemaId: e.target.value })
            }
          >
            <option value="">Select a schema…</option>
            {availableTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
          {errors?.targetSchemaId && (
            <p className="mt-1 text-xs text-red-600">{errors.targetSchemaId}</p>
          )}
        </div>
      )}
    </div>
  );
}
