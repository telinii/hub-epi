import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, FileDown, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { EquipmentFormDialog } from "./EquipmentFormDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type SortKey = "quantity" | "name" | "ca" | "status";

export function InventoryTab() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewingItem, setViewingItem] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Equipamento removido");
    },
    onError: () => toast.error("Erro ao remover equipamento"),
  });

  const getStatus = (qty: number, min: number) => {
    if (qty <= 0) return { label: "SEM ESTOQUE", className: "bg-destructive/20 text-destructive border-destructive", rank: 0 };
    if (qty <= min) return { label: "CRÍTICO", className: "bg-destructive/20 text-destructive border-destructive animate-pulse", rank: 1 };
    if (qty <= min * 1.5) return { label: "ESTOQUE BAIXO", className: "bg-primary/10 text-primary border-primary/50", rank: 2 };
    return { label: "ADEQUADO", className: "bg-success/10 text-success border-success/30", rank: 3 };
  };

  const filtered = equipment
    .filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.code.toLowerCase().includes(search.toLowerCase()) ||
        e.ca.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "quantity":
          return b.quantity - a.quantity;
        case "name":
          return a.name.localeCompare(b.name, "pt-BR");
        case "ca":
          return a.ca.localeCompare(b.ca, "pt-BR", { numeric: true });
        case "status":
          return getStatus(a.quantity, a.min_quantity).rank - getStatus(b.quantity, b.min_quantity).rank;
        default:
          return 0;
      }
    });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Estoque de EPIs", 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 30);

    autoTable(doc, {
      startY: 36,
      head: [["Código", "C.A.", "Nome", "Qtd. Atual", "Qtd. Mín.", "Status"]],
      body: filtered.map((e) => [
        e.code,
        e.ca,
        e.name,
        e.quantity.toString(),
        e.min_quantity.toString(),
        getStatus(e.quantity, e.min_quantity).label,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 35] },
    });

    doc.save(`estoque_epis_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF gerado com sucesso");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
            Inventário Ativo
          </h2>
          <div className="text-sm text-muted-foreground flex gap-4 mt-1">
            <span>{equipment.length} itens cadastrados</span>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <div className="bg-accent p-3 border border-border">
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground block">Total em Estoque</span>
            <span className="text-foreground font-bold text-lg tabular-nums">
              {equipment.reduce((sum, e) => sum + e.quantity, 0).toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="bg-accent p-3 border border-border">
            <span className="text-[10px] tracking-widest uppercase text-destructive block">Atenção</span>
            <span className="text-destructive font-bold text-lg tabular-nums">
              {equipment.filter((e) => e.quantity <= e.min_quantity).length}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <input
            type="text"
            placeholder="BUSCAR POR CÓDIGO, C.A. OU NOME..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-accent border border-border text-primary text-sm px-10 py-3 focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 tracking-widest uppercase"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="bg-accent border border-border text-foreground text-xs px-4 py-3 focus:outline-none focus:border-primary tracking-widest uppercase font-bold cursor-pointer"
        >
          <option value="name">A-Z (NOME)</option>
          <option value="quantity">QUANTIDADE</option>
          <option value="ca">C.A.</option>
          <option value="status">STATUS</option>
        </select>
        <button
          onClick={() => { setEditingItem(null); setShowForm(true); }}
          className="bg-primary text-primary-foreground px-5 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4 inline mr-1" /> NOVO EPI
        </button>
        <button
          onClick={exportPDF}
          className="bg-secondary text-foreground border border-border px-5 py-3 text-sm font-bold tracking-widest uppercase hover:border-foreground transition-colors"
        >
          <FileDown className="h-4 w-4 inline mr-1" /> PDF
        </button>
      </div>

      <div className="border border-border bg-secondary overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-accent text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="p-4 border-b border-border font-normal">Código</th>
              <th className="p-4 border-b border-border font-normal">Nome do Equipamento</th>
              <th className="p-4 border-b border-border font-normal">C.A.</th>
              <th className="p-4 border-b border-border font-normal text-right">Qtd</th>
              <th className="p-4 border-b border-border font-normal text-right">Qtd Mín</th>
              <th className="p-4 border-b border-border font-normal text-center">Status</th>
              <th className="p-4 border-b border-border font-normal text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-foreground tabular-nums">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Nenhum equipamento encontrado
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const status = getStatus(item.quantity, item.min_quantity);
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-accent/50 border-b border-border/50 group ${
                      item.quantity <= item.min_quantity ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="p-4 text-primary">{item.code}</td>
                    <td className="p-4 font-display font-medium tracking-wide">{item.name}</td>
                    <td className="p-4 text-muted-foreground">{item.ca}</td>
                    <td className={`p-4 text-right font-bold ${item.quantity <= item.min_quantity ? "text-destructive" : ""}`}>
                      {item.quantity}
                    </td>
                    <td className="p-4 text-right text-muted-foreground">{item.min_quantity}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-1 border text-[10px] uppercase tracking-widest ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => { setEditingItem(item); setShowForm(true); }}
                        className="text-muted-foreground hover:text-primary mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit2 className="h-4 w-4 inline" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <EquipmentFormDialog
          item={editingItem}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
