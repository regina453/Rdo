# Painel RDO — ENGM

Painel que mostra, para cada obra ativa da ENGM, se o RDO (Relatório Diário de Obra) foi criado e **enviado** no dia, quanto tempo levou para ser criado e enviado, e quando foi o último registro. Os dados vêm da API externa do [App Diário de Obra](https://web.diariodeobra.app/).

O painel é publicado como um [Artifact do Claude](https://claude.ai/code/artifacts) — uma página estática que qualquer pessoa com o link acessa de qualquer lugar, sem login. Como a página não busca dados sozinha, ela é regenerada e republicada periodicamente (manualmente ou por uma automação).

## Como funciona

- `rdo-panel/template.html` — o layout do painel (HTML/CSS/JS), com placeholders para fontes, logo e os dados.
- `rdo-panel/assets/` — fontes (Kanit, Lato, Raleway, IBM Plex Mono) e o logo da ENGM, já em base64, prontos para serem embutidos no HTML final.
- `rdo-panel/build.js` — busca os dados reais na API do Diário de Obra e gera `rdo-panel-output.html`, o arquivo final pronto para publicar.
- `rdo-panel/config.json` — **não versionado** (contém o token da API). Veja `config.example.json`.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou mais recente (usa `fetch` nativo).
- Um token JWT da API do Diário de Obra, gerado em **Cadastros → Empresa → Gerar token** dentro do app (precisa ser usuário Administrador).

## Como rodar

```bash
git clone <url-deste-repositorio>
cd rdo-panel
cp config.example.json config.json
```

Edite `config.json` e coloque seu token:

```json
{
  "token": "SEU_TOKEN_JWT_AQUI",
  "artifactUrl": ""
}
```

Depois:

```bash
node build.js
```

Isso gera `rdo-panel-output.html`. Para publicar esse arquivo como um painel acessível por link, use o Claude Code (a ferramenta Artifact) apontando para esse arquivo. Depois de publicado uma vez, salve a URL gerada em `artifactUrl` no `config.json` — assim, execuções futuras do `build.js` (e de qualquer automação) sabem sempre atualizar o mesmo link em vez de criar um novo.

## Lendo o painel

Cada obra é avaliada em três frentes, com cor por severidade (verde = ok, âmbar = atenção, vermelho = crítico):

- **Criação** — quantos dias depois do dia de referência o relatório foi criado.
- **Envio** — quanto tempo levou entre a criação e o relatório sair do status "Preenchendo" (rascunho). Se ainda estiver em rascunho, aparece como não enviado.
- **Status** — veredito combinado: se o RDO de hoje foi enviado, está pendente, ou atrasado.

## Segurança

`config.json` contém um token de acesso à API da empresa e **nunca deve ser commitado**. Ele já está no `.gitignore`. Cada pessoa que clonar o projeto deve gerar seu próprio token.
