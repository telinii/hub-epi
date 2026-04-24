import { Package, FileText, ArrowDownCircle, Users, Shield, Settings, Menu, X, BarChart3, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const allItems = [
  { id: "estoque", label: "ESTOQUE", icon: Package, adminOnly: false },
  { id: "notas", label: "NOTAS FISCAIS", icon: FileText, adminOnly: false },
  { id: "baixas", label: "BAIXAS", icon: ArrowDownCircle, adminOnly: false },
  { id: "validade", label: "VALIDADE C.A.", icon: ShieldCheck, adminOnly: false },
  { id: "relatorios", label: "RELATÓRIOS", icon: BarChart3, adminOnly: true },
  { id: "funcionarios", label: "FUNCIONÁRIOS", icon: Users, adminOnly: true },
  { id: "admin", label: "ADMIN", icon: Shield, adminOnly: true },
  { id: "config", label: "CONFIG", icon: Settings, adminOnly: true },
];

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useUserRole();
  const menuItems = allItems.filter((i) => !i.adminOnly || isAdmin);

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
