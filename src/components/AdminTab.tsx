import { useEffect, useState } from "react";
import { Shield, Users, ScrollText, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

type SubTab = "requests" | "admins" | "audit";

interface AdminRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  justification: string;
  status: string;
  requested_at: string;
}

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  granted_at: string;
}

interface AuditEntry {
  id: string;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  created_at: string;
}

export function AdminTab() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [sub, setSub] = useState<SubTab>("requests");

  if (roleLoading) return <div className="text-muted-foreground tracking-widest text-sm">CARREGANDO...</div>;
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">Administradores</h2>
        <div className="bg-secondary border border-border p-8 flex flex-col items-center gap-3 min-h-[300px] justify-center">
          <Shield className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center text-sm tracking-widest uppercase">Acesso restrito a administradores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight">Administradores</h2>
      <div className="flex gap-1 border-b border-border flex-wrap">
        {([
          ["requests", "Solicitações", Shield],
          ["admins", "Admins Ativos", Users],
          ["audit", "Auditoria", ScrollText],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`px-4 py-2 text-xs font-bold tracking-widest uppercase flex items-center gap-2 transition-colors ${
              sub === id ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>
      {sub === "requests" && <RequestsList />}
      {sub === "admins" && <AdminsList />}
      {sub === "audit" && <AuditList />}
    </div>
  );
}

function RequestsList() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_requests")
      .select("*")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    if (error) toast.error(error.message);
    setRequests((data as AdminRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const approve = async (req: AdminRequest) => {
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: req.user_id, role: "admin" });
    if (roleErr && !roleErr.message.includes("duplicate")) {
      toast.error(roleErr.message);
      return;
    }
    const { error } = await supabase
      .from("admin_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        review_notes: notes[req.id] ?? null,
      })
      .eq("id", req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${req.full_name} agora é admin`);
    load();
  };

  const reject = async (req: AdminRequest) => {
    if (!notes[req.id] || notes[req.id].trim().length < 5) {
      toast.error("Informe uma nota explicando a rejeição (mín. 5 caracteres)");
      return;
    }
    const { error } = await supabase
      .from("admin_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        review_notes: notes[req.id],
      })
      .eq("id", req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Solicitação rejeitada");
    load();
  };

  if (loading) return <div className="text-muted-foreground tracking-widest text-sm">CARREGANDO...</div>;
  if (requests.length === 0)
    return (
      <div className="bg-secondary border border-border p-8 text-center text-sm tracking-widest uppercase text-muted-foreground">
        Nenhuma solicitação pendente
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {requests.map((req) => (
        <div key={req.id} className="bg-secondary border border-border p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <div>
              <div className="font-display font-bold text-foreground uppercase tracking-wider">{req.full_name}</div>
              <div className="text-xs text-muted-foreground">{req.email}</div>
            </div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
              {new Date(req.requested_at).toLocaleString("pt-BR")}
            </div>
          </div>
          <div className="text-sm text-foreground bg-background border border-border p-3 whitespace-pre-wrap">
            {req.justification}
          </div>
          <textarea
            placeholder="Nota de revisão (obrigatória para rejeitar)"
            value={notes[req.id] ?? ""}
            onChange={(e) => setNotes({ ...notes, [req.id]: e.target.value })}
            rows={2}
            className="w-full bg-background border border-border p-2 text-xs text-foreground focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => reject(req)}
              className="border border-destructive text-destructive px-3 py-2 text-xs font-bold tracking-widest uppercase hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" /> REJEITAR
            </button>
            <button
              onClick={() => approve(req)}
              className="bg-primary text-primary-foreground px-3 py-2 text-xs font-bold tracking-widest uppercase hover:opacity-90 flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> APROVAR
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminsList() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, granted_at")
      .eq("role", "admin");
    if (!roles || roles.length === 0) {
      setAdmins([]);
      setLoading(false);
      return;
    }
    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    const merged = roles.map((r) => {
      const p = profiles?.find((p) => p.id === r.user_id);
      return {
        user_id: r.user_id,
        email: p?.email ?? "—",
        full_name: p?.full_name ?? null,
        granted_at: r.granted_at,
      };
    });
    setAdmins(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (a: AdminUser) => {
    if (a.user_id === user?.id) {
      toast.error("Você não pode revogar a si mesmo");
      return;
    }
    if (!confirm(`Revogar admin de ${a.full_name ?? a.email}?`)) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", a.user_id)
      .eq("role", "admin");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Admin revogado");
    load();
  };

  if (loading) return <div className="text-muted-foreground tracking-widest text-sm">CARREGANDO...</div>;

  return (
    <div className="flex flex-col gap-2">
      {admins.map((a) => (
        <div key={a.user_id} className="bg-secondary border border-border p-3 flex items-center justify-between gap-2">
          <div>
            <div className="font-display font-bold text-foreground uppercase tracking-wider text-sm">
              {a.full_name ?? a.email} {a.user_id === user?.id && <span className="text-primary text-[10px]">(VOCÊ)</span>}
            </div>
            <div className="text-xs text-muted-foreground">{a.email}</div>
          </div>
          <button
            onClick={() => revoke(a)}
            disabled={a.user_id === user?.id}
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Revogar admin"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AuditList() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTable, setFilterTable] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (filterTable) q = q.eq("table_name", filterTable);
      const { data, error } = await q;
      if (error) toast.error(error.message);
      setEntries((data as AuditEntry[]) ?? []);
      setLoading(false);
    })();
  }, [filterTable]);

  const tables = ["", "equipment", "deliveries", "invoices", "user_roles", "admin_requests"];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        {tables.map((t) => (
          <button
            key={t || "all"}
            onClick={() => setFilterTable(t)}
            className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase border ${
              filterTable === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t || "TODAS"}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-muted-foreground tracking-widest text-sm">CARREGANDO...</div>
      ) : entries.length === 0 ? (
        <div className="bg-secondary border border-border p-6 text-center text-xs tracking-widest uppercase text-muted-foreground">
          Sem registros
        </div>
      ) : (
        <div className="bg-secondary border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border">
              <tr className="text-[10px] tracking-widest uppercase text-muted-foreground">
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Usuário</th>
                <th className="text-left p-2">Ação</th>
                <th className="text-left p-2">Tabela</th>
                <th className="text-left p-2">Registro</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/50 last:border-0">
                  <td className="p-2 text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-2 text-foreground">{e.user_email ?? "—"}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold tracking-widest ${
                        e.action === "INSERT"
                          ? "bg-primary/20 text-primary"
                          : e.action === "DELETE"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-accent text-foreground"
                      }`}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="p-2 text-foreground">{e.table_name}</td>
                  <td className="p-2 text-muted-foreground font-mono text-[10px]">{e.record_id?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
