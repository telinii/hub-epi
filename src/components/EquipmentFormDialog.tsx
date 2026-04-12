import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  item?: any;
  onClose: () => void;
}

export function EquipmentFormDialog({ item, onClose }: Props) {
  const [form, setForm] = useState({
    code: item?.code || "",
    name: item?.name || "",
    ca: item?.ca || "",
    description: item?.description || "",
    quantity: item?.quantity?.toString() || "0",
    min_quantity: item?.min_quantity?.toString() || "0",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        ca: form.ca.trim(),
        description: form.description.trim() || null,
        quantity: parseInt(form.quantity) || 0,
        min_quantity: parseInt(form.min_quantity) || 0,
      };
      if (item) {
        const { error } = await supabase.from("equipment").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipment").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success(item ? "Equipamento atualizado" : "Equipamento cadastrado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.ca) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-secondary border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">
            {item ? "EDITAR EPI" : "NOVO EPI"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {[
            { key: "code", label: "CÓDIGO *", placeholder: "Ex: EPI-001" },
            { key: "name", label: "NOME *", placeholder: "Ex: Capacete de Segurança" },
            { key: "ca", label: "C.A. *", placeholder: "Ex: CA-12345" },
            { key: "description", label: "DESCRIÇÃO", placeholder: "Descrição opcional" },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">{f.label}</label>
              <input
                value={(form as any)[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">QUANTIDADE</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">QTD MÍNIMA</label>
              <input
                type="number"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-2 bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? "SALVANDO..." : "SALVAR"}
          </button>
        </form>
      </div>
    </div>
  );
}
