import { geometria } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const nivel = new URL(req.url).searchParams.get("nivel");
  if (nivel !== "setor" && nivel !== "bairro" && nivel !== "fcu") {
    return Response.json({ erro: "nivel deve ser setor, bairro ou fcu" }, { status: 400 });
  }
  return Response.json(await geometria(nivel), {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
