/**
 * executionEngine.js
 * Core test executor. Loaded via importScripts in background.js (service worker).
 * IMPORTANT: No emoji or special Unicode chars - importScripts requires clean ASCII/UTF-8.
 */

async function executeTestCases(testCases, tabId) {
  var results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    duration: 0,
    startTime: Date.now(),
    testCases: []
  };

  // Count total steps for timing estimate (avg ~4s per step, +3s per TC overhead)
  var totalSteps = testCases.reduce(function(s, tc) { return s + tc.steps.length; }, 0);
  var estimatedSecs = totalSteps * 4 + testCases.length * 3;
  broadcastTiming(testCases.length, totalSteps, estimatedSecs);

  for (var i = 0; i < testCases.length; i++) {
    var tc = testCases[i];

    broadcastUI({
      kind: 'tc-start',
      message: 'Test Case ' + (i + 1) + ' / ' + testCases.length + ': ' + tc.id,
      sub: tc.scenario || '',
      tcIndex: i + 1,
      tcTotal: testCases.length
    });

    var tcResult = {
      id: tc.id,
      scenario: tc.scenario,
      priority: tc.priority,
      status: 'Passed',
      steps: []
    };

    if (typeof executionState !== 'undefined' && executionState.abortRequested) {
      tcResult.status = 'Failed';
      tcResult.steps.push({
        stepNumber: 1, description: 'Test aborted', expectedResult: '-',
        status: 'Failed', actualResult: 'Execution stopped by user'
      });
      results.failed++;
      results.testCases.push(tcResult);
      break;
    }

    for (var j = 0; j < tc.steps.length; j++) {
      if (typeof executionState !== 'undefined' && executionState.abortRequested) {
        broadcastUI({ kind: 'step-fail', message: 'Execution stopped by user.' });
        tcResult.status = 'Failed';
        tcResult.steps.push({
          stepNumber: tc.steps[j].stepNumber || j+1,
          description: 'Remaining steps aborted',
          expectedResult: '-',
          status: 'Failed',
          actualResult: 'Stopped by user'
        });
        break;
      }
      var step = tc.steps[j];
      var shortDesc = step.description.length > 70
        ? step.description.substring(0, 70) + '...'
        : step.description;

      broadcastUI({
        kind: 'step-run',
        message: 'Step ' + step.stepNumber + ' / ' + tc.steps.length + ': ' + shortDesc,
        fullMessage: 'Step ' + step.stepNumber + ' / ' + tc.steps.length + ': ' + step.description,
        stepNum: step.stepNumber,
        stepTotal: tc.steps.length,
        tcId: tc.id
      });

      // Always use full step description for execution (not truncated)
      var action = interpretStep(step.description, step.testData);

      // Ensure validation steps actually use the ExpectedResult text
      // from Excel when present (for content.js validate logic).
      if (action && action.type === 'validate') {
        if (!action.value && step.expectedResult) {
          action.value = step.expectedResult;
        }
        if (!action.target && step.description) {
          action.target = step.description;
        }
      }

      // Announce what action the engine will attempt
      var actionDesc = '';
      if      (action.type === 'click')    { actionDesc = 'Clicking: '     + (action.target || action.text || ''); }
      else if (action.type === 'type')     { actionDesc = 'Typing "'       + (action.value || '') + '" into: ' + (action.target || ''); }
      else if (action.type === 'navigate') { actionDesc = 'Navigating to: ' + (action.url || ''); }
      else if (action.type === 'verify')   { actionDesc = 'Verifying: '    + (action.text || action.target || ''); }
      else if (action.type === 'wait')     { actionDesc = 'Waiting '       + (action.duration || 1000) + 'ms'; }
      else                                 { actionDesc = 'Action: '       + action.type; }

      broadcastUI({ kind: 'step-action', message: '  -> ' + actionDesc });

      var stepResult = await retryAction(tabId, action, 10); // Wait longer for elements (implicit wait)

      var screenshot = null;
      try { screenshot = await captureScreenshot(); } catch (e) {}

      var finalStep = {
        stepNumber:     step.stepNumber,
        description:    step.description,
        testData:       step.testData,
        expectedResult: step.expectedResult,
        status: (stepResult.status === 'Success' || stepResult.status === 'Passed') ? 'Passed' : 'Failed',
        actualResult: stepResult.actual || stepResult.error ||
          (stepResult.status === 'Success' ? 'Action completed successfully' : 'Action failed'),
        screenshot: screenshot
      };

      if (finalStep.status === 'Failed') {
        tcResult.status = 'Failed';
        broadcastUI({
          kind: 'step-fail',
          message: 'Step ' + step.stepNumber + ' FAILED: ' + (stepResult.error || 'Action did not succeed')
        });
      } else {
        broadcastUI({
          kind: 'step-pass',
          message: 'Step ' + step.stepNumber + ' passed'
        });
      }

      tcResult.steps.push(finalStep);
    }

    if (tcResult.status === 'Passed') {
      results.passed++;
      broadcastUI({ kind: 'tc-pass', message: tc.id + ' -- PASSED' });
    } else {
      results.failed++;
      broadcastUI({ kind: 'tc-fail', message: tc.id + ' -- FAILED' });
    }

    results.testCases.push(tcResult);
    results.duration = Math.round((Date.now() - results.startTime) / 1000);
    broadcastStatus(results, false);
  }

  results.duration = Math.round((Date.now() - results.startTime) / 1000);
  broadcastStatus(results, true);
  return results;
}

async function retryAction(tabId, action, maxRetries) {
  var lastResult = { status: 'Failed', error: 'Not executed' };
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      var response = await sendToContent(tabId, { type: 'EXECUTE_ACTION', action: action });
      if (response && (response.status === 'Success' || response.status === 'Passed')) {
        return response;
      }
      lastResult = response || { status: 'Failed', error: 'No response' };
    } catch (e) {
      lastResult = { status: 'Failed', error: e.message };
    }
    if (attempt < maxRetries - 1) await sleep(1200);
  }
  return lastResult;
}

function sendToContent(tabId, message) {
  return new Promise(function(resolve) {
    chrome.tabs.sendMessage(tabId, message, function(response) {
      if (chrome.runtime.lastError) {
        resolve({ status: 'Failed', error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

function captureScreenshot() {
  return chrome.tabs.captureVisibleTab(null, { format: 'png' });
}

function broadcastUI(payload) {
  var msg = (typeof payload === 'string')
    ? { type: 'UI_UPDATE', kind: 'info', message: payload }
    : Object.assign({ type: 'UI_UPDATE', kind: 'info' }, payload);
  chrome.runtime.sendMessage(msg).catch(function() {});
}

function broadcastTiming(tcCount, stepCount, estimatedSecs) {
  chrome.runtime.sendMessage({
    type: 'UI_TIMING',
    tcCount: tcCount,
    stepCount: stepCount,
    estimatedSecs: estimatedSecs
  }).catch(function() {});
}

function broadcastStatus(results, finished) {
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    results: results,
    finished: !!finished
  }).catch(function() {});
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}
