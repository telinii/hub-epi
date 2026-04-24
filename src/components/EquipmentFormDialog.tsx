import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  item?: any;
  onClose: () => void;
}

type FieldKey = "code" | "name" | "ca" | "description";

export function EquipmentFormDialog({ item, onClose }: Props) {
  const [form, setForm] = useState({
    code: item?.code || "",
    name: item?.name || "",
    ca: item?.ca || "",
    description: item?.description || "",
    quantity: item?.quantity?.toString() || "0",
    min_quantity: item?.min_quantity?.toString() || "0",
    ca_expiry_date: item?.ca_expiry_date || "",
    ca_status_note: item?.ca_status_note || "",
  });
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Busca todos os EPIs já cadastrados para alimentar o autocomplete
  const { data: allEquipment = [] } = useQuery({
    queryKey: ["equipment-autocomplete"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("code, name, ca, description");
      if (error) throw error;
      return data;
    },
  });

  // Gera sugestões únicas para o campo ativo
  const suggestions = useMemo(() => {
    if (!activeField || activeField === "code") return [];
    const value = (form[activeField] || "").toLowerCase().trim();
    if (value.length < 1) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const eq of allEquipment) {
      const v = (eq as any)[activeField];
      if (!v) continue;
      const key = v.toLowerCase();
      if (key === value) continue;
      if (key.includes(value) && !seen.has(key)) {
        seen.add(key);
        result.push(v);
        if (result.length >= 6) break;
      }
    }
    return result;
  }, [activeField, form, allEquipment]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveField(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const applySuggestion = (field: FieldKey, value: string) => {
    // Procura o EPI completo correspondente para auto-preencher os outros campos
    const match = allEquipment.find((eq: any) => (eq[field] || "").toLowerCase() === value.toLowerCase());
    if (match) {
      setForm((f) => ({
        ...f,
        name: f.name || (match as any).name || "",
        ca: f.ca || (match as any).ca || "",
        description: f.description || (match as any).description || "",
        [field]: value,
      }));
    } else {
      setForm((f) => ({ ...f, [field]: value }));
    }
    setActiveField(null);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        ca: form.ca.trim(),
        description: form.description.trim() || null,
        quantity: parseInt(form.quantity) || 0,
        min_quantity: parseInt(form.min_quantity) || 0,
        ca_expiry_date: form.ca_expiry_date || null,
        ca_status_note: form.ca_status_note.trim() || null,
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

  const fields: { key: FieldKey; label: string; placeholder: string }[] = [
    { key: "code", label: "CÓDIGO *", placeholder: "Ex: EPI-001" },
    { key: "name", label: "NOME *", placeholder: "Ex: Capacete de Segurança" },
    { key: "ca", label: "C.A. *", placeholder: "Ex: CA-12345" },
    { key: "description", label: "DESCRIÇÃO", placeholder: "Descrição opcional" },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div ref={containerRef} className="bg-secondary border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">
            {item ? "EDITAR EPI" : "NOVO EPI"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {fields.map((f) => (
            <div key={f.key} className="relative">
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">{f.label}</label>
              <input
                value={form[f.key]}
                onChange={(e) => {
                  setForm({ ...form, [f.key]: e.target.value });
                  setActiveField(f.key);
                }}
                onFocus={() => setActiveField(f.key)}
                placeholder={f.placeholder}
                autoComplete="off"
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
              />
              {activeField === f.key && suggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-background border border-primary/50 max-h-48 overflow-y-auto shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applySuggestion(f.key, s)}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">QUANTIDADE</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                onFocus={() => setActiveField(null)}
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">QTD MÍNIMA</label>
              <input
                type="number"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                onFocus={() => setActiveField(null)}
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">VALIDADE C.A.</label>
              <input
                type="date"
                value={form.ca_expiry_date}
                onChange={(e) => setForm({ ...form, ca_expiry_date: e.target.value })}
                onFocus={() => setActiveField(null)}
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">NOTA C.A.</label>
              <input
                value={form.ca_status_note}
                onChange={(e) => setForm({ ...form, ca_status_note: e.target.value })}
                onFocus={() => setActiveField(null)}
                placeholder="Ex: sem C.A."
                className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
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
