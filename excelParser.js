/**
 * excelParser.js
 * Parses Excel (.xlsx, .xls) and CSV files into structured test cases.
 * Uses fuzzy/flexible column name matching — works with any header naming convention.
 * On failure, throws a structured error with detailed column info.
 */

var COLUMN_ALIASES = {
  id:             { label: 'Test Case ID',       aliases: ['testcaseid','test case id','testid','test id','caseid','case id','tc id','tcid','id','case#','tc#'] },
  scenario:       { label: 'Test Scenario',       aliases: ['testscenario','test scenario','scenario','test name','testname','title','name','summary','feature'] },
  preconditions:  { label: 'Preconditions',       aliases: ['preconditions','precondition','pre conditions','pre condition','prerequisite','prerequisites','setup','given'] },
  priority:       { label: 'Priority',            aliases: ['priority','severity','criticality','importance','p0','p1','p2'] },
  stepNumber:     { label: 'Step Number',         aliases: ['stepnumber','step number','step no','stepno','step#','seq','sequence','sno','s.no','no.','no','sr','sr.no','#'] },
  description:    { label: 'Step Description',    aliases: ['teststepdescription','test step description','stepdescription','step description','step','action','teststep','test step','description','steps','actions','what to do','test action','testaction','instruction'] },
  testData:       { label: 'Test Data',           aliases: ['testdata','test data','data','input','inputdata','input data','testinput','value','values','test input','parameters'] },
  expectedResult: { label: 'Expected Result',     aliases: ['expectedresult','expected result','expected','expected outcome','expectedoutcome','expected value','expectedvalue','result','outcome','expected behavior','expectedbehavior','verification','verify','assertion'] }
};

var REQUIRED_FIELDS = ['id', 'description'];

function resolveColumns(headers) {
  var map = {};
  var lowerHeaders = headers.map(function(h) { return (h || '').toString().toLowerCase().replace(/\s+/g,' ').trim(); });

  Object.keys(COLUMN_ALIASES).forEach(function(field) {
    var aliases = COLUMN_ALIASES[field].aliases;
    // 1. Exact match
    for (var i = 0; i < aliases.length; i++) {
      var idx = lowerHeaders.indexOf(aliases[i]);
      if (idx !== -1) { map[field] = headers[idx]; return; }
    }
    // 2. Contains match (header contains alias)
    for (var i = 0; i < aliases.length; i++) {
      for (var j = 0; j < lowerHeaders.length; j++) {
        if (!map[field] && lowerHeaders[j].includes(aliases[i])) {
          map[field] = headers[j];
        }
      }
    }
    // 3. Alias contains header (e.g. "id" alias catches short header "ID")
    if (!map[field]) {
      for (var i = 0; i < aliases.length; i++) {
        for (var j = 0; j < lowerHeaders.length; j++) {
          if (!map[field] && lowerHeaders[j].length > 1 && aliases[i].includes(lowerHeaders[j])) {
            map[field] = headers[j];
          }
        }
      }
    }
  });

  return map;
}

function getVal(row, colName) {
  if (!colName || !row) return '';
  if (row[colName] !== undefined && row[colName] !== null) return row[colName].toString().trim();
  var lower = colName.toLowerCase();
  var keys = Object.keys(row);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase().trim() === lower) return (row[keys[i]] || '').toString().trim();
  }
  return '';
}

function buildColumnError(headers, colMap) {
  // Figure out which required fields are missing
  var missing = REQUIRED_FIELDS.filter(function(f) { return !colMap[f]; });

  var mappedInfo = Object.keys(COLUMN_ALIASES).map(function(field) {
    return {
      field: field,
      label: COLUMN_ALIASES[field].label,
      mapped: colMap[field] || null,
      required: REQUIRED_FIELDS.indexOf(field) !== -1
    };
  });

  var err = new Error('COLUMN_MISMATCH');
  err.isColumnError = true;
  err.detectedColumns = headers;
  err.columnMapping = mappedInfo;
  err.missingRequired = missing.map(function(f) { return COLUMN_ALIASES[f].label; });
  err.suggestedNames = missing.map(function(f) {
    return { label: COLUMN_ALIASES[f].label, examples: COLUMN_ALIASES[f].aliases.slice(0, 4).map(function(a) { return toTitleCase(a); }) };
  });
  return err;
}

function toTitleCase(str) {
  return str.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function parseFile(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    var isCSV = file.name.toLowerCase().endsWith('.csv');

    reader.onload = function(e) {
      try {
        var data = e.target.result;
        var workbook = isCSV
          ? XLSX.read(data, { type: 'string' })
          : XLSX.read(data, { type: 'binary' });

        // Pick the sheet with the most data rows (avoids picking an empty Sheet1)
        var sheetName = workbook.SheetNames[0];
        var maxRows = 0;
        workbook.SheetNames.forEach(function(name) {
          var s = workbook.Sheets[name];
          var r = XLSX.utils.sheet_to_json(s, { defval: '' });
          if (r.length > maxRows) { maxRows = r.length; sheetName = name; }
        });
        console.log('[AI Test Executor] Using sheet:', sheetName);
        var sheet = workbook.Sheets[sheetName];
        var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows || rows.length === 0) {
          var e2 = new Error('The file appears to be empty or has no data rows.');
          e2.isColumnError = false;
          throw e2;
        }

        var headers = Object.keys(rows[0]);
        console.log('[AI Test Executor] Detected columns:', headers);

        var colMap = resolveColumns(headers);
        console.log('[AI Test Executor] Column mapping:', colMap);

        // Check required fields
        var missing = REQUIRED_FIELDS.filter(function(f) { return !colMap[f]; });
        if (missing.length > 0) {
          throw buildColumnError(headers, colMap);
        }

        var testCases = groupRowsIntoTestCases(rows, colMap);

        if (!testCases || testCases.length === 0) {
          var e3 = new Error('File was read but no test cases could be built. Ensure the Test Case ID column has values in every row.');
          e3.isColumnError = false;
          throw e3;
        }

        resolve({ testCases: testCases, headers: headers, colMap: colMap });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = function() { reject(new Error('Failed to read the file.')); };
    isCSV ? reader.readAsText(file) : reader.readAsBinaryString(file);
  });
}

/**
 * Splits a multi-line numbered string like:
 *   "1. Login to app\n2. Click button\n3. Verify result"
 * into an array: ["Login to app", "Click button", "Verify result"]
 * Falls back to splitting by newline if no numbering is detected.
 */
function splitNumberedLines(text) {
  if (!text) return [];
  var str = text.toString().trim();
  // Try splitting on numbered lines: "1. ...", "2. ..."
  var parts = str.split(/\n+(?=\d+[\.\)]\s)/);
  if (parts.length > 1) {
    return parts.map(function(p) { return p.replace(/^\d+[\.\)]\s*/, '').trim(); }).filter(Boolean);
  }
  // Fallback: split by newlines
  var lines = str.split(/\n+/).map(function(l) { return l.trim(); }).filter(Boolean);
  return lines.length > 1 ? lines : [str];
}

function groupRowsIntoTestCases(rows, colMap) {
  var casesMap = {};
  var caseOrder = [];

  rows.forEach(function(row) {
    var id = colMap.id ? getVal(row, colMap.id) : '';
    if (!id) { var fk = Object.keys(row)[0]; id = getVal(row, fk); }
    id = id.toString().trim();
    if (!id) return;

    if (!casesMap[id]) {
      casesMap[id] = {
        id: id,
        scenario: colMap.scenario ? getVal(row, colMap.scenario) : '',
        preconditions: colMap.preconditions ? getVal(row, colMap.preconditions) : '',
        priority: colMap.priority ? (getVal(row, colMap.priority) || 'Medium') : 'Medium',
        steps: []
      };
      caseOrder.push(id);
    }

    var rawDesc     = colMap.description    ? getVal(row, colMap.description)    : '';
    var rawExpected = colMap.expectedResult ? getVal(row, colMap.expectedResult) : '';
    var rawTestData = colMap.testData       ? getVal(row, colMap.testData)       : '';
    var rawStepNum  = colMap.stepNumber     ? getVal(row, colMap.stepNumber)     : '';

    // Detect multi-step single-cell format
    var descLines     = splitNumberedLines(rawDesc);
    var expectedLines = splitNumberedLines(rawExpected);

    if (descLines.length > 1) {
      // One row contains ALL steps packed into a single cell
      descLines.forEach(function(desc, i) {
        casesMap[id].steps.push({
          stepNumber:     i + 1,
          description:    desc,
          testData:       rawTestData,
          expectedResult: expectedLines[i] || expectedLines[expectedLines.length - 1] || ''
        });
      });
    } else {
      // Normal format: one row = one step
      var desc     = rawDesc.trim();
      var expected = rawExpected.trim();
      var stepNum  = rawStepNum || (casesMap[id].steps.length + 1);
      if (desc || expected) {
        casesMap[id].steps.push({ stepNumber: stepNum, description: desc, testData: rawTestData, expectedResult: expected });
      }
    }
  });

  return caseOrder.map(function(id) { return casesMap[id]; }).filter(function(tc) { return tc.steps.length > 0; });
}
