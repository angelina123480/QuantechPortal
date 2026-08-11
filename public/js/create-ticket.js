(function () {
  'use strict';

  var drop = document.getElementById('fileDrop');
  var input = document.getElementById('attachments');
  var fileList = document.getElementById('fileList');
  if (!drop || !input || !fileList) return;

  var MAX_FILES = 5;
  var MAX_SIZE = 10 * 1024 * 1024;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderFileList() {
    fileList.innerHTML = '';
    Array.prototype.forEach.call(input.files, function (file, index) {
      var chip = document.createElement('div');
      chip.className = 'file-chip';

      var nameWrap = document.createElement('div');
      nameWrap.className = 'file-chip-name';
      var nameSpan = document.createElement('span');
      nameSpan.textContent = file.name + ' · ' + formatSize(file.size);
      nameWrap.appendChild(nameSpan);
      chip.appendChild(nameWrap);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'file-chip-remove';
      removeBtn.setAttribute('aria-label', 'Remove ' + file.name);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function () {
        removeFile(index);
      });
      chip.appendChild(removeBtn);

      fileList.appendChild(chip);
    });
  }

  function removeFile(indexToRemove) {
    var dt = new DataTransfer();
    Array.prototype.forEach.call(input.files, function (file, index) {
      if (index !== indexToRemove) dt.items.add(file);
    });
    input.files = dt.files;
    renderFileList();
  }

  function addFiles(newFiles) {
    var dt = new DataTransfer();
    Array.prototype.forEach.call(input.files, function (file) { dt.items.add(file); });

    var oversized = [];
    Array.prototype.forEach.call(newFiles, function (file) {
      if (dt.items.length >= MAX_FILES) return;
      if (file.size > MAX_SIZE) {
        oversized.push(file.name);
        return;
      }
      dt.items.add(file);
    });

    input.files = dt.files;
    renderFileList();

    if (oversized.length && window.QT) {
      window.QT.toast(oversized.join(', ') + ' exceeded the 10MB limit and was skipped.', 'error');
    }
  }

  drop.addEventListener('click', function () { input.click(); });
  drop.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  drop.setAttribute('tabindex', '0');
  drop.setAttribute('role', 'button');

  input.addEventListener('change', function () { renderFileList(); });

  ['dragenter', 'dragover'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) {
      e.preventDefault();
      drop.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) {
      e.preventDefault();
      drop.classList.remove('is-dragover');
    });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
})();
