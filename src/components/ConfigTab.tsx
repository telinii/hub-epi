import { Settings } from "lucide-react";

export function ConfigTab() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">
        Configurações
      </h2>
      <div className="bg-secondary border border-border p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <Settings className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center text-sm tracking-widest uppercase">
          Módulo de otimização em desenvolvimento.
        </p>
        <p className="text-muted-foreground/60 text-center text-xs tracking-wider">
          Em breve: configurações de relatórios automáticos, temas e preferências do sistema.
        </p>
      </div>
    </div>
  );
}
