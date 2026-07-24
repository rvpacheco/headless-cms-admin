import Link from 'next/link';
import { listSchemas } from '@/lib/db/schemas';

export default function Home() {
  const schemas = listSchemas();
  const hasSchemas = schemas.length > 0;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {hasSchemas ? 'Select a schema' : 'Create your first schema'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {hasSchemas
            ? 'Choose a schema from the sidebar to view it, or create a new content type.'
            : 'A schema defines a content type — a name and a set of typed fields. Start by defining one.'}
        </p>
        <Link
          href="/schemas/new"
          className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          New schema
        </Link>
      </div>
    </div>
  );
}
