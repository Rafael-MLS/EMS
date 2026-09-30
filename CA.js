// ── State ──────────────────────────────────────────────────────────────────
let records    = JSON.parse(localStorage.getItem('ca_docs') || '[]');

function safeUrl(url) {
  if (!url) return '';
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}
let sortCol    = -1;
let sortDir    = 1;
let editIndex  = -1;
let filterText = '';
let currentPage = 1;
let perPage     = 15;

// ── Inbox ──────────────────────────────────────────────────────────────────
let inbox = JSON.parse(localStorage.getItem('ca_inbox') || '[]');

function saveInbox() { localStorage.setItem('ca_inbox', JSON.stringify(inbox)); }

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

// ── Field definitions ──────────────────────────────────────────────────────
const FIELDS = [
  { id: 'unidade',         label: 'Unidade / Obra',          type: 'text' },
  { id: 'entidade',        label: 'Entidade Responsável',    type: 'text' },
  { id: 'correspavel',     label: 'Entidade Corresponsável', type: 'text' },
  { id: 'docAutorizativo', label: 'Documento Autorizativo',  type: 'text' },
  { id: 'numDoc',          label: 'Nº Documento',            type: 'text' },
  { id: 'emitente',        label: 'Emitente',                type: 'text' },
  { id: 'docAnexo',        label: 'Documento Anexo',         type: 'text' },
  { id: 'status',          label: 'Condicionante',            type: 'text' },
];

const KEYS = FIELDS.map(f => f.id);

// Status is free-text — no fixed labels map needed

// ── Form helpers ───────────────────────────────────────────────────────────
function getFormValues() {
  const r = {};
  FIELDS.forEach(f => { r[f.id] = document.getElementById(f.id)?.value.trim() || ''; });
  return r;
}

function addRecord() {
  const r = getFormValues();
  if (!r.unidade && !r.numDoc && !r.docAutorizativo) {
    showToast('⚠ Preencha ao menos Unidade, Nº Documento ou Documento Autorizativo', '#f0c060');
    return;
  }
  records.push(r);
  save();
  clearForm();
  renderTable();
  showToast('✓ Registro adicionado com sucesso');
}

function clearForm() {
  FIELDS.forEach(f => { const el = document.getElementById(f.id); if (el) el.value = ''; });
  document.getElementById('editHint').textContent = '';
}

// ── CRUD ───────────────────────────────────────────────────────────────────
function deleteRecord(i) {
  if (!confirm('Remover este registro?')) return;
  records.splice(i, 1);
  save();
  renderTable();
  showToast('Registro removido', '#b91c1c');
}

function openEdit(i) {
  editIndex = i;
  const r    = records[i];
  const grid = document.getElementById('modalFormGrid');

  grid.innerHTML = FIELDS.map(f => {
    const val = r[f.id] || '';
    let input = '';
    if (f.type === 'select') {
      const opts = f.options.map(o =>
        `<option value="${o.value}"${o.value === val ? ' selected' : ''}>${o.label}</option>`
      ).join('');
      input = `<select id="edit_${f.id}">${opts}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="edit_${f.id}" style="min-height:70px">${val}</textarea>`;
    } else {
      input = `<input type="text" id="edit_${f.id}" value="${val}">`;
    }
    const wide = '';
    return `<div class="field-group${wide}"><label>${f.label}</label>${input}</div>`;
  }).join('');

  document.getElementById('editModal').classList.add('open');
}

function saveEdit() {
  const r = {};
  FIELDS.forEach(f => { r[f.id] = document.getElementById('edit_' + f.id)?.value.trim() || ''; });
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
  currentPage = 1;
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
function statusBadge(s) {
  if (!s) return '<span style="color:var(--text-dimmer)">—</span>';
  return `<span class="badge badge-custom">${s}</span>`;
}

function getRowValues(r) { return KEYS.map(k => r[k]); }

function renderTable() {
  const tbody = document.getElementById('tableBody');

  let filtered = records.filter(r => {
    if (!filterText) return true;
    return getRowValues(r).some(v => (v || '').toLowerCase().includes(filterText));
  });

  if (sortCol >= 0) {
    filtered.sort((a, b) => {
      const av = (a[KEYS[sortCol]] || '').toString();
      const bv = (b[KEYS[sortCol]] || '').toString();
      return av.localeCompare(bv, 'pt-BR') * sortDir;
    });
  }

  document.getElementById('totalCount').textContent = records.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="empty-icon">${filterText ? '🔍' : '🌿'}</div>
        <p>${filterText ? `Nenhum resultado para "${filterText}".` : 'Nenhum registro encontrado.<br>Preencha o formulário acima para adicionar condicionantes.'}</p>
      </div></td></tr>`;
    renderPagination(0, 0, 0, 0);
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
    const realIdx   = records.indexOf(r);
    const cols      = getRowValues(r);
    const condCount = (r.condicionantes || []).length;
    return `<tr>
      <td data-tip="${cols[0]||''}">${cols[0]||'—'}</td>
      <td data-tip="${cols[1]||''}">${cols[1]||'—'}</td>
      <td data-tip="${cols[2]||''}">${cols[2]||'—'}</td>
      <td data-tip="${cols[3]||''}">${cols[3]||'—'}</td>
      <td data-tip="${cols[4]||''}">${cols[4]||'—'}</td>
      <td data-tip="${cols[5]||''}">${cols[5]||'—'}</td>
      <td style="text-align:center">${cols[6] ? `<a href="${safeUrl(cols[6])}" target="_blank" rel="noopener" class="btn-anexo" title="${cols[6]}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></a>` : '<span style="color:var(--text-dimmer)">—</span>'}</td>
      <td style="text-align:center"><button class="btn-list-icon${condCount > 0 ? ' has-items' : ''}" onclick="openCondicionantesModal(${realIdx})" title="${condCount > 0 ? condCount + ' condicionante(s)' : 'Ver condicionantes'}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="0.8" fill="currentColor"/><circle cx="3" cy="12" r="0.8" fill="currentColor"/><circle cx="3" cy="18" r="0.8" fill="currentColor"/></svg>${condCount > 0 ? '<span class="cond-count">' + condCount + '</span>' : ''}</button></td>
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
    pages.map(p => p === '…'
      ? `<span style="padding:5px 4px;color:var(--text-dimmer);font-size:12px">…</span>`
      : `<button class="btn-page ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`
    ).join('') +
    `<button class="btn-page" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
}

function goToPage(page) { currentPage = page; renderTable(); }
function changePerPage(val) { perPage = parseInt(val); currentPage = 1; renderTable(); }

// ── Persistence ────────────────────────────────────────────────────────────
function save() { localStorage.setItem('ca_docs', JSON.stringify(records)); }

// ── Export headers & rows ──────────────────────────────────────────────────
const EXPORT_HEADERS = [
  'Unidade / Obra','Entidade Responsável','Entidade Corresponsável',
  'Documento Autorizativo','Nº Documento','Emitente',
  'Documento Anexo','Condicionante'
];

function getExportRows() {
  return records.map(r => KEYS.map(k => r[k] || ''));
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
  ws['!cols'] = [28,22,22,28,20,16,24,28].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Condicionantes');
  XLSX.writeFile(wb, 'condicionantes_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  showToast('✓ Excel exportado');
}

function exportPDF() {
  if (records.length === 0) { showToast('Sem dados para exportar', '#f0c060'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  const date = new Date().toLocaleDateString('pt-BR');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(13, 45, 26);
  doc.text('Condicionantes Ambientais', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(58, 106, 74);
  doc.text(`Gerado em ${date} — ${records.length} registro${records.length !== 1 ? 's' : ''}`, 14, 22);

  const STATUS_COLORS_PDF = {
    'Em Atendimento': [26,122,60],
    'Atendido':       [22,101,52],
    'Pendente':       [146,97,10],
    'Não Iniciado':   [107,114,128],
    'Em Análise':     [0,119,182],
    'Não Aplicável':  [138,170,196],
  };

  doc.autoTable({
    head: [EXPORT_HEADERS],
    body: getExportRows(),
    startY: 27,
    styles: {
      font: 'helvetica', fontSize: 7, cellPadding: 2.5,
      valign: 'middle', textColor: [13, 45, 26],
      lineColor: [178, 216, 191], lineWidth: 0.2, overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [26, 122, 60], textColor: [255, 255, 255],
      fontStyle: 'bold', fontSize: 7.5, halign: 'center',
    },
    alternateRowStyles: { fillColor: [240, 247, 242] },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40 },
      2: { cellWidth: 40 },
      3: { cellWidth: 50 },
      4: { cellWidth: 36 },
      5: { cellWidth: 26 },
      6: { cellWidth: 50 },
      7: { cellWidth: 50 },
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 7) {
        const col = STATUS_COLORS_PDF[data.cell.text[0]];
        if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = 'bold'; }
      }
    },
    margin: { left: 8, right: 8 },
  });

  doc.save('condicionantes_' + new Date().toISOString().slice(0, 10) + '.pdf');
  showToast('✓ PDF exportado');
}

// ── Condicionantes Sub-table ───────────────────────────────────────────────
let currentCondRecordIdx = -1;
let currentCondEditIdx   = -1;

const COND_FIELDS = [
  { id: 'documento',        label: 'Documento',                     type: 'text' },
  { id: 'condicionante',    label: 'Condicionantes / Exigências',   type: 'textarea', wide: true },
  { id: 'prazo',            label: 'Prazo Execução / Próx. Evento', type: 'text' },
  { id: 'status',           label: 'Status',                        type: 'text' },
  { id: 'obs',              label: 'OBS',                           type: 'textarea', wide: true },
  { id: 'docComprobatorio', label: 'Documentos Comprobatórios',     type: 'textarea', wide: true },
];

function openCondicionantesModal(recordIdx) {
  currentCondRecordIdx = recordIdx;
  if (!records[recordIdx].condicionantes) records[recordIdx].condicionantes = [];
  const r = records[recordIdx];
  const h = r.condHeader || {};
  document.getElementById('condModalTitle').textContent =
    [h.unidade, h.numDoc].filter(Boolean).join(' — ') || 'Condicionantes';
  renderCondHeader();
  renderCondicionantesTable();
  document.getElementById('condModal').classList.add('open');
}

function closeCondicionantesModal() {
  document.getElementById('condModal').classList.remove('open');
  currentCondRecordIdx = -1;
}

function renderCondHeader() {
  const h = records[currentCondRecordIdx].condHeader || {};
  function v(val) { return (val || '').replace(/"/g, '&quot;'); }
  document.getElementById('condHeaderForm').innerHTML = `
    <div class="cond-header-grid">
      <div class="cond-header-field cond-hf-full">
        <label>Nome do Projeto</label>
        <input type="text" id="ch_nomeProjeto" value="${v(h.nomeProjeto)}" oninput="saveCondHeader()" placeholder="Ex: Projeto Novo Mané Dendê">
      </div>
      <div class="cond-header-field cond-hf-full">
        <label>Unidade / Obra</label>
        <input type="text" id="ch_unidade" value="${v(h.unidade)}" oninput="saveCondHeader()" placeholder="Ex: Saneamento e Urbanização">
      </div>
      <div class="cond-header-field">
        <label>Documento Autorizativo</label>
        <input type="text" id="ch_docAutorizativo" value="${v(h.docAutorizativo)}" oninput="saveCondHeader()" placeholder="Ex: Licença de Demolição">
      </div>
      <div class="cond-header-field">
        <label>Nº Documento Autorizativo</label>
        <input type="text" id="ch_numDoc" value="${v(h.numDoc)}" oninput="saveCondHeader()" placeholder="Ex: Atestado nº 261-2024">
      </div>
      <div class="cond-header-field">
        <label>Data Publicação</label>
        <input type="text" id="ch_dataPublicacao" value="${v(h.dataPublicacao)}" oninput="saveCondHeader()" placeholder="Ex: 21/11/2024">
      </div>
      <div class="cond-header-field">
        <label>Validade</label>
        <input type="text" id="ch_validade" value="${v(h.validade)}" oninput="saveCondHeader()" placeholder="Ex: 21/10/2025">
      </div>
      <div class="cond-header-field">
        <label>Entidade Responsável</label>
        <input type="text" id="ch_entidade" value="${v(h.entidade)}" oninput="saveCondHeader()" placeholder="Ex: SEINFRA">
      </div>
      <div class="cond-header-field">
        <label>Entidade Coresponsável</label>
        <input type="text" id="ch_correspavel" value="${v(h.correspavel)}" oninput="saveCondHeader()" placeholder="Ex: Consórcio Construtor Mané Dendê">
      </div>
    </div>`;
}

function saveCondHeader() {
  const r = records[currentCondRecordIdx];
  if (!r.condHeader) r.condHeader = {};
  r.condHeader.nomeProjeto    = document.getElementById('ch_nomeProjeto')?.value    || '';
  r.condHeader.unidade        = document.getElementById('ch_unidade')?.value        || '';
  r.condHeader.docAutorizativo= document.getElementById('ch_docAutorizativo')?.value|| '';
  r.condHeader.numDoc         = document.getElementById('ch_numDoc')?.value         || '';
  r.condHeader.dataPublicacao = document.getElementById('ch_dataPublicacao')?.value || '';
  r.condHeader.validade       = document.getElementById('ch_validade')?.value       || '';
  r.condHeader.entidade       = document.getElementById('ch_entidade')?.value       || '';
  r.condHeader.correspavel    = document.getElementById('ch_correspavel')?.value    || '';
  save();
  const h = r.condHeader;
  document.getElementById('condModalTitle').textContent =
    [h.unidade, h.numDoc].filter(Boolean).join(' — ') || 'Condicionantes';
}

function renderCondicionantesTable() {
  const items = records[currentCondRecordIdx].condicionantes || [];
  const tbody = document.getElementById('condTableBody');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>Nenhuma condicionante registrada.<br>Clique em "＋ Adicionar" para inserir.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item, i) => `
    <tr>
      <td data-tip="${(item.documento||'').replace(/"/g,'&quot;')}">${item.documento || '—'}</td>
      <td data-tip="${(item.condicionante||'').replace(/"/g,'&quot;')}">${item.condicionante || '—'}</td>
      <td data-tip="${(item.prazo||'').replace(/"/g,'&quot;')}">${item.prazo || '—'}</td>
      <td data-tip="${(item.status||'').replace(/"/g,'&quot;')}">${item.status || '—'}</td>
      <td data-tip="${(item.obs||'').replace(/"/g,'&quot;')}">${item.obs || '—'}</td>
      <td data-tip="${(item.docComprobatorio||'').replace(/"/g,'&quot;')}">${item.docComprobatorio || '—'}</td>
      <td><div class="td-actions">
        <button class="btn-edit"   onclick="editCondicionante(${i})">editar</button>
        <button class="btn-delete" onclick="deleteCondicionante(${i})">excluir</button>
      </div></td>
    </tr>`).join('');
}

function addCondicionante() {
  currentCondEditIdx = -1;
  const grid = document.getElementById('condEditFormGrid');
  grid.innerHTML = COND_FIELDS.map(f => {
    const input = f.type === 'textarea'
      ? `<textarea id="cedit_${f.id}" style="min-height:80px"></textarea>`
      : `<input type="text" id="cedit_${f.id}" value="">`;
    return `<div class="field-group${f.wide ? ' cond-field-wide' : ''}">${'<label>' + f.label + '</label>'}${input}</div>`;
  }).join('');
  document.getElementById('condEditModal').classList.add('open');
}

function editCondicionante(condIdx) {
  currentCondEditIdx = condIdx;
  const item = records[currentCondRecordIdx].condicionantes[condIdx];
  const grid = document.getElementById('condEditFormGrid');
  grid.innerHTML = COND_FIELDS.map(f => {
    const val   = (item[f.id] || '').replace(/"/g, '&quot;');
    const input = f.type === 'textarea'
      ? `<textarea id="cedit_${f.id}" style="min-height:80px">${item[f.id] || ''}</textarea>`
      : `<input type="text" id="cedit_${f.id}" value="${val}">`;
    return `<div class="field-group${f.wide ? ' cond-field-wide' : ''}"><label>${f.label}</label>${input}</div>`;
  }).join('');
  document.getElementById('condEditModal').classList.add('open');
}

function saveCondicionanteEdit() {
  const r = records[currentCondRecordIdx];
  if (!r.condicionantes) r.condicionantes = [];
  const item = {};
  COND_FIELDS.forEach(f => { item[f.id] = document.getElementById('cedit_' + f.id)?.value.trim() || ''; });
  if (currentCondEditIdx === -1) {
    r.condicionantes.push(item);
  } else {
    r.condicionantes[currentCondEditIdx] = item;
  }
  save();
  closeCondicionanteEdit();
  renderCondicionantesTable();
  renderTable();
}

function closeCondicionanteEdit() {
  document.getElementById('condEditModal').classList.remove('open');
  currentCondEditIdx = -1;
}

function deleteCondicionante(condIdx) {
  if (!confirm('Remover esta condicionante?')) return;
  records[currentCondRecordIdx].condicionantes.splice(condIdx, 1);
  save();
  renderCondicionantesTable();
  renderTable();
}

const COND_EXPORT_HEADERS = [
  'Documento', 'Condicionantes / Exigências', 'Prazo Execução / Próx. Evento',
  'Status', 'OBS', 'Documentos Comprobatórios',
];

function getCondExportRows() {
  return (records[currentCondRecordIdx].condicionantes || []).map(item =>
    COND_FIELDS.map(f => item[f.id] || '')
  );
}

function exportCondExcel() {
  const r     = records[currentCondRecordIdx];
  const h     = r.condHeader || {};
  const aoa   = [
    ['Nome do Projeto',           h.nomeProjeto     || ''],
    ['Unidade / Obra',            h.unidade         || ''],
    ['Documento Autorizativo',    h.docAutorizativo || ''],
    ['Nº Documento Autorizativo', h.numDoc          || ''],
    ['Data Publicação',           h.dataPublicacao  || ''],
    ['Validade',                  h.validade        || ''],
    ['Entidade Responsável',      h.entidade        || ''],
    ['Entidade Coresponsável',    h.correspavel     || ''],
    [],
    COND_EXPORT_HEADERS,
    ...getCondExportRows(),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [32, 60, 32, 20, 48, 48].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Condicionantes');
  const slug = (r.numDoc || r.unidade || 'cond').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  XLSX.writeFile(wb, 'condicionantes_' + slug + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  showToast('✓ Excel exportado');
}

function exportCondPDF() {
  const r     = records[currentCondRecordIdx];
  const h     = r.condHeader || {};
  const items = r.condicionantes || [];
  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(13, 45, 26);
  doc.text('Condicionantes Ambientais', 14, 14);

  // Header info block — two columns of label: value pairs
  const infoFields = [
    ['Nome do Projeto',           h.nomeProjeto     || '—'],
    ['Unidade / Obra',            h.unidade         || '—'],
    ['Documento Autorizativo',    h.docAutorizativo || '—'],
    ['Nº Documento Autorizativo', h.numDoc          || '—'],
    ['Data Publicação',           h.dataPublicacao  || '—'],
    ['Validade',                  h.validade        || '—'],
    ['Entidade Responsável',      h.entidade        || '—'],
    ['Entidade Coresponsável',    h.correspavel     || '—'],
  ];
  const half = Math.ceil(infoFields.length / 2);
  let y = 22;
  for (let i = 0; i < half; i++) {
    const left  = infoFields[i];
    const right = infoFields[i + half];
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');   doc.setTextColor(60, 100, 70);
    doc.text(left[0] + ':', 14, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(13, 45, 26);
    doc.text(String(left[1]).substring(0, 60), 58, y);
    if (right) {
      doc.setFont('helvetica', 'bold');   doc.setTextColor(60, 100, 70);
      doc.text(right[0] + ':', 162, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(13, 45, 26);
      doc.text(String(right[1]).substring(0, 60), 218, y);
    }
    y += 6;
  }

  // Divider + record count
  doc.setDrawColor(178, 216, 191); doc.line(14, y, 406, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 140, 110);
  doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR') + ' — ' + items.length + ' registro' + (items.length !== 1 ? 's' : ''), 14, y);

  doc.autoTable({
    head: [COND_EXPORT_HEADERS],
    body: getCondExportRows(),
    startY: y + 5,
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.5, valign: 'middle', textColor: [13, 45, 26], lineColor: [178, 216, 191], lineWidth: 0.2, overflow: 'linebreak' },
    headStyles: { fillColor: [26, 122, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    alternateRowStyles: { fillColor: [240, 247, 242] },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 90 }, 2: { cellWidth: 36 }, 3: { cellWidth: 22 }, 4: { cellWidth: 60 }, 5: { cellWidth: 60 } },
    margin: { left: 8, right: 8 },
  });

  const slug = (r.numDoc || r.unidade || 'cond').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save('condicionantes_' + slug + '_' + new Date().toISOString().slice(0, 10) + '.pdf');
  showToast('✓ PDF exportado');
}

// ── Excel Import ───────────────────────────────────────────────────────────
function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const workbook = XLSX.read(e.target.result, { type: 'array' });

      // Prefer a sheet with "CONDICIONANTE" in the name, fallback to first sheet
      const targetSheet = workbook.SheetNames.find(n =>
        n.toUpperCase().includes('CONDICIONANTE')
      ) || workbook.SheetNames[0];

      const ws   = workbook.Sheets[targetSheet];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Find header row by scanning for known CA column names
      let headerRowIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const rowStr = rows[i].join('|').toUpperCase();
        if (rowStr.includes('UNIDADE') || rowStr.includes('ENTIDADE RESPONSAVEL') || rowStr.includes('DOCUMENTO AUTORIZATIVO')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        showToast('⚠ Cabeçalho não encontrado na planilha', '#b91c1c');
        return;
      }

      const headers = rows[headerRowIdx].map(h => h.toString().trim().toUpperCase());

      const COL_MAP = {
        'UNIDADE / OBRA':          'unidade',
        'UNIDADE/OBRA':            'unidade',
        'UNIDADE':                 'unidade',
        'OBRA':                    'unidade',
        'ENTIDADE RESPONSAVEL':    'entidade',
        'ENTIDADE RESPONSÁVEL':    'entidade',
        'RESPONSAVEL':             'entidade',
        'ENTIDADE CORRESPONSAVEL': 'correspavel',
        'ENTIDADE CORRESPONSÁVEL': 'correspavel',
        'CORRESPONSAVEL':          'correspavel',
        'CORRESPONSÁVEL':          'correspavel',
        'DOCUMENTO AUTORIZATIVO':  'docAutorizativo',
        'Nº DOCUMENTO':            'numDoc',
        'N° DOCUMENTO':            'numDoc',
        'NO DOCUMENTO':            'numDoc',
        'NUMERO DOCUMENTO':        'numDoc',
        'NÚMERO DOCUMENTO':        'numDoc',
        'EMITENTE':                'emitente',
        'DOCUMENTO ANEXO':         'docAnexo',
        'CONDICIONANTE':           'status',
        'STATUS CONDICIONANTE':    'status',
        'STATUS':                  'status',
      };

      // Build column index → field key lookup (accent-insensitive)
      const colToField = {};
      headers.forEach((h, i) => {
        const norm = h.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
        const match = Object.keys(COL_MAP).find(k =>
          k.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() === norm
        );
        if (match) colToField[i] = COL_MAP[match];
      });

      let imported = 0;
      let skipped  = 0;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

        const r = { unidade:'', entidade:'', correspavel:'', docAutorizativo:'', numDoc:'', emitente:'', docAnexo:'', status:'' };

        Object.entries(colToField).forEach(([colIdx, field]) => {
          const raw = row[colIdx];
          if (raw === undefined || raw === null || raw === '' || raw === '-') return;
          r[field] = String(raw).trim();
        });

        if (!r.unidade && !r.numDoc && !r.docAutorizativo) { skipped++; continue; }

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

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, color = 'var(--accent)') {
  const t = document.getElementById('toast');
  t.style.background = color;
  t.style.color = (color === 'var(--accent)') ? '#fff' : '#fff';
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Fixed bottom scrollbar mirror ─────────────────────────────────────────
(function () {
  const mirror      = document.getElementById('scrollMirror');
  const mirrorInner = document.getElementById('scrollMirrorInner');
  const wrapper     = document.querySelector('.table-wrapper');
  let syncing = false;

  function syncMirrorWidth() { mirrorInner.style.width = wrapper.scrollWidth + 'px'; }

  function updateMirrorVisibility() {
    const rect = wrapper.getBoundingClientRect();
    const tableBottomBelowViewport = rect.bottom > window.innerHeight;
    const tableVisible = rect.top < window.innerHeight && rect.bottom > 0;
    mirror.style.display = (tableVisible && tableBottomBelowViewport) ? 'block' : 'none';
    mirror.style.left  = rect.left  + 'px';
    mirror.style.width = rect.width + 'px';
    syncMirrorWidth();
  }

  mirror.addEventListener('scroll', () => { if (syncing) return; syncing = true; wrapper.scrollLeft = mirror.scrollLeft; syncing = false; });
  wrapper.addEventListener('scroll', () => { if (syncing) return; syncing = true; mirror.scrollLeft = wrapper.scrollLeft; syncing = false; });
  window.addEventListener('scroll',  updateMirrorVisibility, { passive: true });
  window.addEventListener('resize',  updateMirrorVisibility, { passive: true });

  const _origRender = renderTable;
  window.renderTable = function () { _origRender(); requestAnimationFrame(updateMirrorVisibility); };
  requestAnimationFrame(updateMirrorVisibility);
})();

// ── Init ───────────────────────────────────────────────────────────────────
document.getElementById('editModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.getElementById('condModal').addEventListener('click', function (e) {
  if (e.target === this) closeCondicionantesModal();
});

document.getElementById('condEditModal').addEventListener('click', function (e) {
  if (e.target === this) closeCondicionanteEdit();
});

// ── Cell tooltip ───────────────────────────────────────────────────────────
(function () {
  const tip = document.getElementById('caTooltip');
  let showTimer;

  document.addEventListener('mouseover', function (e) {
    const td = e.target.closest('td[data-tip]');
    if (!td) { clearTimeout(showTimer); tip.style.opacity = '0'; return; }
    const text = (td.getAttribute('data-tip') || '').trim();
    if (!text) { tip.style.opacity = '0'; return; }
    clearTimeout(showTimer);
    tip.textContent = text;
    moveTip(e);
    showTimer = setTimeout(function () { tip.style.opacity = '1'; }, 280);
  });

  document.addEventListener('mousemove', function (e) {
    if (e.target.closest('td[data-tip]')) moveTip(e);
  });

  document.addEventListener('mouseout', function (e) {
    if (e.target.closest('td[data-tip]')) { clearTimeout(showTimer); tip.style.opacity = '0'; }
  });

  function moveTip(e) {
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth  - tip.offsetWidth  - 14) + 'px';
    tip.style.top  = Math.min(e.clientY + 18, window.innerHeight - tip.offsetHeight - 14) + 'px';
  }
})();

renderTable();
renderInbox();
