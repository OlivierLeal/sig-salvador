import { contexto } from "@/lib/consultas";

export const dynamic = "force-dynamic";

const TABELAS = [1, 6, 8, 9, 11, 13, 14, 15, 16];

export async function GET(req) {
  const tabela = Number(new URL(req.url).searchParams.get("tabela"));
  if (!TABELAS.includes(tabela)) {
    return Response.json({ erro: `tabela deve ser uma de ${TABELAS.join(", ")}` }, { status: 400 });
  }
  return Response.json(await contexto(tabela));
}
