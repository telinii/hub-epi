import { useUserRole } from "@/hooks/useUserRole";

export function RequireAdmin({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { isAdmin, loading } = useUserRole();
  if (loading) return null;
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
