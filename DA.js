// ── State ──────────────────────────────────────────────────────────────────
let records    = JSON.parse(localStorage.getItem('gestao_docs') || '[]');
let sortCol    = -1;
let sortDir    = 1;
let editIndex  = -1;
let filterText = '';
let currentPage = 1;
let perPage     = 15;

// ── Inbox ──────────────────────────────────────────────────────────────────
let inbox = JSON.parse(localStorage.getItem('gestao_inbox') || '[]');

function saveInbox() {
  localStorage.setItem('gestao_inbox', JSON.stringify(inbox));
}

function pushNotification(text, color) {
  inbox.unshift({
    text,
    color,
    time: new Date().toLocaleString('pt-BR')
  });
  // Keep max 100 notifications
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
  badge.textContent   = inbox.length > 99 ? '99+' : inbox.length;
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

function toggleInbox() {
  document.getElementById('inboxPanel').classList.toggle('open');
}

function clearInbox() {
  inbox = [];
  saveInbox();
  renderInbox();
}

// Close inbox when clicking outside
document.addEventListener('click', e => {
  const wrap = document.querySelector('.inbox-btn-wrap');
  if (wrap && !wrap.contains(e.target))
    document.getElementById('inboxPanel')?.classList.remove('open');
});

// ── Auto-status check ──────────────────────────────────────────────────────
// Only these three keys are managed automatically; all others are left alone
const AUTO_STATUSES = new Set(['valida', 'valida_renovar', 'vencida', '']);

const STATUS_COLORS_NOTIFY = {
  valida:         '#007a3d',
  valida_renovar: '#854d0e',
  vencida:        '#b91c1c',
};

function checkExpiryStatuses() {
  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  let changed   = false;

  records.forEach(r => {
    if (!r.validade) return;
    // Skip records whose status was manually set by the user
    if (r.manualStatus) return;

    // Normalise the stored status key (handles raw import strings)
    let currentKey = r.status || '';
    if (currentKey && !AUTO_STATUSES.has(currentKey)) {
      // Try to resolve to internal key for comparison
      const norm = currentKey.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if      (norm.includes('RENOVAR'))  currentKey = 'valida_renovar';
      else if (norm.includes('VENCID'))   currentKey = 'vencida';
      else if (norm.includes('VALID') || norm.includes('ATIVA')) currentKey = 'valida';
      // If it still isn't one of the three auto-managed statuses, skip
      if (!AUTO_STATUSES.has(currentKey)) return;
    }

    const expiry  = new Date(r.validade);
    expiry.setHours(0, 0, 0, 0);
    const diffMs  = expiry - today;
    const diffDays = Math.ceil(diffMs / 86400000);

    let newKey;
    if (diffDays > 60)       newKey = 'valida';
    else if (diffDays >= 0)  newKey = 'valida_renovar';
    else                     newKey = 'vencida';

    if (r.status !== newKey) {
      const oldLabel = (STATUS_LABELS[r.status] || r.status || '(sem status)');
      const newLabel = STATUS_LABELS[newKey];
      const doc      = r.numero || r.tema || 'Documento sem identificação';
      const color    = STATUS_COLORS_NOTIFY[newKey];

      pushNotification(
        `<strong>${doc}</strong> — status atualizado de <em>${oldLabel}</em> para <strong>${newLabel}</strong>` +
        (diffDays >= 0 ? ` (${diffDays} dia${diffDays !== 1 ? 's' : ''} restante${diffDays !== 1 ? 's' : ''})` : ' (vencido)'),
        color
      );

      r.status = newKey;
      changed  = true;
    }
  });

  if (changed) { save(); }
}

// ── Field definitions (used for the edit modal) ────────────────────────────
const FIELDS = [
  { id: 'tema',        label: 'Tema Associado',        type: 'text' },
  { id: 'orgao',       label: 'Órgão Emitente',        type: 'text' },
  { id: 'natureza',    label: 'Natureza do Documento',  type: 'select',
    options: ['', 'Portaria', 'Resolução', 'Decreto', 'Instrução Normativa',
              'Circular', 'Contrato', 'Ofício', 'Memorando', 'Outro'] },
  { id: 'numero',      label: 'Número do Documento',   type: 'text' },
  { id: 'procedimento',label: 'Procedimento',           type: 'text' },
  { id: 'teor',        label: 'Teor do Documento',     type: 'textarea' },
  { id: 'interessado', label: 'Interessado',            type: 'text' },
  { id: 'ano',         label: 'Data de Emissão',       type: 'date' },
  { id: 'validade',    label: 'Data de Vencimento',     type: 'date' },
  { id: 'status',      label: 'Status',                 type: 'select',
    options: [
      { value: '',               label: 'Selecione...' },
      { value: 'valida',         label: 'Válida' },
      { value: 'valida_renovar', label: 'Válida (A Renovar)' },
      { value: 'valida_analise', label: 'Válida (Em Análise)' },
      { value: 'vencida',        label: 'Vencida' },
      { value: 'em_encerramento',label: 'Em Processo De Encerramento' },
      { value: 'em_tratativas',  label: 'Em Tratativas' },
      { value: 'sem_efeito',     label: 'Sem Efeito' },
      { value: 'nenhum',         label: '-' }
    ]
  },
  { id: 'docAnexo',    label: 'Documento Anexo (URL)',  type: 'text' },
  { id: 'observacao',  label: 'Observação',             type: 'textarea' }
];

// ── Form helpers ───────────────────────────────────────────────────────────
function getFormValues() {
  return {
    tema:         document.getElementById('tema').value.trim(),
    orgao:        document.getElementById('orgao').value.trim(),
    natureza:     document.getElementById('natureza').value,
    numero:       document.getElementById('numero').value.trim(),
    procedimento: document.getElementById('procedimento').value.trim(),
    teor:         document.getElementById('teor').value.trim(),
    interessado:  document.getElementById('interessado').value.trim(),
    ano:          document.getElementById('ano').value.trim(),
    validade:     document.getElementById('validade').value,
    status:       document.getElementById('status').value,
    docAnexo:     document.getElementById('docAnexo').value.trim(),
    observacao:   document.getElementById('observacao').value.trim()
  };
}

function addRecord() {
  const r = getFormValues();
  if (!r.tema && !r.orgao && !r.numero) {
    showToast('⚠ Preencha ao menos Tema, Órgão ou Número', '#f0c060');
    return;
  }
  records.push(r);
  save();
  checkExpiryStatuses();
  clearForm();
  renderTable();
  showToast('✓ Registro adicionado com sucesso');
}

function clearForm() {
  ['tema','orgao','natureza','numero','procedimento','teor',
   'interessado','ano','validade','status','docAnexo','observacao'].forEach(id => {
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
    const val = r[f.id] || '';
    let input = '';

    if (f.type === 'select') {
      const opts = f.options.map(o => {
        if (typeof o === 'string')
          return `<option${o === val ? ' selected' : ''}>${o}</option>`;
        return `<option value="${o.value}"${o.value === val ? ' selected' : ''}>${o.label}</option>`;
      }).join('');
      input = `<select id="edit_${f.id}">${opts}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="edit_${f.id}" style="min-height:70px">${val}</textarea>`;
    } else {
      input = `<input type="${f.type}" id="edit_${f.id}" value="${val}">`;
    }

    const wide = f.id === 'teor'      ? ' wide' : '';
    const full = f.id === 'observacao' ? ' full' : '';
    return `<div class="field-group${wide}${full}"><label>${f.label}</label>${input}</div>`;
  }).join('');

  document.getElementById('editModal').classList.add('open');
}

function saveEdit() {
  const r = {};
  FIELDS.forEach(f => { r[f.id] = document.getElementById('edit_' + f.id).value.trim(); });
  // Mark status as manually set so auto-check won't overwrite it
  r.manualStatus = true;
  records[editIndex] = r;
  save();
  checkExpiryStatuses();
  renderTable();
  closeModal();
  showToast('✓ Registro atualizado');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
  editIndex = -1;
}

function resetToAuto() {
  if (editIndex < 0) return;
  records[editIndex].manualStatus = false;
  save();
  checkExpiryStatuses();
  renderTable();
  closeModal();
  showToast('🔓 Status voltará a ser gerenciado automaticamente', '#6d28d9');
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
const KEYS = ['tema','orgao','natureza','numero','procedimento',
              'teor','interessado','ano','validade','status','docAnexo','observacao'];

function safeUrl(url) {
  if (!url) return '';
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

function getRowValues(r) {
  return KEYS.map(k => r[k]);
}

function statusBadge(s) {
  if (!s) return '<span style="color:var(--text-dimmer)">—</span>';
  const labels = {
    valida:          'Válida',
    valida_renovar:  'Válida (A Renovar)',
    valida_analise:  'Válida (Em Análise)',
    vencida:         'Vencida',
    em_encerramento: 'Em Processo De Encerramento',
    em_tratativas:   'Em Tratativas',
    sem_efeito:      'Sem Efeito',
    nenhum:          '-'
  };
  // If the stored value isn't a known key (old import), try to normalize it on the fly
  if (!labels[s]) {
    const norm = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('RENOVAR'))                 s = 'valida_renovar';
    else if (norm.includes('TRATATIV'))           s = 'em_tratativas';
    else if (norm.includes('ANALISE'))            s = 'valida_analise';
    else if (norm.includes('ENCERR'))             s = 'em_encerramento';
    else if (norm.includes('VENCID'))             s = 'vencida';
    else if (norm.includes('EFEITO'))             s = 'sem_efeito';
    else if (norm.includes('VALID') || norm.includes('ATIVA')) s = 'valida';
    else                                          s = 'nenhum';
  }
  return `<span class="badge badge-${s}">${labels[s] || s}</span>`;
}

function formatDate(val) {
  if (!val) return '—';
  const [y, m, d] = val.split('-');
  return (d && m && y) ? `${d}/${m}/${y}` : val;
}

function renderTable() {
  const tbody = document.getElementById('tableBody');

  // Filter
  let filtered = records.filter(r => {
    if (!filterText) return true;
    return getRowValues(r).some(v => (v || '').toLowerCase().includes(filterText));
  });

  // Sort
  if (sortCol >= 0) {
    filtered.sort((a, b) => {
      const av = (a[KEYS[sortCol]] || '').toString();
      const bv = (b[KEYS[sortCol]] || '').toString();
      return av.localeCompare(bv, 'pt-BR') * sortDir;
    });
  }

  document.getElementById('totalCount').textContent = records.length;

  // Empty state
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="13">
        <div class="empty-state">
          <div class="empty-icon">${filterText ? '🔍' : '📋'}</div>
          <p>${filterText
            ? `Nenhum resultado para "${filterText}".`
            : 'Nenhum registro encontrado.<br>Preencha o formulário acima para adicionar documentos.'
          }</p>
        </div>
      </td></tr>`;
    renderPagination(0, 0);
    return;
  }

  // Pagination
  const totalFiltered = filtered.length;
  const totalPages    = Math.ceil(totalFiltered / perPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1)          currentPage = 1;

  const start  = (currentPage - 1) * perPage;
  const end    = Math.min(start + perPage, totalFiltered);
  const paged  = filtered.slice(start, end);

  // Rows
  tbody.innerHTML = paged.map(r => {
    const realIdx = records.indexOf(r);
    const cols    = getRowValues(r);
    return `<tr>
      <td title="${cols[0]||''}">${cols[0]||'—'}</td>
      <td title="${cols[1]||''}">${cols[1]||'—'}</td>
      <td>${cols[2]||'—'}</td>
      <td>${cols[3]||'—'}</td>
      <td title="${cols[4]||''}">${cols[4]||'—'}</td>
      <td title="${cols[5]||''}" style="max-width:180px">${cols[5]||'—'}</td>
      <td title="${cols[6]||''}">${cols[6]||'—'}</td>
      <td>${formatDate(cols[7])}</td>
      <td>${formatDate(cols[8])}</td>
      <td>${statusBadge(cols[9])}</td>
      <td style="text-align:center">${cols[10] ? `<a href="${safeUrl(cols[10])}" target="_blank" rel="noopener" class="btn-anexo" title="${cols[10]}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></a>` : '<span style="color:var(--text-dimmer)">—</span>'}</td>
      <td title="${cols[11]||''}">${cols[11]||'—'}</td>
      <td><div class="td-actions">
        <button class="btn-edit"   onclick="openEdit(${realIdx})">editar</button>
        <button class="btn-delete" onclick="deleteRecord(${realIdx})">excluir</button>
      </div></td>
    </tr>`;
  }).join('');

  // Scroll table back to top on page change
  document.querySelector('.table-wrapper').scrollTop = 0;

  renderPagination(totalFiltered, totalPages, start, end);
}

function renderPagination(total, totalPages, start, end) {
  const info     = document.getElementById('paginationInfo');
  const controls = document.getElementById('paginationControls');

  if (total === 0) {
    info.innerHTML = '';
    controls.innerHTML = '';
    return;
  }

  info.innerHTML = `Exibindo <strong>${start + 1}–${end}</strong> de <strong>${total}</strong> registros`;

  // Build page buttons — show at most 7 buttons with ellipsis
  let pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages = [1];
    if (currentPage > 3)          pages.push('…');
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

function goToPage(page) {
  currentPage = page;
  renderTable();
}

function changePerPage(val) {
  perPage     = parseInt(val);
  currentPage = 1;
  renderTable();
}

// ── Export ─────────────────────────────────────────────────────────────────
// ── Export helpers ─────────────────────────────────────────────────────────
const EXPORT_HEADERS = [
  'Tema Associado','Órgão Emitente','Natureza do Documento',
  'Número do Documento','Procedimento','Teor Documento',
  'Interessado','Data de Emissão','Data de Vencimento','Status','Documento Anexo','Observação'
];

const STATUS_LABELS = {
  valida:'Válida', valida_renovar:'Válida (A Renovar)',
  valida_analise:'Válida (Em Análise)', vencida:'Vencida',
  em_encerramento:'Em Processo De Encerramento',
  em_tratativas:'Em Tratativas', sem_efeito:'Sem Efeito', nenhum:'-'
};

function resolveStatus(s) {
  if (STATUS_LABELS[s]) return STATUS_LABELS[s];
  if (!s) return '-';
  const n = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (n.includes('RENOVAR'))  return 'Válida (A Renovar)';
  if (n.includes('TRATATIV')) return 'Em Tratativas';
  if (n.includes('ANALISE'))  return 'Válida (Em Análise)';
  if (n.includes('ENCERR'))   return 'Em Processo De Encerramento';
  if (n.includes('EFEITO'))   return 'Sem Efeito';
  if (n.includes('VENCID'))   return 'Vencida';
  if (n.includes('VALID'))    return 'Válida';
  return s;
}

function getExportRows() {
  return records.map(r => KEYS.map(k => {
    if (k === 'status') return resolveStatus(r[k]);
    if (k === 'ano' || k === 'validade') return formatDate(r[k]);
    return r[k] || '';
  }));
}

function toggleExportMenu() {
  document.getElementById('exportMenu').classList.toggle('open');
}

// Close menu when clicking outside
document.addEventListener('click', e => {
  const dd = document.getElementById('exportDropdown');
  if (dd && !dd.contains(e.target))
    document.getElementById('exportMenu').classList.remove('open');
});

function exportExcel() {
  if (records.length === 0) { showToast('Sem dados para exportar', '#f0c060'); return; }
  const ws   = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...getExportRows()]);

  // Column widths
  ws['!cols'] = [22,20,22,18,18,30,20,16,16,24,30,30].map(w => ({ wch: w }));

  // Header style
  EXPORT_HEADERS.forEach((_, i) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '0077B6' } },
        alignment: { horizontal: 'center' }
      };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Documentos');
  XLSX.writeFile(wb, 'documentos_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  showToast('✓ Excel exportado');
}

function exportPDF() {
  if (records.length === 0) { showToast('Sem dados para exportar', '#f0c060'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  const date = new Date().toLocaleDateString('pt-BR');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(13, 45, 74);
  doc.text('Gestão de Documentos Autorizativos', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(74, 106, 138);
  doc.text(`Gerado em ${date} — ${records.length} registro${records.length !== 1 ? 's' : ''}`, 14, 22);

  // Status color map for cell fill
  const STATUS_COLORS = {
    'Válida':                       [0,122,61],
    'Válida (A Renovar)':           [133,77,14],
    'Válida (Em Análise)':          [22,101,52],
    'Vencida':                      [185,28,28],
    'Em Processo De Encerramento':  [124,45,18],
    'Em Tratativas':                [194,65,12],
    'Sem Efeito':                   [107,114,128],
    '-':                            [138,170,196],
  };

  doc.autoTable({
    head: [EXPORT_HEADERS],
    body: getExportRows(),
    startY: 27,
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 2.5,
      valign: 'middle',
      textColor: [13, 45, 74],
      lineColor: [194, 212, 232],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [0, 119, 182],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [240, 244, 248] },
    columnStyles: {
      0:  { cellWidth: 34 },  // Tema Associado
      1:  { cellWidth: 24 },  // Órgão Emitente
      2:  { cellWidth: 26 },  // Natureza do Documento
      3:  { cellWidth: 20 },  // Número do Documento
      4:  { cellWidth: 24 },  // Procedimento
      5:  { cellWidth: 55 },  // Teor Documento
      6:  { cellWidth: 26 },  // Interessado
      7:  { cellWidth: 18 },  // Data de Emissão
      8:  { cellWidth: 18 },  // Data de Vencimento
      9:  { cellWidth: 34 },  // Status
      10: { cellWidth: 40 },  // Documento Anexo
      11: { cellWidth: 75 },  // Observação
    },
    // Color status cells
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 9) {
        const col = STATUS_COLORS[data.cell.text[0]];
        if (col) {
          data.cell.styles.textColor = col;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 8, right: 8 },
  });

  doc.save('documentos_' + new Date().toISOString().slice(0, 10) + '.pdf');
  showToast('✓ PDF exportado');
}

// ── Painel ─────────────────────────────────────────────────────────────────
let chartStatusInst = null;
let chartTemaInst   = null;

const STATUS_META = {
  // colors mirror the badge definitions exactly
  valida:          { label: 'Válida',             color: '#007a3d', bg: 'rgba(0,180,100,0.18)'   },
  valida_renovar:  { label: 'Válida (A Renovar)', color: '#854d0e', bg: 'rgba(253,224,71,0.25)'  },  // light yellow text
  valida_analise:  { label: 'Válida (Em Análise)',color: '#166534', bg: 'rgba(187,247,208,0.4)'  },  // light green text
  vencida:         { label: 'Vencida',            color: '#b91c1c', bg: 'rgba(200,40,40,0.18)'   },
  em_encerramento: { label: 'Em Encerramento',    color: '#7c2d12', bg: 'rgba(124,45,18,0.18)'   },
  em_tratativas:   { label: 'Em Tratativas',      color: '#c2410c', bg: 'rgba(251,146,60,0.2)'   },  // orange text
  sem_efeito:      { label: 'Sem Efeito',         color: '#6b7280', bg: 'rgba(107,114,128,0.18)' },
  nenhum:          { label: '-',                  color: '#8aaac4', bg: 'rgba(138,170,196,0.18)' },
};

function openPainel() {
  if (records.length === 0) { showToast('Nenhum dado para exibir no painel', '#6b7280'); return; }

  // Set current month/year
  const now  = new Date();
  const mes  = now.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
  document.getElementById('painelDate').textContent = `${mes}/${now.getFullYear()}`;

  // ── Count by status — normalize raw strings on the fly ──
  const statusCounts = {};
  Object.keys(STATUS_META).forEach(k => statusCounts[k] = 0);
  records.forEach(r => {
    let key = r.status || '';
    // If the key isn't recognised (e.g. old raw import), normalise it
    if (key && statusCounts[key] === undefined) {
      const norm = key.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if      (norm.includes('RENOVAR'))                              key = 'valida_renovar';
      else if (norm.includes('TRATATIV'))                             key = 'em_tratativas';
      else if (norm.includes('ANALISE') || norm.includes('LICENCIADOR')) key = 'valida_analise';
      else if (norm.includes('ENCERR'))                               key = 'em_encerramento';
      else if (norm.includes('EFEITO'))                               key = 'sem_efeito';
      else if (norm.includes('VENCID'))                               key = 'vencida';
      else if (norm.includes('VALID') || norm.includes('ATIVA'))      key = 'valida';
      else                                                            key = 'nenhum';
    }
    if (key && statusCounts[key] !== undefined) statusCounts[key]++;
  });

  // ── Count by tema ──
  const temaCounts = {};
  records.forEach(r => {
    const t = (r.tema || '').trim() || '(sem tema)';
    temaCounts[t] = (temaCounts[t] || 0) + 1;
  });
  const temasSorted = Object.entries(temaCounts).sort((a, b) => b[1] - a[1]);

  // ── Destroy old charts if any ──
  if (chartStatusInst) { chartStatusInst.destroy(); chartStatusInst = null; }
  if (chartTemaInst)   { chartTemaInst.destroy();   chartTemaInst   = null; }

  document.getElementById('painelModal').classList.add('open');

  // Render after modal is visible
  requestAnimationFrame(() => {
    // Shared height: driven by however many temas there are
    const temaCount_   = temasSorted.length;
    const sharedHeight = Math.max(320, temaCount_ * 28 + 60);

    // ── Chart 1: Status vertical bar ──────────────────────────────────
    const canvasStatus = document.getElementById('chartStatus');
    canvasStatus.style.height    = sharedHeight + 'px';
    canvasStatus.style.minHeight = sharedHeight + 'px';
    canvasStatus.style.width     = '100%';

    const ctxS = canvasStatus.getContext('2d');
    chartStatusInst = new Chart(ctxS, {
      type: 'bar',
      data: {
        labels: Object.values(STATUS_META).map(m => m.label),
        datasets: [{
          label: 'Quantidade',
          data: Object.keys(STATUS_META).map(k => statusCounts[k]),
          backgroundColor: Object.values(STATUS_META).map(m => m.color),
          borderColor:     Object.values(STATUS_META).map(m => m.color),
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d2d4a',
            titleFont: { family: 'Syne', size: 12, weight: '700' },
            bodyFont:  { family: 'IBM Plex Mono', size: 12 },
            padding: 10,
            callbacks: { label: ctx => `  ${ctx.parsed.y} documento${ctx.parsed.y !== 1 ? 's' : ''}` }
          },
        },
        scales: {
          x: {
            ticks: {
              font: { family: 'IBM Plex Mono', size: 9 },
              color: '#4a6a8a',
              maxRotation: 25,
              callback: function(val, i) {
                // Wrap long labels at ~16 chars
                const label = this.getLabelForValue(val);
                if (label.length <= 16) return label;
                const words = label.split(' ');
                const lines = [];
                let line = '';
                words.forEach(w => {
                  if ((line + ' ' + w).trim().length > 16) { lines.push(line.trim()); line = w; }
                  else line = (line + ' ' + w).trim();
                });
                if (line) lines.push(line);
                return lines;
              }
            },
            grid: { color: 'rgba(194,212,232,0.35)' }
          },
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: 'IBM Plex Mono', size: 11, weight: '500' },
              color: '#4a6a8a'
            },
            grid: { color: 'rgba(194,212,232,0.35)' },
            title: { display: true, text: 'Quantidade', font: { family: 'Syne', size: 11, weight: '700' }, color: '#4a6a8a' }
          }
        },
        // Draw value labels on top of each bar
        animation: {
          onComplete: function() {
            const chart = this;
            const ctx2  = chart.ctx;
            chart.data.datasets.forEach((dataset, i) => {
              const meta = chart.getDatasetMeta(i);
              meta.data.forEach((bar, j) => {
                const val = dataset.data[j];
                if (!val) return;
                ctx2.save();
                ctx2.font = 'bold 12px "Syne", sans-serif';
                ctx2.fillStyle = chart.data.datasets[i].borderColor[j] || '#0d2d4a';
                ctx2.textAlign = 'center';
                ctx2.textBaseline = 'bottom';
                ctx2.fillText(val, bar.x, bar.y - 4);
                ctx2.restore();
              });
            });
          }
        }
      }
    });

    // ── Chart 2: Tema horizontal bar — same height as status chart ────────
    const canvasTema = document.getElementById('chartTema');
    canvasTema.style.height    = sharedHeight + 'px';
    canvasTema.style.minHeight = sharedHeight + 'px';
    canvasTema.style.width     = '100%';

    const ctxT = canvasTema.getContext('2d');
    chartTemaInst = new Chart(ctxT, {
      type: 'bar',
      data: {
        labels: temasSorted.map(([k]) => k),
        datasets: [{
          label: 'Quantidade',
          data: temasSorted.map(([, v]) => v),
          backgroundColor: '#0077b6',
          borderColor:     '#0077b6',
          borderWidth: 1,          // finer lines
          borderRadius: 3,
          borderSkipped: false,
          barThickness: 14,        // slimmer bars
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d2d4a',
            titleFont: { family: 'Syne', size: 12, weight: '700' },
            bodyFont:  { family: 'IBM Plex Mono', size: 12 },
            padding: 10,
            callbacks: { label: ctx => `  ${ctx.parsed.x} documento${ctx.parsed.x !== 1 ? 's' : ''}` }
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: 'IBM Plex Mono', size: 11, weight: '500' },
              color: '#4a6a8a'
            },
            grid: { color: 'rgba(194,212,232,0.25)', lineWidth: 0.8 }
          },
          y: {
            ticks: {
              font: { family: 'IBM Plex Mono', size: 10 },
              color: '#0d2d4a'
            },
            grid: { display: false }
          }
        },
        // Draw value labels at end of each bar
        animation: {
          onComplete: function() {
            const chart = this;
            const ctx2  = chart.ctx;
            chart.data.datasets.forEach((dataset, i) => {
              const meta = chart.getDatasetMeta(i);
              meta.data.forEach((bar, j) => {
                const val = dataset.data[j];
                if (!val) return;
                ctx2.save();
                ctx2.font = 'bold 11px "Syne", sans-serif';
                ctx2.fillStyle = '#ffffff';
                ctx2.textAlign = 'right';
                ctx2.textBaseline = 'middle';
                ctx2.fillText(val, bar.x - 6, bar.y);
                ctx2.restore();
              });
            });
          }
        }
      }
    });

    // ── Totals strip ──
    const total = records.length;
    const chips = [
      { label: 'Total', value: total, color: '#0077b6', bg: 'rgba(0,119,182,0.08)' },
      ...Object.entries(STATUS_META).map(([k, m]) => ({
        label: m.label, value: statusCounts[k], color: m.color, bg: m.bg
      }))
    ];

    document.getElementById('painelTotals').innerHTML = chips.map(c => `
      <div class="painel-total-chip" style="border-color:${c.color}44; background:${c.bg || 'var(--bg)'}">
        <div class="painel-total-dot" style="background:${c.color}"></div>
        <span class="painel-total-label" style="color:${c.color}">${c.label}</span>
        <span class="painel-total-value" style="font-family:'Syne',sans-serif; color:${c.color}">${c.value}</span>
      </div>
    `).join('');
  });
}

function closePainel() {
  document.getElementById('painelModal').classList.remove('open');
}

// ── Clear Table ────────────────────────────────────────────────────────────
function clearTable() {
  if (records.length === 0) {
    showToast('A tabela já está vazia', '#6b7280');
    return;
  }

  // Custom confirmation modal
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 300;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
  `;

  overlay.innerHTML = `
    <div style="
      background: #fff; border: 1px solid #c2d4e8; border-radius: 8px;
      padding: 36px 40px; max-width: 420px; width: 90%; text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    ">
      <div style="font-size: 36px; margin-bottom: 16px;">⚠️</div>
      <p style="
        font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px;
        color: #0d2d4a; margin-bottom: 10px;
      ">Limpar todos os registros?</p>
      <p style="
        font-family: 'IBM Plex Mono', monospace; font-size: 12px;
        color: #4a6a8a; line-height: 1.6; margin-bottom: 28px;
      ">Esta ação irá remover <strong>${records.length} registro${records.length !== 1 ? 's' : ''}</strong> permanentemente.<br>Esta operação não pode ser desfeita.</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="confirmClearBtn" style="
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          letter-spacing: 1px; text-transform: uppercase;
          background: #b91c1c; color: #fff; border: none;
          padding: 12px 28px; border-radius: 4px; cursor: pointer;
        ">✕ Sim, limpar tudo</button>
        <button id="cancelClearBtn" style="
          font-family: 'IBM Plex Mono', monospace; font-size: 12px;
          color: #4a6a8a; background: transparent;
          border: 1px solid #c2d4e8; padding: 11px 20px;
          border-radius: 4px; cursor: pointer;
        ">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('confirmClearBtn').onclick = () => {
    records = [];
    save();
    renderTable();
    document.body.removeChild(overlay);
    showToast('Tabela limpa com sucesso', '#6b7280');
  };

  document.getElementById('cancelClearBtn').onclick = () => {
    document.body.removeChild(overlay);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
}
function save() {
  localStorage.setItem('gestao_docs', JSON.stringify(records));
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, color = 'var(--accent)') {
  const t         = document.getElementById('toast');
  t.style.background = color;
  t.style.color   = (color === 'var(--accent)') ? 'var(--bg)' : '#fff';
  t.textContent   = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Excel Import ───────────────────────────────────────────────────────────
function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });

      // Find the data sheet — prefer "LICENÇAS & DOCS AUTORIZATIVOS", fallback to first sheet
      const targetSheet = workbook.SheetNames.find(n =>
        n.toUpperCase().includes('LICEN') || n.toUpperCase().includes('AUTORIZATIV')
      ) || workbook.SheetNames[0];

      const ws = workbook.Sheets[targetSheet];

      // Convert to array of arrays (raw rows) so we can find the header row ourselves
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Find the header row by looking for "TEMA ASSOCIADO" or "NATUREZA"
      let headerRowIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const rowStr = rows[i].join('|').toUpperCase();
        if (rowStr.includes('TEMA ASSOCIADO') || rowStr.includes('NATUREZA DO DOCUMENTO')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        showToast('⚠ Cabeçalho não encontrado na planilha', '#b91c1c');
        return;
      }

      const headers = rows[headerRowIdx].map(h => h.toString().trim().toUpperCase());

      // Map Excel column names → our internal field keys
      const COL_MAP = {
        'TEMA ASSOCIADO':        'tema',
        'PROGRAMA AO QUAL SE VINCULA': 'tema',   // fallback label used in this file
        'ÓRGÃO EMITENTE':        'orgao',
        'ORGAO EMITENTE':        'orgao',
        'NATUREZA DO DOCUMENTO': 'natureza',
        'Nº DOCUMENTO':          'numero',
        'N° DOCUMENTO':          'numero',
        'NO DOCUMENTO':          'numero',
        'PROCEDIMENTO':          'procedimento',
        'TEOR DOCUMENTO':        'teor',
        'INTERESSADO':           'interessado',
        'DATA EMISSÃO':          'ano',
        'DATA EMISSAO':          'ano',
        'DATA DE EMISSÃO':       'ano',
        'DATA DE EMISSAO':       'ano',
        'ANO EMISSÃO':           'ano',
        'ANO EMISSAO':           'ano',
        'DATA VENCIMENTO':       'validade',
        'DATA DE VENCIMENTO':    'validade',
        'STATUS':                'status',
        'OBS':                   'observacao',
        'OBSERVAÇÃO':            'observacao',
        'OBSERVACAO':            'observacao',
        'DOCUMENTO ANEXO':       'docAnexo',
        'DOC ANEXO':             'docAnexo',
        'LINK':                  'docAnexo',
      };

      // Build column index → field key lookup
      const colToField = {};
      headers.forEach((h, i) => {
        // Normalize: remove accents for matching
        const norm = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        const match = Object.keys(COL_MAP).find(k =>
          k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === norm
        );
        if (match) colToField[i] = COL_MAP[match];
      });

      // Helper: convert Excel serial date or Date object → "YYYY" for ano, or "YYYY-MM-DD" for validade
      function excelDateToISO(val) {
        if (!val || val === '-' || val === '' || val === ' - ') return '';
        if (val instanceof Date) {
          const y = val.getFullYear();
          const m = String(val.getMonth() + 1).padStart(2, '0');
          const d = String(val.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        // numeric serial
        if (typeof val === 'number') {
          const d = XLSX.SSF.parse_date_code(val);
          if (d) {
            return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
          }
        }
        return String(val).trim();
      }

      function excelDateToYear(val) {
        const iso = excelDateToISO(val);
        return iso ? iso.slice(0, 4) : '';
      }

      // Normalize status values from Portuguese labels
      function normalizeStatus(raw) {
        const str = (raw || '').toString().trim();
        // Empty or dash → "-" status
        if (!str || str === '-') return 'nenhum';

        const s = str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (s.includes('SEM EFEITO'))                           return 'sem_efeito';
        if (s.includes('ENCERR'))                               return 'em_encerramento';
        if (s.includes('TRATATIV'))                             return 'em_tratativas';
        if (s.includes('EM ANALISE') || s.includes('ANALISE') || s.includes('LICENCIADOR')) return 'valida_analise';
        // "VALIDA A RENOVAR" and "A RENOVAR" must come before plain "VALID"
        if (s.includes('RENOVAR'))                              return 'valida_renovar';
        if (s.includes('VENCIDA') || s.includes('VENCIDO'))    return 'vencida';
        if (s.includes('VALID') || s.includes('ATIVA'))        return 'valida';
        return 'nenhum';
      }

      // Parse data rows (everything after the header)
      let imported = 0;
      let skipped  = 0;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        // Skip completely empty rows
        if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

        const r = { tema:'', orgao:'', natureza:'', numero:'', procedimento:'',
                    teor:'', interessado:'', ano:'', validade:'', status:'', docAnexo:'', observacao:'' };

        Object.entries(colToField).forEach(([colIdx, field]) => {
          const raw = row[colIdx];
          // For status, always run normalizeStatus (handles empty/dash too)
          if (field === 'status') {
            r.status = normalizeStatus(raw);
            return;
          }
          if (raw === undefined || raw === null || raw === '-' || raw === ' - ') return;

          if (field === 'validade') {
            r.validade = excelDateToISO(raw);
          } else if (field === 'ano') {
            r.ano = excelDateToISO(raw);
          } else {
            r[field] = String(raw).trim();
          }
        });

        // Skip rows with nothing useful
        if (!r.tema && !r.orgao && !r.numero && !r.natureza) { skipped++; continue; }

        records.push(r);
        imported++;
      }

      save();
      checkExpiryStatuses();
      renderTable();

      // Reset file input so the same file can be re-imported if needed
      event.target.value = '';

      showToast(`✓ ${imported} registros importados${skipped ? ` (${skipped} ignorados)` : ''}`);

    } catch (err) {
      console.error(err);
      showToast('⚠ Erro ao ler o arquivo Excel', '#b91c1c');
    }
  };

  reader.readAsArrayBuffer(file);
}

// ── Init ───────────────────────────────────────────────────────────────────
document.getElementById('editModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.getElementById('painelModal').addEventListener('click', function (e) {
  if (e.target === this) closePainel();
});

// Run expiry check on load, then every hour
checkExpiryStatuses();
renderTable();
renderInbox();
setInterval(checkExpiryStatuses, 60 * 60 * 1000);

// ── Fixed bottom scrollbar mirror ─────────────────────────────────────────
(function () {
  const mirror      = document.getElementById('scrollMirror');
  const mirrorInner = document.getElementById('scrollMirrorInner');
  const wrapper     = document.querySelector('.table-wrapper');

  let syncing = false;

  function syncMirrorWidth() {
    // Make the inner phantom div as wide as the actual scrollable content
    mirrorInner.style.width = wrapper.scrollWidth + 'px';
  }

  function updateMirrorVisibility() {
    const rect = wrapper.getBoundingClientRect();
    const tableBottomBelowViewport = rect.bottom > window.innerHeight;
    const tableTopInView           = rect.top    < window.innerHeight;
    const tableVisible             = tableTopInView && rect.bottom > 0;

    // Show mirror only when the table's own scrollbar would be off-screen
    mirror.style.display = (tableVisible && tableBottomBelowViewport) ? 'block' : 'none';

    // Keep mirror positioned to align with the table horizontally
    mirror.style.left  = rect.left  + 'px';
    mirror.style.width = rect.width + 'px';

    syncMirrorWidth();
  }

  // Sync scroll positions — guard against infinite loops
  mirror.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    wrapper.scrollLeft = mirror.scrollLeft;
    syncing = false;
  });

  wrapper.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    mirror.scrollLeft = wrapper.scrollLeft;
    syncing = false;
  });

  // Update on scroll, resize, and after table renders
  window.addEventListener('scroll',  updateMirrorVisibility, { passive: true });
  window.addEventListener('resize',  updateMirrorVisibility, { passive: true });

  // Re-check after renderTable() calls update the DOM
  const _origRender = renderTable;
  window.renderTable = function () {
    _origRender();
    requestAnimationFrame(updateMirrorVisibility);
  };

  // Initial check
  requestAnimationFrame(updateMirrorVisibility);
})();
