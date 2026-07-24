import { getSchemaByName } from '@/lib/db/schemas';
import { listEntries } from '@/lib/db/entries';
import { serializeEntry } from '@/lib/api/serialize';

// GET /api/content/{type} — all entries of the schema named {type}
// (case-insensitive). Read-only; non-GET methods get an automatic 405.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;

  const schema = getSchemaByName(type);
  if (!schema) {
    return Response.json(
      { error: `Unknown content type: ${type}` },
      { status: 404 },
    );
  }

  const entries = listEntries(schema.id);
  return Response.json({
    type: schema.name,
    count: entries.length,
    entries: entries.map((entry) => serializeEntry(schema, entry)),
  });
}
