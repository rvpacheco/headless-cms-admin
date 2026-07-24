import { getSchemaByName } from '@/lib/db/schemas';
import { getEntry } from '@/lib/db/entries';
import { serializeEntry } from '@/lib/api/serialize';

// GET /api/content/{type}/{id} — a single entry of the schema named {type}.
// Read-only; non-GET methods get an automatic 405.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  const schema = getSchemaByName(type);
  if (!schema) {
    return Response.json(
      { error: `Unknown content type: ${type}` },
      { status: 404 },
    );
  }

  const entry = getEntry(id);
  // The entry must exist AND belong to this content type.
  if (!entry || entry.schemaId !== schema.id) {
    return Response.json(
      { error: `No entry "${id}" in ${schema.name}` },
      { status: 404 },
    );
  }

  return Response.json(serializeEntry(schema, entry));
}
