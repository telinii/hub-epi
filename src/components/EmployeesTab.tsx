import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import { toast } from "sonner";

export function EmployeesTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ registration: "", name: "", department: "", role: "" });

  const resetForm = () => {
    setForm({ registration: "", name: "", department: "", role: "" });
    setEditingItem(null);
    setShowForm(false);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.registration || !form.name) throw new Error("Preencha matrícula e nome");
      const payload = {
        registration: form.registration.trim(),
        name: form.name.trim(),
        department: form.department.trim() || null,
        role: form.role.trim() || null,
      };
      if (editingItem) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editingItem ? "Funcionário atualizado" : "Funcionário cadastrado");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário desativado");
    },
    onError: () => toast.error("Erro ao desativar"),
  });

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.registration.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
          Funcionários
        </h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-primary text-primary-foreground px-5 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4 inline mr-1" /> NOVO
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary border border-border p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">
              {editingItem ? "EDITAR FUNCIONÁRIO" : "NOVO FUNCIONÁRIO"}
            </h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">MATRÍCULA *</label>
              <input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">NOME *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">DEPARTAMENTO</label>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">CARGO</label>
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 self-start"
          >
            {mutation.isPending ? "SALVANDO..." : "SALVAR"}
          </button>
        </div>
      )}

      <input
        type="text"
        placeholder="BUSCAR FUNCIONÁRIO..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-accent border border-border text-primary text-sm px-4 py-3 focus:outline-none focus:border-primary placeholder:text-muted-foreground/50 tracking-widest uppercase max-w-md"
      />

      <div className="border border-border bg-secondary overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-accent text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="p-4 border-b border-border font-normal">Matrícula</th>
              <th className="p-4 border-b border-border font-normal">Nome</th>
              <th className="p-4 border-b border-border font-normal">Departamento</th>
              <th className="p-4 border-b border-border font-normal">Cargo</th>
              <th className="p-4 border-b border-border font-normal text-center">Status</th>
              <th className="p-4 border-b border-border font-normal text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum funcionário</td></tr>
            ) : (
              filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-accent/50 border-b border-border/50 group">
                  <td className="p-4 text-primary">{emp.registration}</td>
                  <td className="p-4 font-display font-medium">{emp.name}</td>
                  <td className="p-4 text-muted-foreground">{emp.department || "-"}</td>
                  <td className="p-4 text-muted-foreground">{emp.role || "-"}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2 py-1 border text-[10px] uppercase tracking-widest ${emp.active ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                      {emp.active ? "ATIVO" : "INATIVO"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setEditingItem(emp);
                        setForm({ registration: emp.registration, name: emp.name, department: emp.department || "", role: emp.role || "" });
                        setShowForm(true);
                      }}
                      className="text-muted-foreground hover:text-primary mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="h-4 w-4 inline" />
                    </button>
                    {emp.active && (
                      <button onClick={() => deleteMutation.mutate(emp.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
