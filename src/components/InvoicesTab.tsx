import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export function InvoicesTab() {
  const [showForm, setShowForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*, equipment(code, name, ca))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ invoice_number: "", supplier: "", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [items, setItems] = useState<{ equipment_id: string; quantity: string; unit_price: string }[]>([]);

  const addItem = () => setItems([...items, { equipment_id: "", quantity: "1", unit_price: "0" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.invoice_number || !form.supplier || items.length === 0) throw new Error("Preencha todos os campos");
      
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({ invoice_number: form.invoice_number, supplier: form.supplier, date: form.date, notes: form.notes || null })
        .select()
        .single();
      if (invError) throw invError;

      const invoiceItems = items.map((item) => ({
        invoice_id: invoice.id,
        equipment_id: item.equipment_id,
        quantity: parseInt(item.quantity),
        unit_price: parseFloat(item.unit_price) || 0,
      }));
      const { error: itemsError } = await supabase.from("invoice_items").insert(invoiceItems);
      if (itemsError) throw itemsError;

      // Update equipment quantities
      for (const item of items) {
        const eq = equipment.find((e) => e.id === item.equipment_id);
        if (eq) {
          await supabase.from("equipment").update({ quantity: eq.quantity + parseInt(item.quantity) }).eq("id", eq.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setShowForm(false);
      setForm({ invoice_number: "", supplier: "", date: new Date().toISOString().slice(0, 10), notes: "" });
      setItems([]);
      toast.success("Nota fiscal registrada e estoque atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
          Notas Fiscais
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-primary-foreground px-5 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4 inline mr-1" /> NOVA NOTA
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary border border-border p-5 flex flex-col gap-4">
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm border-b border-border pb-3">
            REGISTRAR NOTA FISCAL
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">Nº NOTA *</label>
              <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">FORNECEDOR *</label>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">DATA</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">ITENS DA NOTA</label>
              <button onClick={addItem} className="text-primary text-xs font-bold tracking-widest uppercase hover:opacity-80">+ ADICIONAR ITEM</button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 mb-2">
                <select
                  value={item.equipment_id}
                  onChange={(e) => { const n = [...items]; n[i].equipment_id = e.target.value; setItems(n); }}
                  className="bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Selecionar EPI</option>
                  {equipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.code} - {eq.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Qtd"
                  value={item.quantity}
                  onChange={(e) => { const n = [...items]; n[i].quantity = e.target.value; setItems(n); }}
                  className="bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <input
                  type="number"
                  placeholder="R$"
                  value={item.unit_price}
                  onChange={(e) => { const n = [...items]; n[i].unit_price = e.target.value; setItems(n); }}
                  className="bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button onClick={() => removeItem(i)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 self-start"
          >
            {submitMutation.isPending ? "SALVANDO..." : "REGISTRAR NOTA"}
          </button>
        </div>
      )}

      <div className="border border-border bg-secondary overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-accent text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="p-4 border-b border-border font-normal">Nº Nota</th>
              <th className="p-4 border-b border-border font-normal">Fornecedor</th>
              <th className="p-4 border-b border-border font-normal">Data</th>
              <th className="p-4 border-b border-border font-normal text-right">Itens</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhuma nota fiscal registrada</td></tr>
            ) : (
              invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-accent/50 border-b border-border/50">
                  <td className="p-4 text-primary">{inv.invoice_number}</td>
                  <td className="p-4 font-display font-medium">{inv.supplier}</td>
                  <td className="p-4 text-muted-foreground">{new Date(inv.date).toLocaleDateString("pt-BR")}</td>
                  <td className="p-4 text-right">{inv.invoice_items?.length || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
