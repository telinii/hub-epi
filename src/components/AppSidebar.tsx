import { Package, FileText, ArrowDownCircle, Users, Shield, Settings, BarChart3, ShieldCheck, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const allItems = [
  { id: "estoque", label: "[01] ESTOQUE", icon: Package, group: "Módulos do Sistema", adminOnly: false },
  { id: "notas", label: "[02] NOTAS FISCAIS", icon: FileText, group: "Módulos do Sistema", adminOnly: false },
  { id: "baixas", label: "[03] BAIXAS", icon: ArrowDownCircle, group: "Módulos do Sistema", adminOnly: false },
  { id: "validade", label: "[04] VALIDADE C.A.", icon: ShieldCheck, group: "Módulos do Sistema", adminOnly: false },
  { id: "relatorios", label: "[05] RELATÓRIOS", icon: BarChart3, group: "Módulos do Sistema", adminOnly: true },
  { id: "funcionarios", label: "[06] FUNCIONÁRIOS", icon: Users, group: "Gestão de Pessoal", adminOnly: true },
  { id: "admin", label: "[07] ADMINISTRADORES", icon: Shield, group: "Gestão de Pessoal", adminOnly: true },
  { id: "temas", label: "[08] TEMAS", icon: Palette, group: "Sistema", adminOnly: false },
  { id: "config", label: "[09] CONFIGURAÇÕES", icon: Settings, group: "Sistema", adminOnly: true },
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { isAdmin } = useUserRole();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const { count } = await supabase
        .from("admin_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPending(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("sidebar_admin_reqs")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_requests" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAdmin]);

  const menuItems = allItems.filter((i) => !i.adminOnly || isAdmin);
  const groups = [...new Set(menuItems.map((item) => item.group))];

  return (
    <nav className="w-[280px] shrink-0 border-r border-border flex flex-col bg-secondary hidden md:flex">
      <div className="p-6 border-b border-border">
        <h1 className="font-display font-bold text-2xl text-foreground tracking-widest uppercase">
          EPI<span className="text-primary">//</span>SYS
        </h1>
        <p className="text-xs mt-1 tracking-widest text-muted-foreground">
          GESTÃO DE EQUIPAMENTOS
        </p>
      </div>

      <div className="flex-1 py-6 flex flex-col gap-2 px-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group}>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-2 mt-4 first:mt-0">
              {group}
            </div>
            {menuItems
              .filter((item) => item.group === group)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 text-sm font-medium tracking-wider uppercase transition-colors text-left ${
                    activeTab === item.id
                      ? "bg-accent border border-primary text-primary shadow-[inset_4px_0_0_0_hsl(var(--primary))]"
                      : "border border-transparent hover:border-border hover:bg-accent text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {item.id === "admin" && pending > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">
                      {pending}
                    </span>
                  )}
                  {activeTab === item.id && item.id !== "admin" && (
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  )}
                </button>
              ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
