export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      ts: new Date().toISOString(),
      message: 'pong',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
