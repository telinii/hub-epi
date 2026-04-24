import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Check, ChevronsUpDown, Pencil, X, Search, RefreshCw, Globe } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

type Status = {
  label: string;
  variant: "success" | "warning" | "destructive" | "muted";
  days: number | null;
};

function getCaStatus(expiry: string | null, note: string | null): Status {
  if (!expiry) return { label: note?.trim() ? note.trim() : "SEM C.A.", variant: "muted", days: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry + "T00:00:00");
  const days = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `VENCIDO HÁ ${-days}D`, variant: "destructive", days };
  if (days <= 30) return { label: `VENCE EM ${days}D`, variant: "warning", days };
  return { label: `VÁLIDO — ${days}D`, variant: "success", days };
}

const variantClasses: Record<Status["variant"], string> = {
  success: "bg-primary/10 text-primary border-primary",
  warning: "bg-warning/10 text-warning border-warning",
  destructive: "bg-destructive/10 text-destructive border-destructive",
  muted: "bg-muted text-muted-foreground border-border",
};

type Filter = "all" | "valid" | "soon" | "expired" | "none";

export function CaValidityTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();

  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [editing, setEditing] = useState<any | null>(null);
  const [editExpiry, setEditExpiry] = useState("");
  const [editNote, setEditNote] = useState("");

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [lookupLoadingId, setLookupLoadingId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  async function lookupOne(eq: any): Promise<{ ok: boolean; status: string }> {
    if (!/^\d+$/.test(String(eq.ca || "").trim())) {
      await supabase
        .from("equipment")
        .update({ ca_status_note: eq.ca_status_note || "C.A. não informado" })
        .eq("id", eq.id);
      return { ok: false, status: "INVALID_CA" };
    }
    try {
      const { data, error } = await supabase.functions.invoke("lookup-ca", {
        body: { ca: String(eq.ca).trim() },
      });
      if (error) throw error;
      const update: any = {};
      if (data?.expiry_date) {
        update.ca_expiry_date = data.expiry_date;
        update.ca_status_note = null;
      } else {
        update.ca_expiry_date = null;
        update.ca_status_note = data?.raw_label || "C.A. não encontrado";
      }
      await supabase.from("equipment").update(update).eq("id", eq.id);
      return { ok: !!data?.expiry_date, status: data?.status || "UNKNOWN" };
    } catch (e: any) {
      return { ok: false, status: "ERROR" };
    }
  }

  const lookupOneMutation = useMutation({
    mutationFn: async (eq: any) => {
      setLookupLoadingId(eq.id);
      const r = await lookupOne(eq);
      return { eq, r };
    },
    onSuccess: ({ eq, r }) => {
      setLookupLoadingId(null);
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      if (r.ok) toast.success(`Validade atualizada: ${eq.name}`);
      else if (r.status === "INVALID_CA") toast.warning(`${eq.name}: C.A. não numérico`);
      else toast.error(`${eq.name}: C.A. não encontrado`);
    },
    onError: () => {
      setLookupLoadingId(null);
      toast.error("Erro ao consultar C.A.");
    },
  });

  const bulkLookup = async () => {
    const list = equipment.filter((e: any) => /^\d+$/.test(String(e.ca || "").trim()));
    if (list.length === 0) {
      toast.warning("Nenhum EPI com C.A. numérico");
      return;
    }
    setBulkProgress({ done: 0, total: list.length });
    let updated = 0;
    let notFound = 0;
    const concurrency = 5;
    let index = 0;
    const workers = Array.from({ length: concurrency }).map(async () => {
      while (index < list.length) {
        const i = index++;
        const r = await lookupOne(list[i]);
        if (r.ok) updated++;
        else notFound++;
        setBulkProgress({ done: i + 1, total: list.length });
      }
    });
    await Promise.all(workers);
    // Atualizar EPIs com C.A. não numérico (nota automática)
    const nonNumeric = equipment.filter((e: any) => !/^\d+$/.test(String(e.ca || "").trim()));
    for (const eq of nonNumeric) {
      if (!eq.ca_status_note) {
        await supabase
          .from("equipment")
          .update({ ca_status_note: "C.A. não informado" })
          .eq("id", eq.id);
      }
    }
    setBulkProgress(null);
    queryClient.invalidateQueries({ queryKey: ["equipment"] });
    toast.success(`Concluído: ${updated} atualizados, ${notFound} não encontrados, ${nonNumeric.length} sem C.A. numérico`);
  };


  const sorted = useMemo(() => {
    return [...equipment].sort((a: any, b: any) => {
      const sa = getCaStatus(a.ca_expiry_date, a.ca_status_note);
      const sb = getCaStatus(b.ca_expiry_date, b.ca_status_note);
      // Order: vencidos (negativo, mais antigo primeiro) -> vence em breve -> válidos -> sem c.a.
      if (sa.days === null && sb.days === null) return 0;
      if (sa.days === null) return 1;
      if (sb.days === null) return -1;
      return sa.days - sb.days;
    });
  }, [equipment]);

  const filtered = useMemo(() => {
    return sorted.filter((eq: any) => {
      const s = getCaStatus(eq.ca_expiry_date, eq.ca_status_note);
      if (filter === "all") return true;
      if (filter === "none") return s.days === null;
      if (filter === "expired") return s.days !== null && s.days < 0;
      if (filter === "soon") return s.days !== null && s.days >= 0 && s.days <= 30;
      if (filter === "valid") return s.days !== null && s.days > 30;
      return true;
    });
  }, [sorted, filter]);

  const selected = equipment.find((e: any) => e.id === selectedId);
  const selectedStatus = selected ? getCaStatus(selected.ca_expiry_date, selected.ca_status_note) : null;

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("equipment")
        .update({
          ca_expiry_date: editExpiry || null,
          ca_status_note: editNote.trim() || null,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setEditing(null);
      toast.success("Validade atualizada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const openEdit = (eq: any) => {
    setEditing(eq);
    setEditExpiry(eq.ca_expiry_date || "");
    setEditNote(eq.ca_status_note || "");
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "TODOS" },
    { id: "valid", label: "VÁLIDOS" },
    { id: "soon", label: "VENCE EM ≤30D" },
    { id: "expired", label: "VENCIDOS" },
    { id: "none", label: "SEM C.A." },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
        Validade — C.As
      </h2>

      {/* Quick lookup */}
      <div className="bg-secondary border border-border p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Search className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">CONSULTA RÁPIDA</h3>
        </div>

        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={searchOpen}
              className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary flex items-center justify-between hover:border-primary/50 transition-colors"
            >
              <span className={cn("truncate", !selectedId && "text-muted-foreground/60")}>
                {selected ? `${selected.name} — C.A. ${selected.ca}` : "Buscar EPI por nome, código ou C.A."}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-popover border-border" align="start">
            <Command>
              <CommandInput placeholder="Buscar..." className="h-10" />
              <CommandList>
                <CommandEmpty>Nenhum EPI encontrado.</CommandEmpty>
                <CommandGroup>
                  {equipment.map((eq: any) => (
                    <CommandItem
                      key={eq.id}
                      value={`${eq.name} ${eq.code} ${eq.ca}`}
                      onSelect={() => {
                        setSelectedId(eq.id);
                        setSearchOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", selectedId === eq.id ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{eq.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">C.A. {eq.ca}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected && selectedStatus && (
          <div className="border border-border bg-background p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs text-muted-foreground tracking-widest uppercase">{selected.code}</span>
                <span className="font-display font-bold text-lg text-foreground">{selected.name}</span>
                <span className="text-sm text-muted-foreground">C.A. {selected.ca}</span>
                {selected.ca_expiry_date && (
                  <span className="text-xs text-muted-foreground tracking-widest uppercase mt-1">
                    Validade: {new Date(selected.ca_expiry_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <div className={cn("border-2 px-4 py-3 font-display font-bold text-base tracking-widest uppercase", variantClasses[selectedStatus.variant])}>
                {selectedStatus.label}
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => openEdit(selected)}
                className="self-start text-xs text-muted-foreground hover:text-primary tracking-widest uppercase flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> EDITAR VALIDADE
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 text-[11px] tracking-widest uppercase border transition-colors",
              filter === f.id
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Full table */}
      <div className="border border-border bg-secondary overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-accent text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="p-4 border-b border-border font-normal">EPI</th>
              <th className="p-4 border-b border-border font-normal">C.A.</th>
              <th className="p-4 border-b border-border font-normal">Validade</th>
              <th className="p-4 border-b border-border font-normal">Status</th>
              <th className="p-4 border-b border-border font-normal">Nota</th>
              {isAdmin && <th className="p-4 border-b border-border font-normal text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="text-foreground">
            {isLoading ? (
              <tr><td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-muted-foreground">Nenhum EPI</td></tr>
            ) : (
              filtered.map((eq: any) => {
                const s = getCaStatus(eq.ca_expiry_date, eq.ca_status_note);
                return (
                  <tr key={eq.id} className="hover:bg-accent/50 border-b border-border/50">
                    <td className="p-4">
                      <span className="text-primary">{eq.code}</span> - {eq.name}
                    </td>
                    <td className="p-4 text-muted-foreground">{eq.ca}</td>
                    <td className="p-4 text-muted-foreground">
                      {eq.ca_expiry_date ? new Date(eq.ca_expiry_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="p-4">
                      <span className={cn("inline-block border px-2 py-1 text-[10px] tracking-widest uppercase font-bold", variantClasses[s.variant])}>
                        {s.label}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs max-w-[200px] truncate">{eq.ca_status_note || "—"}</td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEdit(eq)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                          title="Editar validade"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      {editing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-secondary border border-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">EDITAR VALIDADE</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="text-xs text-muted-foreground">
                <span className="text-primary">{editing.code}</span> - {editing.name}
                <br />
                C.A. {editing.ca}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">DATA DE VALIDADE</label>
                <input
                  type="date"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                  className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">NOTA (USADA QUANDO NÃO HÁ VALIDADE)</label>
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Ex: sem C.A., em renovação..."
                  className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                />
              </div>
              <button
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
                className="mt-2 bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editMutation.isPending ? "SALVANDO..." : "SALVAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
