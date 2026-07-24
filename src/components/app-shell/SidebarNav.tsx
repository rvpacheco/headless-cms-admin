'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SidebarSchema {
  id: string;
  name: string;
}

interface SidebarNavProps {
  schemas: SidebarSchema[];
}

export function SidebarNav({ schemas }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-6 p-4">
      <div className="px-2">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Content Admin
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Schemas
          </span>
        </div>

        {schemas.length === 0 ? (
          <p className="px-2 text-sm text-zinc-400">No schemas yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {schemas.map((schema) => {
              const href = `/schemas/${schema.id}`;
              const active = pathname.startsWith(href);
              return (
                <li key={schema.id}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                    }`}
                  >
                    {schema.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link
        href="/schemas/new"
        className="mt-auto rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        New schema
      </Link>
    </nav>
  );
}
