/**
 * popup.js — Premium Interactive UI Controller
 */
var currentResults = null;

document.addEventListener('DOMContentLoaded', function () {

  // ─── Safe helpers ────────────────────────────────────────────────────────
  function $ (id)  { return document.getElementById(id); }
  function qA(sel) { return document.querySelectorAll(sel); }
  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

  function checkStartBtnState() {
    var urlEl  = $('appUrl');
    var upload = $('excelUpload');
    var url    = urlEl ? urlEl.value.trim() : '';
    var file   = upload ? upload.files[0] : null;
    var btn    = $('startBtn');
    if (!btn) return;
    
    var validUrl = /^https?:\/\/.+/.test(url);
    if (!validUrl || !file) {
      btn.disabled = true;
      var btnText = $('startBtnText');
      if (btnText) {
        if (!file) btnText.textContent = 'Upload a valid file to enable';
        else if (!validUrl) btnText.textContent = 'Enter a valid App URL to run';
      }
    } else {
      btn.disabled = false;
      var btnText = $('startBtnText');
      if (btnText) {
          if (currentResults) btnText.textContent = '✓ Done — Run Again';
          else btnText.textContent = '▶ Start Test Execution';
      }
    }
  }

  // ─── TAB NAVIGATION ──────────────────────────────────────────────────────
  function resetLogsBadge() {
    var badge = $('logsBadge');
    if (badge) {
      badge.classList.add('hidden');
      badge.textContent = '0';
    }
  }

  qA('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      qA('.tab').forEach(function (t) { t.classList.remove('active'); });
      qA('.tab-content').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = $('tab-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
      if (tab.dataset.tab === 'logs') resetLogsBadge();
    });
  });

  function switchTab(name) {
    qA('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    qA('.tab-content').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    if (name === 'logs') resetLogsBadge();
  }

  // ─── LOGIN COLLAPSIBLE ───────────────────────────────────────────────────
  on('loginToggle', 'click', function () {
    var body    = $('loginBody');
    var chevron = $('loginChevron');
    var badge   = $('loginBadge');
    if (!body) return;
    var open = body.classList.toggle('open');
    if (chevron) chevron.classList.toggle('open', open);
    if (badge) {
      if (open) { badge.textContent = 'Active';   badge.classList.replace('green', 'active'); }
      else       { badge.textContent = 'Optional'; badge.classList.replace('active', 'green'); }
    }
  });

  // ─── PASSWORD TOGGLE ─────────────────────────────────────────────────────
  on('togglePwd', 'click', function () {
    var pw = $('loginPassword');
    if (!pw) return;
    pw.type = pw.type === 'password' ? 'text' : 'password';
    var eye = $('togglePwd');
    if (eye) eye.textContent = pw.type === 'password' ? '👁' : '🙈';
  });

  // ─── URL VALIDATION ───────────────────────────────────────────────────────
  on('appUrl', 'input', function () {
    var val   = this.value.trim();
    var check = $('urlCheck');
    if (!check) return;
    if (!val)                         { check.textContent = ''; }
    else if (/^https?:\/\/.+/.test(val)) { check.textContent = '✅'; }
    else                              { check.textContent = '⚠️'; }
    checkStartBtnState();
  });

  // ─── FILE DRAG & DROP ────────────────────────────────────────────────────
  var dropZone = $('dropZone');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (ev) {
      dropZone.addEventListener(ev, function () { dropZone.classList.remove('drag-over'); });
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      var file = e.dataTransfer.files[0];
      if (file) setFileDisplay(file);
    });
  }

  on('excelUpload', 'change', function () {
    if (this.files[0]) setFileDisplay(this.files[0]);
  });

  function setFileDisplay(file) {
    var allowed = ['.xlsx', '.xls', '.csv'];
    var ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { setStatus('Invalid file type. Use .xlsx, .xls, or .csv', true); return; }
    var inner    = $('dropzoneInner');
    var selected = $('fileSelected');
    var nameEl   = $('fileSelectedName');
    var sizeEl   = $('fileSelectedSize');
    var badgeEl  = $('fileValidBadge');
    var iconEl   = $('fileValidIcon');
    if (inner)    inner.classList.add('hidden');
    if (selected) selected.classList.remove('hidden');
    if (nameEl)   nameEl.textContent = file.name;
    if (sizeEl)   sizeEl.textContent = formatBytes(file.size);
    if (badgeEl)  badgeEl.textContent = '⏳ Checking...';
    if (badgeEl)  badgeEl.className = 'file-val-badge checking';
    if (iconEl)   iconEl.textContent = '📄';
    clearFileValidation();

    // Parse the file immediately to validate format
    parseFile(file).then(function(result) {
      var tc = result.testCases || [];
      var stepTotal = tc.reduce(function(sum, c) { return sum + (c.steps ? c.steps.length : 0); }, 0);
      showFvSuccess(tc.length, stepTotal, result.headers || []);
      if (badgeEl) { badgeEl.textContent = '✅ Valid'; badgeEl.className = 'file-val-badge valid'; }
      if (iconEl)  iconEl.textContent = '📗';
      
      checkStartBtnState();
      
    }).catch(function(err) {
      showFvError(err);
      if (badgeEl) { badgeEl.textContent = '❌ Invalid'; badgeEl.className = 'file-val-badge invalid'; }
      if (iconEl)  iconEl.textContent = '📕';

      checkStartBtnState();
    });
  }

  // ─── INLINE VALIDATION HELPERS ───────────────────────────────────────────
  function clearFileValidation() {
    var banner = $('fileValidationBanner');
    var ok     = $('fvSuccess');
    var err    = $('fvError');
    if (banner) banner.classList.add('hidden');
    if (ok)    ok.classList.add('hidden');
    if (err)   err.classList.add('hidden');
  }

  function showFvSuccess(tcCount, stepCount, headers) {
    var banner = $('fileValidationBanner');
    var box    = $('fvSuccess');
    var detail = $('fvSuccessDetail');
    var errBox = $('fvError');
    if (!banner || !box) return;
    if (errBox) errBox.classList.add('hidden');
    if (detail) {
      var cols = headers.slice(0, 6).join(', ');
      detail.textContent =
        tcCount + ' test case' + (tcCount !== 1 ? 's' : '') +
        ' · ' + stepCount + ' step' + (stepCount !== 1 ? 's' : '') + ' detected.' +
        (cols ? '  Columns: ' + cols + (headers.length > 6 ? '…' : '') + '.' : '');
    }
    box.classList.remove('hidden');
    banner.classList.remove('hidden');
    hideErrorPanel(); // also hide old results-tab error panel
  }

  function showFvError(err) {
    var banner  = $('fileValidationBanner');
    var errBox  = $('fvError');
    var okBox   = $('fvSuccess');
    var msgEl   = $('fvErrorMsg');
    var colDiv  = $('fvDetectedCols');
    var mapBody = $('fvMappingBody');
    var fixList = $('fvFixList');
    var fixSec  = $('fvFixSection');
    var colSec  = $('fvColSection');
    if (!banner || !errBox) return;
    if (okBox)  okBox.classList.add('hidden');

    // Plain error message (non-column errors)
    if (msgEl) msgEl.textContent = (err && err.message && !err.isColumnError) ? err.message : '';

    // Detected columns
    if (colDiv) {
      colDiv.innerHTML = '';
      if (err && err.detectedColumns && err.detectedColumns.length) {
        err.detectedColumns.forEach(function(c) {
          var tag = document.createElement('span');
          tag.className = 'fv-tag'; tag.textContent = c;
          colDiv.appendChild(tag);
        });
        if (colSec) colSec.style.display = '';
      } else {
        if (colSec) colSec.style.display = 'none';
      }
    }

    // Mapping table
    if (mapBody) {
      mapBody.innerHTML = '';
      (err && err.columnMapping ? err.columnMapping : []).forEach(function(row) {
        var tr = document.createElement('tr');
        var cls, txt;
        if (row.mapped)        { cls = 'ok';  txt = '✅ Matched'; }
        else if (row.required) { cls = 'err'; txt = '❌ Missing'; }
        else                   { cls = 'opt'; txt = '⚪ Optional'; }
        tr.innerHTML =
          '<td><strong style="color:var(--accent)">' + escHtml(row.label) + '</strong>' +
          (row.required ? ' <span class="req-star">★</span>' : '') + '</td>' +
          '<td>' + (row.mapped
            ? '<span class="fv-col-ok">' + escHtml(row.mapped) + '</span>'
            : '<span class="fv-col-miss">— not found —</span>') + '</td>' +
          '<td><span class="fv-dot ' + cls + '">' + txt + '</span></td>';
        mapBody.appendChild(tr);
      });
    }

    // Fix suggestions
    if (fixList) {
      fixList.innerHTML = '';
      var suggestions = err && err.suggestedNames ? err.suggestedNames : [];
      suggestions.forEach(function(s) {
        var div = document.createElement('div');
        div.className = 'fv-fix-item';
        div.innerHTML =
          '<div class="fv-fix-title">Rename a column to: <strong>' + escHtml(s.label) + '</strong></div>' +
          '<div class="fv-fix-examples">Accepted names: ' +
            s.examples.map(function(e) { return '<code>' + escHtml(e) + '</code>'; }).join(' ') +
          '</div>';
        fixList.appendChild(div);
      });
      if (fixSec) fixSec.style.display = suggestions.length > 0 ? '' : 'none';
    }

    errBox.classList.remove('hidden');
    banner.classList.remove('hidden');
  }

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  // ─── START EXECUTION ─────────────────────────────────────────────────────
  on('startBtn', 'click', function () {
    var urlEl  = $('appUrl');
    var upload = $('excelUpload');
    var url    = urlEl ? urlEl.value.trim() : '';
    var file   = upload ? upload.files[0] : null;
    hideErrorPanel();

    if (!url)                           { alert('❌ Please enter an Application URL.'); setStatus('Please enter an Application URL.', true); return; }
    if (!/^https?:\/\/.+/.test(url))    { alert('❌ URL must start with http:// or https://'); setStatus('URL must start with http:// or https://', true); return; }
    if (!file)                          { alert('❌ Please upload a test cases file.'); setStatus('Please upload a test cases file.', true); return; }

    var btn     = $('startBtn');
    var btnText = $('startBtnText');
    if (btn)     btn.disabled = true;
    if (btnText) btnText.textContent = '⏳ Parsing file...';
    setStatus('Parsing test cases file...');
    switchTab('logs');
    
    // Hide the waiting placeholder in the results tab
    var rw = $('resultsWaiting');
    if (rw) rw.classList.add('hidden');
    var rl = $('reportLinks'); 
    if (rl) rl.classList.add('hidden');
    
    var stopBtn = $('stopBtn');
    if (stopBtn) stopBtn.classList.remove('hidden');

    var liveDot = $('liveDot');
    if (liveDot) liveDot.classList.add('active');
    addFeedLine('Starting execution...', 'info');

    parseFile(file).then(function (result) {
      var testCases = result.testCases;
      if (!testCases || testCases.length === 0) {
        setStatus('No valid test cases found in file.', true);
        resetBtn(); return;
      }

      var totalEl = $('totalCases');
      if (totalEl) totalEl.textContent = testCases.length;
      setStatus('Sending ' + testCases.length + ' test case(s) to executor...');
      addFeedLine('Found ' + testCases.length + ' test case(s). Launching browser...', 'info');
      if (btnText) btnText.textContent = '⏳ Running...';

      var loginCreds = {
        username:      ($('loginUsername')  || {}).value || '',
        password:      ($('loginPassword')  || {}).value || ''
      };

      // Open execution in a separate popup window (app-like on the taskbar) so user can watch progress and stop from Logs
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 480,
        height: 720
      });

      chrome.runtime.sendMessage({ type: 'START_TESTS', testCases: testCases, url: url, loginCreds: loginCreds },
        function (response) {
          if (chrome.runtime.lastError) {
            setStatus('Extension error: ' + chrome.runtime.lastError.message, true);
            addFeedLine('Error: ' + chrome.runtime.lastError.message, 'fail');
            resetBtn();
          }
        });

    }).catch(function (err) {
      if (err && err.isColumnError) {
        showColumnError(err);
        switchTab('results');
      } else {
        setStatus('Error: ' + ((err && err.message) || 'Unknown error'), true);
        addFeedLine('Parse error: ' + ((err && err.message) || ''), 'fail');
      }
      resetBtn();
      var stopBtn = $('stopBtn');
      if (stopBtn) stopBtn.classList.add('hidden');
    });
  });

  // ─── STOP EXECUTION ──────────────────────────────────────────────────────
  on('stopBtn', 'click', function() {
    var btn = $('stopBtn');
    if (btn) btn.classList.add('hidden');
    setStatus('Sending stop signal...', true);
    addFeedLine('User requested stop...', 'info');
    chrome.runtime.sendMessage({ type: 'STOP_TESTS' });
    // Persist "stopped" immediately so reopening the popup shows stopped UI, not running
    chrome.storage.local.get(['executionState'], function(data) {
      var state = data.executionState || {};
      state.isRunning = false;
      chrome.storage.local.set({ executionState: state });
    });
  });

  // ─── MESSAGES FROM BACKGROUND ────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function (msg) {

    if (msg.type === 'UI_TIMING') {
      // Start countdown the moment we know how many steps there are
      startCountdown(msg.estimatedSecs, msg.tcCount, msg.stepCount);
    }

    if (msg.type === 'UI_UPDATE') {
      var kind = msg.kind || 'info';
      addFeedLine(msg.message || '', kind, msg.fullMessage, msg.errorDetails);
      // NOW strip shows full step text (no truncation) so user sees exact action being run
      if (kind === 'step-run' || kind === 'tc-start') {
        updateCurrentStep(msg.fullMessage || msg.message || '');
      }
      // Also show info/nav lines in strip briefly
      if (kind === 'info') {
        updateCurrentStep(msg.message || '');
      }
    }

    if (msg.type === 'STATUS_UPDATE') {
      currentResults = msg.results;
      var r     = msg.results;
      var total = r.total || 1;
      var done  = (r.passed || 0) + (r.failed || 0);
      var pct   = Math.min(Math.round((done / total) * 100), 100);

      var pb  = $('progressBar');    if (pb)  pb.style.width = pct + '%';
      var pp  = $('progressPercent'); if (pp)  pp.textContent = pct + '%';
      var ps  = $('passedSteps');    if (ps)  ps.textContent = r.passed || 0;
      var fs  = $('failedSteps');    if (fs)  fs.textContent = r.failed || 0;
      setRadial(pct);

      if (msg.finished) {
        stopCountdown();
        updateCurrentStep('✅ Execution complete (or stopped)');
        setStatus('✅ Execution Complete/Stopped');
        addFeedLine('Finished. Passed: ' + r.passed + ' | Failed: ' + r.failed, r.failed > 0 ? 'tc-fail' : 'tc-pass');
        var liveDot = $('liveDot');
        if (liveDot) liveDot.classList.remove('active');
        var rl  = $('reportLinks'); if (rl)  rl.classList.remove('hidden');
        var sBtn = $('stopBtn');    if (sBtn) sBtn.classList.add('hidden');
        checkStartBtnState();
        switchTab('results');
      }
    }
  });

  // ─── RADIAL RING ──────────────────────────────────────────────────────────
  function setRadial(pct) {
    var filled = (pct / 100) * 314;
    var bar    = $('radialBar');
    if (bar) bar.setAttribute('stroke-dasharray', filled + ' ' + (314 - filled));
    var pctEl = $('radialPct');
    if (pctEl) pctEl.textContent = pct + '%';
  }

  // ─── COUNTDOWN TIMER ─────────────────────────────────────────────────────
  var _countdownTimer = null;
  var _countdownSecs  = 0;

  function startCountdown(estimatedSecs, tcCount, stepCount) {
    stopCountdown();
    _countdownSecs = estimatedSecs;
    var pill = $('countdownDisplay');
    if (pill) {
      pill.classList.remove('hidden');
      pill.textContent = '⏱ ~' + formatCountdown(_countdownSecs) + ' remaining';
    }
    _countdownTimer = setInterval(function() {
      _countdownSecs = Math.max(0, _countdownSecs - 1);
      if (pill) {
        pill.textContent = _countdownSecs > 0
          ? '⏱ ~' + formatCountdown(_countdownSecs) + ' remaining'
          : '⏱ Finishing...';
      }
    }, 1000);
  }

  function stopCountdown() {
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
    var pill = $('countdownDisplay');
    if (pill) {
      pill.textContent = '✅ Done';
      pill.classList.remove('hidden');
      pill.classList.add('done');
    }
  }

  function formatCountdown(secs) {
    if (secs >= 60) {
      return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
    }
    return secs + 's';
  }

  // ─── CURRENT STEP STRIP ───────────────────────────────────────────────────
  function updateCurrentStep(text) {
    var strip  = $('currentStepStrip');
    var textEl = $('currentStepText');
    if (!strip || !textEl) return;
    strip.classList.remove('hidden');
    // Clean leading emoji/arrow for display
    textEl.textContent = text.replace(/^[\s▶📋→✅❌⚠️🌐🔐]+\s*/, '');
  }

  // ─── LIVE FEED ────────────────────────────────────────────────────────────
  function addFeedLine(text, kind, tooltipFullText, errorDetails) {
    var body = $('liveFeedBody');
    if (!body) return;
    var idle = body.querySelector('.feed-idle');
    if (idle) idle.remove();

    var tabItem = $('tabLogs');
    if (tabItem && !tabItem.classList.contains('active')) {
      var badge = $('logsBadge');
      if (badge) {
        badge.classList.remove('hidden');
        badge.textContent = parseInt(badge.textContent || '0', 10) + 1;
      }
    }

    var now = new Date();
    var ts  = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    var line = document.createElement('div');
    if (tooltipFullText) line.title = tooltipFullText;

    if (kind === 'tc-start') {
      // Purple test-case header pill
      line.className = 'feed-line feed-tc-start';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<span class="feed-tc-pill">TC</span>' +
        '<span class="msg">' + escHtml(text.replace(/^📋\s*/, '')) + '</span>';

    } else if (kind === 'step-run') {
      line.className = 'feed-line feed-step-run';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<span class="feed-step-num">▶</span>' +
        '<span class="msg">' + escHtml(text.replace(/^▶\s*/, '')) + '</span>';

    } else if (kind === 'step-action') {
      line.className = 'feed-line feed-step-action';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<span class="msg">' + escHtml(text) + '</span>';

    } else if (kind === 'step-pass') {
      line.className = 'feed-line feed-step-pass';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<span class="msg">' + escHtml(text) + '</span>';

    } else if (kind === 'step-fail') {
      line.className = 'feed-line feed-step-fail';
      var reasonHtml = errorDetails ? '<div class="fail-reason"><strong>Reason:</strong> ' + escHtml(errorDetails) + '</div>' : '';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<div class="fail-content">' +
          '<span class="msg">' + escHtml(text) + '</span>' +
          reasonHtml +
        '</div>';

    } else if (kind === 'tc-pass') {
      line.className = 'feed-line feed-tc-pass';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<span class="msg"><strong>' + escHtml(text) + '</strong></span>';

    } else if (kind === 'tc-fail') {
      line.className = 'feed-line feed-tc-fail';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<span class="msg"><strong>' + escHtml(text) + '</strong></span>';

    } else {
      // info / fallback
      line.className = 'feed-line';
      line.innerHTML =
        '<span class="ts">[' + ts + ']</span>' +
        '<span class="msg">' + escHtml(text) + '</span>';
    }

    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  // ─── ERROR PANEL ──────────────────────────────────────────────────────────
  on('errorCloseBtn', 'click', hideErrorPanel);

  function showColumnError(err) {
    var dl = $('detectedColumnsList');
    var tb = $('mappingTableBody');
    var hd = $('missingFieldsHelp');
    if (!dl || !tb || !hd) return;

    dl.innerHTML = '';
    (err.detectedColumns || []).forEach(function (col) {
      var tag = document.createElement('span');
      tag.className   = 'column-tag';
      tag.textContent = col;
      dl.appendChild(tag);
    });

    tb.innerHTML = '';
    (err.columnMapping || []).forEach(function (row) {
      var tr = document.createElement('tr');
      var cls, txt;
      if (row.mapped)        { cls = 'ok';  txt = '✅'; }
      else if (row.required) { cls = 'err'; txt = '❌ Missing'; }
      else                   { cls = 'opt'; txt = '⚪ Optional'; }
      tr.innerHTML =
        '<td><strong style="color:var(--accent)">' + escHtml(row.label) + '</strong></td>' +
        '<td>' + (row.mapped
          ? '<span class="mapped-col">' + escHtml(row.mapped) + '</span>'
          : '<span class="map-none">— not found —</span>') + '</td>' +
        '<td><span class="status-dot ' + cls + '">' + txt + '</span></td>';
      tb.appendChild(tr);
    });

    hd.innerHTML = '';
    (err.suggestedNames || []).forEach(function (s) {
      var div = document.createElement('div');
      div.className = 'help-item';
      div.innerHTML =
        '<div class="help-item-title">Rename a column to: <strong>' + escHtml(s.label) + '</strong></div>' +
        '<div class="help-item-examples">Accepted: ' +
          s.examples.map(function (e) { return '<span>' + escHtml(e) + '</span>'; }).join('') +
        '</div>';
      hd.appendChild(div);
    });

    var ms = $('missingSection');
    if (ms) ms.style.display = (err.suggestedNames || []).length > 0 ? '' : 'none';
    var ep = $('errorPanel');
    if (ep) ep.classList.remove('hidden');
    setStatus('Column mapping issue — see details below.', true);
    addFeedLine('Column error: ' + (err.missingRequired || []).join(', ') + ' not found', 'fail');
  }

  function hideErrorPanel() {
    var ep = $('errorPanel');
    if (ep) ep.classList.add('hidden');
  }

  // ─── DOWNLOADS ────────────────────────────────────────────────────────────
  on('downloadReport', 'click', function () {
    if (!currentResults) return;
    var html = generateHTMLReport(currentResults);
    var blob = new Blob([html], { type: 'text/html' });
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = 'Execution_Report_' + Date.now() + '.html';
    a.click();
    addFeedLine('HTML report downloaded', 'ok');
  });

  on('downloadBugs', 'click', function () {
    if (!currentResults) return;
    var bugs  = generateBugExcel(currentResults);
    var saved = saveBugExcel(bugs, 'Detected_Bugs_' + Date.now() + '.xlsx');
    if (!saved) { addFeedLine('No bugs — all passed!', 'ok'); alert('✅ No bugs to export!'); }
    else         { addFeedLine('Bug report Excel downloaded', 'ok'); }
  });

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  function setStatus(msg, isErr) {
    var el = $('currentAction');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'status-msg' + (isErr ? ' error' : '');
  }

  function resetBtn() {
    var btn = $('startBtn');    if (btn) btn.disabled = false;
    var bt  = $('startBtnText'); if (bt)  bt.textContent = '▶ Start Test Execution';
    var ld  = $('liveDot');     if (ld)  ld.classList.remove('active');
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── RESTORE STATE WHEN POPUP REOPENS (execution running or just finished) ─
  function restoreFromStorage() {
    chrome.storage.local.get(['executionState', 'lastResults'], function(data) {
      var state = data.executionState;
      var lastResults = data.lastResults;
      if (!state) return;

      var logLines = state.logLines || [];
      var isRunning = !!state.isRunning;
      var progress = state.progress || {};
      var totalCases = state.totalCases || 0;
      var currentStep = state.currentStep || '';

      if (logLines.length === 0 && !isRunning && !lastResults) return;

      // Restore log feed
      var body = $('liveFeedBody');
      if (body) {
        body.innerHTML = '';
        logLines.forEach(function(line) {
          addFeedLine(line.text || '', line.kind || 'info', line.full || line.text);
        });
        // Don't show badge count when user just opens the extension; only during live run.
        resetLogsBadge();
      }

      // Restore progress
      var pct = progress.pct || 0;
      var pb = $('progressBar');   if (pb)  pb.style.width = pct + '%';
      var pp = $('progressPercent'); if (pp) pp.textContent = pct + '%';
      var ps = $('passedSteps');   if (ps) ps.textContent = progress.passed || 0;
      var fs = $('failedSteps');   if (fs) fs.textContent = progress.failed || 0;
      setRadial(pct);
      var totalEl = $('totalCases'); if (totalEl) totalEl.textContent = totalCases;

      updateCurrentStep(currentStep || (isRunning ? 'Execution in progress...' : 'Execution complete (or stopped)'));
      setStatus(isRunning ? 'Execution in progress...' : 'Execution Complete/Stopped', false);

      if (isRunning) {
        switchTab('logs');
        var rw = $('resultsWaiting'); if (rw) rw.classList.add('hidden');
        var rl = $('reportLinks');     if (rl) rl.classList.add('hidden');
        var stopBtn = $('stopBtn');    if (stopBtn) stopBtn.classList.remove('hidden');
        var liveDot = $('liveDot');    if (liveDot) liveDot.classList.add('active');
        var btn = $('startBtn');       if (btn) btn.disabled = true;
        var bt = $('startBtnText');   if (bt) bt.textContent = '⏳ Running...';
      } else {
        currentResults = lastResults || null;
        // Keep default tab (Setup) when opening; only switch to Logs when run is still in progress
        var stopBtn = $('stopBtn');    if (stopBtn) stopBtn.classList.add('hidden');
        var liveDot = $('liveDot');    if (liveDot) liveDot.classList.remove('active');
        var rl = $('reportLinks');    if (rl) rl.classList.remove('hidden');
        var rw = $('resultsWaiting'); if (rw) rw.classList.add('hidden');
        
        checkStartBtnState();
      }
    });
  }

  restoreFromStorage();

}); // end DOMContentLoaded
