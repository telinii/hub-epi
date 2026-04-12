import { Package, FileText, ArrowDownCircle, Users, Shield, Settings } from "lucide-react";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "estoque", label: "[01] ESTOQUE", icon: Package, group: "Módulos do Sistema" },
  { id: "notas", label: "[02] NOTAS FISCAIS", icon: FileText, group: "Módulos do Sistema" },
  { id: "baixas", label: "[03] BAIXAS", icon: ArrowDownCircle, group: "Módulos do Sistema" },
  { id: "funcionarios", label: "[04] FUNCIONÁRIOS", icon: Users, group: "Gestão de Pessoal" },
  { id: "admin", label: "[05] ADMINISTRADORES", icon: Shield, group: "Gestão de Pessoal" },
  { id: "config", label: "[06] CONFIGURAÇÕES", icon: Settings, group: "Sistema" },
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
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
                  {activeTab === item.id && (
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
