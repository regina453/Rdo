// Busca dados reais da API do App Diário de Obra e gera rdo-panel-output.html
// Uso: node build.js

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const TOKEN = config.token;
const API = 'https://apiexterna.diariodeobra.app/v1';

// --- limitador de requisições (limite da API: 150/min por empresa) ---
const callTimestamps = [];
async function waitForSlot() {
  const now = Date.now();
  while (callTimestamps.length && now - callTimestamps[0] > 60000) callTimestamps.shift();
  if (callTimestamps.length >= 100) {
    const waitMs = 60000 - (now - callTimestamps[0]) + 50;
    await new Promise((r) => setTimeout(r, waitMs));
    return waitForSlot();
  }
}

async function api(pathname, attempt) {
  attempt = attempt || 1;
  await waitForSlot();
  callTimestamps.push(Date.now());
  let res;
  try {
    res = await fetch(API + pathname, {
      headers: { 'Content-Type': 'application/json', token: TOKEN },
    });
  } catch (networkErr) {
    // falha transitória de rede (ECONNRESET, timeout, etc) — tenta de novo
    if (attempt <= 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return api(pathname, attempt + 1);
    }
    throw networkErr;
  }
  if (res.status === 429 && attempt <= 4) {
    await new Promise((r) => setTimeout(r, 5000 * attempt));
    return api(pathname, attempt + 1);
  }
  const json = await res.json();
  if (!res.ok) {
    throw new Error('API error on ' + pathname + ': ' + JSON.stringify(json));
  }
  return json;
}

function isTestObra(nome) {
  return /\(teste\)|n[aã]o usar/i.test(nome);
}

function parseBRDate(s) {
  // "DD/MM/YYYY" -> Date (meia-noite)
  const [d, m, y] = s.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function flattenTarefaIds(cronograma) {
  const ids = [];
  for (const etapa of cronograma || []) {
    for (const t of etapa.tarefas || []) ids.push(t._id);
  }
  return ids;
}

// Reconstrói o "Realizado" geral (média do % de cada tarefa) na data de cada relatório do histórico,
// usando o histórico por-tarefa (mesma definição que a API usa para o valor atual).
async function progressoHistorico(obraId, timelineDatas) {
  const cronograma = await api(`/obras/${obraId}/lista-de-tarefas`);
  const tarefaIds = flattenTarefaIds(cronograma.cronograma);

  if (!tarefaIds.length) {
    return {
      totalTarefas: cronograma.totalTarefas,
      naoIniciada: cronograma.totalTarefasNaoIniciada,
      emAndamento: cronograma.totalTarefasEmAndamento,
      concluida: cronograma.totalTarefasConcluida,
      realizadoAtual: cronograma.realizado,
      porData: {},
    };
  }

  const historias = [];
  for (const tarefaId of tarefaIds) {
    const detalhe = await api(`/obras/${obraId}/lista-de-tarefas/${tarefaId}`);
    const hist = (detalhe.relatorios || [])
      .filter((r) => typeof r.porcentagem === 'number')
      .map((r) => ({ date: parseBRDate(r.data), pct: r.porcentagem }))
      .sort((a, b) => a.date - b.date);
    historias.push(hist);
  }

  function pctAsOf(hist, targetDate) {
    let val = 0;
    for (const h of hist) {
      if (h.date <= targetDate) val = h.pct;
      else break;
    }
    return val;
  }

  const porData = {};
  for (const dataStr of timelineDatas) {
    const target = parseBRDate(dataStr);
    const soma = historias.reduce((s, h) => s + pctAsOf(h, target), 0);
    porData[dataStr] = soma / historias.length;
  }

  return {
    totalTarefas: cronograma.totalTarefas,
    naoIniciada: cronograma.totalTarefasNaoIniciada,
    emAndamento: cronograma.totalTarefasEmAndamento,
    concluida: cronograma.totalTarefasConcluida,
    realizadoAtual: cronograma.realizado,
    porData: porData, // { "DD/MM/YYYY": percentualNaquelaData }
  };
}

async function main() {
  const empresa = await api('/empresa');
  const obras = await api('/obras');

  const ativas = obras.filter((o) => o.status.id === 3 && !isTestObra(o.nome));

  const enriched = [];
  for (const obra of ativas) {
    const relatorios = await api(`/obras/${obra._id}/relatorios?limite=10&ordem=desc`);
    const r = relatorios[0];
    if (!r) continue; // obra ativa sem nenhum relatorio ainda

    const timeline = relatorios.map((rr) => ({
      numero: rr.numero,
      data: rr.data,
      statusId: rr.status.id,
      statusDescricao: rr.status.descricao,
      criadoPor: (rr.criadoPor.usuario.nome || '—').trim(),
      criadoHora: rr.criadoPor.dataHora,
      modificadoPor: rr.modificadoPor ? (rr.modificadoPor.usuario.nome || '—').trim() : null,
      modificadoHora: rr.modificadoPor ? rr.modificadoPor.dataHora : rr.criadoPor.dataHora,
    }));

    const progresso = await progressoHistorico(obra._id, timeline.map((t) => t.data));
    for (const t of timeline) {
      t.realizadoNaData = Object.prototype.hasOwnProperty.call(progresso.porData, t.data)
        ? progresso.porData[t.data]
        : null;
    }

    enriched.push({
      nome: obra.nome.trim(),
      numero: r.numero,
      responsavel: (r.criadoPor && r.criadoPor.usuario && r.criadoPor.usuario.nome || '—').trim(),
      data: r.data, // "DD/MM/YYYY" — dia a que o relatório se refere
      dataHora: r.criadoPor.dataHora, // "DD/MM/YYYY HH:mm" — quando foi criado
      modificadoHora: r.modificadoPor ? r.modificadoPor.dataHora : r.criadoPor.dataHora, // última mudança (proxy p/ envio)
      statusId: r.status.id, // 1 = Preenchendo (rascunho, não enviado), 3 = Revisar, 4 = Aprovado
      timeline: timeline, // últimos relatórios, com o % geral reconstruído na data de cada um
      progresso: {
        total: progresso.totalTarefas,
        naoIniciada: progresso.naoIniciada,
        emAndamento: progresso.emAndamento,
        concluida: progresso.concluida,
        realizado: progresso.realizadoAtual,
      },
    });
    console.log('  ...', obra.nome.trim(), 'ok');
  }

  const rdoData = {
    empresa: empresa.nome,
    obras: enriched,
    // contado a partir de /obras (dado ao vivo) em vez de empresa.log, que é um agregado com cache defasado
    concluidas: obras.filter((o) => o.status.id === 4).length,
    paralisadas: obras.filter((o) => o.status.id === 2 && !isTestObra(o.nome)).length,
    syncedAt: new Date().toISOString(),
  };

  const assetsDir = path.join(DIR, 'assets');
  const readAsset = (f) => fs.readFileSync(path.join(assetsDir, f), 'utf8');

  let tpl = fs.readFileSync(path.join(DIR, 'template.html'), 'utf8');
  const fontMap = {
    __FONT_KANIT500__: 'kanit-500.woff2.b64.txt',
    __FONT_KANIT600__: 'kanit-600.woff2.b64.txt',
    __FONT_KANIT700__: 'kanit-700.woff2.b64.txt',
    __FONT_LATO700__: 'lato-700.woff2.b64.txt',
    __FONT_LATO900__: 'lato-900.woff2.b64.txt',
    __FONT_RALEWAY__: 'raleway-var.woff2.b64.txt',
    __FONT_IPM400__: 'ipm-400.woff2.b64.txt',
    __FONT_IPM500__: 'ipm-500.woff2.b64.txt',
    __LOGO_LIGHT__: 'engm-logo-header.png.b64.txt',
    __LOGO_DARK__: 'engm-logo-white.png.b64.txt',
  };
  for (const [placeholder, file] of Object.entries(fontMap)) {
    tpl = tpl.replace(placeholder, readAsset(file));
  }
  tpl = tpl.replace('__RDO_DATA_JSON__', JSON.stringify(rdoData));

  const outPath = path.join(DIR, 'rdo-panel-output.html');
  fs.writeFileSync(outPath, tpl);
  console.log('OK — obras ativas:', enriched.length, '| concluidas:', rdoData.concluidas, '| paralisadas:', rdoData.paralisadas);
  console.log('Arquivo gerado em:', outPath);
}

main().catch((err) => {
  console.error('Falha ao gerar o painel:', err.message);
  process.exit(1);
});
