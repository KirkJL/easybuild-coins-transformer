// =========================
// INLINE CONFIG (NO FETCH)
// =========================

const mapping = {
  easybuild_to_coins: {
    "First Name": "ContactFirstName",
    "Last Name": "ContactLastName",
    "Email": "EmailAddress",
    "Phone": "PhoneNumber",
    "Plot": "PlotID"
  },
  coins_to_easybuild: {
    "ContactFirstName": "First Name",
    "ContactLastName": "Last Name",
    "EmailAddress": "Email",
    "PhoneNumber": "Phone",
    "PlotID": "Plot"
  }
};

const config = {
  required_fields: ["ContactFirstName", "ContactLastName", "EmailAddress"],
  unique_fields: ["EmailAddress"],
  field_rules: {
    EmailAddress: { type: "email", required: true },
    PhoneNumber: { type: "phone", required: false, min_length: 10 },
    PlotID: { type: "string", required: false }
  }
};

let outputData = [];

console.log("APP LOADED");

// =========================
// EVENTS
// =========================
document.getElementById('fileInput').addEventListener('change', () => {
  console.log("FILE SELECTED");
});

document.getElementById('convertBtn').onclick = async () => {
  console.log("CONVERT CLICKED");

  const file = document.getElementById('fileInput').files[0];

  if (!file) {
    alert("Upload a file first");
    return;
  }

  const text = await file.text();

  console.log("FILE LOADED");

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

document.getElementById('downloadBtn').onclick = () => {
  const csv = toCSV(outputData);
  download(csv);
};

// =========================
// CSV PARSE
// =========================
function parseCSV(text) {
  const rows = [];
  let current = '';
  let insideQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (current || row.length) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const headers = rows[0].map(h => h.trim());

  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] || '').trim();
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

      if (map[src].includes('Email')) val = val.toLowerCase();
      if (map[src].includes('Phone')) val = val.replace(/\s+/g, '');

      newRow[map[src]] = val;
    });

    return newRow;
  });
}

// =========================
// VALIDATE
// =========================
function validate(data) {
  const errors = [];
  const seen = new Set();

  data.forEach((row, i) => {
    const r = i + 2;

    config.required_fields.forEach(field => {
      if (!row[field]) {
        errors.push({ row: r, field, message: "Missing" });
      }
    });

    if (row.EmailAddress) {
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(row.EmailAddress)) {
        errors.push({ row: r, field: "EmailAddress", message: "Invalid email" });
      }

      if (seen.has(row.EmailAddress)) {
        errors.push({ row: r, field: "EmailAddress", message: "Duplicate" });
      }

      seen.add(row.EmailAddress);
    }
  });

  return { errors, warnings: [] };
}

// =========================
// CSV BUILD
// =========================
function toCSV(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  rows.forEach(row => {
    lines.push(headers.map(h => row[h]).join(','));
  });

  return lines.join('\n');
}

// =========================
// DOWNLOAD
// =========================
function download(text) {
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'output.csv';
  a.click();
}
