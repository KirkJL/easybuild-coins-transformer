// =========================
// STATE
// =========================
let mapping = null;
let config = null;
let outputData = [];
let isReady = false;

// =========================
// INIT (BLOCKING READY STATE)
// =========================
async function init() {
  try {
    console.log("INIT START");

    const mappingRes = await fetch('mapping.json');
    const configRes = await fetch('config.json');

    if (!mappingRes.ok || !configRes.ok) {
      throw new Error("Failed to load JSON files");
    }

    mapping = await mappingRes.json();
    config = await configRes.json();

    isReady = true;

    console.log("INIT COMPLETE", { mapping, config });

  } catch (err) {
    console.error("INIT FAILED:", err);
    alert("App failed to load config files. Check console.");
  }
}

init();

// =========================
// UI EVENTS
// =========================
document.getElementById('convertBtn').onclick = async () => {

  if (!isReady) {
    alert("App still loading. Try again in a second.");
    return;
  }

  const file = document.getElementById('fileInput').files[0];
  if (!file) {
    alert("Upload a CSV file first.");
    return;
  }

  const text = await file.text();

  const rows = parseCSV(text);

  const direction = document.getElementById('direction').value;

  const transformed = transform(rows, direction);

  const validation = validate(transformed);

  if (validation.errors.length) {
    console.error(validation.errors);
    alert("Validation errors found. Check console.");
    return;
  }

  outputData = transformed;

  document.getElementById('output').textContent =
    JSON.stringify(transformed.slice(0, 5), null, 2);

  document.getElementById('downloadBtn').disabled = false;
};

// =========================
// DOWNLOAD
// =========================
document.getElementById('downloadBtn').onclick = () => {
  const csv = toCSV(outputData);
  download(csv);
};

// =========================
// CSV PARSER
// =========================
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};

    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || '').trim();
    });

    return obj;
  });
}

// =========================
// TRANSFORM
// =========================
function transform(data, direction) {
  const map = mapping[direction];

  return data.map(row => {
    const newRow = {};

    Object.keys(map).forEach(src => {
      let val = (row[src] || '').trim();

      if (map[src].includes('Email')) {
        val = val.toLowerCase();
      }

      if (map[src].includes('Phone')) {
        val = val.replace(/\s+/g, '');
      }

      newRow[map[src]] = val;
    });

    return newRow;
  });
}

// =========================
// VALIDATION
// =========================
function validate(data) {
  const errors = [];
  const seen = new Set();

  data.forEach((row, i) => {
    const rowNum = i + 2;

    config.required_fields.forEach(field => {
      if (!row[field]) {
        errors.push({ row: rowNum, field, message: "Missing value" });
      }
    });

    if (row.EmailAddress) {

      if (!/^[^@]+@[^@]+\.[^@]+$/.test(row.EmailAddress)) {
        errors.push({
          row: rowNum,
          field: "EmailAddress",
          message: "Invalid email"
        });
      }

      if (seen.has(row.EmailAddress)) {
        errors.push({
          row: rowNum,
          field: "EmailAddress",
          message: "Duplicate email"
        });
      }

      seen.add(row.EmailAddress);
    }
  });

  return { errors, warnings: [] };
}

// =========================
// CSV GENERATOR
// =========================
function toCSV(rows) {
  const headers = Object.keys(rows[0]);

  const lines = [
    headers.join(',')
  ];

  rows.forEach(row => {
    lines.push(headers.map(h => row[h]).join(','));
  });

  return lines.join('\n');
}

// =========================
// DOWNLOAD HELPER
// =========================
function download(text) {
  const blob = new Blob([text], { type: 'text/csv' });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'output.csv';

  a.click();
}
