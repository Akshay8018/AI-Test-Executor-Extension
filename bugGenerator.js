/**
 * bugGenerator.js
 * Generates a Detected_Bugs.xlsx file for failed test steps.
 * Uses global XLSX from xlsx.min.js and saveAs from FileSaver.js.
 */

function generateBugExcel(results) {
  var bugs = [];
  var bugId = 1;

  (results.testCases || []).forEach(function(tc) {
    (tc.steps || []).forEach(function(step) {
      if (step.status === 'Failed') {
        bugs.push({
          'BugID': 'BUG-' + String(bugId++).padStart(3, '0'),
          'TestCaseID': tc.id,
          'Scenario': tc.scenario,
          'StepNumber': step.stepNumber,
          'StepDescription': step.description,
          'ExpectedResult': step.expectedResult,
          'ActualResult': step.actualResult || 'N/A',
          'Priority': tc.priority || 'Medium',
          'Timestamp': new Date().toISOString(),
          'ScreenshotNote': step.screenshot ? 'See HTML Report' : 'N/A'
        });
      }
    });
  });

  return bugs;
}

function saveBugExcel(bugs, filename) {
  if (!bugs || bugs.length === 0) return false;

  var ws = XLSX.utils.json_to_sheet(bugs);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detected Bugs');

  // Auto-size columns
  var cols = Object.keys(bugs[0]).map(function(key) {
    return { wch: Math.max(key.length, 18) };
  });
  ws['!cols'] = cols;

  var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  var blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, filename || 'Detected_Bugs.xlsx');
  return true;
}
