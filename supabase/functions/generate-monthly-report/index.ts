import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getLastBusinessDay(year: number, month: number): Date {
  // month is 0-indexed (0=Jan, 11=Dec)
  // Get last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay(); // 0=Sun, 6=Sat

  if (dayOfWeek === 0) {
    // Sunday → go back to Friday
    lastDay.setDate(lastDay.getDate() - 2);
  } else if (dayOfWeek === 6) {
    // Saturday → go back to Friday
    lastDay.setDate(lastDay.getDate() - 1);
  }

  return lastDay;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const lastBizDay = getLastBusinessDay(now.getFullYear(), now.getMonth());

    // Only generate if today is the last business day of the month
    if (!isToday(lastBizDay)) {
      return new Response(
        JSON.stringify({
          message: "Hoje não é o último dia útil do mês. Nenhum relatório gerado.",
          today: now.toISOString().slice(0, 10),
          lastBusinessDay: lastBizDay.toISOString().slice(0, 10),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Check if report already exists for this month
    const { data: existing } = await supabase
      .from("monthly_reports")
      .select("id")
      .eq("report_month", reportMonth)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ message: `Relatório de ${reportMonth} já foi gerado.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch equipment data
    const { data: equipment, error: eqError } = await supabase
      .from("equipment")
      .select("*")
      .order("code");

    if (eqError) throw eqError;

    // Build CSV content (simple report format for server-side)
    const csvHeader = "Código,C.A.,Nome,Quantidade Atual,Quantidade Mínima,Status\n";
    const csvRows = (equipment || [])
      .map((e: any) => {
        let status = "ADEQUADO";
        if (e.quantity <= 0) status = "SEM ESTOQUE";
        else if (e.quantity <= e.min_quantity) status = "CRÍTICO";
        else if (e.quantity <= e.min_quantity * 1.5) status = "ESTOQUE BAIXO";
        return `"${e.code}","${e.ca}","${e.name}",${e.quantity},${e.min_quantity},"${status}"`;
      })
      .join("\n");

    const csvContent = csvHeader + csvRows;
    const filePath = `mensal/${reportMonth}.csv`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(filePath, new Blob([csvContent], { type: "text/csv" }), {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Record in monthly_reports table
    const { error: insertError } = await supabase.from("monthly_reports").insert({
      report_month: reportMonth,
      file_path: filePath,
      generated_by: "sistema automático",
    });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        message: `Relatório mensal ${reportMonth} gerado com sucesso!`,
        file_path: filePath,
        items_count: equipment?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
