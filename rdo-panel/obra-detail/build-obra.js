// Piloto: painel de detalhamento de UMA obra (histórico de relatórios + avanço de atividades)
// Uso: node build-obra.js

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const ROOT = path.join(DIR, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const TOKEN = config.token;
const API = 'https://apiexterna.diariodeobra.app/v1';

// Piloto: UFV - RNEST - Petrobrás - Ipojuca/PE
const OBRA_ID = config.obraPilotoId || '6995a07e73d9d9e83c04fdd4';

async function api(pathname) {
  const res = await fetch(API + pathname, {
    headers: { 'Content-Type': 'application/json', token: TOKEN },
  });
  const json = await res.json();
  if (!res.ok) throw new Error('API error on ' + pathname + ': ' + JSON.stringify(json));
  return json;
}

async function main() {
  const obra = await api(`/obras/${OBRA_ID}`);
  const relatorios = await api(`/obras/${OBRA_ID}/relatorios?limite=10&ordem=desc`);

  const timeline = relatorios.map((r) => ({
    numero: r.numero,
    data: r.data,
    statusId: r.status.id,
    statusDescricao: r.status.descricao,
    criadoPor: r.criadoPor.usuario.nome.trim(),
    criadoHora: r.criadoPor.dataHora,
    modificadoPor: r.modificadoPor ? r.modificadoPor.usuario.nome.trim() : null,
    modificadoHora: r.modificadoPor ? r.modificadoPor.dataHora : r.criadoPor.dataHora,
  }));

  const ultimoId = relatorios[0] && relatorios[0]._id;
  let atividades = [];
  if (ultimoId) {
    const detalhe = await api(`/obras/${OBRA_ID}/relatorios/${ultimoId}`);
    atividades = (detalhe.atividades || []).map((a) => ({
      descricao: a.descricao,
      atual: a.porcentagem,
      anterior: a.porcentagemAnterior,
      status: a.status ? a.status.descricao : null,
    }));
  }

  const obraData = {
    obra: obra.nome.trim(),
    responsavel: timeline[0] ? timeline[0].criadoPor : '—',
    timeline: timeline,
    atividades: atividades,
    syncedAt: new Date().toISOString(),
  };

  const assetsDir = path.join(ROOT, 'assets');
  const readAsset = (f) => fs.readFileSync(path.join(assetsDir, f), 'utf8');

  let tpl = fs.readFileSync(path.join(DIR, 'template-obra.html'), 'utf8');
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
  };
  for (const [placeholder, file] of Object.entries(fontMap)) {
    tpl = tpl.replace(placeholder, readAsset(file));
  }
  tpl = tpl.replace('__OBRA_DATA_JSON__', JSON.stringify(obraData));

  const outPath = path.join(DIR, 'obra-detail-output.html');
  fs.writeFileSync(outPath, tpl);
  console.log('OK —', obraData.obra, '| relatórios:', timeline.length, '| atividades:', atividades.length);
  console.log('Arquivo gerado em:', outPath);
}

main().catch((err) => {
  console.error('Falha ao gerar o detalhamento:', err.message);
  process.exit(1);
});
