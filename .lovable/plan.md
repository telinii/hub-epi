# Plano: Gestão de Baixas + Aba Validade C.A.

## 1. Edição/exclusão de baixas (admins)

Na `DeliveriesTab.tsx`, na tabela de histórico:

- Nova coluna **Ações** visível só para admins (via `<RequireAdmin>`).
- Botão **Editar** abre dialog com:
  - Campo de data/hora (input `datetime-local`) pré-preenchido com `delivered_at`.
  - Campo de observação editável.
  - Salva via `UPDATE deliveries SET delivered_at, notes WHERE id`.
- Botão **Excluir** abre `AlertDialog` de confirmação:
  - Exclui a baixa (`DELETE FROM deliveries`).
  - **Devolve a quantidade ao estoque**: `UPDATE equipment SET quantity = quantity + <qtd da baixa>`.
  - Tudo em sequência com rollback visual via toast em caso de erro.

No formulário de **registrar baixa**, adicionar campo opcional **"Data/hora da entrega"** (`datetime-local`):

- Default = agora.
- Se preenchido, envia `delivered_at` no insert (sobrescreve o default `now()` do banco).
- Visível para todos os usuários (útil para registrar baixa retroativa).

**Permissões:** RLS já permite UPDATE/DELETE só para admins — nada a mudar no banco.

## 2. Nova aba "Validade C.A."

### Estrutura

- Novo arquivo `src/components/CaValidityTab.tsx`.
- Registrar na sidebar (`AppSidebar.tsx`) e nav mobile (`MobileNav.tsx`) com ícone `ShieldCheck` — visível para **todos os usuários autenticados**.
- Adicionar rota/aba em `Index.tsx`.

### Schema do banco

Adicionar 2 colunas em `equipment`:

- `ca_expiry_date DATE NULL` — data de validade do C.A.
- `ca_status_note TEXT NULL` — nota livre (ex: "sem C.A.", "em renovação").

Migração via tool de migração.

Atualizar `EquipmentFormDialog.tsx` para incluir esses campos (admins).

### UI da aba

Layout em duas seções:

**a) Consulta rápida (topo)**

- Combobox de busca por nome/código/C.A. (mesmo padrão de `DeliveriesTab`).
- Card resultado mostrando: nome, código, C.A., e **status grande**:
  - Verde "VÁLIDO — faltam X dias" se `ca_expiry_date > hoje`.
  - Vermelho "VENCIDO há X dias" se `ca_expiry_date < hoje`.
  - Amarelo "VENCE EM BREVE" se ≤ 30 dias.
  - Cinza "SEM C.A." (auto) ou texto de `ca_status_note` se sem data.

**b) Tabela completa (abaixo)**

- Lista todos EPIs com: Nome | C.A. | Validade | Status (badge colorido) | Dias restantes | Nota.
- Ordenada por proximidade do vencimento (vencidos no topo).
- Filtros: **Todos / Válidos / Vence em ≤30d / Vencidos / Sem C.A.**
- Para admins: botão "Editar validade" inline abre mini-dialog para setar `ca_expiry_date` e `ca_status_note` rapidamente sem abrir o form completo do EPI.

### Lógica de status (helper)

```ts
function getCaStatus(expiry: string | null, note: string | null) {
  if (!expiry) return { label: note || "SEM C.A.", variant: "muted", days: null };
  const days = differenceInDays(parseISO(expiry), new Date());
  if (days < 0) return { label: `VENCIDO HÁ ${-days}D`, variant: "destructive", days };
  if (days <= 30) return { label: `VENCE EM ${days}D`, variant: "warning", days };
  return { label: `VÁLIDO — ${days}D`, variant: "success", days };
}
```

## Arquivos afetados

- `supabase/migrations/...` — adicionar colunas `ca_expiry_date`, `ca_status_note` em `equipment`.
- `src/components/DeliveriesTab.tsx` — campo de data, botões editar/excluir, dialogs.
- `src/components/EquipmentFormDialog.tsx` — campos novos.
- `src/components/CaValidityTab.tsx` — **novo**.
- `src/components/AppSidebar.tsx`, `src/components/MobileNav.tsx`, `src/pages/Index.tsx` — registrar aba.