'use strict';

(() => {
  const state = {
    mapping: null,
    defaultConfig: null,
    uploadedFile: null,
    uploadedText: '',
    originalRows: [],
    transformedRows: [],
    validationResults: { errors: [], warnings: [] },
    outputCsv: '',
    effectiveConfig: null,
    direction: 'easybuild_to_coins'
  };

  const elements = {
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    browseBtn: document.getElementById('browseBtn'),
    fileName: document.getElementById('fileName'),
    detectedHeaders: document.getElementById('detectedHeaders'),
    requiredFields: document.getElementById('requiredFields'),
    emailRequiredToggle: document.getElementById('emailRequiredToggle'),
    phoneRequiredToggle: document.getElementById('phoneRequiredToggle'),
    uniqueEmailToggle: document.getElementById('uniqueEmailToggle'),
    requirePlotIdToggle: document.getElementById('requirePlotIdToggle'),
    convertBtn: document.getElementById('convertBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    downloadErrorsBtn: document.getElementById('downloadErrorsBtn'),
    resetBtn: document.getElementById('resetBtn'),
    exportConfigBtn: document.getElementById('exportConfigBtn'),
    importConfigInput: document.getElementById('importConfigInput'),
    originalPreview: document.getElementById('originalPreview'),
    transformedPreview: document.getElementById('transformedPreview'),
    errorsList: document.getElementById('errorsList'),
    warningsList: document.getElementById('warningsList'),
    statusText: document.getElementById('statusText'),
    progressFill: document.getElementById('progressFill')
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindEvents();

    try {
      updateStatus('Loading mapping and validation defaults…', 5);
      state.mapping = await loadJson('mapping.json');
      state.defaultConfig = await loadConfig();
      state.direction = getSelectedDirection();
      syncValidationControlsFromDefaults();
      populateRequiredFields();
      updateStatus('Ready.', 0);
    } catch (error) {
      console.error(error);
      updateStatus('Failed to load app configuration files. Check mapping.json and config.json.', 0);
      elements.convertBtn.disabled = true;
    }
  }

  function bindEvents() {
    elements.browseBtn.addEventListener('click', () => elements.fileInput.click());

    elements.fileInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        await handleFile(file);
      }
    });

    elements.dropZone.addEventListener('click', () => elements.fileInput.click());

    elements.dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        elements.fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove('is-dragover');
      });
    });

    elements.dropZone.addEventListener('drop', async (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) {
        await handleFile(file);
      }
    });

    document.querySelectorAll('input[name="direction"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        state.direction = getSelectedDirection();
        populateRequiredFields();
        resetConversionArtifacts(false);
        renderTransformedPreview([]);
        renderResults({ errors: [], warnings: [] });
        updateStatus('Direction changed. Ready.', 0);
      });
    });

    elements.convertBtn.addEventListener('click', onConvert);
