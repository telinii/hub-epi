import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { InventoryTab } from "@/components/InventoryTab";
import { InvoicesTab } from "@/components/InvoicesTab";
import { DeliveriesTab } from "@/components/DeliveriesTab";
import { EmployeesTab } from "@/components/EmployeesTab";
import { ReportsTab } from "@/components/ReportsTab";
import { AdminTab } from "@/components/AdminTab";
import { ConfigTab } from "@/components/ConfigTab";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import safetyWallpaper from "@/assets/safety-wallpaper.png";

const Index = () => {
  const [activeTab, setActiveTab] = useState("estoque");
  const { signOut, user } = useAuth();

  const renderTab = () => {
    switch (activeTab) {
      case "estoque": return <InventoryTab />;
      case "notas": return <InvoicesTab />;
      case "baixas": return <DeliveriesTab />;
      case "funcionarios": return <EmployeesTab />;
      case "relatorios": return <ReportsTab />;
      case "admin": return <AdminTab />;
      case "config": return <ConfigTab />;
      default: return <InventoryTab />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background relative">
      <div
        className="safety-wallpaper"
        style={{ backgroundImage: `url(${safetyWallpaper})` }}
        aria-hidden="true"
      />
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex items-center justify-end gap-3 px-4 sm:px-8 pt-4">
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
