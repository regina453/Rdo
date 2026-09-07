# Controle Financeiro Pessoal — AppSheet + Google Sheets

App para lançar receitas, despesas e investimentos das suas contas (Nubank, Banco do Brasil, Itaú e dinheiro), categorizar tudo, controlar compras parceladas e despesas fixas, e acompanhar mensalmente a saúde financeira — direto do celular.

## Como funciona

- **`Controle_Financeiro_AppSheet.xlsx`** — planilha modelo já pronta com as abas, colunas, fórmulas e formatação que o app vai usar. É a "fonte de dados" (o banco de dados) do AppSheet.
- **AppSheet** é o app em si (formulário para lançar gastos, listas, dashboard, automações). Ele não guarda dados — ele lê e escreve nesta planilha, que precisa estar no **Google Sheets**.
- Ao lançar uma compra parcelada uma única vez, uma automação (Bot) do AppSheet já gera sozinha as linhas das parcelas futuras.
- Todo mês, a aba **Resumo_Mensal** mostra receitas, despesas, investimentos, saldo e taxa de poupança já realizados; a aba **Previsao_Mensal** mostra quanto você já sabe que vai precisar ter reservado nos próximos meses (parcelas futuras + contas fixas).

## Abas da planilha

| Aba | Para que serve |
|---|---|
| `Contas` | Suas contas (Nubank, BB, Itaú, Carteira, Investimentos). |
| `Categorias` | Categorias de receita/despesa/investimento. |
| `Lancamentos` | Tabela principal — cada linha é um lançamento (ou uma parcela). |
| `Despesas_Fixas` | Contas semi-fixas recorrentes (aluguel, água, luz, internet...). |
| `Numeros_Auxiliar` | Tabela técnica (1 a 60), usada só pela automação de parcelamento — não mexer. |
| `Resumo_Mensal` | Fechamento mensal do que **já aconteceu** (só lançamentos com Status = Realizado). |
| `Previsao_Mensal` | Quanto você precisa **ter reservado** mês a mês (parcelas futuras + contas fixas). |
| `Orcamento` | Limite de gasto por categoria x gasto real no mês. |

## Passo 1 — Subir a planilha para o Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com) → **Arquivo → Importar → Upload** e envie `Controle_Financeiro_AppSheet.xlsx` (ou arraste o arquivo para o Google Drive e abra com Google Sheets).
2. Confirme "Substituir planilha" na importação, para virar um Google Sheets nativo (não deixe como .xlsx dentro do Drive — o AppSheet funciona melhor com Sheets nativo).
3. Revise a aba **Contas**: ajuste nomes/saldos iniciais das suas contas reais (Nubank, BB, Itaú, Carteira/dinheiro).
4. Revise a aba **Categorias**: já vem com ~30 categorias comuns — adicione, renomeie ou remova como quiser.
5. Revise a aba **Despesas_Fixas**: ajuste os valores esperados de aluguel, condomínio, luz, água e internet para os seus valores reais.
6. Apague as linhas de exemplo da aba **Lancamentos** (LC0001 a LC0008) quando for começar a usar de verdade — ou mantenha por enquanto para testar o app (elas mostram, inclusive, como fica uma compra parcelada em 3x).

## Passo 2 — Criar o app no AppSheet

1. Acesse [appsheet.com](https://www.appsheet.com) com a mesma conta Google → **Create → App → Start with existing data**.
2. Selecione a planilha que você acabou de subir. O AppSheet vai importar as abas como tabelas.
3. Em **Data → Tables**, marque `Resumo_Mensal` e `Previsao_Mensal` como **read-only** (só leitura) — são 100% calculadas por fórmula.

### Configurar a tabela `Lancamentos` (a mais importante)

Vá em **Data → Columns** da tabela `Lancamentos` e ajuste:

| Coluna | Tipo no AppSheet | Configuração |
|---|---|---|
| `ID_Lancamento` | Text | Marcar como **Key**, Initial value: `UNIQUEID()` |
| `Data` | Date | Initial value: `TODAY()` |
| `Tipo` | Enum | Valores: `Receita`, `Despesa`, `Investimento`, `Transferência` |
| `Conta` | Enum (ref) | Valid values: `SELECT(Contas[Nome_Conta], [Ativa]="Sim")` |
| `Categoria` | Enum (ref) | Valid values: `SELECT(Categorias[Nome_Categoria], [Tipo]=[_THISROW].[Tipo])` — só aparecem categorias compatíveis com o Tipo escolhido |
| `Valor` | Price/Number | Obrigatório, > 0. **Para compras parceladas, é o valor de cada parcela**, não o total da compra |
| `Forma_Pagamento` | Enum | `Débito`, `Crédito`, `Pix`, `Dinheiro`, `Boleto`, `Transferência` |
| `Parcela_Atual` | Number | Default `1` |
| `Total_Parcelas` | Number | Default `1` — quando > 1, a automação abaixo gera as parcelas seguintes sozinha |
| `ID_Compra` | Text | Deixe em branco no formulário (`Show` = ON só para consulta); a automação preenche sozinha |
| `Status` | Enum | Valores: `Realizado`, `Previsto`. Initial value: `"Realizado"` (quem lança manualmente já debitou/recebeu; as parcelas futuras geradas pela automação recebem `Previsto` automaticamente) |
| `Recorrente` | Yes/No | Para despesas fixas lançadas manualmente |
| `Mes_Referencia` | Text | Marcar **Show = OFF** (calculada pela planilha, não editar) |

Isso já te dá um formulário de lançamento rápido: escolhe o tipo, a conta, a categoria (filtrada pelo tipo), o valor e a forma de pagamento — funciona bem no celular, inclusive para gastos em dinheiro na hora.

### Parcelamento automático (a parte que você pediu)

Ideia: você lança a compra **uma única vez**, com o valor da parcela e o número total de parcelas (ex: R$ 100,00 em 3x). Um Bot do AppSheet gera sozinho as próximas parcelas como linhas `Previsto`, já com a data certa (mês seguinte, e assim por diante), e assim elas já entram na previsão de gastos futuros (aba `Previsao_Mensal`) sem você precisar lançar mês a mês.

Crie em **Automation → Bots → New Bot**:

1. **Event**: tabela `Lancamentos`, evento **Adds** (quando uma linha é adicionada).
2. **Condition** (só dispara para a 1ª parcela de compras parceladas): `AND([Total_Parcelas] > 1, [Parcela_Atual] = 1)`
3. **Process**, passo 1 — **"Run a task for each item in a list"**, com a lista:
   ```
   SELECT(Numeros_Auxiliar[Numero], AND([Numero] > 1, [Numero] <= [_THISROW].[Total_Parcelas]))
   ```
   Isso gera a sequência 2, 3, 4... até o total de parcelas (a tabela `Numeros_Auxiliar` cobre compras de até 60x).
4. Dentro desse loop, passo 2 — **"Add a new row to Lancamentos"**, preenchendo:
   - `ID_Lancamento`: `UNIQUEID()`
   - `Data`: `EDATE([_THISROW].[Data], [_THISROW_INNER] - 1)` (soma um mês por parcela)
   - `Tipo`: `[_THISROW].[Tipo]`
   - `Conta`: `[_THISROW].[Conta]`
   - `Categoria`: `[_THISROW].[Categoria]`
   - `Descricao`: `[_THISROW].[Descricao]`
   - `Valor`: `[_THISROW].[Valor]`
   - `Forma_Pagamento`: `[_THISROW].[Forma_Pagamento]`
   - `Parcela_Atual`: `[_THISROW_INNER]`
   - `Total_Parcelas`: `[_THISROW].[Total_Parcelas]`
   - `ID_Compra`: `[_THISROW].[ID_Lancamento]`
   - `Status`: `"Previsto"`
5. Volte na linha original (a 1ª parcela) e, se quiser, adicione uma **Action** simples (ou ajuste via workflow) para preencher o `ID_Compra` dela também com o próprio `ID_Lancamento` — assim todas as parcelas da mesma compra compartilham o mesmo `ID_Compra` e dá pra filtrar/agrupar por compra depois.

Com isso, ao lançar "Tênis, R$ 100,00, 3x": fica 1 linha `Realizado` (a parcela do mês) + 2 linhas `Previsto` já geradas automaticamente (meses seguintes) — é exatamente o que as linhas de exemplo LC0006/07/08 da planilha mostram.

Quando a parcela futura realmente for cobrada no extrato, edite aquela linha e mude `Status` de `Previsto` para `Realizado` (pode virar uma Action de um toque: "Marcar como pago").

### Despesas fixas e previsão de reserva

- Cadastre na aba/tabela **`Despesas_Fixas`** as contas que se repetem todo mês com valor parecido (aluguel, condomínio, água, luz, internet), com o valor esperado atual. Atualize o `Valor_Esperado` sempre que a conta chegar diferente.
- A aba **`Previsao_Mensal`** soma, mês a mês (próximos 12 meses), `Parcelas_Previstas` (parcelas futuras de compras parceladas, Status = Previsto) + `Despesas_Fixas_Previstas` (soma das despesas fixas ativas) = `Total_Reserva_Necessaria`.
- Crie uma view tipo **dashboard/chart** em cima de `Previsao_Mensal` para visualizar quanto precisa estar guardado em cada um dos próximos meses — é o "quanto já sei que vou gastar" antes mesmo de a fatura chegar.

### Views sugeridas

- **Lançar** (form, view principal) → tabela `Lancamentos`, ação rápida de "+" sempre visível.
- **Extrato** (deck ou table) → `Lancamentos` ordenado por Data decrescente, agrupado por Categoria, Conta ou Status (Realizado/Previsto).
- **Resumo do Mês** (dashboard) → `Resumo_Mensal`, com cards de Total_Receitas, Total_Despesas, Total_Investimentos, Saldo_do_Mes e Taxa_de_Poupanca do mês mais recente, e gráfico de Saldo_Acumulado.
- **Previsão** (dashboard/chart) → `Previsao_Mensal`, gráfico de barras de `Total_Reserva_Necessaria` por mês.
- **Orçamento** → `Orcamento`, com destaque de cor (format rule) quando `Status = "Estourado"`.
- **Contas** → `Contas`, mostrando saldo inicial de cada uma.

### Regra de formatação útil (Format Rules)

Na view de **Orçamento**, crie uma format rule: se `[Status] = "Estourado"` → fundo vermelho claro; se `"Dentro do orcado"` → fundo verde claro.

## Passo 3 — Usar no dia a dia

- Toda despesa, receita ou investimento — inclusive em dinheiro — você lança pelo app, na hora ou no fim do dia.
- Escolha sempre a conta certa e a categoria mais específica possível — é isso que faz o relatório mensal ser útil.
- Compra parcelada: lance uma vez só, com o **valor da parcela** e o `Total_Parcelas` — a automação cuida do resto.
- Quando uma parcela `Previsto` for efetivamente cobrada, marque-a como `Realizado`.

## Passo 4 — Ler sua saúde financeira mensal

Na aba **Resumo_Mensal** (só o que já aconteceu, Status = Realizado):

- **Total_Receitas / Total_Despesas / Total_Investimentos** — somados por mês (`Mes_Referencia`, formato AAAA-MM).
- **Saldo_do_Mes** = Receitas − Despesas − Investimentos.
- **Taxa_de_Poupanca** = Saldo_do_Mes ÷ Receitas — quanto (em %) você guardou/investiu sobre o que ganhou.
- **Saldo_Acumulado** — soma progressiva do saldo mês a mês.
- A tabela auxiliar **"Gastos por Categoria - Mês mais recente"** (colunas I e J) mostra onde o dinheiro foi no mês mais atual.

Na aba **Previsao_Mensal** (o que ainda vai acontecer): quanto você precisa ter disponível em cada um dos próximos 12 meses só de parcelas em aberto e contas fixas — antes mesmo delas chegarem.

A aba **Orçamento** compara, por categoria, o que você planejou gastar (`Valor_Orcado`) com o que já gastou de fato no mês corrente (`Valor_Gasto`, só Status = Realizado).

## Observações

- `Resumo_Mensal`, `Previsao_Mensal` e `Orcamento` são 100% calculadas a partir de `Lancamentos`/`Despesas_Fixas` — não edite as fórmulas dessas abas, só lance dados em `Lancamentos` e ajuste `Valor_Orcado`/`Despesas_Fixas`.
- Os dados são fictícios apenas na aba `Lancamentos` (8 linhas de exemplo, incluindo a compra parcelada) — apague-os antes de usar para valer.
- Se quiser um indicador de patrimônio total (contas + investimentos), dá para criar uma coluna extra em `Contas` com o saldo atual (`Saldo_Inicial` + `SUMIFS` dos lançamentos daquela conta, Status = Realizado) e somar tudo numa nova aba.
