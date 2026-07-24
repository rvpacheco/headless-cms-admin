'use client';

import type { Field } from '@/lib/domain/types';
import type { EntryOption } from '@/lib/entries/reference-labels';

interface EntryFieldInputProps {
  field: Field;
  /** String for text/number/date/reference; boolean for boolean. */
  value: string | boolean;
  error?: string;
  disabled: boolean;
  /** Candidate target entries — only for reference fields. */
  referenceOptions?: EntryOption[];
  onChange: (name: string, value: string | boolean) => void;
}

const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-700';

export function EntryFieldInput({
  field,
  value,
  error,
  disabled,
  referenceOptions = [],
  onChange,
}: EntryFieldInputProps) {
  // One input per field type — generated from the schema, switching on the
  // discriminated union so all five types are handled exhaustively.
  function renderControl() {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={String(value)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={inputClass}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={String(value)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={inputClass}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(value)}
              disabled={disabled}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
              onChange={(e) => onChange(field.name, e.target.checked)}
            />
            {Boolean(value) ? 'Yes' : 'No'}
          </label>
        );

      case 'date':
        return (
          <input
            type="date"
            value={String(value)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={`${inputClass} max-w-xs`}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        );

      case 'reference': {
        const currentId = String(value);
        // A stored reference whose target entry no longer exists won't be in the
        // options. Surface it as a visible "missing" option so the user can see
        // the dangling value and change it, rather than a silently-blank select.
        const isDangling =
          currentId !== '' &&
          !referenceOptions.some((option) => option.id === currentId);
        return (
          <select
            value={currentId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={`${inputClass} max-w-sm`}
            onChange={(e) => onChange(field.name, e.target.value)}
          >
            <option value="">
              {field.required ? 'Select an entry…' : 'None'}
            </option>
            {isDangling && (
              <option value={currentId}>
                ⚠ missing ({currentId.slice(0, 8)}…)
              </option>
            )}
            {referenceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {field.name}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {renderControl()}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
