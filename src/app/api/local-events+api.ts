import { ingestLocalEvents, ingestLocalEventDetail } from '@/services/dtu';

// Server-side ingestion endpoint for the DTU event calendar (used by web).
// GET /api/local-events        → upcoming events list
// GET /api/local-events?id=123 → enriched event detail
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  try {
    if (id) {
      return Response.json((await ingestLocalEventDetail(id)) ?? null);
    }
    return Response.json(await ingestLocalEvents(), {
      headers: { 'Cache-Control': 'public, max-age=900' },
    });
  } catch {
    return Response.json(id ? null : [], { status: 200 });
  }
}
