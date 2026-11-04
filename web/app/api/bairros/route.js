import { bairros } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await bairros(), { headers: { "Cache-Control": "public, max-age=86400" } });
}
