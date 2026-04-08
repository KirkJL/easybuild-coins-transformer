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
document.addEventListener("DOMContentLoaded", async () => {
  mapping = await fetchJSON("mapping.json");
  baseConfig = await fetchJSON("config.json");

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
// UPLOAD
// ==========================
function setupUpload() {
  const input = document.getElementById("fileInput");
  const btn = document.getElementById("browseBtn");

  btn.onclick = () => input.click();

  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });
}

function handleFile(file) {
  document.getElementById("fileName").textContent = file.name;

  const reader = new FileReader();

  reader.onload = e => {
    rawData = parseCSV(e.target.result);

    if (!rawData.length) return;

    document.getElementById("detectedHeaders").textContent =
      Object.keys(rawData[0]).join(", ");

    renderPreview("originalPreview", rawData);
    populateRequiredFields();
  };

  reader.readAsText(file);
}

// ==========================
// CSV PARSER
// ==========================
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || "").trim();
    });
    return obj;
  });
}

// ==========================
// REQUIRED FIELDS POPULATION
// ==========================
function populateRequiredFields() {
  const select = document.getElementById("requiredFields");
  select.innerHTML = "";

  const direction = getDirection();
  const map = mapping[direction];

  const mappedFields = Object.values(map);
  const headers = rawData.length ? Object.keys(rawData[0]) : [];

  const availableFields = mappedFields.filter(f => headers.includes(f));

  availableFields.forEach(field => {
    const option = document.createElement("option");
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
      let val = row[src] || "";

      // cleaning rules
      val = val.trim();

      if (dest.toLowerCase().includes("email")) {
        val = val.toLowerCase();
      }

      if (dest.toLowerCase().includes("phone")) {
        val = val.replace(/\s+/g, "");
      }

      out[dest] = val;
    }

    return out;
  });
}

// ==========================
// VALIDATION CONFIG
// ==========================
function buildUserConfig() {
  const requiredFields = Array.from(
    document.getElementById("requiredFields").selectedOptions
  ).map(o => o.value);

  return {
    required_fields: requiredFields,
    emailRequired: document.getElementById("emailRequiredToggle").checked,
    phoneRequired: document.getElementById("phoneRequiredToggle").checked,
    uniqueEmail: document.getElementById("uniqueEmailToggle").checked,
    requirePlot: document.getElementById("requirePlotIdToggle").checked
  };
}

// ==========================
// VALIDATION
// ==========================
function validateData(data, config) {
  const errors = [];
  const warnings = [];

  const seenEmails = new Set();

  data.forEach((row, index) => {
    const rowNum = index + 1;

    // required fields
    config.required_fields.forEach(field => {
      if (!row[field]) {
        errors.push({ row: rowNum, field, message: "Missing required field" });
      }
    });

    // email
    const email = row.EmailAddress;
    if (email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.push({ row: rowNum, field: "EmailAddress", message: "Invalid email" });
      }

      if (config.uniqueEmail) {
        if (seenEmails.has(email)) {
          errors.push({ row: rowNum, field: "EmailAddress", message: "Duplicate email" });
        }
        seenEmails.add(email);
      }
    } else if (config.emailRequired) {
      errors.push({ row: rowNum, field: "EmailAddress", message: "Email required" });
    }

    // phone
    const phone = row.PhoneNumber;
    if (phone) {
      if (phone.length < 10) {
        warnings.push({ row: rowNum, field: "PhoneNumber", message: "Short phone number" });
      }
    } else if (config.phoneRequired) {
      errors.push({ row: rowNum, field: "PhoneNumber", message: "Phone required" });
    }

    // plot
    if (config.requirePlot && !row.PlotID) {
      errors.push({ row: rowNum, field: "PlotID", message: "Plot required" });
    }

    // empty row
    if (Object.values(row).every(v => !v)) {
      errors.push({ row: rowNum, field: "-", message: "Empty row" });
    }
  });

  return { errors, warnings };
}

// ==========================
// ACTIONS
// ==========================
function setupActions() {
  document.getElementById("convertBtn").onclick = () => {
    if (!rawData.length) return;

    const direction = getDirection();

    transformedData = transformData(rawData, direction);

    const userConfig = buildUserConfig();

    validationResults = validateData(transformedData, userConfig);

    renderPreview("transformedPreview", transformedData, validationResults);
    renderResults(validationResults);

    document.getElementById("downloadBtn").disabled = validationResults.errors.length > 0;
    document.getElementById("downloadErrorsBtn").disabled =
      validationResults.errors.length === 0 &&
      validationResults.warnings.length === 0;
  };

  document.getElementById("downloadBtn").onclick = () => {
    downloadCSV(transformedData, "output.csv");
  };

  document.getElementById("downloadErrorsBtn").onclick = () => {
    downloadErrorReport(validationResults);
  };

  document.getElementById("resetBtn").onclick = () => location.reload();

  document.querySelectorAll('input[name="direction"]').forEach(r => {
    r.addEventListener("change", () => {
      if (rawData.length) populateRequiredFields();
    });
  });
}

// ==========================
// HELPERS
// ==========================
function getDirection() {
  return document.querySelector('input[name="direction"]:checked').value;
}

// ==========================
// PREVIEW
// ==========================
function renderPreview(id, data, validation = null) {
  const el = document.getElementById(id);

  if (!data.length) {
    el.innerHTML = "No data";
    return;
  }

  const headers = Object.keys(data[0]);

  let html = "<table><thead><tr>";
  headers.forEach(h => (html += `<th>${h}</th>`));
  html += "</tr></thead><tbody>";

  data.slice(0, 5).forEach((row, i) => {
    const hasError =
      validation &&
      validation.errors.some(e => e.row === i + 1);

    html += `<tr class="${hasError ? "error-row" : ""}">`;

    headers.forEach(h => {
      html += `<td>${row[h] || ""}</td>`;
    });

    html += "</tr>";
  });

  html += "</tbody></table>";
  el.innerHTML = html;
}

// ==========================
// RESULTS
// ==========================
function renderResults(results) {
  const errorsEl = document.getElementById("errorsList");
  const warningsEl = document.getElementById("warningsList");

  errorsEl.innerHTML = results.errors.length
    ? results.errors.map(e => `<p>Row ${e.row} [${e.field}] - ${e.message}</p>`).join("")
    : "No errors";

  warningsEl.innerHTML = results.warnings.length
    ? results.warnings.map(w => `<p>Row ${w.row} [${w.field}] - ${w.message}</p>`).join("")
    : "No warnings";
}

// ==========================
// DOWNLOADS
// ==========================
function downloadCSV(data, filename) {
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => `"${row[h] || ""}"`).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function downloadErrorReport(results) {
  const rows = [
    ["Row", "Field", "Type", "Message"],
    ...results.errors.map(e => [e.row, e.field, "Error", e.message]),
    ...results.warnings.map(w => [w.row, w.field, "Warning", w.message])
  ];

  const csv = rows.map(r => r.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `validation-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
