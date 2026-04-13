import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, FileText, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function ReportsTab() {
  const [generating, setGenerating] = useState(false);

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["monthly_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getStatus = (qty: number, min: number) => {
    if (qty <= 0) return "SEM ESTOQUE";
    if (qty <= min) return "CRÍTICO";
    if (qty <= min * 1.5) return "ESTOQUE BAIXO";
    return "ADEQUADO";
  };

  const generatePDF = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório de Estoque de EPIs", 14, 22);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 30);
      doc.text(`Total de itens: ${equipment.length}`, 14, 36);
      doc.text(
        `Itens em atenção: ${equipment.filter((e) => e.quantity <= e.min_quantity).length}`,
        14,
        42
      );

      autoTable(doc, {
        startY: 50,
        head: [["Código", "C.A.", "Nome", "Qtd. Atual", "Qtd. Mín.", "Status"]],
        body: equipment.map((e) => [
          e.code,
          e.ca,
          e.name,
          e.quantity.toString(),
          e.min_quantity.toString(),
          getStatus(e.quantity, e.min_quantity),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 30, 35] },
      });

      doc.save(`relatorio_estoque_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Relatório gerado com sucesso");
    } catch {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (filePath: string) => {
    const { data } = supabase.storage.from("reports").getPublicUrl(filePath);
    window.open(data.publicUrl, "_blank");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
            Relatórios
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gere relatórios sob demanda ou visualize os relatórios mensais automáticos
          </p>
        </div>
      </div>

      {/* Manual Report Generation */}
      <div className="bg-secondary border border-border p-5">
        <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
          <FileDown className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">
            GERAR RELATÓRIO MANUAL
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Gera um PDF com o estoque atual organizado por código, C.A. e nome do equipamento.
        </p>
        <button
          onClick={generatePDF}
          disabled={generating || equipment.length === 0}
          className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> GERANDO...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" /> GERAR PDF DO ESTOQUE ATUAL
            </>
          )}
        </button>
      </div>

      {/* Monthly Report Info */}
      <div className="bg-secondary border border-border p-5">
        <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">
            RELATÓRIOS MENSAIS AUTOMÁTICOS
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Gerados automaticamente no último dia útil de cada mês (Segunda a Sexta).
          Se o último dia do mês cair em Sábado ou Domingo, o relatório será gerado na Sexta-feira anterior.
        </p>

        <div className="border border-border bg-background overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-accent text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="p-4 border-b border-border font-normal">Mês de Referência</th>
                <th className="p-4 border-b border-border font-normal">Data de Geração</th>
                <th className="p-4 border-b border-border font-normal">Gerado por</th>
                <th className="p-4 border-b border-border font-normal text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {reportsLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Nenhum relatório mensal gerado ainda
                  </td>
                </tr>
              ) : (
                reports.map((r: any) => (
                  <tr key={r.id} className="hover:bg-accent/50 border-b border-border/50">
                    <td className="p-4 font-display font-medium">{r.report_month}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-4 text-muted-foreground capitalize">{r.generated_by}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => downloadReport(r.file_path)}
                        className="text-primary hover:underline text-xs font-bold tracking-widest uppercase flex items-center gap-1 ml-auto"
                      >
                        <FileText className="h-4 w-4" /> DOWNLOAD
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
