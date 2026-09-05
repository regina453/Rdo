# Controle Financeiro Pessoal — AppSheet + Google Sheets

App para lançar receitas, despesas e investimentos das suas contas (Nubank, Banco do Brasil, Itaú e dinheiro), categorizar tudo e acompanhar mensalmente a saúde financeira — direto do celular.

## Como funciona

- **`Controle_Financeiro_AppSheet.xlsx`** — planilha modelo já pronta com as abas, colunas, fórmulas e formatação que o app vai usar. É a "fonte de dados" (o banco de dados) do AppSheet.
- **AppSheet** é o app em si (formulário para lançar gastos, listas, dashboard). Ele não guarda dados — ele lê e escreve nesta planilha, que precisa estar no **Google Sheets**.
- Todo mês, ao abrir a aba **Resumo_Mensal**, você vê receitas, despesas, investimentos, saldo do mês, taxa de poupança e saldo acumulado — calculados automaticamente.

## Passo 1 — Subir a planilha para o Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com) → **Arquivo → Importar → Upload** e envie `Controle_Financeiro_AppSheet.xlsx` (ou arraste o arquivo para o Google Drive e abra com Google Sheets).
2. Confirme "Substituir planilha" na importação, para virar um Google Sheets nativo (não deixe como .xlsx dentro do Drive — o AppSheet funciona melhor com Sheets nativo).
3. Revise a aba **Contas**: ajuste nomes/saldos iniciais das suas contas reais (Nubank, BB, Itaú, Carteira/dinheiro).
4. Revise a aba **Categorias**: já vem com ~30 categorias comuns (moradia, alimentação, transporte, saúde, lazer, assinaturas, investimentos etc.) — adicione, renomeie ou remova como quiser.
5. Apague as 5 linhas de exemplo da aba **Lancamentos** (LC0001 a LC0005) quando for começar a usar de verdade — ou mantenha por enquanto para testar o app.

## Passo 2 — Criar o app no AppSheet

1. Acesse [appsheet.com](https://www.appsheet.com) com a mesma conta Google → **Create → App → Start with existing data**.
2. Selecione a planilha que você acabou de subir. O AppSheet vai importar as 5 abas como tabelas: `Contas`, `Categorias`, `Lancamentos`, `Resumo_Mensal`, `Orcamento`.
3. Em **Data → Tables**, marque `Resumo_Mensal` como **read-only** (só leitura) — ela é 100% calculada por fórmula, não deve ser editada pelo app.

### Configurar a tabela `Lancamentos` (a mais importante)

Vá em **Data → Columns** da tabela `Lancamentos` e ajuste:

| Coluna | Tipo no AppSheet | Configuração |
|---|---|---|
| `ID_Lancamento` | Text | Marcar como **Key**, Initial value: `=CONCATENATE("LC", TEXT(RANDBETWEEN(100000,999999)))` (ou `UNIQUEID()`) |
| `Data` | Date | Initial value: `TODAY()` |
| `Tipo` | Enum | Valores: `Receita`, `Despesa`, `Investimento`, `Transferência` |
| `Conta` | Enum (ref) | Valid values: `SELECT(Contas[Nome_Conta], [Ativa]="Sim")` |
| `Categoria` | Enum (ref) | Valid values: `SELECT(Categorias[Nome_Categoria], [Tipo]=[_THISROW].[Tipo])` — assim só aparecem categorias compatíveis com o Tipo escolhido |
| `Valor` | Price/Number | Obrigatório, > 0 |
| `Forma_Pagamento` | Enum | `Débito`, `Crédito`, `Pix`, `Dinheiro`, `Boleto`, `Transferência` |
| `Parcela_Atual` / `Total_Parcelas` | Number | Default `1` — use para compras parceladas no cartão |
| `Recorrente` | Yes/No | Para despesas fixas (aluguel, assinaturas) |
| `Mes_Referencia` | Text | Marcar como **Show = OFF** (é calculada pela fórmula da planilha, o app não precisa mostrar nem editar) |

Isso já te dá um formulário de lançamento rápido: escolhe o tipo (receita/despesa/investimento), a conta, a categoria (filtrada automaticamente pelo tipo), o valor e a forma de pagamento — funciona muito bem no celular, inclusive para lançar gastos em dinheiro na hora.

### Views sugeridas

- **Lançar** (form, view principal) → tabela `Lancamentos`, ação rápida de "+" sempre visível.
- **Extrato** (deck ou table) → `Lancamentos` ordenado por Data decrescente, com agrupamento por Categoria ou Conta.
- **Resumo do Mês** (dashboard) → tabela `Resumo_Mensal`, mostrando os cards de Total_Receitas, Total_Despesas, Total_Investimentos, Saldo_do_Mes e Taxa_de_Poupanca do mês mais recente. Dá pra usar um gráfico (chart view) de Saldo_Acumulado ao longo dos 12 meses.
- **Orçamento** → tabela `Orcamento`, com destaque de cor (format rule) quando `Status = "Estourado"`.
- **Contas** → tabela `Contas`, mostrando saldo inicial de cada uma (opcional: criar uma coluna virtual de saldo atual = Saldo_Inicial + soma dos lançamentos daquela conta).

### Regra de formatação útil (Format Rules)

Na view de **Orçamento**, crie uma format rule: se `[Status] = "Estourado"` → fundo vermelho claro; se `"Dentro do orcado"` → fundo verde claro. Isso dá um alerta visual imediato de onde você está gastando mais do que planejou.

## Passo 3 — Usar no dia a dia

- Toda despesa, receita ou investimento — inclusive em dinheiro — você lança pelo app, na hora ou no fim do dia.
- Escolha sempre a conta certa (Nubank, BB, Itaú ou Carteira) e a categoria mais específica possível — é isso que faz o relatório mensal ser útil.
- Para compras parceladas, uma opção simples é lançar o valor da parcela (não o total) todo mês, preenchendo `Parcela_Atual`/`Total_Parcelas` para referência.

## Passo 4 — Ler sua saúde financeira mensal

Abra a planilha (ou uma view do app) na aba **Resumo_Mensal**:

- **Total_Receitas / Total_Despesas / Total_Investimentos** — somados automaticamente por mês (`Mes_Referencia`, formato AAAA-MM), com base em tudo que foi lançado.
- **Saldo_do_Mes** = Receitas − Despesas − Investimentos. Positivo é bom sinal; negativo indica que você gastou/investiu mais do que ganhou.
- **Taxa_de_Poupanca** = Saldo_do_Mes ÷ Receitas. É o quanto (em %) você conseguiu guardar/investir sobre o que ganhou — um dos indicadores mais importantes de saúde financeira.
- **Saldo_Acumulado** — soma progressiva do saldo mês a mês, mostrando a tendência (crescendo, estável ou caindo) ao longo do ano.
- A tabela auxiliar **"Gastos por Categoria - Mês mais recente"** (colunas I e J da mesma aba) mostra onde o dinheiro foi para no mês mais atual — ótimo para identificar onde cortar.

A aba **Orçamento** compara, categoria por categoria, o que você planejou gastar (`Valor_Orcado`, editável) com o que realmente gastou no mês corrente (`Valor_Gasto`, automático), sinalizando quando estourou.

## Observações

- Todas as fórmulas de `Resumo_Mensal` e `Orcamento` leem direto da aba `Lancamentos` — não edite essas duas abas manualmente, apenas lance dados em `Lancamentos` (pelo app) e ajuste `Valor_Orcado` em `Orcamento`.
- Os dados são fictícios apenas na aba `Lancamentos` (5 linhas de exemplo) — apague-os antes de usar para valer.
- Se quiser adicionar um 4º indicador (ex: patrimônio total somando saldo das contas + investimentos), dá para criar uma coluna extra em `Contas` com o saldo atual (`Saldo_Inicial` + `SUMIFS` dos lançamentos daquela conta) e depois somar tudo numa nova aba.
