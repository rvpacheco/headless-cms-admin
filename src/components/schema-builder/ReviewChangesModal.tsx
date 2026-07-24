'use client';

import { startTransition, useActionState, useState } from 'react';
import type { ApplyPayload, ApplyState } from '@/lib/actions/evolution';
import type { EvolutionPlan, FieldImpact } from '@/lib/evolution/analyze';
import type { FieldDiff } from '@/lib/domain/schema-diff';
import { migrateEntryData } from '@/lib/domain/entry-migration';
import type { DraftSchema } from '@/lib/domain/schema-validation';
import type { Field, FieldValue } from '@/lib/domain/types';

interface ReviewChangesModalProps {
  plan: EvolutionPlan;
  draft: DraftSchema;
  applyAction: (prev: ApplyState, payload: ApplyPayload) => Promise<ApplyState>;
  onCancel: () => void;
  onReanalyze: () => void;
  reanalyzing: boolean;
}

// fieldId -> entryId -> raw fix (string|boolean). Absent key = unresolved.
type Fixes = Record<string, Record<string, string | boolean>>;

function formatValue(value: FieldValue): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** Client-side coercion of a raw fix into a typed value (for the live preview). */
function toFieldValue(field: Field, raw: string | boolean | undefined): FieldValue {
  if (raw === '' || raw === undefined || raw === null) return null;
  if (field.type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (field.type === 'boolean') return Boolean(raw);
  return String(raw);
}

const severityStyles = {
  safe: 'border-zinc-200 dark:border-zinc-800',
  warning:
    'border-amber-300 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20',
  conflict: 'border-red-300 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/20',
} as const;

const inputClass =
  'rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-700';

export function ReviewChangesModal({
  plan,
  draft,
  applyAction,
  onCancel,
  onReanalyze,
  reanalyzing,
}: ReviewChangesModalProps) {
  const [state, dispatch, isPending] = useActionState(applyAction, null);
  const [fixes, setFixes] = useState<Fixes>({});

  const diffById = new Map(plan.diff.fields.map((f) => [f.fieldId, f]));

  const allConflicts = plan.impacts.flatMap((i) =>
    (i.conflicts ?? []).map((c) => ({ fieldId: i.fieldId, entryId: c.entryId })),
  );
  const unresolved = allConflicts.filter(
    (c) => fixes[c.fieldId]?.[c.entryId] === undefined,
  ).length;

  const counts = { safe: 0, warning: 0, conflict: 0 };
  for (const impact of plan.impacts) counts[impact.severity] += 1;

  function setFix(fieldId: string, entryId: string, raw: string | boolean) {
    setFixes((current) => ({
      ...current,
      [fieldId]: { ...current[fieldId], [entryId]: raw },
    }));
  }

  function handleApply() {
    if (unresolved > 0) return;
    startTransition(() =>
      dispatch({ draft, fixes, fromVersion: plan.fromVersion }),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Review changes
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {plan.entryCount} existing{' '}
            {plan.entryCount === 1 ? 'entry' : 'entries'} · {counts.safe} safe ·{' '}
            {counts.warning} warning · {counts.conflict} need attention
          </p>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6 py-4">
          {plan.impacts.map((impact) => {
            const fd = diffById.get(impact.fieldId);
            if (!fd) return null;
            return (
              <ImpactCard
                key={impact.fieldId}
                impact={impact}
                fd={fd}
                fixes={fixes[impact.fieldId] ?? {}}
                onFix={(entryId, raw) => setFix(impact.fieldId, entryId, raw)}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          {state?.stale ? (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
              {state.error}
              <button
                type="button"
                onClick={onReanalyze}
                disabled={reanalyzing}
                className="ml-2 font-medium underline disabled:opacity-50"
              >
                {reanalyzing ? 'Re-checking…' : 'Review again'}
              </button>
            </div>
          ) : state?.error ? (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {unresolved > 0
                ? `${unresolved} ${unresolved === 1 ? 'conflict' : 'conflicts'} left to resolve`
                : 'Nothing is applied until you confirm.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={unresolved > 0 || isPending}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {isPending ? 'Applying…' : 'Apply changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactCard({
  impact,
  fd,
  fixes,
  onFix,
}: {
  impact: FieldImpact;
  fd: FieldDiff;
  fixes: Record<string, string | boolean>;
  onFix: (entryId: string, raw: string | boolean) => void;
}) {
  return (
    <div className={`rounded-lg border p-4 ${severityStyles[impact.severity]}`}>
      <p className="text-sm text-zinc-800 dark:text-zinc-200">{impact.summary}</p>

      {impact.conflicts && impact.conflicts.length > 0 && fd.before && fd.after && (
        <div className="mt-3 space-y-2 border-t border-red-200/70 pt-3 dark:border-red-900/50">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">
            These values don’t convert — set a new value for each:
          </p>
          {impact.conflicts.map((conflict) => {
            const raw = fixes[conflict.entryId];
            // migrateEntryData is the SAME function apply uses — this preview is
            // exactly what will be committed for this entry.
            const preview = migrateEntryData(
              [fd.before!],
              [fd.after!],
              { [fd.before!.name]: conflict.oldValue },
              raw === undefined
                ? {}
                : { [fd.after!.id]: toFieldValue(fd.after!, raw) },
            )[fd.after!.name];

            return (
              <div
                key={conflict.entryId}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                  {conflict.entryLabel}
                </span>
                <span className="text-zinc-400 line-through">
                  {formatValue(conflict.oldValue)}
                </span>
                <span className="text-zinc-400">→</span>
                <FixInput
                  impact={impact}
                  raw={raw}
                  onFix={(v) => onFix(conflict.entryId, v)}
                />
                <span className="w-16 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  = {formatValue(preview)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FixInput({
  impact,
  raw,
  onFix,
}: {
  impact: FieldImpact;
  raw: string | boolean | undefined;
  onFix: (raw: string | boolean) => void;
}) {
  if (impact.targetType === 'boolean') {
    const value = raw === true ? 'true' : raw === false ? 'false' : '';
    return (
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onFix(e.target.value === 'true')}
      >
        <option value="" disabled>
          Choose…
        </option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (impact.targetType === 'reference') {
    return (
      <select
        className={inputClass}
        value={typeof raw === 'string' ? raw : ''}
        onChange={(e) => onFix(e.target.value)}
      >
        <option value="">None (clear)</option>
        {(impact.referenceOptions ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  // number or date
  return (
    <input
      type={impact.targetType === 'number' ? 'number' : 'date'}
      className={`${inputClass} w-32`}
      value={typeof raw === 'string' ? raw : ''}
      placeholder="new value"
      onChange={(e) => onFix(e.target.value)}
    />
  );
}
