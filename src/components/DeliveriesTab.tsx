import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownCircle, Plus, Trash2, Check, ChevronsUpDown, Pencil, X, Pin, PinOff, Layers, Zap, Send } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

type CartItem = { equipment_id: string; quantity: number };
type BatchEntry = {
  id: string;
  employee_id: string;
  items: CartItem[];
  notes: string;
  delivered_at: string;
};
type Mode = "fast" | "batch";

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function DeliveriesTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [mode, setMode] = useState<Mode>("fast");

  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickEquipment, setPickEquipment] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [deliveredAt, setDeliveredAt] = useState(toLocalInput(new Date()));

  // Fast mode: keep employee pinned after delivery
  const [pinnedEmployee, setPinnedEmployee] = useState(false);

  // Batch mode: accumulate entries for many employees
  const [batch, setBatch] = useState<BatchEntry[]>([]);

  const [editing, setEditing] = useState<any | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleting, setDeleting] = useState<any | null>(null);

  const equipmentTriggerRef = useRef<HTMLButtonElement>(null);

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

  const getEquipment = (id: string) => equipment.find((e) => e.id === id);
  const getEmployee = (id: string) => employees.find((e) => e.id === id);

  // Compute reserved quantity per equipment across batch + cart, so we don't oversell
  const reservedByEquipment = (excludeBatchId?: string) => {
    const map: Record<string, number> = {};
    for (const entry of batch) {
      if (entry.id === excludeBatchId) continue;
      for (const it of entry.items) {
        map[it.equipment_id] = (map[it.equipment_id] || 0) + it.quantity;
      }
    }
    for (const it of cart) {
      map[it.equipment_id] = (map[it.equipment_id] || 0) + it.quantity;
    }
    return map;
  };

  const addToCart = () => {
    if (!pickEquipment) return toast.error("Selecione um EPI");
    const qty = parseInt(pickQty) || 1;
    if (qty < 1) return toast.error("Quantidade inválida");
    const eq = getEquipment(pickEquipment);
    if (!eq) return;

    const reserved = reservedByEquipment();
    const alreadyInCart = cart.find((c) => c.equipment_id === pickEquipment)?.quantity || 0;
    // reservedByEquipment includes current cart, so when checking, available = stock - (reserved - alreadyInCart) - (alreadyInCart + qty)
    const otherReserved = (reserved[pickEquipment] || 0) - alreadyInCart;
    const totalRequested = alreadyInCart + qty;
    if (eq.quantity < otherReserved + totalRequested) {
      return toast.error(`Estoque insuficiente para ${eq.name} (já reservado em outras baixas)`);
    }

    if (alreadyInCart > 0) {
      setCart(cart.map((c) => (c.equipment_id === pickEquipment ? { ...c, quantity: totalRequested } : c)));
    } else {
      setCart([...cart, { equipment_id: pickEquipment, quantity: qty }]);
    }
    setPickEquipment("");
    setPickQty("1");
  };

  const removeFromCart = (id: string) => setCart(cart.filter((c) => c.equipment_id !== id));

  // ------- FAST MODE: process single delivery immediately -------
  const deliverMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Selecione um funcionário");
      if (cart.length === 0) throw new Error("Adicione pelo menos um EPI");

      for (const item of cart) {
        const eq = getEquipment(item.equipment_id);
        if (!eq) throw new Error("Equipamento não encontrado");
        if (eq.quantity < item.quantity) throw new Error(`Estoque insuficiente para ${eq.name}`);
      }

      const deliveredIso = deliveredAt ? new Date(deliveredAt).toISOString() : new Date().toISOString();

      const { error: delError } = await supabase.from("deliveries").insert(
        cart.map((item) => ({
          equipment_id: item.equipment_id,
          employee_id: employeeId,
          quantity: item.quantity,
          notes: notes || null,
          delivered_at: deliveredIso,
        }))
      );
      if (delError) throw delError;

      for (const item of cart) {
        const eq = getEquipment(item.equipment_id)!;
        const { error: upError } = await supabase
          .from("equipment")
          .update({ quantity: eq.quantity - item.quantity })
          .eq("id", eq.id);
        if (upError) throw upError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });

      const empName = getEmployee(employeeId)?.name;
      setCart([]);
      setNotes("");
      setDeliveredAt(toLocalInput(new Date()));

      if (pinnedEmployee && empName) {
        toast.success(`Baixa registrada — pronto para próximo EPI de ${empName}`);
        setTimeout(() => equipmentTriggerRef.current?.focus(), 50);
      } else {
        setEmployeeId("");
        toast.success("Baixa registrada com sucesso");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearAll = () => {
    setEmployeeId("");
    setCart([]);
    setNotes("");
    setDeliveredAt(toLocalInput(new Date()));
    setPinnedEmployee(false);
  };

  // ------- BATCH MODE: add current form to batch list -------
  const addToBatch = () => {
    if (!employeeId) return toast.error("Selecione um funcionário");
    if (cart.length === 0) return toast.error("Adicione pelo menos um EPI");

    setBatch([
      ...batch,
      {
        id: crypto.randomUUID(),
        employee_id: employeeId,
        items: [...cart],
        notes,
        delivered_at: deliveredAt || toLocalInput(new Date()),
      },
    ]);
    toast.success("Adicionado ao lote");
    setCart([]);
    setNotes("");
    setDeliveredAt(toLocalInput(new Date()));
    if (!pinnedEmployee) setEmployeeId("");
  };

  const removeBatchEntry = (id: string) => setBatch(batch.filter((b) => b.id !== id));

  const submitBatchMutation = useMutation({
    mutationFn: async () => {
      if (batch.length === 0) throw new Error("Lote vazio");

      // Validate stock against full batch
      const totals: Record<string, number> = {};
      for (const entry of batch) {
        for (const it of entry.items) {
          totals[it.equipment_id] = (totals[it.equipment_id] || 0) + it.quantity;
        }
      }
      for (const [eqId, qty] of Object.entries(totals)) {
        const eq = getEquipment(eqId);
        if (!eq) throw new Error("Equipamento não encontrado");
        if (eq.quantity < qty) throw new Error(`Estoque insuficiente para ${eq.name} (necessário ${qty}, disponível ${eq.quantity})`);
      }

      // Build all delivery rows
      const rows = batch.flatMap((entry) =>
        entry.items.map((it) => ({
          equipment_id: it.equipment_id,
          employee_id: entry.employee_id,
          quantity: it.quantity,
          notes: entry.notes || null,
          delivered_at: new Date(entry.delivered_at).toISOString(),
        }))
      );

      const { error: delError } = await supabase.from("deliveries").insert(rows);
      if (delError) throw delError;

      for (const [eqId, qty] of Object.entries(totals)) {
        const eq = getEquipment(eqId)!;
        const { error: upError } = await supabase
          .from("equipment")
          .update({ quantity: eq.quantity - qty })
          .eq("id", eq.id);
        if (upError) throw upError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      const count = batch.length;
      setBatch([]);
      setEmployeeId("");
      setCart([]);
      setNotes("");
      setDeliveredAt(toLocalInput(new Date()));
      toast.success(`Lote enviado: ${count} baixa${count > 1 ? "s" : ""} processada${count > 1 ? "s" : ""}`);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar lote"),
  });

  // ------- Edit / Delete (admin) -------
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const iso = editDate ? new Date(editDate).toISOString() : editing.delivered_at;
      const { error } = await supabase
        .from("deliveries")
        .update({ delivered_at: iso, notes: editNotes || null })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      setEditing(null);
      toast.success("Baixa atualizada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      const eq = getEquipment(deleting.equipment_id);
      if (eq) {
        const { error: upError } = await supabase
          .from("equipment")
          .update({ quantity: eq.quantity + deleting.quantity })
          .eq("id", eq.id);
        if (upError) throw upError;
      }
      const { error } = await supabase.from("deliveries").delete().eq("id", deleting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setDeleting(null);
      toast.success("Baixa excluída e estoque devolvido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  const openEdit = (d: any) => {
    setEditing(d);
    setEditDate(toLocalInput(new Date(d.delivered_at)));
    setEditNotes(d.notes || "");
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (batch.length > 0 && next === "fast") {
      if (!confirm("Você tem itens no lote que não foram enviados. Trocar de modo descarta o lote. Continuar?")) return;
      setBatch([]);
    }
    setMode(next);
    setPinnedEmployee(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
          Baixas de EPIs
        </h2>

        {/* Mode toggle */}
        <div className="flex border border-border bg-secondary">
          <button
            onClick={() => switchMode("fast")}
            className={cn(
              "px-3 py-2 text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 transition-colors",
              mode === "fast" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="h-3.5 w-3.5" /> MODO RÁPIDO
          </button>
          <button
            onClick={() => switchMode("batch")}
            className={cn(
              "px-3 py-2 text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 transition-colors border-l border-border",
              mode === "batch" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5" /> MODO LOTE
            {batch.length > 0 && (
              <span className="bg-foreground/20 px-1.5 py-0.5 text-[10px] rounded-sm">{batch.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Mode hint */}
      <div className="text-[11px] text-muted-foreground border-l-2 border-primary pl-3">
        {mode === "fast" ? (
          <>
            <strong className="text-foreground">Modo Rápido:</strong> cada baixa é enviada imediatamente. Use o cadeado para manter o funcionário fixado entre baixas.
          </>
        ) : (
          <>
            <strong className="text-foreground">Modo Lote:</strong> acumule baixas de vários funcionários e envie tudo de uma vez. Estoque é validado no envio final.
          </>
        )}
      </div>

      <div className="bg-secondary border border-border p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <ArrowDownCircle className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">
            {mode === "fast" ? "REGISTRAR BAIXA" : "ADICIONAR AO LOTE"}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1 flex items-center justify-between">
              <span>FUNCIONÁRIO *</span>
              {employeeId && (
                <button
                  type="button"
                  onClick={() => setPinnedEmployee((p) => !p)}
                  className={cn(
                    "flex items-center gap-1 text-[10px] tracking-widest uppercase transition-colors",
                    pinnedEmployee ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={pinnedEmployee ? "Desafixar funcionário" : "Fixar funcionário entre baixas"}
                >
                  {pinnedEmployee ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
                  {pinnedEmployee ? "FIXADO" : "FIXAR"}
                </button>
              )}
            </label>
            <div className="flex gap-2">
              <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={employeeOpen}
                    className={cn(
                      "flex-1 bg-background border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary flex items-center justify-between hover:border-primary/50 transition-colors",
                      pinnedEmployee && employeeId ? "border-primary" : "border-border"
                    )}
                  >
                    <span className={cn("truncate", !employeeId && "text-muted-foreground/60")}>
                      {employeeId ? getEmployee(employeeId)?.name : "Selecionar funcionário"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-popover border-border" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar funcionário..." className="h-10" />
                    <CommandList>
                      <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={emp.name}
                            onSelect={() => {
                              setEmployeeId(emp.id);
                              setEmployeeOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", employeeId === emp.id ? "opacity-100" : "opacity-0")} />
                            {emp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {employeeId && (
                <button
                  type="button"
                  onClick={() => { setEmployeeId(""); setPinnedEmployee(false); }}
                  className="px-2 border border-border bg-background hover:border-destructive hover:text-destructive transition-colors"
                  title="Trocar funcionário"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">DATA / HORA DA ENTREGA</label>
            <input
              type="datetime-local"
              value={deliveredAt}
              onChange={(e) => setDeliveredAt(e.target.value)}
              className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="border border-border bg-background/50 p-4 flex flex-col gap-3">
          <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">ADICIONAR EPI</span>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3">
            <Popover open={equipmentOpen} onOpenChange={setEquipmentOpen}>
              <PopoverTrigger asChild>
                <button
                  ref={equipmentTriggerRef}
                  type="button"
                  role="combobox"
                  aria-expanded={equipmentOpen}
                  className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary flex items-center justify-between hover:border-primary/50 transition-colors"
                >
                  <span className={cn("truncate", !pickEquipment && "text-muted-foreground/60")}>
                    {pickEquipment
                      ? (() => {
                          const eq = getEquipment(pickEquipment);
                          return eq ? `${eq.name} — C.A. ${eq.ca}` : "Selecionar EPI";
                        })()
                      : "Selecionar EPI"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-popover border-border" align="start">
                <Command>
                  <CommandInput placeholder="Buscar EPI..." className="h-10" />
                  <CommandList>
                    <CommandEmpty>Nenhum EPI encontrado.</CommandEmpty>
                    <CommandGroup>
                      {equipment.map((eq) => (
                        <CommandItem
                          key={eq.id}
                          value={`${eq.name} ${eq.ca}`}
                          onSelect={() => {
                            setPickEquipment(eq.id);
                            setEquipmentOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", pickEquipment === eq.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{eq.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">C.A. {eq.ca}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <input
              type="number"
              min="1"
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              placeholder="Qtd"
              className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={addToCart}
              className="bg-accent text-foreground border border-border px-4 py-2.5 text-xs font-bold tracking-widest uppercase hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> ADICIONAR
            </button>
          </div>

          {cart.length > 0 && (
            <div className="border border-border divide-y divide-border">
              {cart.map((item) => {
                const eq = getEquipment(item.equipment_id);
                return (
                  <div key={item.equipment_id} className="flex items-center justify-between p-3 bg-secondary">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm text-foreground font-medium truncate">
                        <span className="text-primary">{eq?.code}</span> - {eq?.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground tracking-widest uppercase">C.A. {eq?.ca}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums text-foreground">×{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.equipment_id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">OBSERVAÇÃO</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional (aplicada a todos os itens)"
            className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {mode === "fast" ? (
            <button
              onClick={() => deliverMutation.mutate()}
              disabled={deliverMutation.isPending || !employeeId || cart.length === 0}
              className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deliverMutation.isPending ? "PROCESSANDO..." : `PROCESSAR BAIXA${cart.length > 0 ? ` (${cart.length} ITEM${cart.length > 1 ? "S" : ""})` : ""}`}
            </button>
          ) : (
            <button
              onClick={addToBatch}
              disabled={!employeeId || cart.length === 0}
              className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> ADICIONAR AO LOTE
            </button>
          )}
          <button
            onClick={clearAll}
            disabled={!employeeId && cart.length === 0 && !notes}
            className="border border-border text-muted-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:border-destructive hover:text-destructive transition-colors disabled:opacity-30"
          >
            LIMPAR
          </button>
        </div>
      </div>

      {/* Batch staging area */}
      {mode === "batch" && batch.length > 0 && (
        <div className="bg-secondary border border-primary p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">
                LOTE PENDENTE — {batch.length} BAIXA{batch.length > 1 ? "S" : ""}
              </h3>
            </div>
            <button
              onClick={() => setBatch([])}
              className="text-[10px] text-muted-foreground hover:text-destructive font-bold tracking-widest uppercase"
            >
              DESCARTAR LOTE
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {batch.map((entry, idx) => {
              const emp = getEmployee(entry.employee_id);
              return (
                <div key={entry.id} className="border border-border bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-muted-foreground tracking-widest">#{idx + 1}</span>
                        <span className="font-display font-bold text-foreground">{emp?.name || "—"}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(entry.delivered_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {entry.items.map((it) => {
                          const eq = getEquipment(it.equipment_id);
                          return (
                            <span key={it.equipment_id} className="text-[11px] bg-accent border border-border px-2 py-1">
                              <span className="text-primary">{eq?.code}</span> {eq?.name} <strong>×{it.quantity}</strong>
                            </span>
                          );
                        })}
                      </div>
                      {entry.notes && (
                        <div className="text-[11px] text-muted-foreground mt-2 italic">{entry.notes}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeBatchEntry(entry.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remover do lote"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => submitBatchMutation.mutate()}
            disabled={submitBatchMutation.isPending}
            className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 self-start flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {submitBatchMutation.isPending ? "ENVIANDO..." : `ENVIAR LOTE COMPLETO (${batch.length})`}
          </button>
        </div>
      )}

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
              {isAdmin && <th className="p-4 border-b border-border font-normal text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="text-foreground">
            {isLoading ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : deliveries.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-muted-foreground">Nenhuma baixa registrada</td></tr>
            ) : (
              deliveries.map((d: any) => (
                <tr key={d.id} className="hover:bg-accent/50 border-b border-border/50">
                  <td className="p-4 text-muted-foreground">{new Date(d.delivered_at).toLocaleString("pt-BR")}</td>
                  <td className="p-4 font-display font-medium">{d.employees?.name || "-"}</td>
                  <td className="p-4 text-primary">{d.equipment?.code} - {d.equipment?.name}</td>
                  <td className="p-4 text-muted-foreground">{d.equipment?.ca}</td>
                  <td className="p-4 text-right font-bold">{d.quantity}</td>
                  <td className="p-4 text-muted-foreground">{d.notes || "-"}</td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(d)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(d)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      {editing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-secondary border border-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display font-bold text-foreground uppercase tracking-widest text-sm">EDITAR BAIXA</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="text-xs text-muted-foreground">
                <span className="text-primary">{editing.equipment?.code}</span> - {editing.equipment?.name} ×{editing.quantity}
                <br />
                <span className="tracking-widest uppercase">{editing.employees?.name}</span>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">DATA / HORA</label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">OBSERVAÇÃO</label>
                <input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir baixa?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  A quantidade de <strong>{deleting.quantity}× {deleting.equipment?.name}</strong> será devolvida ao estoque.
                  Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir e devolver estoque
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
