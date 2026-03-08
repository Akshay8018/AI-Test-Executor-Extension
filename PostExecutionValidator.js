/**
 * PostExecutionValidator.js
 * 
 * Enterprise NLP Validation Engine
 * Role: Background orchestrator. Hooked into the end of `executionEngine.js` test cases.
 * Orchestrates the NLP logic and commands the Content script UI Scanner.
 */

async function runExpectedResultValidation(tabId, testCase, tcResult) {
  // Rule 1: Only run if all steps actually executed and didn't hard fail during interaction
  if (tcResult.status === 'Failed') {
      return tcResult; // Do not validate Expected Result if the steps themselves blew up.
  }

  // Find the Expected Result text. Usually stored on the last step, or accumulated.
  var expectedResultText = '';
  if (testCase.steps && testCase.steps.length > 0) {
      // Prioritize the last step's expected result, as it dictates the final outcome.
      var lastStep = testCase.steps[testCase.steps.length - 1];
      expectedResultText = lastStep.expectedResult || lastStep.ExpectedResult || '';
  }

  if (!expectedResultText || expectedResultText.trim() === '' || expectedResultText === '-') {
      // No explicit validation requested. Keep status as is.
      return tcResult;
  }

  broadcastUI({
      kind: 'info',
      message: 'Analyzing Expected Result via NLP...'
  });

  // 1. Parse NLP Intent
  var nlpPayload = globalThis.NLPIntentParser.parseIntent(expectedResultText);
  
  broadcastUI({
      kind: 'info',
      message: 'NLP Intent Detect: [' + nlpPayload.Intent + '] Target: "' + nlpPayload.Target + '"'
  });

  // 2. Dispatch validation to Content Script
  var validationResult = { status: 'Failed', log: 'Content script failed to respond or timeout.' };
  try {
      validationResult = await new Promise(function(resolve, reject) {
          var timeout = setTimeout(() => resolve({ status: 'Failed', log: 'Validation request timed out after 5s' }), 5000);
          chrome.tabs.sendMessage(tabId, {
              type: 'EXECUTE_NLP_VALIDATION',
              payload: nlpPayload
          }, function(response) {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) resolve({ status: 'Failed', log: chrome.runtime.lastError.message });
              else resolve(response || { status: 'Failed', log: 'No response from page logic' });
          });
      });
  } catch (e) {
      validationResult = { status: 'Failed', log: 'Exception during UI State Scanning: ' + e.message };
  }

  // 3. Append Validation Step to Results
  var validationStep = {
      stepNumber: 'Validation',
      description: 'AI Expected Result Verification',
      testData: nlpPayload.Intent,
      expectedResult: expectedResultText,
      status: validationResult.status,
      actualResult: validationResult.log || 'Unknown validation state',
      screenshot: null
  };

  try { validationStep.screenshot = await captureScreenshot(); } catch (e) {}

  tcResult.steps.push(validationStep);

  // 4. Determine Final Test Case Pass/Fail Status based entirely on Validation Outcome
  tcResult.status = validationResult.status;

  if (validationResult.status === 'Failed') {
      broadcastUI({ kind: 'step-fail', message: 'EXPECTED RESULT FAILED: ' + validationResult.log });
  } else {
      broadcastUI({ kind: 'step-pass', message: 'EXPECTED RESULT PASSED: ' + validationResult.log });
  }

  return tcResult;
}
