// ── State ──────────────────────────────────────────────────────────────────
let records    = JSON.parse(localStorage.getItem('cnc_docs') || '[]');
let chartSituacaoInst = null, chartFaixaInst = null, chartEnquadramentoInst = null;
let chartTrechoInst   = null, chartEmpresasInst = null, chartEvolucaoInst = null;
let sortCol    = -1;
let sortDir    = 1;
let editIndex  = -1;
let filterText = '';
let currentPage = 1;
let perPage     = 15;

// ── Inbox ──────────────────────────────────────────────────────────────────
let inbox = JSON.parse(localStorage.getItem('cnc_inbox') || '[]');

function saveInbox() { localStorage.setItem('cnc_inbox', JSON.stringify(inbox)); }

function pushNotification(text, color) {
  inbox.unshift({ text, color, time: new Date().toLocaleString('pt-BR') });
  if (inbox.length > 100) inbox = inbox.slice(0, 100);
  saveInbox();
  renderInbox();
}

function renderInbox() {
  const list  = document.getElementById('inboxList');
  const badge = document.getElementById('inboxBadge');
  if (!list) return;
  if (inbox.length === 0) {
    list.innerHTML = '<div class="inbox-empty">Nenhuma notificação</div>';
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'flex';
  badge.textContent = inbox.length > 99 ? '99+' : inbox.length;
  list.innerHTML = inbox.map(n => `
    <div class="inbox-item">
      <div class="inbox-item-dot" style="background:${n.color}"></div>
      <div class="inbox-item-body">
        <div class="inbox-item-text">${n.text}</div>
        <div class="inbox-item-time">${n.time}</div>
      </div>
    </div>
  `).join('');
}

function toggleInbox() { document.getElementById('inboxPanel').classList.toggle('open'); }

function clearInbox() { inbox = []; saveInbox(); renderInbox(); }

document.addEventListener('click', e => {
  const wrap = document.querySelector('.inbox-btn-wrap');
  if (wrap && !wrap.contains(e.target))
    document.getElementById('inboxPanel')?.classList.remove('open');
});

// ── Auto-computed fields ───────────────────────────────────────────────────
function computeAutoFields(r) {
  if (r.dataCorrecao && r.dataLimite) {
    const c = new Date(r.dataCorrecao + 'T00:00:00');
    const l = new Date(r.dataLimite   + 'T00:00:00');
    r.diasAtraso = Math.round((c - l) / 86400000);
  } else {
    r.diasAtraso = '';
  }
  r.correcaoPrazo = r.diasAtraso === '' ? '' : (r.diasAtraso <= 0 ? 'SIM' : 'NÃO');
}

// ── Field definitions (drives edit modal) ─────────────────────────────────
const FIELDS = [
  { id: 'codigo',            label: 'Código',                               type: 'text' },
  { id: 'dataRegistro',      label: 'Data Registro',                        type: 'date' },
  { id: 'contratado',        label: 'Contratado',                           type: 'text' },
  { id: 'respInspecao',      label: 'Responsável pela Inspeção',            type: 'text' },
  { id: 'instanciaEmitente', label: 'Instância Emitente',                   type: 'text' },
  { id: 'tema',              label: 'Tema',                                 type: 'text' },
  { id: 'local',             label: 'Local',                                type: 'text' },
  { id: 'trecho',            label: 'Trecho',                               type: 'text' },
  { id: 'origemNC',          label: 'Origem da Não Conformidade',           type: 'text' },
  { id: 'areaTecnica',       label: 'Área Técnica Responsável',             type: 'text' },
  { id: 'dataDistribuicao',  label: 'Data Distribuição NC',                 type: 'date' },
  { id: 'descricaoNC',       label: 'Descrição da Não Conformidade',        type: 'textarea', wide: true },
  { id: 'enquadramento',     label: 'Enquadramento da NC',                  type: 'select',
    options: ['','LEG','CTR','VEG','FAU','ERS','DRE','ASS','EST','ATM','EMR','RES','EFL','COM','SST','SVI','SOC','MEX','MMO','EQP','FRM','INS','TRB'] },
  { id: 'diretrizCorrecoes', label: 'Diretriz para Correções',              type: 'textarea', wide: true },
  { id: 'dataLimite',        label: 'Data Limite de Atendimento',           type: 'date' },
  { id: 'descricaoAcoes',    label: 'Descrição das Ações de Correção',      type: 'textarea', full: true },
  { id: 'dataCorrecao',      label: 'Data Correção',                        type: 'date' },
  { id: 'dataEncerramento',  label: 'Data Encerramento NC',                 type: 'date' },
  { id: 'statusNC',          label: 'Status NC',                            type: 'select',
    options: ['','ABERTA','EM ANDAMENTO','FECHADA'] },
  { id: 'respIdentificacao', label: 'Responsável pela Identificação',       type: 'text' },
  { id: 'faixaIntervalo',    label: 'Faixa de Intervalo',                   type: 'select',
    options: ['','0','1 a 2','3 a 5','6 a 10','11 a 20','21 a 30','Superior a 30'] },
  { id: 'acaoCorretiva',     label: 'Ação Corretiva Executada a Contento?', type: 'select',
    options: ['','SIM','NÃO'] },
];

// ── Form helpers ───────────────────────────────────────────────────────────
function getFormValues() {
  const g = id => document.getElementById(id);
  return {
    codigo:            g('codigo').value.trim(),
    dataRegistro:      g('dataRegistro').value,
    contratado:        g('contratado').value.trim(),
    respInspecao:      g('respInspecao').value.trim(),
    instanciaEmitente: g('instanciaEmitente').value.trim(),
    tema:              g('tema').value.trim(),
    local:             g('local').value.trim(),
    trecho:            g('trecho').value.trim(),
    origemNC:          g('origemNC').value.trim(),
    areaTecnica:       g('areaTecnica').value.trim(),
    dataDistribuicao:  g('dataDistribuicao').value,
    descricaoNC:       g('descricaoNC').value.trim(),
    enquadramento:     g('enquadramento').value,
    diretrizCorrecoes: g('diretrizCorrecoes').value.trim(),
    dataLimite:        g('dataLimite').value,
    descricaoAcoes:    g('descricaoAcoes').value.trim(),
    dataCorrecao:      g('dataCorrecao').value,
    dataEncerramento:  g('dataEncerramento').value,
    statusNC:          g('statusNC').value,
    respIdentificacao: g('respIdentificacao').value.trim(),
    faixaIntervalo:    g('faixaIntervalo').value,
    acaoCorretiva:     g('acaoCorretiva').value,
  };
}

function addRecord() {
  const r = getFormValues();
  if (!r.codigo && !r.contratado && !r.dataRegistro) {
    showToast('⚠ Preencha ao menos Código, Contratado ou Data Registro', '#f0c060');
    return;
  }
  computeAutoFields(r);
  records.push(r);
  save();
  clearForm();
  renderTable();
  showToast('✓ Registro adicionado com sucesso');
}

function clearForm() {
  ['codigo','dataRegistro','contratado','respInspecao','instanciaEmitente',
   'tema','local','trecho','origemNC','areaTecnica','dataDistribuicao',
   'descricaoNC','enquadramento','diretrizCorrecoes','dataLimite',
   'descricaoAcoes','dataCorrecao','dataEncerramento','statusNC',
   'respIdentificacao','faixaIntervalo','acaoCorretiva'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('editHint').textContent = '';
}

// ── CRUD ───────────────────────────────────────────────────────────────────
function deleteRecord(i) {
  if (!confirm('Remover este registro?')) return;
  records.splice(i, 1);
  save();
  renderTable();
  showToast('Registro removido', '#f06060');
}

function openEdit(i) {
  editIndex = i;
  const r    = records[i];
  const grid = document.getElementById('modalFormGrid');

  grid.innerHTML = FIELDS.map(f => {
    const val = r[f.id] !== undefined ? r[f.id] : '';
    let input = '';

    if (f.type === 'select') {
      const opts = f.options.map(o =>
        `<option${o === val ? ' selected' : ''}>${o}</option>`
      ).join('');
      input = `<select id="edit_${f.id}">${opts}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="edit_${f.id}" style="min-height:80px">${val}</textarea>`;
    } else {
      input = `<input type="${f.type}" id="edit_${f.id}" value="${val}">`;
    }

    const cls = (f.full ? ' full' : f.wide ? ' wide' : '');
    return `<div class="field-group${cls}"><label>${f.label}</label>${input}</div>`;
  }).join('');

  // Show computed fields as read-only
  const diasVal = r.diasAtraso !== undefined && r.diasAtraso !== '' ? r.diasAtraso : '—';
  const prazoVal = r.correcaoPrazo || '—';
  grid.innerHTML += `
    <div class="field-group">
      <label>Dias de Atraso (calculado)</label>
      <input type="text" value="${diasVal}" disabled style="opacity:0.6;cursor:not-allowed">
    </div>
    <div class="field-group">
      <label>Correção no Prazo? (calculado)</label>
      <input type="text" value="${prazoVal}" disabled style="opacity:0.6;cursor:not-allowed">
    </div>
  `;

  document.getElementById('editModal').classList.add('open');
}

function saveEdit() {
  const r = {};
  FIELDS.forEach(f => {
    r[f.id] = document.getElementById('edit_' + f.id).value;
    if (f.type !== 'select' && f.type !== 'date') r[f.id] = r[f.id].trim();
  });
  computeAutoFields(r);
  records[editIndex] = r;
  save();
  renderTable();
  closeModal();
  showToast('✓ Registro atualizado');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
  editIndex = -1;
}

// ── Search & Sort ──────────────────────────────────────────────────────────
function filterTable() {
  filterText = document.getElementById('searchInput').value.toLowerCase();
  renderTable();
}

function sortTable(col) {
  const ths = document.querySelectorAll('th');
  ths.forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
  sortDir = (sortCol === col) ? sortDir * -1 : 1;
  sortCol = col;
  ths[col].classList.add(sortDir === 1 ? 'sorted-asc' : 'sorted-desc');
  renderTable();
}

// ── Render ─────────────────────────────────────────────────────────────────
const KEYS = [
  'codigo','dataRegistro','contratado','respInspecao','instanciaEmitente',
  'tema','local','trecho','origemNC','areaTecnica',
  'dataDistribuicao','descricaoNC','enquadramento','diretrizCorrecoes',
  'dataLimite','descricaoAcoes','dataCorrecao','dataEncerramento',
  'statusNC','respIdentificacao','diasAtraso','faixaIntervalo',
  'correcaoPrazo','acaoCorretiva'
];

function getRowValues(r) { return KEYS.map(k => r[k]); }

function statusNCBadge(s) {
  if (!s) return '<span style="color:var(--text-dimmer)">—</span>';
  const map = { 'ABERTA': 'aberta', 'EM ANDAMENTO': 'em_andamento', 'FECHADA': 'fechada' };
  const cls = map[s] || 'aberta';
  return `<span class="badge badge-${cls}">${s}</span>`;
}

function boolBadge(v) {
  if (!v) return '<span style="color:var(--text-dimmer)">—</span>';
  const cls = v === 'SIM' ? 'sim' : 'nao';
  return `<span class="badge badge-${cls}">${v}</span>`;
}

function diasAtrasoCell(v) {
  if (v === '' || v === undefined || v === null)
    return '<span style="color:var(--text-dimmer)">—</span>';
  const n = Number(v);
  const color = n <= 0 ? '#006830' : '#c2200a';
  const text  = n > 0 ? `+${n}` : String(n);
  return `<span style="color:${color};font-weight:600;font-family:'IBM Plex Mono',monospace">${text}</span>`;
}

function formatDate(val) {
  if (!val) return '—';
  const [y, m, d] = val.split('-');
  return (d && m && y) ? `${d}/${m}/${y}` : val;
}

function esc(s) { return (s || '').toString().replace(/"/g, '&quot;'); }

function renderTable() {
  const tbody = document.getElementById('tableBody');

  let filtered = records.filter(r => {
    if (!filterText) return true;
    return getRowValues(r).some(v => (v !== undefined && v !== null ? String(v) : '').toLowerCase().includes(filterText));
  });

  if (sortCol >= 0) {
    filtered.sort((a, b) => {
      if (sortCol === 20) { // diasAtraso — numeric
        const an = (a.diasAtraso === '' || a.diasAtraso === undefined) ? -Infinity : Number(a.diasAtraso);
        const bn = (b.diasAtraso === '' || b.diasAtraso === undefined) ? -Infinity : Number(b.diasAtraso);
        return (an - bn) * sortDir;
      }
      const av = (a[KEYS[sortCol]] !== undefined ? String(a[KEYS[sortCol]]) : '');
      const bv = (b[KEYS[sortCol]] !== undefined ? String(b[KEYS[sortCol]]) : '');
      return av.localeCompare(bv, 'pt-BR') * sortDir;
    });
  }

  document.getElementById('totalCount').textContent = records.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="25">
        <div class="empty-state">
          <div class="empty-icon">${filterText ? '🔍' : '⚠️'}</div>
          <p>${filterText
            ? `Nenhum resultado para "${filterText}".`
            : 'Nenhum registro encontrado.<br>Preencha o formulário acima para adicionar não conformidades.'
          }</p>
        </div>
      </td></tr>`;
    renderPagination(0, 0);
    return;
  }

  const totalFiltered = filtered.length;
  const totalPages    = Math.ceil(totalFiltered / perPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1)          currentPage = 1;

  const start = (currentPage - 1) * perPage;
  const end   = Math.min(start + perPage, totalFiltered);
  const paged = filtered.slice(start, end);

  tbody.innerHTML = paged.map(r => {
    const realIdx = records.indexOf(r);
    const c = getRowValues(r); // c[0..23]
    return `<tr>
      <td data-tip="${esc(c[0])}">${c[0]||'—'}</td>
      <td>${formatDate(c[1])}</td>
      <td data-tip="${esc(c[2])}">${c[2]||'—'}</td>
      <td data-tip="${esc(c[3])}">${c[3]||'—'}</td>
      <td data-tip="${esc(c[4])}">${c[4]||'—'}</td>
      <td data-tip="${esc(c[5])}">${c[5]||'—'}</td>
      <td data-tip="${esc(c[6])}">${c[6]||'—'}</td>
      <td data-tip="${esc(c[7])}">${c[7]||'—'}</td>
      <td data-tip="${esc(c[8])}">${c[8]||'—'}</td>
      <td data-tip="${esc(c[9])}">${c[9]||'—'}</td>
      <td>${formatDate(c[10])}</td>
      <td data-tip="${esc(c[11])}">${c[11]||'—'}</td>
      <td style="text-align:center;font-weight:600">${c[12]||'—'}</td>
      <td data-tip="${esc(c[13])}">${c[13]||'—'}</td>
      <td>${formatDate(c[14])}</td>
      <td data-tip="${esc(c[15])}">${c[15]||'—'}</td>
      <td>${formatDate(c[16])}</td>
      <td>${formatDate(c[17])}</td>
      <td>${statusNCBadge(c[18])}</td>
      <td data-tip="${esc(c[19])}">${c[19]||'—'}</td>
      <td style="text-align:center">${diasAtrasoCell(r.diasAtraso)}</td>
      <td>${c[21]||'—'}</td>
      <td>${boolBadge(c[22])}</td>
      <td>${boolBadge(c[23])}</td>
      <td><div class="td-actions">
        <button class="btn-edit"   onclick="openEdit(${realIdx})">editar</button>
        <button class="btn-delete" onclick="deleteRecord(${realIdx})">excluir</button>
      </div></td>
    </tr>`;
  }).join('');

  document.querySelector('.table-wrapper').scrollTop = 0;
  renderPagination(totalFiltered, totalPages, start, end);
}

function renderPagination(total, totalPages, start, end) {
  const info     = document.getElementById('paginationInfo');
  const controls = document.getElementById('paginationControls');
  if (total === 0) { info.innerHTML = ''; controls.innerHTML = ''; return; }

  info.innerHTML = `Exibindo <strong>${start + 1}–${end}</strong> de <strong>${total}</strong> registros`;

  let pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages = [1];
    if (currentPage > 3) pages.push('…');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  controls.innerHTML =
    `<button class="btn-page" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>` +
    pages.map(p =>
      p === '…'
        ? `<span style="padding:5px 4px;color:var(--text-dimmer);font-size:12px">…</span>`
        : `<button class="btn-page ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`
    ).join('') +
    `<button class="btn-page" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
}

function goToPage(page) { currentPage = page; renderTable(); }

function changePerPage(val) { perPage = parseInt(val); currentPage = 1; renderTable(); }

// ── Export ─────────────────────────────────────────────────────────────────
const EXPORT_HEADERS = [
  'Código','Data Registro','Contratado','Resp. Inspeção','Instância Emitente',
  'Tema','Local','Trecho','Origem da NC','Área Técnica',
  'Data Dist. NC','Descrição da NC','Enquadramento NC','Diretriz p/ Correções',
  'Data Limite','Ações de Correção','Data Correção','Data Encerramento NC',
  'Status NC','Resp. Identificação','Dias de Atraso','Faixa de Intervalo',
  'Correção no Prazo?','Ação Corretiva a Contento?'
];

const DATE_KEYS = new Set(['dataRegistro','dataDistribuicao','dataLimite','dataCorrecao','dataEncerramento']);

function getExportRows() {
  return records.map(r => KEYS.map(k => {
    if (DATE_KEYS.has(k)) return formatDate(r[k]);
    const v = r[k];
    return (v !== undefined && v !== null) ? String(v) : '';
  }));
}

function toggleExportMenu() {
  document.getElementById('exportMenu').classList.toggle('open');
}

document.addEventListener('click', e => {
  const dd = document.getElementById('exportDropdown');
  if (dd && !dd.contains(e.target))
    document.getElementById('exportMenu').classList.remove('open');
});

function exportExcel() {
  if (records.length === 0) { showToast('Sem dados para exportar', '#f0c060'); return; }
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...getExportRows()]);

  ws['!cols'] = [10,12,20,18,18,14,14,10,20,18,14,28,12,26,14,28,12,14,14,18,10,14,12,18].map(w => ({ wch: w }));

  EXPORT_HEADERS.forEach((_, i) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'C2610C' } },
        alignment: { horizontal: 'center' }
      };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Não Conformidades');
  XLSX.writeFile(wb, 'nao_conformidades_' + new Date().toISOString().slice(0,10) + '.xlsx');
  showToast('✓ Excel exportado');
}

function exportPDF() {
  if (records.length === 0) { showToast('Sem dados para exportar', '#f0c060'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  const date = new Date().toLocaleDateString('pt-BR');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(61, 24, 5);
  doc.text('Controle de Não Conformidades', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(124, 58, 10);
  doc.text(`Gerado em ${date} — ${records.length} registro${records.length !== 1 ? 's' : ''}`, 14, 22);

  const STATUS_COLORS = {
    'ABERTA':       [194, 32, 10],
    'EM ANDAMENTO': [146, 64, 14],
    'FECHADA':      [0, 104, 48],
  };

  doc.autoTable({
    head: [EXPORT_HEADERS],
    body: getExportRows(),
    startY: 27,
    styles: {
      font: 'helvetica',
      fontSize: 6,
      cellPadding: 2,
      valign: 'middle',
      textColor: [61, 24, 5],
      lineColor: [240, 208, 168],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [194, 97, 12],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [255, 249, 242] },
    columnStyles: {
      0:  { cellWidth: 10 },  // Código
      1:  { cellWidth: 14 },  // Data Registro
      2:  { cellWidth: 20 },  // Contratado
      3:  { cellWidth: 18 },  // Resp. Inspeção
      4:  { cellWidth: 18 },  // Instância Emitente
      5:  { cellWidth: 14 },  // Tema
      6:  { cellWidth: 14 },  // Local
      7:  { cellWidth: 10 },  // Trecho
      8:  { cellWidth: 20 },  // Origem NC
      9:  { cellWidth: 18 },  // Área Técnica
      10: { cellWidth: 14 },  // Data Dist. NC
      11: { cellWidth: 26 },  // Descrição NC
      12: { cellWidth: 10 },  // Enquadramento
      13: { cellWidth: 24 },  // Diretriz
      14: { cellWidth: 14 },  // Data Limite
      15: { cellWidth: 26 },  // Ações Correção
      16: { cellWidth: 14 },  // Data Correção
      17: { cellWidth: 14 },  // Data Encerramento
      18: { cellWidth: 14 },  // Status NC
      19: { cellWidth: 18 },  // Resp. Identificação
      20: { cellWidth: 10 },  // Dias Atraso
      21: { cellWidth: 14 },  // Faixa Intervalo
      22: { cellWidth: 12 },  // Correção Prazo
      23: { cellWidth: 16 },  // Ação Corretiva
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 18) {
        const col = STATUS_COLORS[data.cell.text[0]];
        if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = 'bold'; }
      }
      if (data.section === 'body' && data.column.index === 20) {
        const v = parseInt(data.cell.text[0]);
        if (!isNaN(v)) {
          data.cell.styles.textColor = v <= 0 ? [0,104,48] : [194,32,10];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 6, right: 6 },
  });

  doc.save('nao_conformidades_' + new Date().toISOString().slice(0,10) + '.pdf');
  showToast('✓ PDF exportado');
}

// ── Clear Table ────────────────────────────────────────────────────────────
function clearTable() {
  if (records.length === 0) { showToast('A tabela já está vazia', '#6b7280'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:300;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;
  `;
  overlay.innerHTML = `
    <div style="
      background:#fff;border:1px solid #f0d0a8;border-radius:8px;
      padding:36px 40px;max-width:420px;width:90%;text-align:center;
      box-shadow:0 20px 60px rgba(0,0,0,0.15);
    ">
      <div style="font-size:36px;margin-bottom:16px;">⚠️</div>
      <p style="font-family:'Syne',sans-serif;font-weight:700;font-size:18px;
        color:#3d1805;margin-bottom:10px;">Limpar todos os registros?</p>
      <p style="font-family:'IBM Plex Mono',monospace;font-size:12px;
        color:#7c3a0a;line-height:1.6;margin-bottom:28px;">
        Esta ação irá remover <strong>${records.length} registro${records.length !== 1 ? 's' : ''}</strong> permanentemente.<br>Esta operação não pode ser desfeita.</p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button id="confirmClearBtn" style="
          font-family:'Syne',sans-serif;font-weight:700;font-size:13px;
          letter-spacing:1px;text-transform:uppercase;
          background:#b91c1c;color:#fff;border:none;
          padding:12px 28px;border-radius:4px;cursor:pointer;">✕ Sim, limpar tudo</button>
        <button id="cancelClearBtn" style="
          font-family:'IBM Plex Mono',monospace;font-size:12px;
          color:#7c3a0a;background:transparent;
          border:1px solid #f0d0a8;padding:11px 20px;
          border-radius:4px;cursor:pointer;">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('confirmClearBtn').onclick = () => {
    records = []; save(); renderTable();
    document.body.removeChild(overlay);
    showToast('Tabela limpa com sucesso', '#6b7280');
  };
  document.getElementById('cancelClearBtn').onclick = () => document.body.removeChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
}

// ── Persist ────────────────────────────────────────────────────────────────
function save() { localStorage.setItem('cnc_docs', JSON.stringify(records)); }

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, color = 'var(--accent)') {
  const t = document.getElementById('toast');
  t.style.background = color;
  t.style.color = '#fff';
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Excel Import ───────────────────────────────────────────────────────────
function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Find header row
      let headerRowIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const s = rows[i].join('|').toUpperCase();
        if (s.includes('CODIGO') || s.includes('CÓDIGO') || s.includes('CONTRATADO') || s.includes('STATUS NC')) {
          headerRowIdx = i; break;
        }
      }
      if (headerRowIdx === -1) { showToast('⚠ Cabeçalho não encontrado', '#b91c1c'); return; }

      function normalizeHeader(h) {
        return (h == null ? '' : h.toString()).trim().toUpperCase()
          .normalize('NFD')
          .split('').filter(c => { const n = c.charCodeAt(0); return n < 0x0300 || n > 0x036F; }).join('')
          .replace(/\s*\(\d+\)\s*/g, '')
          .replace(/[:?]+$/, '')
          .replace(/[^A-Z0-9\s\/\.]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const headers = rows[headerRowIdx].map(normalizeHeader);

      const COL_MAP = {
        'CODIGO':                                     'codigo',
        'DATA REGISTRO':                              'dataRegistro',
        'CONTRATADO':                                 'contratado',
        'RESPONSAVEL PELA INSPECAO':                  'respInspecao',
        'RESP INSPECAO':                              'respInspecao',
        'RESP. INSPECAO':                             'respInspecao',
        'INSTANCIA EMITENTE':                         'instanciaEmitente',
        'TEMA':                                       'tema',
        'LOCAL':                                      'local',
        'TRECHO':                                     'trecho',
        'ORIGEM DA NAO CONFORMIDADE':                 'origemNC',
        'ORIGEM DA NC':                               'origemNC',
        'AREA TECNICA RESPONSAVEL':                   'areaTecnica',
        'AREA TECNICA':                               'areaTecnica',
        'DATA DISTRIBUICAO NC':                       'dataDistribuicao',
        'DATA DIST NC':                               'dataDistribuicao',
        'DATA DIST. NC':                              'dataDistribuicao',
        'DESCRICAO DA NAO CONFORMIDADE':              'descricaoNC',
        'DESCRICAO DA NC':                            'descricaoNC',
        'ENQUADRAMENTO DA NC':                        'enquadramento',
        'ENQUADRAMENTO NC':                           'enquadramento',
        'DIRETRIZ PARA CORRECOES':                    'diretrizCorrecoes',
        'DIRETRIZ P/ CORRECOES':                      'diretrizCorrecoes',
        'DATA LIMITE DE ATENDIMENTO':                 'dataLimite',
        'DATA LIMITE':                                'dataLimite',
        'DESCRICAO DAS ACOES DE CORRECAO EFETUADAS':  'descricaoAcoes',
        'DESCRICAO DAS ACOES CORRECAO EFETUADAS':     'descricaoAcoes',
        'ACOES DE CORRECAO':                          'descricaoAcoes',
        'DATA CORRECAO':                              'dataCorrecao',
        'DATA ENCERRAMENTO NC':                       'dataEncerramento',
        'STATUS NC':                                  'statusNC',
        'RESPONSAVEL PELA IDENTIFICACAO':             'respIdentificacao',
        'RESP IDENTIFICACAO':                         'respIdentificacao',
        'RESP. IDENTIFICACAO':                        'respIdentificacao',
        'DIAS DE ATRASO':                             'diasAtraso',
        'FAIXA DE INTERVALO':                         'faixaIntervalo',
        'CORRECAO DENTRO DO PRAZO':                   'correcaoPrazo',
        'CORRECAO NO PRAZO':                          'correcaoPrazo',
        'ACAO CORRETIVA EXECUTADA A CONTENTO':        'acaoCorretiva',
        'ACAO CORRETIVA A CONTENTO':                  'acaoCorretiva',
      };

      // Normalize COL_MAP keys the same way so comparison is apples-to-apples
      const normalizedCOL_MAP = {};
      Object.entries(COL_MAP).forEach(([k, v]) => { normalizedCOL_MAP[normalizeHeader(k)] = v; });

      const colToField = {};
      headers.forEach((h, i) => {
        if (!h) return;
        // Exact match first, then try stripping all non-alpha as last resort
        const match = normalizedCOL_MAP[h]
          || normalizedCOL_MAP[h.replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g,' ').trim()];
        if (match) colToField[i] = match;
      });

      function toISO(val) {
        if (!val || val === '-') return '';
        if (val instanceof Date) {
          return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,'0')}-${String(val.getDate()).padStart(2,'0')}`;
        }
        if (typeof val === 'number') {
          const d = XLSX.SSF.parse_date_code(val);
          if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
        }
        return String(val).trim();
      }

      const DATE_FIELDS = new Set(['dataRegistro','dataDistribuicao','dataLimite','dataCorrecao','dataEncerramento']);
      let imported = 0, skipped = 0;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(c => c === '' || c === null || c === undefined)) continue;

        const r = {};
        KEYS.forEach(k => { r[k] = ''; });

        Object.entries(colToField).forEach(([ci, field]) => {
          const raw = row[ci];
          if (raw === undefined || raw === null || raw === '' || raw === '-') return;
          if (DATE_FIELDS.has(field)) { r[field] = toISO(raw); }
          else if (field === 'statusNC') {
            const s = String(raw).trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (s.includes('FECHAD')) r[field] = 'FECHADA';
            else if (s.includes('ANDAMENTO')) r[field] = 'EM ANDAMENTO';
            else if (s.includes('ABERTO') || s.includes('ABERTA')) r[field] = 'ABERTA';
            else r[field] = String(raw).trim();
          }
          else { r[field] = String(raw).trim(); }
        });

        if (!r.codigo && !r.contratado && !r.dataRegistro) { skipped++; continue; }

        // Recalculate computed fields from imported data
        computeAutoFields(r);
        records.push(r);
        imported++;
      }

      save();
      renderTable();
      event.target.value = '';
      showToast(`✓ ${imported} registros importados${skipped ? ` (${skipped} ignorados)` : ''}`);
    } catch (err) {
      console.error(err);
      showToast('⚠ Erro ao ler o arquivo Excel', '#b91c1c');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Painel ─────────────────────────────────────────────────────────────────
function commonTooltipOpts(unit) {
  return {
    backgroundColor: '#3d1805',
    titleFont: { family: 'Syne', size: 12, weight: '700' },
    bodyFont:  { family: 'IBM Plex Mono', size: 12 },
    padding: 10,
    callbacks: {
      label: ctx => {
        const v = ctx.parsed.y !== undefined ? ctx.parsed.y
                : ctx.parsed.x !== undefined ? ctx.parsed.x
                : ctx.raw;
        return `  ${v} ${unit}`;
      }
    }
  };
}

function drawBarLabels(chart, horizontal) {
  const ctx2 = chart.ctx;
  chart.data.datasets.forEach((dataset, i) => {
    chart.getDatasetMeta(i).data.forEach((bar, j) => {
      const val = dataset.data[j];
      if (!val) return;
      ctx2.save();
      ctx2.font = 'bold 10px "Syne", sans-serif';
      if (horizontal) {
        ctx2.textAlign = 'right'; ctx2.textBaseline = 'middle';
        ctx2.fillStyle = '#ffffff';
        ctx2.fillText(val, bar.x - 4, bar.y);
      } else {
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'bottom';
        ctx2.fillStyle = typeof dataset.backgroundColor === 'string'
          ? dataset.backgroundColor : '#3d1805';
        ctx2.fillText(val, bar.x, bar.y - 4);
      }
      ctx2.restore();
    });
  });
}

function openPainel() {
  if (records.length === 0) { showToast('Nenhum dado para exibir no painel', '#6b7280'); return; }

  const now = new Date();
  document.getElementById('painelDate').textContent =
    now.toLocaleString('pt-BR', { month: 'long' }).toUpperCase() + ' / ' + now.getFullYear();

  const total            = records.length;
  const emAberto         = records.filter(r => r.statusNC === 'ABERTA' || r.statusNC === 'EM ANDAMENTO').length;
  const totalEncerradas  = records.filter(r => r.statusNC === 'FECHADA').length;
  const fechadaNoPrazo   = records.filter(r => r.statusNC === 'FECHADA' && r.correcaoPrazo === 'SIM').length;
  const fechadaForaPrazo = records.filter(r => r.statusNC === 'FECHADA' && r.correcaoPrazo === 'NÃO').length;

  document.getElementById('painelStats').innerHTML = `
    <div class="painel-stats-total">
      <div class="painel-stats-label">Notificações de NC Emitidas</div>
      <div class="painel-stats-value">${total}</div>
    </div>
    <div class="painel-stat-chip" style="border-color:#e07830;background:rgba(224,120,48,0.1)">
      <div class="chip-icon">🔓</div>
      <div class="chip-sub-label" style="color:#e07830">Em Aberto</div>
      <div class="chip-sub-value" style="color:#e07830">${emAberto}</div>
    </div>
    <div class="painel-stat-chip" style="border-color:#006830;background:rgba(0,104,48,0.1)">
      <div class="chip-icon">🔒</div>
      <div class="chip-sub-label" style="color:#006830">Fechadas no Prazo</div>
      <div class="chip-sub-value" style="color:#006830">${fechadaNoPrazo}</div>
    </div>
    <div class="painel-stat-chip" style="border-color:#c2200a;background:rgba(194,32,10,0.1)">
      <div class="chip-icon">🔒</div>
      <div class="chip-sub-label" style="color:#c2200a">Fechadas Fora do Prazo</div>
      <div class="chip-sub-value" style="color:#c2200a">${fechadaForaPrazo}</div>
    </div>
  `;

  [chartSituacaoInst, chartFaixaInst, chartEnquadramentoInst,
   chartTrechoInst, chartEmpresasInst, chartEvolucaoInst]
    .forEach(c => { if (c) c.destroy(); });
  chartSituacaoInst = chartFaixaInst = chartEnquadramentoInst =
    chartTrechoInst = chartEmpresasInst = chartEvolucaoInst = null;

  document.getElementById('painelModal').classList.add('open');

  requestAnimationFrame(() => {
    const openRecs = records.filter(r => r.statusNC === 'ABERTA' || r.statusNC === 'EM ANDAMENTO');
    const pctAberto = total > 0 ? Math.round(emAberto / total * 100) : 0;

    // ── 1: NNC Situação Atual (donut) ──────────────────────────────────────
    const cSit = document.getElementById('chartSituacao');
    cSit.style.width = '100%'; cSit.style.height = '210px';
    chartSituacaoInst = new Chart(cSit.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: [`NC em Aberto — ${pctAberto}%`, `Encerradas — ${100 - pctAberto}%`],
        datasets: [{ data: [emAberto, totalEncerradas],
          backgroundColor: ['#e07830', '#1e3a5f'],
          borderColor: ['#fff9f2', '#fff9f2'], borderWidth: 3 }]
      },
      options: {
        responsive: false, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'IBM Plex Mono', size: 10 }, boxWidth: 12, padding: 10 } },
          tooltip: commonTooltipOpts('nc(s)'),
        }
      }
    });

    // ── 2: NC por Faixa de Intervalo (bar) ────────────────────────────────
    const FAIXA = ['0', '1 a 2', '3 a 5', '6 a 10', '11 a 20', '21 a 30', 'Superior a 30'];
    const faixaCounts = {}; FAIXA.forEach(f => faixaCounts[f] = 0);
    records.forEach(r => {
      if (!r.faixaIntervalo) return;
      const fv = r.faixaIntervalo.toString().trim();
      const key = FAIXA.find(f => f.toLowerCase() === fv.toLowerCase());
      if (key) faixaCounts[key]++;
    });

    const cFaixa = document.getElementById('chartFaixa');
    cFaixa.style.width = '100%'; cFaixa.style.height = '210px';
    chartFaixaInst = new Chart(cFaixa.getContext('2d'), {
      type: 'bar',
      data: {
        labels: FAIXA,
        datasets: [{ data: FAIXA.map(f => faixaCounts[f]),
          backgroundColor: '#c2610c', borderRadius: 5, borderSkipped: false }]
      },
      options: {
        responsive: false, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: commonTooltipOpts('nc(s)') },
        scales: {
          x: { ticks: { font: { family: 'IBM Plex Mono', size: 9 }, color: '#7c3a0a', maxRotation: 30 }, grid: { color: 'rgba(240,208,168,0.4)' } },
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'IBM Plex Mono', size: 10 }, color: '#7c3a0a' }, grid: { color: 'rgba(240,208,168,0.4)' } }
        },
        animation: { onComplete: function() { drawBarLabels(this, false); } }
      }
    });

    // ── 3: Incidência por Tema / Enquadramento (hbar) ─────────────────────
    const ENQUADRAMENTOS = ['LEG','CTR','VEG','FAU','ERS','DRE','ASS','EST','ATM','EMR','RES','EFL','COM','SST','SVI','SOC','MEX','MMO','EQP','FRM','INS','TRB'];
    const enqCounts = {}; ENQUADRAMENTOS.forEach(e => enqCounts[e] = 0);
    records.forEach(r => { if (r.enquadramento) enqCounts[r.enquadramento] = (enqCounts[r.enquadramento] || 0) + 1; });
    const cEnq = document.getElementById('chartEnquadramento');
    cEnq.style.width = '100%'; cEnq.style.height = '290px';
    chartEnquadramentoInst = new Chart(cEnq.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ENQUADRAMENTOS,
        datasets: [{ data: ENQUADRAMENTOS.map(e => enqCounts[e]),
          backgroundColor: '#1e3a5f', borderRadius: 3, barThickness: 14, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y', responsive: false, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: commonTooltipOpts('nc(s)') },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'IBM Plex Mono', size: 10 }, color: '#7c3a0a' }, grid: { color: 'rgba(240,208,168,0.3)' } },
          y: { ticks: { font: { family: 'IBM Plex Mono', size: 10 }, color: '#3d1805' }, grid: { display: false } }
        },
        animation: { onComplete: function() { drawBarLabels(this, true); } }
      }
    });

    // ── 4: Incidência por Vale / Trecho (hbar) ────────────────────────────
    const trechoCounts = {};
    records.forEach(r => { const t = (r.trecho || '').trim(); if (t) trechoCounts[t] = (trechoCounts[t] || 0) + 1; });
    const trechosSorted = Object.entries(trechoCounts).sort((a, b) => b[1] - a[1]);
    const trH = Math.min(290, Math.max(140, trechosSorted.length * 26 + 40));

    const cTr = document.getElementById('chartTrecho');
    cTr.style.width = '100%'; cTr.style.height = trH + 'px';
    chartTrechoInst = new Chart(cTr.getContext('2d'), {
      type: 'bar',
      data: {
        labels: trechosSorted.map(([k]) => k),
        datasets: [{ data: trechosSorted.map(([, v]) => v),
          backgroundColor: '#1e3a5f', borderRadius: 3, barThickness: 16, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y', responsive: false, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: commonTooltipOpts('nc(s)') },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'IBM Plex Mono', size: 10 }, color: '#7c3a0a' }, grid: { color: 'rgba(240,208,168,0.3)' } },
          y: { ticks: { font: { family: 'IBM Plex Mono', size: 10 }, color: '#3d1805' }, grid: { display: false } }
        },
        animation: { onComplete: function() { drawBarLabels(this, true); } }
      }
    });

    // ── 5: NNC por Empresas (donut) ───────────────────────────────────────
    const empresaCounts = {};
    records.forEach(r => { const e = (r.contratado || '').trim() || '(sem empresa)'; empresaCounts[e] = (empresaCounts[e] || 0) + 1; });
    const empresasSorted = Object.entries(empresaCounts).sort((a, b) => b[1] - a[1]);
    const PALETTE = ['#c2610c','#1e3a5f','#92400e','#2a6f9e','#e07830','#3a5f8a','#f5a543','#7c3a0a','#4a94d1','#d4763a'];

    const cEmp = document.getElementById('chartEmpresas');
    cEmp.style.width = '100%'; cEmp.style.height = '210px';
    chartEmpresasInst = new Chart(cEmp.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: empresasSorted.map(([k]) => k),
        datasets: [{ data: empresasSorted.map(([, v]) => v),
          backgroundColor: PALETTE.slice(0, empresasSorted.length),
          borderColor: '#fff9f2', borderWidth: 2 }]
      },
      options: {
        responsive: false, maintainAspectRatio: false, cutout: '50%',
        plugins: {
          legend: { position: 'right', labels: { font: { family: 'IBM Plex Mono', size: 9 }, boxWidth: 10, padding: 8 } },
          tooltip: commonTooltipOpts('nc(s)'),
        }
      }
    });

    // ── 6: Evolução NC por Ano (bar) ──────────────────────────────────────
    const anoCounts = {};
    records.forEach(r => { if (r.dataRegistro) { const a = r.dataRegistro.slice(0, 4); anoCounts[a] = (anoCounts[a] || 0) + 1; } });
    const anosOrdenados = Object.keys(anoCounts).sort();

    const cEv = document.getElementById('chartEvolucao');
    cEv.style.width = '100%'; cEv.style.height = '210px';
    chartEvolucaoInst = new Chart(cEv.getContext('2d'), {
      type: 'bar',
      data: {
        labels: anosOrdenados,
        datasets: [{ data: anosOrdenados.map(a => anoCounts[a]),
          backgroundColor: '#1e3a5f', borderRadius: 6, borderSkipped: false, maxBarThickness: 60 }]
      },
      options: {
        responsive: false, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: commonTooltipOpts('nc(s)') },
        scales: {
          x: { ticks: { font: { family: 'IBM Plex Mono', size: 11 }, color: '#7c3a0a' }, grid: { color: 'rgba(240,208,168,0.35)' } },
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'IBM Plex Mono', size: 11 }, color: '#7c3a0a' }, grid: { color: 'rgba(240,208,168,0.35)' } }
        },
        animation: { onComplete: function() { drawBarLabels(this, false); } }
      }
    });
  });
}

function closePainel() {
  document.getElementById('painelModal').classList.remove('open');
}

// ── Init ───────────────────────────────────────────────────────────────────
document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.getElementById('painelModal').addEventListener('click', function(e) {
  if (e.target === this) closePainel();
});

// ── Tooltip IIFE ───────────────────────────────────────────────────────────
(function () {
  const tip = document.getElementById('cncTooltip');
  let showTimer;
  document.addEventListener('mouseover', function(e) {
    const td = e.target.closest('td[data-tip]');
    if (!td) { clearTimeout(showTimer); tip.style.opacity = '0'; return; }
    const text = (td.getAttribute('data-tip') || '').trim();
    if (!text) { tip.style.opacity = '0'; return; }
    clearTimeout(showTimer);
    tip.textContent = text;
    moveTip(e);
    showTimer = setTimeout(function() { tip.style.opacity = '1'; }, 280);
  });
  document.addEventListener('mousemove', function(e) {
    if (e.target.closest('td[data-tip]')) moveTip(e);
  });
  document.addEventListener('mouseout', function(e) {
    if (e.target.closest('td[data-tip]')) { clearTimeout(showTimer); tip.style.opacity = '0'; }
  });
  function moveTip(e) {
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth  - tip.offsetWidth  - 14) + 'px';
    tip.style.top  = Math.min(e.clientY + 18, window.innerHeight - tip.offsetHeight - 14) + 'px';
  }
})();

renderTable();
renderInbox();

// ── Fixed bottom scrollbar mirror ─────────────────────────────────────────
(function () {
  const mirror      = document.getElementById('scrollMirror');
  const mirrorInner = document.getElementById('scrollMirrorInner');
  const wrapper     = document.querySelector('.table-wrapper');
  let syncing = false;

  function syncMirrorWidth() { mirrorInner.style.width = wrapper.scrollWidth + 'px'; }

  function updateMirrorVisibility() {
    const rect = wrapper.getBoundingClientRect();
    const vis  = rect.top < window.innerHeight && rect.bottom > 0;
    mirror.style.display = (vis && rect.bottom > window.innerHeight) ? 'block' : 'none';
    mirror.style.left  = rect.left  + 'px';
    mirror.style.width = rect.width + 'px';
    syncMirrorWidth();
  }

  mirror.addEventListener('scroll', () => {
    if (syncing) return; syncing = true; wrapper.scrollLeft = mirror.scrollLeft; syncing = false;
  });
  wrapper.addEventListener('scroll', () => {
    if (syncing) return; syncing = true; mirror.scrollLeft = wrapper.scrollLeft; syncing = false;
  });

  window.addEventListener('scroll', updateMirrorVisibility, { passive: true });
  window.addEventListener('resize', updateMirrorVisibility, { passive: true });

  const _origRender = renderTable;
  window.renderTable = function() { _origRender(); requestAnimationFrame(updateMirrorVisibility); };

  requestAnimationFrame(updateMirrorVisibility);
})();
