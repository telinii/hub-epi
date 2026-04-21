import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

type Tab = "login" | "signup" | "admin-request";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(72, "Senha muito longa")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe a senha").max(72),
});

const adminReqSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe a senha").max(72),
  justification: z.string().trim().min(20, "Justificativa precisa ter ao menos 20 caracteres").max(1000),
});

export default function Auth() {
  const [tab, setTab] = useState<Tab>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login realizado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      setTab("login");
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = adminReqSchema.safeParse({ email, password, justification });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      // Login com a conta existente (precisa estar com e-mail confirmado)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      if (!signInData.user) throw new Error("Falha na autenticação");

      // Verifica se já é admin
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", signInData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (existingRole) {
        toast.success("Você já é administrador!");
        return;
      }

      // Verifica se já tem solicitação pendente
      const { data: existingReq } = await supabase
        .from("admin_requests")
        .select("id")
        .eq("user_id", signInData.user.id)
        .eq("status", "pending")
        .maybeSingle();
      if (existingReq) {
        toast.error("Você já possui uma solicitação pendente");
        return;
      }

      // Pega nome do profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", signInData.user.id)
        .single();

      const { error: reqError } = await supabase.from("admin_requests").insert({
        user_id: signInData.user.id,
        email: profile?.email ?? signInData.user.email!,
        full_name: profile?.full_name ?? signInData.user.email!,
        justification,
        status: "pending",
      });
      if (reqError) throw reqError;
      toast.success("Solicitação enviada! Aguarde aprovação de um administrador.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar acesso");
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
          <div className="flex border-b border-border mb-6 text-[10px] sm:text-xs">
            {([
              ["login", "ENTRAR"],
              ["signup", "CADASTRAR"],
              ["admin-request", "SOLICITAR ADMIN"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 pb-3 font-bold tracking-widest uppercase transition-colors ${
                  tab === id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Field label="E-MAIL" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
              <Field label="SENHA" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              <SubmitBtn loading={loading} label="ENTRAR" />
            </form>
          )}

          {tab === "signup" && (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <Field label="NOME COMPLETO" value={fullName} onChange={setFullName} placeholder="João da Silva" />
              <Field label="E-MAIL" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
              <Field label="SENHA" type="password" value={password} onChange={setPassword} placeholder="Mín. 8, com maiúscula e número" />
              <p className="text-[10px] text-muted-foreground tracking-wider">
                Conta será criada como USUÁRIO COMUM. Para virar admin, use a aba "Solicitar Admin" depois de confirmar o e-mail.
              </p>
              <SubmitBtn loading={loading} label="CRIAR CONTA" />
            </form>
          )}

          {tab === "admin-request" && (
            <form onSubmit={handleAdminRequest} className="flex flex-col gap-4">
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                Você precisa ter conta criada e e-mail confirmado.
              </p>
              <Field label="E-MAIL" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
              <Field label="SENHA" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              <div>
                <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">
                  JUSTIFICATIVA (mín. 20 caracteres)
                </label>
                <textarea
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Por que você precisa de acesso de administrador?"
                  className="w-full bg-background border border-border p-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40"
                />
              </div>
              <SubmitBtn loading={loading} label="ENVIAR SOLICITAÇÃO" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase block mb-1">
        {label}
      </label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border p-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="bg-primary text-primary-foreground px-6 py-3 text-sm font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
    >
      {loading ? "PROCESSANDO..." : label}
    </button>
  );
}
