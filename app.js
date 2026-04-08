'use strict';

// ==========================
// STATE
// ==========================
let rawData = [];
let transformedData = [];
let mapping = {};
let baseConfig = {};
let validationResults = { errors: [], warnings: [] };

// ==========================
// INIT
// ==========================
document.addEventListener('DOMContentLoaded', async () => {
  mapping = await fetchJSON('mapping.json');
  baseConfig = await fetchJSON('config.json');

  setupUpload();
  setupActions();
});

// ==========================
// FETCH JSON
// ==========================
async function fetchJSON(path) {
  const res = await fetch(path);
  return await res.json();
}

// ==========================
// HELPERS
// ==========================
function el(id) {
  return document.getElementById(id);
}

function getDirection() {
  return document.querySelector('input[name="direction"]:checked').value;
}

// ==========================
// UPLOAD
// ==========================
function setupUpload() {
  const input = el('fileInput');
  const btn = el('browseBtn');

  btn.onclick = () => input.click();

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });
}

async function handleFile(file) {
  el('fileName').textContent = file.name;

  const text = await file.text();
  rawData = parseCSV(text);

  if (!rawData.length) return;

  const headers = Object.keys(rawData[0]);
  el('detectedHeaders').textContent = headers.join(', ');

  renderPreview('originalPreview', rawData);

  // 🔥 FIXED FIELD POPULATION
  populateRequiredFields(headers);
}

// ==========================
// CSV PARSER
// ==========================
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').trim();
    });
    return obj;
  });
}

// ==========================
// REQUIRED FIELDS (FIXED)
// ==========================
function getAvailableTargetFields(headers, direction) {
  const map = mapping[direction];

  // ✅ STEP 1: find valid SOURCE fields in CSV
  const validSourceFields = Object.keys(map).filter(src =>
    headers.includes(src)
  );

  // ✅ STEP 2: convert to TARGET fields
  return validSourceFields.map(src => map[src]);
}

function populateRequiredFields(headers) {
  const select = el('requiredFields');
  select.innerHTML = '';

  const direction = getDirection();

  const fields = getAvailableTargetFields(headers, direction);

  fields.forEach(field => {
    const option = document.createElement('option');
    option.value = field;
    option.textContent = field;

    if (baseConfig.required_fields.includes(field)) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

// ==========================
// TRANSFORM
// ==========================
function transformData(data, direction) {
  const map = mapping[direction];

  return data.map(row => {
    const out = {};

    for (const [src, dest] of Object.entries(map)) {
      let val = row[src] || '';

      val = val.trim();

      if (dest.toLowerCase().includes('email')) {
        val = val.toLowerCase();
      }

      if (dest.toLowerCase().includes('phone')) {
        val = val.replace(/\s+/g, '');
      }

      out[dest] = val;
    }

    return out;
  });
}

// ==========================
// USER CONFIG
// ==========================
function buildUserConfig() {
  return {
    required_fields: Array.from(el('requiredFields').selectedOptions).map(o => o.value),
    emailRequired: el('emailRequiredToggle').checked,
    phoneRequired: el('phoneRequiredToggle').checked,
    uniqueEmail: el('uniqueEmailToggle').checked,
    requirePlot: el('requirePlotIdToggle').checked
  };
}

// ==========================
// VALIDATION
// ==========================
function validateData(data, config) {
  const errors = [];
  const warnings = [];
  const seenEmails = new Set();

  data.forEach((row, i) => {
    const rowNum = i + 1;

    config.required_fields.forEach(field => {
      if (!row[field]) {
        errors.push({ row: rowNum, field, message: 'Missing required field' });
      }
    });

    const email = row.EmailAddress || row.Email;
    const phone = row.PhoneNumber || row.Phone;
    const plot = row.PlotID || row.Plot;

    if (email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.push({ row: rowNum, field: 'Email', message: 'Invalid email' });
      }

      if (config.uniqueEmail) {
        if (seenEmails.has(email)) {
          errors.push({ row: rowNum, field: 'Email', message: 'Duplicate email' });
        }
        seenEmails.add(email);
      }
    } else if (config.emailRequired) {
      errors.push({ row: rowNum, field: 'Email', message: 'Email required' });
    }

    if (phone) {
      if (phone.length < 10) {
        warnings.push({ row: rowNum, field: 'Phone', message: 'Short phone number' });
      }
    } else if (config.phoneRequired) {
      errors.push({ row: rowNum, field: 'Phone', message: 'Phone required' });
    }

    if (config.requirePlot && !plot) {
      errors.push({ row: rowNum, field: 'Plot', message: 'Plot required' });
    }
  });

  return { errors, warnings };
}

// ==========================
// ACTIONS
// ==========================
function setupActions() {
  el('convertBtn').onclick = () => {
    if (!rawData.length) return;

    const direction = getDirection();

    transformedData = transformData(rawData, direction);

    const config = buildUserConfig();
    validationResults = validateData(transformedData, config);

    renderPreview('transformedPreview', transformedData, validationResults);
    renderResults(validationResults);

    el('downloadBtn').disabled = validationResults.errors.length > 0;
    el('downloadErrorsBtn').disabled =
      validationResults.errors.length === 0 &&
      validationResults.warnings.length === 0;
  };

  el('downloadBtn').onclick = () => {
    downloadCSV(transformedData, 'output.csv');
  };

  el('downloadErrorsBtn').onclick = () => {
    downloadErrorReport(validationResults);
  };

  el('resetBtn').onclick = () => location.reload();

  document.querySelectorAll('input[name="direction"]').forEach(r => {
    r.addEventListener('change', () => {
      if (!rawData.length) return;

      const headers = Object.keys(rawData[0]);
      populateRequiredFields(headers);
    });
  });
}

// ==========================
// PREVIEW
// ==========================
function renderPreview(id, data, validation = null) {
  const elDiv = el(id);

  if (!data.length) {
    elDiv.innerHTML = 'No data';
    return;
  }

  const headers = Object.keys(data[0]);

  let html = '<table><thead><tr>';
  headers.forEach(h => (html += `<th>${h}</th>`));
  html += '</tr></thead><tbody>';

  data.slice(0, 5).forEach((row, i) => {
    const hasError =
      validation &&
      validation.errors.some(e => e.row === i + 1);

    html += `<tr class="${hasError ? 'error-row' : ''}">`;

    headers.forEach(h => {
      html += `<td>${row[h] || ''}</td>`;
    });

    html += '</tr>';
  });

  html += '</tbody></table>';
  elDiv.innerHTML = html;
}

// ==========================
// RESULTS
// ==========================
function renderResults(results) {
  el('errorsList').innerHTML = results.errors.length
    ? results.errors.map(e => `<p>Row ${e.row} [${e.field}] - ${e.message}</p>`).join('')
    : 'No errors';

  el('warningsList').innerHTML = results.warnings.length
    ? results.warnings.map(w => `<p>Row ${w.row} [${w.field}] - ${w.message}</p>`).join('')
    : 'No warnings';
}

// ==========================
// DOWNLOADS
// ==========================
function downloadCSV(data, filename) {
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => `"${row[h] || ''}"`).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function downloadErrorReport(results) {
  const rows = [
    ['Row', 'Field', 'Type', 'Message'],
    ...results.errors.map(e => [e.row, e.field, 'Error', e.message]),
    ...results.warnings.map(w => [w.row, w.field, 'Warning', w.message])
  ];

  const csv = rows.map(r => r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `validation-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
