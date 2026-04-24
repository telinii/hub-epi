# Plano: Buscar validade dos C.A.s automaticamente

## Diagnóstico

**Problema 1 — Todos aparecem "SEM C.A.":** A coluna `ca_expiry_date` está `NULL` em todos os 46 EPIs. A aba só mostra como válido/vencido quando essa data está preenchida. Logo, o status "SEM C.A." está correto pelos dados — falta popular as datas.

**Problema 2 — Buscar na internet:** Existem EPIs com C.A. real (numérico) e EPIs com placeholder (`Verificar`, `NT`). Apenas os numéricos podem ser consultados.

Validei manualmente que `https://consultaca.com/{numero_ca}` retorna a data de validade no HTML. Exemplos testados:
- C.A. 14235 (Abafador) → válido até **11/10/2029**
- C.A. 44746 (PFF-2) → válido até **13/02/2030**

## Solução

### 1. Edge function `lookup-ca`

Cria `supabase/functions/lookup-ca/index.ts` que recebe `{ ca: string }`, busca em `consultaca.com/{ca}` e devolve:

```ts
{ ca, status: "VÁLIDO" | "VENCIDO" | "NÃO ENCONTRADO", expiry_date: "YYYY-MM-DD" | null, raw_label: string }
```

A extração usa regex no HTML para capturar o bloco **Validade:** (formato `dd/mm/yyyy`) e o bloco **Situação:**. Sem dependência de SDK externo. Tem CORS aberto e `verify_jwt = false`.

### 2. Botão "Atualizar validade via C.A." na aba Validade — C.As

Em `CaValidityTab.tsx`, adicionar (somente admin):

- Botão **"BUSCAR TODOS NA INTERNET"** no topo: percorre todos os EPIs cujo `ca` é puramente numérico, chama a edge function em paralelo (com limite de concorrência ~5) e faz UPDATE em `equipment.ca_expiry_date`. Mostra progresso (`X de Y`) e toast final com resumo (atualizados / não encontrados / inválidos).
- Botão **"BUSCAR"** inline em cada linha da tabela: consulta apenas aquele C.A. e atualiza.
- Para EPIs com C.A. não-numérico (`Verificar`, `NT`), o botão fica desabilitado e a coluna Nota recebe automaticamente `"C.A. não informado"` na primeira execução em massa (sem sobrescrever notas existentes).

### 3. Sem alterações de schema

As colunas `ca_expiry_date` e `ca_status_note` já existem. Apenas serão populadas pela função.

## Arquivos afetados

- **Novo:** `supabase/functions/lookup-ca/index.ts` — scraper de consultaca.com
- **Novo:** `supabase/config.toml` — adicionar bloco `[functions.lookup-ca] verify_jwt = false`
- **Editado:** `src/components/CaValidityTab.tsx` — botão global + botão por linha + lógica de fetch/update

## Detalhes técnicos

- Concorrência limitada (5 req simultâneas) para não derrubar o site.
- Regex de extração: `/Validade:[\s\S]*?(\d{2}\/\d{2}\/\d{4})/` e `/Situação:[\s\S]*?(VÁLIDO|VENCIDO|CANCELADO)/i`.
- Conversão `dd/mm/yyyy` → `yyyy-mm-dd` antes do UPDATE.
- Se `consultaca.com` retornar 404 ou não casar regex → marca `ca_status_note = "C.A. não encontrado"` e `ca_expiry_date = null`.
- Erros de rede individuais não interrompem o lote — são contados no resumo final.

## Observação

`consultaca.com` é uma fonte de terceiros (não-oficial). É a única com URL pública por C.A. e HTML estável. Caso o layout mude no futuro, basta ajustar a regex na edge function.
