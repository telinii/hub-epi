import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownCircle, Plus, Trash2, Check, ChevronsUpDown, Pencil, X } from "lucide-react";
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

// Format date as "YYYY-MM-DDTHH:mm" for datetime-local input
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function DeliveriesTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickEquipment, setPickEquipment] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [deliveredAt, setDeliveredAt] = useState(toLocalInput(new Date()));

  const [editing, setEditing] = useState<any | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleting, setDeleting] = useState<any | null>(null);

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

  const addToCart = () => {
    if (!pickEquipment) return toast.error("Selecione um EPI");
    const qty = parseInt(pickQty) || 1;
    if (qty < 1) return toast.error("Quantidade inválida");
    const eq = equipment.find((e) => e.id === pickEquipment);
    if (!eq) return;

    const existing = cart.find((c) => c.equipment_id === pickEquipment);
    const totalRequested = (existing?.quantity || 0) + qty;
    if (eq.quantity < totalRequested) return toast.error(`Estoque insuficiente para ${eq.name}`);

    if (existing) {
      setCart(cart.map((c) => (c.equipment_id === pickEquipment ? { ...c, quantity: totalRequested } : c)));
    } else {
      setCart([...cart, { equipment_id: pickEquipment, quantity: qty }]);
    }
    setPickEquipment("");
    setPickQty("1");
  };

  const removeFromCart = (id: string) => setCart(cart.filter((c) => c.equipment_id !== id));

  const deliverMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Selecione um funcionário");
      if (cart.length === 0) throw new Error("Adicione pelo menos um EPI");

      for (const item of cart) {
        const eq = equipment.find((e) => e.id === item.equipment_id);
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
        const eq = equipment.find((e) => e.id === item.equipment_id)!;
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
      setEmployeeId("");
      setNotes("");
      setCart([]);
      setDeliveredAt(toLocalInput(new Date()));
      toast.success("Baixa registrada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      // Return stock first
      const eq = equipment.find((e) => e.id === deleting.equipment_id);
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

  const getEquipment = (id: string) => equipment.find((e) => e.id === id);

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">FUNCIONÁRIO *</label>
            <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={employeeOpen}
                  className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary flex items-center justify-between hover:border-primary/50 transition-colors"
                >
                  <span className={cn("truncate", !employeeId && "text-muted-foreground/60")}>
                    {employeeId ? employees.find((e) => e.id === employeeId)?.name : "Selecionar funcionário"}
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
          <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">ADICIONAR EPI À BAIXA</span>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3">
            <Popover open={equipmentOpen} onOpenChange={setEquipmentOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={equipmentOpen}
                  className="w-full bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:border-primary flex items-center justify-between hover:border-primary/50 transition-colors"
                >
                  <span className={cn("truncate", !pickEquipment && "text-muted-foreground/60")}>
                    {pickEquipment
                      ? (() => {
                          const eq = equipment.find((e) => e.id === pickEquipment);
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

        <button
          onClick={() => deliverMutation.mutate()}
          disabled={deliverMutation.isPending || !employeeId || cart.length === 0}
          className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed self-start"
        >
          {deliverMutation.isPending ? "PROCESSANDO..." : `PROCESSAR BAIXA${cart.length > 0 ? ` (${cart.length} ITEM${cart.length > 1 ? "S" : ""})` : ""}`}
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
