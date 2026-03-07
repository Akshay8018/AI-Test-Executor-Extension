/**
 * reportGenerator.js
 * Generates an HTML execution report.
 * Loaded as a classic script.
 */

function generateHTMLReport(results) {
  var total = results.total || 0;
  var passed = results.passed || 0;
  var failed = results.failed || 0;
  var duration = results.duration || 0;

  var caseRows = (results.testCases || []).map(function(tc) {
    var stepRows = (tc.steps || []).map(function(step) {
      var badge = step.status === 'Passed'
        ? '<span class="badge pass">PASS</span>'
        : '<span class="badge fail">FAIL</span>';
      var screenshot = step.screenshot
        ? '<img src="' + step.screenshot + '" class="thumb" onclick="window.open(this.src)" title="Click to enlarge">'
        : '<span class="no-img">—</span>';
      return '<tr>' +
        '<td>' + step.stepNumber + '</td>' +
        '<td>' + escHtml(step.description) + '</td>' +
        '<td>' + escHtml(step.expectedResult) + '</td>' +
        '<td>' + escHtml(step.actualResult || '—') + '</td>' +
        '<td><span style="font-size:10px;color:#888;">' + escHtml(step.locatorUsed || '—') + '</span></td>' +
        '<td>' + badge + '</td>' +
        '<td>' + screenshot + '</td>' +
        '</tr>';
    }).join('');

    var tcBadge = tc.status === 'Passed'
      ? '<span class="badge pass">PASS</span>'
      : '<span class="badge fail">FAIL</span>';

    return '<div class="tc-card">' +
      '<div class="tc-header">' + tcBadge +
        '<strong>' + escHtml(tc.id) + '</strong> — ' + escHtml(tc.scenario) +
      '</div>' +
      '<table class="step-table"><thead><tr>' +
        '<th>#</th><th>Step</th><th>Expected</th><th>Actual</th><th>Locator</th><th>Status</th><th>Evidence</th>' +
      '</tr></thead><tbody>' + stepRows + '</tbody></table></div>';
  }).join('');

  return '<!DOCTYPE html><html><head><title>Execution Report</title>' +
    '<meta charset="UTF-8">' +
    '<style>' +
      'body{font-family:Segoe UI,sans-serif;background:#f0f4f8;margin:0;padding:24px;color:#1e293b}' +
      '.container{max-width:1100px;margin:0 auto}' +
      'h1{color:#4f46e5;margin-bottom:4px}' +
      '.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}' +
      '.stat{background:white;border-radius:10px;padding:18px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.08)}' +
      '.stat .num{font-size:28px;font-weight:700}' +
      '.stat .lbl{font-size:12px;color:#64748b;margin-top:4px}' +
      '.stat.t .num{color:#4f46e5} .stat.p .num{color:#10b981} .stat.f .num{color:#ef4444} .stat.d .num{color:#6366f1}' +
      '.tc-card{background:white;border-radius:10px;margin-bottom:20px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.06)}' +
      '.tc-header{padding:14px 18px;background:#f8f9ff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;font-size:14px}' +
      '.badge{padding:3px 9px;border-radius:4px;font-size:11px;font-weight:700;color:white}' +
      '.badge.pass{background:#10b981} .badge.fail{background:#ef4444}' +
      '.step-table{width:100%;border-collapse:collapse;font-size:13px}' +
      '.step-table th,.step-table td{padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}' +
      '.step-table th{background:#f8fafc;font-weight:600;font-size:12px;color:#64748b}' +
      '.thumb{max-width:120px;max-height:80px;cursor:pointer;border:1px solid #ddd;border-radius:4px}' +
      '.no-img{color:#cbd5e1}' +
    '</style></head><body><div class="container">' +
    '<h1>Execution Report</h1>' +
    '<p style="color:#64748b;font-size:13px">Generated: ' + new Date().toLocaleString() + '</p>' +
    '<div class="summary">' +
      '<div class="stat t"><div class="num">' + total + '</div><div class="lbl">Total Cases</div></div>' +
      '<div class="stat p"><div class="num">' + passed + '</div><div class="lbl">Passed</div></div>' +
      '<div class="stat f"><div class="num">' + failed + '</div><div class="lbl">Failed</div></div>' +
      '<div class="stat d"><div class="num">' + duration + 's</div><div class="lbl">Duration</div></div>' +
    '</div>' +
    caseRows +
    '</div></body></html>';
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
