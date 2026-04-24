// Lookup C.A. (Certificado de Aprovação) validity from consultaca.com
// Public, no JWT required.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ddmmyyyyToISO(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ca = String(body.ca || "").trim();

    if (!/^\d+$/.test(ca)) {
      return new Response(
        JSON.stringify({
          ca,
          status: "INVALID_CA",
          expiry_date: null,
          raw_label: "C.A. inválido (não numérico)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `https://consultaca.com/${ca}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          ca,
          status: "NOT_FOUND",
          expiry_date: null,
          raw_label: `Falha HTTP ${res.status}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = await res.text();

    // Extract validade dd/mm/yyyy
    const dateMatch = html.match(/Validade[\s\S]{0,200}?(\d{2}\/\d{2}\/\d{4})/i);
    // Extract situação
    const sitMatch = html.match(/Situa[cç][aã]o[\s\S]{0,200}?(VÁLIDO|VALIDO|VENCIDO|CANCELADO)/i);

    const iso = dateMatch ? ddmmyyyyToISO(dateMatch[1]) : null;
    const sitRaw = sitMatch ? sitMatch[1].toUpperCase() : "";
    let status: "VALID" | "EXPIRED" | "CANCELLED" | "NOT_FOUND" = "NOT_FOUND";
    if (sitRaw.startsWith("VAL")) status = "VALID";
    else if (sitRaw === "VENCIDO") status = "EXPIRED";
    else if (sitRaw === "CANCELADO") status = "CANCELLED";
    else if (iso) status = "VALID";

    if (!iso && status === "NOT_FOUND") {
      return new Response(
        JSON.stringify({
          ca,
          status: "NOT_FOUND",
          expiry_date: null,
          raw_label: "C.A. não encontrado",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ca,
        status,
        expiry_date: iso,
        raw_label: dateMatch ? dateMatch[1] : "",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ status: "ERROR", error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
