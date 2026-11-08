import { lerFiltros, interseccional } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const filtros = lerFiltros(new URL(req.url).searchParams);
  return Response.json(await interseccional(filtros));
}
