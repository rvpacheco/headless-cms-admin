# Headless CMS — Admin Panel

The admin panel for a small headless CMS. You define content types (schemas) made of typed fields, then create and manage entries against them. The frontend is the point; the backend is intentionally thin. Every open client stays in sync in real time, and the app is careful about what happens to existing data when a schema changes underneath it.

Built with Next.js 16 (App Router), TypeScript, SQLite, and Server-Sent Events. No external services — it runs entirely on your machine.

## Quick start

```bash
npm install
npm run seed     # loads example data (Person + Car, with references)
npm run dev      # http://localhost:3000
```

That's it. No accounts, no API keys, no cloud database. The SQLite file is created for you at `data/cms.db` on first run.

To reset to clean demo data at any time, run `npm run seed` again.

### Requirements

Developed and tested on **Node 24**. Node 20.9+ should work (that's Next.js 16's minimum). `better-sqlite3` ships prebuilt binaries, so `npm install` won't compile anything on a normal machine.

## What's inside

The five things the challenge asked for:

- **Schema builder** — create and edit content types with named, typed fields: text, number, boolean, date, and references to another schema. A reference field points at a schema, and its entries are picked from that schema's entries.
- **Dynamic entry editor** — the entry form is never hand-written per type. It's generated from the schema definition, one input per field, and it updates when the schema changes. You can browse a schema's entries and jump between referenced ones.
- **Real-time updates** — what one client changes, the others see right away, no refresh. Open the app in two tabs and try it.
- **Schema evolution** — the part I put the most into. When a field is renamed, deleted, retyped, made required, or a reference is retargeted, entries may already exist. The app shows the risk, tells you exactly which entries are affected, previews the change, and lets you fix data that no longer fits before anything commits. More below.
- **Read API** — `GET /api/content/{type}` and `GET /api/content/{type}/:id`. This is the "headless" part: the admin manages content, and any other app can consume it as JSON.

## A few decisions worth knowing

**SQLite + SSE, fully local.** The brief said "we should be able to get it going without asking you," so I avoided any external service. SQLite lives in a file; real-time runs over Server-Sent Events. Every clone is its own isolated instance, and there's nothing to sign up for.

**SSE over WebSockets.** The sync is one-directional: the server pushes changes out to other clients, while writes go through normal requests. SSE gives me that over plain HTTP with automatic reconnection built in, without a bidirectional protocol I don't need.

**Two SQLite tables, JSON columns.** `schemas` holds each content type and its fields; `entries` holds the data. Fields and entry data are stored as JSON rather than over-normalized into a relational field table — for a CMS where the shape is user-defined, that's the honest fit, not a shortcut. All database access goes through repositories, so the rest of the app only ever touches typed domain objects.

**Fields are a discriminated union.** A field is typed on its `type`, so only a `reference` field carries a target, and the form generator has to handle every field type or it won't compile. The product is about typed fields, so the code models them the same way.

**Schema versioning runs through everything.** Each schema carries a `version` that bumps on every structural edit, and each entry records the version it was written against. That one idea shows up in three places: the entry editor pins the version it loaded, a live banner warns you if the schema changes while you're editing, and applying a schema change aborts if the schema drifted since you reviewed it. Concurrent edits are guarded so a change is never lost silently — you get told and choose.

## Schema evolution (the interesting part)

Editing a schema that already has entries opens a **Review changes** step before anything commits. It diffs the old and new schema, matched by a stable field id so a rename is understood as a rename and not a delete-plus-add, and classifies each change:

- **Safe** (e.g. renaming a field): the data key is migrated automatically.
- **Warning** (e.g. removing a field, making one required, retargeting a reference): applied as asked, but you're told how many entries are affected and how.
- **Conflict** (retyping, like text → number): the entries whose values don't convert are surfaced individually, and you fix them before applying. The classic case: a `year` field going from text to number when one entry holds `"vintage"`.

Retype is handled fully — preview each converted value, fix the ones that don't fit. The other four cases are detected and clearly communicated rather than auto-migrated. A full migration engine for every case is the productionized version; the brief asked for a clear direction, and this shows the pattern. The whole apply is one transaction, so the schema change and every entry migration commit together or not at all.

## Tests

```bash
npm test
```

38 tests over the core logic — the schema diff, the value-conversion matrix, and validation — since that's where the evolution behavior lives and where I'd want a safety net.

## Project structure

```
src/
  app/                     # routes: schemas, entries, /api/content, /api/events (SSE)
  components/              # schema builder, entry editor, realtime provider
  lib/
    domain/                # types, schema diff, entry migration, validation (pure)
    db/                    # SQLite connection, repositories, seed
    actions/               # Server Actions (mutations)
    evolution/             # schema-change analysis
    realtime/              # SSE event bus
```

## Known limitations

Deliberate scope choices, listed honestly:

- **Real-time is single-process.** The event bus is in-memory, which is correct for one local server. Multiple instances would need external pub/sub (Redis or similar) — out of scope for a zero-service build.
- **Reference retyped to text** keeps the raw id as a text value rather than flagging it.
- **A pure schema rename** doesn't re-stamp entries' `schemaVersion` (nothing structural changed; it's informational).
- **The "changed since you reviewed" banner** doesn't clear until the next action after a re-analyze — recoverable, just visually sticky.
- **Field names and values aren't hardened** — no length limits, no restriction on odd names, and numbers/dates accept loose formats without normalizing.
- **Entry-level concurrent-edit banner** isn't built. The same mechanism as the schema one would extend to it; I stopped at the schema case the brief names.

## How this was built

I built this with Claude Code as my coding agent, which the challenge invites. My workflow: the agent reads an `AGENTS.md` and the local framework docs before writing, I plan each part before it codes, and I review every diff — I don't ship code I can't explain. A separate AI assistant helped me think through architecture and trade-offs along the way. The prompt exports are included as the AI session record. Where the agent produced something that compiled but was wrong — a race condition hidden in a clean-looking flow, a React 19 transition bug — I caught it and directed the fix. That review is where the engineering is.
