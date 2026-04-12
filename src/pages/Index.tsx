import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { InventoryTab } from "@/components/InventoryTab";
import { InvoicesTab } from "@/components/InvoicesTab";
import { DeliveriesTab } from "@/components/DeliveriesTab";
import { EmployeesTab } from "@/components/EmployeesTab";
import { AdminTab } from "@/components/AdminTab";
import { ConfigTab } from "@/components/ConfigTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState("estoque");

  const renderTab = () => {
    switch (activeTab) {
      case "estoque": return <InventoryTab />;
      case "notas": return <InvoicesTab />;
      case "baixas": return <DeliveriesTab />;
      case "funcionarios": return <EmployeesTab />;
      case "admin": return <AdminTab />;
      case "config": return <ConfigTab />;
      default: return <InventoryTab />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 flex flex-col min-w-0">
        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 overflow-auto p-4 sm:p-8">
          {renderTab()}
        </div>
      </main>
    </div>
  );
};

export default Index;
