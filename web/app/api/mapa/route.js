import { lerFiltros, valoresMapa } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const filtros = lerFiltros(new URL(req.url).searchParams);
  return Response.json(await valoresMapa(filtros));
}
