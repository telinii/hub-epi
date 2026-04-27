# Plano: Fluxo otimizado de baixas em sequência

## Análise das suas duas opções

**Opção 1 — Acumular todas as baixas de vários funcionários e enviar tudo de uma vez:**

- Vantagem: 1 única operação no banco
- Desvantagens reais:
  - Se algo falhar no meio (rede cair, erro em 1 item), você perde TODO o trabalho acumulado
  - Estoque só é validado no envio final → risco de descobrir falta de EPI depois de já ter "registrado" visualmente várias entregas
  - UI fica complexa (lista de funcionários × lista de EPIs cada um)
  - Risco de erro humano alto (esquecer de enviar, fechar a aba, etc.)
- **Sobre "sobrecarregar o banco":** isso é um não-problema. O Supabase aguenta tranquilamente milhares de inserts por segundo. Uma baixa por funcionário é absolutamente trivial.

**Opção 2 — Manter o fluxo atual, mas o funcionário fica "fixado" após a baixa:**

- Cada baixa é independente e segura (se uma falhar, as outras já estão salvas)
- Estoque validado a cada operação (sem surpresas)
- Mais rápido na prática: você só troca de funcionário quando precisa
- Histórico mais limpo (cada baixa = 1 evento real no tempo)

## Recomendação: Opção 2

É a mais segura, mais rápida no uso real, e a "sobrecarga" da Opção 1 é imaginária. Vamos implementar com melhorias para deixar o fluxo o mais ágil possível.

## O que vai mudar em `DeliveriesTab.tsx`

### 1. Funcionário permanece selecionado após processar baixa

No `onSuccess` do `deliverMutation`, em vez de resetar o `employeeId`, mantê-lo. Resetar apenas:

- `cart` (limpar carrinho)
- `notes` (limpar observação)
- `deliveredAt` (atualizar para o horário atual)

### 2. Indicador visual de "funcionário fixado"

Após a primeira baixa, mostrar um badge/chip ao lado do nome do funcionário com:

- Texto tipo: "✓ Funcionário fixado — continue adicionando baixas"
- Botão pequeno **"Trocar funcionário"** (ícone X) que limpa a seleção

### 3. Botão "Limpar tudo"

Botão secundário ao lado do "PROCESSAR BAIXA" que limpa funcionário + carrinho + observação, para quando terminar com aquele funcionário e quiser começar do zero (alternativa ao "Trocar funcionário").

### 4. Toast melhorado

Mensagem de sucesso muda para: *"Baixa registrada — pronto para próximo EPI de [Nome]"* enquanto o funcionário estiver fixado.

### 5. Foco automático

Após processar a baixa, focar automaticamente o seletor de EPI (`pickEquipment`) para acelerar a próxima entrada.

## Arquivos afetados

- `src/components/DeliveriesTab.tsx` — apenas ajustes no `onSuccess`, adicionar badge de funcionário fixado, botão trocar/limpar e auto-foco.

Nenhuma mudança de banco de dados. Nenhuma migração. Mudança contida em um único arquivo.  
  
  
========================================================================  
Nota: Implemente as duas opções, é melhor ter as duas doque apenas uma que seja bem vantajosa, quero experienciar ambas para depois decidir qual de fato implementar.

========================================================================