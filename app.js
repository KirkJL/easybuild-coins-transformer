// =========================
// STATE
// =========================
let rawData = [];
let transformedData = [];
let validationResults = { errors: [], warnings: [] };

// =========================
// STATIC SAFE CONFIG
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

const baseConfig = {
  required_fields: ["ContactFirstName", "ContactLastName", "EmailAddress"],
  unique_fields: ["EmailAddress"]
};

// =========================
// DOM
// =========================
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const dropZone = document.getElementById("dropZone");

const fileNameEl = document.getElementById("fileName");
const detectedHeadersEl = document.getElementById("detectedHeaders");

const convertBtn = document.getElementById("convertBtn");
const downloadBtn = document.getElementById("downloadBtn");
const downloadErrorsBtn = document.getElementById("downloadErrorsBtn");
const resetBtn = document.getElementById("resetBtn");

const requiredFieldsSelect = document.getElementById("requiredFields");

const emailRequiredToggle = document.getElementById("emailRequiredToggle");
const phoneRequiredToggle = document.getElementById("phoneRequiredToggle");
const uniqueEmailToggle = document.getElementById("uniqueEmailToggle");
const requirePlotIdToggle = document.getElementById("requirePlotIdToggle");

const originalPreview = document.getElementById("originalPreview");
const transformedPreview = document.getElementById("transformedPreview");

const errorsList = document.getElementById("errorsList");
const warningsList = document.getElementById("warningsList");

const statusText = document.getElementById("statusText");

// =========================
// FILE INPUT
// =========================
browseBtn.onclick = () => fileInput.click();

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", e => e.preventDefault());

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// =========================
// HANDLE FILE
// =========================
async function handleFile(file) {
  fileNameEl.textContent = file.name;

  const text = await file.text();
  rawData = parseCSV(text);

  if (!rawData.length) {
    statusText.textContent = "Invalid CSV.";
    return;
  }

  detectedHeadersEl.textContent = Object.keys(rawData[0]).join(", ");

  renderPreview(originalPreview, rawData);

  populateRequiredFields();

  statusText.textContent = "File loaded.";
}

// =========================
// POPULATE REQUIRED FIELDS
// =========================
function populateRequiredFields() {
  requiredFieldsSelect.innerHTML = "";

  const direction = getDirection();
  const map = mapping[direction];

  Object.values(map).forEach(field => {
    const option = document.createElement("option");
    option.value = field;
    option.textContent = field;

    if (baseConfig.required_fields.includes(field)) {
      option.selected = true;
    }

    requiredFieldsSelect.appendChild(option);
  });
}

// =========================
// DIRECTION CHANGE
// =========================
document.querySelectorAll('input[name="direction"]').forEach(radio => {
  radio.addEventListener("change", () => {
    if (rawData.length) populateRequiredFields();
  });
});

function getDirection() {
  return document.querySelector('input[name="direction"]:checked').value;
}

// =========================
// CONVERT
// =========================
convertBtn.onclick = () => {
  try {
    if (!rawData.length) {
      alert("Upload a CSV first.");
      return;
    }

    const direction = getDirection();

    transformedData = transform(rawData, direction);

    const config = buildValidationConfig();

    validationResults = validate(transformedData, config);

    renderPreview(transformedPreview, transformedData);
    renderResults();

    downloadBtn.disabled = validationResults.errors.length > 0;
    downloadErrorsBtn.disabled =
      validationResults.errors.length === 0 &&
      validationResults.warnings.length === 0;

    statusText.textContent = validationResults.errors.length
      ? "Errors found."
      : "Success.";

  } catch (err) {
    console.error(err);
    alert("Conversion failed.");
  }
};

// =========================
// BUILD VALIDATION CONFIG
// =========================
function buildValidationConfig() {
  const selectedRequired = Array.from(requiredFieldsSelect.selectedOptions).map(o => o.value);

  const required = new Set(selectedRequired);

  if (emailRequiredToggle.checked) required.add("EmailAddress");
  if (phoneRequiredToggle.checked) required.add("PhoneNumber");
  if (requirePlotIdToggle.checked) required.add("PlotID");

  return {
    required_fields: Array.from(required),
    unique_email: uniqueEmailToggle.checked
  };
}

// =========================
// TRANSFORM
// =========================
function transform(data, direction) {
  const map = mapping[direction];

  return data.map(row => {
    const newRow = {};

    Object.keys(map).forEach(src => {
      let val = (row[src] || "").trim();

      if (map[src].includes("Email")) val = val.toLowerCase();
      if (map[src].includes("Phone")) val = val.replace(/\s+/g, "");

      newRow[map[src]] = val;
    });

    return newRow;
  });
}

// =========================
// VALIDATE
// =========================
function validate(data, config) {
  const errors = [];
  const warnings = [];
  const seenEmails = new Set();

  data.forEach((row, i) => {
    const r = i + 2;

    config.required_fields.forEach(field => {
      if (!row[field]) {
        errors.push({ row: r, field, message: "Missing value" });
      }
    });

    if (row.EmailAddress) {
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(row.EmailAddress)) {
        errors.push({ row: r, field: "EmailAddress", message: "Invalid email" });
      }

      if (config.unique_email) {
        if (seenEmails.has(row.EmailAddress)) {
          errors.push({ row: r, field: "EmailAddress", message: "Duplicate email" });
        }
        seenEmails.add(row.EmailAddress);
      }
    }

    if (row.PhoneNumber && row.PhoneNumber.length < 10) {
      warnings.push({ row: r, field: "PhoneNumber", message: "Phone too short" });
    }
  });

  return { errors, warnings };
}

// =========================
// CSV PARSER
// =========================
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");

  return lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};

    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || "").trim();
    });

    return obj;
  });
}

// =========================
// PREVIEW
// =========================
function renderPreview(container, data) {
  if (!data.length) {
    container.innerHTML = "No data.";
    return;
  }

  const headers = Object.keys(data[0]);

  let html = "<table><thead><tr>";
  headers.forEach(h => html += `<th>${h}</th>`);
  html += "</tr></thead><tbody>";

  data.slice(0, 5).forEach(row => {
    html += "<tr>";
    headers.forEach(h => html += `<td>${row[h] || ""}</td>`);
    html += "</tr>";
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

// =========================
// RESULTS UI
// =========================
function renderResults() {
  errorsList.innerHTML = validationResults.errors.length
    ? validationResults.errors.map(e => `<div>Row ${e.row} - ${e.field}: ${e.message}</div>`).join("")
    : "No errors.";

  warningsList.innerHTML = validationResults.warnings.length
    ? validationResults.warnings.map(w => `<div>Row ${w.row} - ${w.field}: ${w.message}</div>`).join("")
    : "No warnings.";
}

// =========================
// DOWNLOADS
// =========================
downloadBtn.onclick = () => {
  const csv = toCSV(transformedData);
  download(csv, "output.csv");
};

downloadErrorsBtn.onclick = () => {
  const rows = [
    ["Row", "Field", "Type", "Message"],
    ...validationResults.errors.map(e => [e.row, e.field, "Error", e.message]),
    ...validationResults.warnings.map(w => [w.row, w.field, "Warning", w.message])
  ];

  const csv = rows.map(r => r.join(",")).join("\n");
  download(csv, "validation-report.csv");
};

// =========================
// RESET
// =========================
resetBtn.onclick = () => {
  rawData = [];
  transformedData = [];
  validationResults = { errors: [], warnings: [] };

  fileInput.value = "";
  fileNameEl.textContent = "No file selected";
  detectedHeadersEl.textContent = "—";

  originalPreview.innerHTML = "Upload a file.";
  transformedPreview.innerHTML = "Convert a file.";

  errorsList.innerHTML = "No errors.";
  warningsList.innerHTML = "No warnings.";

  downloadBtn.disabled = true;
  downloadErrorsBtn.disabled = true;

  statusText.textContent = "Reset complete.";
};

// =========================
// CSV BUILD
// =========================
function toCSV(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  rows.forEach(row => {
    lines.push(headers.map(h => row[h]).join(","));
  });

  return lines.join("\n");
}

function download(text, filename) {
  const blob = new Blob([text], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
