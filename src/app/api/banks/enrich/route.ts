import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

type Enrichment = {
  name: string;
  portal_url: string | null;
  notes: string | null;
};

function cleanUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getDomain(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

const knownBankDomains: Record<string, string> = {
  "banco do brasil": "www.bb.com.br",
  "caixa economica federal": "www.caixa.gov.br",
  bradesco: "banco.bradesco",
  itau: "www.itau.com.br",
  santander: "www.santander.com.br",
  bmg: "www.bancobmg.com.br",
  pan: "www.bancopan.com.br",
  inter: "www.bancointer.com.br",
  c6: "www.c6bank.com.br",
  safra: "www.safra.com.br",
  daycoval: "www.daycoval.com.br",
  agibank: "www.agibank.com.br",
  "banco agibank": "www.agibank.com.br",
  "agi bank": "www.agibank.com.br",
  digio: "www.digio.com.br",
  "banco digio": "www.digio.com.br",
  neon: "www.neon.com.br",
  "banco neon": "www.neon.com.br",
  original: "www.original.com.br",
  "banco original": "www.original.com.br",
  brb: "www.brb.com.br",
  "banco de brasilia": "www.brb.com.br",
  "banco de brasília": "www.brb.com.br",
  "banco brb": "www.brb.com.br",
  next: "www.next.me",
  "banco next": "www.next.me",
  picpay: "picpay.com",
  "banco picpay": "picpay.com",
  iti: "iti.itau",
  "iti itau": "iti.itau",
  will: "www.willbank.com.br",
  willbank: "www.willbank.com.br",
};

function normalizeBankName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

function getKnownPortal(name: string) {
  const normalized = normalizeBankName(name);
  const match = Object.entries(knownBankDomains).sort(([a], [b]) => b.length - a.length).find(([label]) => normalized === label || normalized.includes(label));
  return match ? `https://${match[1]}` : null;
}

function fallbackEnrichment(name: string, portalUrl: string | null) {
  const fallbackUrl = portalUrl ?? getKnownPortal(name);
  const domain = getDomain(fallbackUrl);
  if (!fallbackUrl || !domain) return null;
  return {
    name,
    portal_url: portalUrl,
    logo_url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    notes: "Portal identificado automaticamente; revise antes de salvar.",
  };
}

function parseJsonObject(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(normalized.slice(start, end + 1)) as Partial<Enrichment>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const bankName = typeof body.name === "string" ? body.name.trim() : "";
  const portalUrl = cleanUrl(body.portal_url);
  if (bankName.length < 2 || bankName.length > 120) return NextResponse.json({ error: "Informe um nome de banco válido." }, { status: 400 });

  const portalDomain = getDomain(portalUrl);
  const knownPortal = getKnownPortal(bankName);
  if (!portalDomain && knownPortal) {
    const knownDomain = getDomain(knownPortal);
    return NextResponse.json({
      name: bankName,
      portal_url: knownPortal,
      logo_url: knownDomain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(knownDomain)}&sz=128` : null,
      notes: "Portal oficial identificado pela base de instituições; confirme a logo antes de salvar.",
    });
  }
  if (portalDomain) {
    return NextResponse.json({
      name: bankName,
      portal_url: portalUrl,
      logo_url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(portalDomain)}&sz=128`,
      notes: "Logo carregada a partir do portal informado; revise antes de salvar.",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = fallbackEnrichment(bankName, null);
    return fallback ? NextResponse.json(fallback) : NextResponse.json({ error: "Não foi possível localizar a logo deste banco agora." }, { status: 503 });
  }

  const prompt = [
    "Você auxilia no cadastro de instituições financeiras brasileiras.",
    "Normalize o nome informado e, quando tiver alta confiança, indique o portal oficial de acesso.",
    "Nunca invente uma URL: se não souber, retorne portal_url nulo.",
    `Nome informado: ${bankName}`,
    portalUrl ? `Portal informado pelo administrador: ${portalUrl}` : "Nenhum portal foi informado.",
    "Responda somente JSON com name, portal_url, domain e notes.",
  ].join("\n");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "required",
        input: [
          { role: "system", content: "Você retorna somente JSON válido, usando fontes oficiais encontradas na web." },
          { role: "user", content: `${prompt}\nPriorize o site oficial do banco e não use agregadores, diretórios ou redes sociais.` },
        ],
      }),
    });
  } catch {
    const fallback = fallbackEnrichment(bankName, portalUrl);
    return fallback ? NextResponse.json(fallback) : NextResponse.json({ error: "O serviço de busca não está acessível neste momento. Informe o portal oficial para carregar a logo." }, { status: 502 });
  }

  if (!response.ok) {
    const fallback = fallbackEnrichment(bankName, portalUrl);
    return fallback ? NextResponse.json(fallback) : NextResponse.json({ error: "Não foi possível concluir a busca agora. Informe o portal oficial para carregar a logo." }, { status: 502 });
  }
  const result = await response.json() as {
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  const responseText = result.output_text || result.output
    ?.find((item) => item.type === "message")?.content
    ?.find((item) => item.type === "output_text")?.text;
  const suggestion = parseJsonObject(responseText);
  if (!suggestion) {
    const fallback = fallbackEnrichment(bankName, portalUrl);
    return fallback ? NextResponse.json(fallback) : NextResponse.json({ error: "A resposta da busca não pôde ser interpretada. Informe o portal oficial para carregar a logo." }, { status: 502 });
  }

  const logoSourceUrl = cleanUrl(suggestion.portal_url) ?? portalUrl;
  const domain = getDomain(logoSourceUrl);
  return NextResponse.json({
    name: typeof suggestion.name === "string" && suggestion.name.trim() ? suggestion.name.trim() : bankName,
    portal_url: portalUrl,
    logo_url: domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null,
    notes: typeof suggestion.notes === "string" ? suggestion.notes.trim() || null : null,
  } satisfies Enrichment & { logo_url: string | null });
}
