import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";

export function DeliveriesTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ equipment_id: "", employee_id: "", quantity: "1", notes: "" });

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, equipment(code, name, ca), employees(name, registration)")
        .order("delivered_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      if (!form.equipment_id || !form.employee_id) throw new Error("Selecione EPI e funcionário");
      const qty = parseInt(form.quantity) || 1;
      const eq = equipment.find((e) => e.id === form.equipment_id);
      if (!eq) throw new Error("Equipamento não encontrado");
      if (eq.quantity < qty) throw new Error("Estoque insuficiente");

      const { error: delError } = await supabase.from("deliveries").insert({
        equipment_id: form.equipment_id,
        employee_id: form.employee_id,
        quantity: qty,
        notes: form.notes || null,
      });
      if (delError) throw delError;

      const { error: upError } = await supabase
        .from("equipment")
        .update({ quantity: eq.quantity - qty })
        .eq("id", eq.id);
      if (upError) throw upError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setForm({ equipment_id: "", employee_id: "", quantity: "1", notes: "" });
      toast.success("Baixa registrada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
        Baixas de EPIs
      </h2>

      <div className="bg-secondary border border-border p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <ArrowDownCircle className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">REGISTRAR BAIXA</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">FUNCIONÁRIO *</label>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Selecionar funcionário</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.registration} - {emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">EPI *</label>
            <select
              value={form.equipment_id}
              onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
              className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Selecionar EPI</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.code} - {eq.name} (Estoque: {eq.quantity})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">QUANTIDADE</label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">OBSERVAÇÃO</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Opcional"
              className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        <button
          onClick={() => deliverMutation.mutate()}
          disabled={deliverMutation.isPending}
          className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 self-start"
        >
          {deliverMutation.isPending ? "PROCESSANDO..." : "PROCESSAR BAIXA"}
        </button>
      </div>

      <div className="border border-border bg-secondary overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-accent text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="p-4 border-b border-border font-normal">Data/Hora</th>
              <th className="p-4 border-b border-border font-normal">Funcionário</th>
              <th className="p-4 border-b border-border font-normal">EPI</th>
              <th className="p-4 border-b border-border font-normal">C.A.</th>
              <th className="p-4 border-b border-border font-normal text-right">Qtd</th>
              <th className="p-4 border-b border-border font-normal">Obs</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : deliveries.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma baixa registrada</td></tr>
            ) : (
              deliveries.map((d: any) => (
                <tr key={d.id} className="hover:bg-accent/50 border-b border-border/50">
                  <td className="p-4 text-muted-foreground">{new Date(d.delivered_at).toLocaleString("pt-BR")}</td>
                  <td className="p-4 font-display font-medium">{d.employees?.name || "-"}</td>
                  <td className="p-4 text-primary">{d.equipment?.code} - {d.equipment?.name}</td>
                  <td className="p-4 text-muted-foreground">{d.equipment?.ca}</td>
                  <td className="p-4 text-right font-bold">{d.quantity}</td>
                  <td className="p-4 text-muted-foreground">{d.notes || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
