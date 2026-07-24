<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before writing any code.

## What this is

The admin panel for a small headless CMS. Users define content schemas (typed fields), then create and manage entries against those schemas. This is a take-home challenge; the frontend is the point, the backend is intentionally thin.

## Stack

- Next.js (App Router) + TypeScript
- SQLite for storage (local file, zero external setup)
- Server-Sent Events (SSE) for real-time sync
- Tailwind CSS for styling

Do not add external services, cloud databases, or heavy dependencies. The whole app must run with `npm install && npm run dev`, nothing else.

## Working rules

1. **Read before writing.** Before changing code, read the relevant files, this document, and the local Next.js docs noted above. If framework behavior is uncertain, check the docs or ask, don't guess from stale training data.
2. **Small, focused changes.** One concern per change. Don't touch unrelated files.
3. **Explain your plan first for non-trivial work.** Describe the approach and wait for confirmation before writing a lot of code.
4. **The human reviews every diff.** Write code that is meant to be read and defended line by line. No cleverness that can't be explained.
5. **TypeScript is not decoration.** Model the domain with real types. The product is about typed fields; the code should reflect that. Avoid `any`.
6. **Be honest about limits.** If something is a shortcut for the challenge scope, say so in a comment or the README rather than hiding it.

## Domain model

- A **Schema** is a content type (e.g. Car). It has a name and a list of typed **Fields**. It carries a `version` that increments on every edit.
- A **Field** has a name, a type (`text | number | boolean | date | reference`), and a `required` flag. A `reference` field also names the target schema.
- An **Entry** belongs to a schema and stores its data as key/value pairs matching the schema's fields.
- Forms are **generated from the schema**, never hand-written per type. When a schema changes, its forms and entries must react.

## Priorities (build in this order)

1. Schema builder (create/edit schemas and fields)
2. Dynamic entry editor + entry list (CRUD, generated forms)
3. Read API (`GET /api/content/{type}`, `GET /api/content/{type}/:id`)
4. Real-time sync via SSE
5. Schema evolution (the differentiator): communicate risk, surface affected entries, preview, allow fixes, and handle a schema that shifts mid-edit via schema versioning.

Keep 1–4 solid and polished before going deep on 5.

## Conventions

- Everything user-facing and in code is in English.
- Keep the UI clean and calm: clear hierarchy, consistent spacing, restrained color. Red is reserved for destructive/danger actions.
- Handle empty states, loading states, and confirmations for destructive actions.
- Commit messages are concise and describe the why, not just the what.
