import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { InventoryTab } from "@/components/InventoryTab";
import { InvoicesTab } from "@/components/InvoicesTab";
import { DeliveriesTab } from "@/components/DeliveriesTab";
import { CaValidityTab } from "@/components/CaValidityTab";
import { EmployeesTab } from "@/components/EmployeesTab";
import { ReportsTab } from "@/components/ReportsTab";
import { AdminTab } from "@/components/AdminTab";
import { ConfigTab } from "@/components/ConfigTab";
import { ThemesTab } from "@/components/ThemesTab";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/hooks/useTheme";
import { LogOut } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("estoque");
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { theme, translucent } = useTheme();

  useEffect(() => {
    document.body.classList.toggle("translucent-mode", translucent);
    return () => document.body.classList.remove("translucent-mode");
  }, [translucent]);

  const renderTab = () => {
    switch (activeTab) {
      case "estoque": return <InventoryTab />;
      case "notas": return <InvoicesTab />;
      case "baixas": return <DeliveriesTab />;
      case "validade": return <CaValidityTab />;
      case "funcionarios": return <EmployeesTab />;
      case "relatorios": return <ReportsTab />;
      case "admin": return <AdminTab />;
      case "config": return <ConfigTab />;
      case "temas": return <ThemesTab />;
      default: return <InventoryTab />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background relative">
      {theme.wallpaper && (
        <div
          className="safety-wallpaper"
          style={{ backgroundImage: `url(${theme.wallpaper})` }}
          aria-hidden="true"
        />
      )}
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex items-center justify-end gap-3 px-4 sm:px-8 pt-4">
          <span
            className={`text-[10px] font-bold tracking-widest px-2 py-0.5 border ${
              isAdmin ? "text-primary border-primary bg-primary/10" : "text-muted-foreground border-border"
            }`}
          >
            {isAdmin ? "ADMIN" : "USUÁRIO"}
          </span>
          <span className="text-xs text-muted-foreground tracking-widest">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-8 pt-2">
          {renderTab()}
        </div>
      </main>
    </div>
  );
};

export default Index;
