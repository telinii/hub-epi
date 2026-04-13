import { Package, FileText, ArrowDownCircle, Users, Shield, Settings, Menu, X, BarChart3 } from "lucide-react";
import { useState } from "react";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "estoque", label: "ESTOQUE", icon: Package },
  { id: "notas", label: "NOTAS FISCAIS", icon: FileText },
  { id: "baixas", label: "BAIXAS", icon: ArrowDownCircle },
  { id: "relatorios", label: "RELATÓRIOS", icon: BarChart3 },
  { id: "funcionarios", label: "FUNCIONÁRIOS", icon: Users },
  { id: "admin", label: "ADMIN", icon: Shield },
  { id: "config", label: "CONFIG", icon: Settings },
];

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden border-b border-border bg-secondary">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="font-display font-bold text-lg text-foreground tracking-widest uppercase">
          EPI<span className="text-primary">//</span>SYS
        </h1>
        <button onClick={() => setOpen(!open)} className="text-foreground p-1">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1 px-4 pb-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setOpen(false);
              }}
              className={`px-3 py-2 text-xs font-medium tracking-wider uppercase transition-colors ${
                activeTab === item.id
                  ? "bg-accent border border-primary text-primary"
                  : "border border-border text-foreground hover:bg-accent"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
