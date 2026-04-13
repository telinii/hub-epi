import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado com sucesso");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Conta criada com sucesso!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-4xl text-foreground tracking-widest uppercase">
            EPI<span className="text-primary">//</span>SYS
          </h1>
          <p className="text-xs mt-2 tracking-widest text-muted-foreground uppercase">
            Sistema de Gestão de Equipamentos
          </p>
        </div>

        <div className="bg-secondary border border-border p-6">
          <div className="flex border-b border-border mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 pb-3 text-sm font-bold tracking-widest uppercase transition-colors ${
                isLogin ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              ENTRAR
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 pb-3 text-sm font-bold tracking-widest uppercase transition-colors ${
                !isLogin ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              CADASTRAR
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">
                E-MAIL
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-background border border-border p-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">
                SENHA
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-background border border-border p-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
            >
              {loading ? "PROCESSANDO..." : isLogin ? "ENTRAR" : "CRIAR CONTA"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
