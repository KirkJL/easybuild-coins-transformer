let mapping = null;
let config = null;
let outputData = [];

async function init() {
  mapping = await fetch('mapping.json').then(r => r.json());
  config = await fetch('config.json').then(r => r.json());
}

document.getElementById('convertBtn').onclick = async () => {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return alert('Upload CSV');

  const text = await file.text();
  const rows = parseCSV(text);

  const direction = document.getElementById('direction').value;
  const transformed = transform(rows, direction);

  const validation = validate(transformed);

  if (validation.errors.length) {
    alert('Errors found. Fix before download.');
    console.log(validation);
    return;
  }

  outputData = transformed;
  document.getElementById('output').textContent = JSON.stringify(transformed.slice(0,5), null, 2);
  document.getElementById('downloadBtn').disabled = false;
};

document.getElementById('downloadBtn').onclick = () => {
  const csv = toCSV(outputData);
  download(csv);
};

function parseCSV(text) {
  const [headerLine, ...lines] = text.split('\n');
  const headers = headerLine.split(',');

  return lines.map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (values[i] || '').trim());
    return obj;
  });
}

function transform(data, direction) {
  const map = mapping[direction];
  return data.map(row => {
    const newRow = {};
    Object.keys(map).forEach(src => {
      let val = (row[src] || '').trim();

      if (map[src].includes('Email')) val = val.toLowerCase();
      if (map[src].includes('Phone')) val = val.replace(/\s+/g, '');

      newRow[map[src]] = val;
    });
    return newRow;
  });
}

function validate(data) {
  const errors = [];
  const seen = new Set();

  data.forEach((row, i) => {
    const r = i + 2;

    config.required_fields.forEach(field => {
      if (!row[field]) {
        errors.push({ row: r, field, message: 'Missing' });
      }
    });

    if (row.EmailAddress) {
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(row.EmailAddress)) {
        errors.push({ row: r, field: 'EmailAddress', message: 'Invalid email' });
      }

      if (seen.has(row.EmailAddress)) {
        errors.push({ row: r, field: 'EmailAddress', message: 'Duplicate' });
      }
      seen.add(row.EmailAddress);
    }
  });

  return { errors, warnings: [] };
}

function toCSV(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  rows.forEach(row => {
    lines.push(headers.map(h => row[h]).join(','));
  });

  return lines.join('\n');
}

function download(text) {
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'output.csv';
  a.click();
}

init();
