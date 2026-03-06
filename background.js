/**
 * background.js
 * MV3 Service Worker — orchestrates test execution, handles messages, captures screenshots.
 * Uses importScripts to load executionEngine (service workers don't support script tags).
 */

importScripts('executionEngine.js', 'stepInterpreter.js');

var executionState = {
  running: false,
  tabId: null,
  loginAttempted: false
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'START_TESTS') {
    handleStartTests(request).then(function(result) {
      sendResponse(result);
    }).catch(function(err) {
      sendResponse({ status: 'Error', error: err.message });
    });
    return true; // async response
  }
  
  if (request.type === 'STOP_TESTS') {
    executionState.abortRequested = true;
    sendResponse({ status: 'Stopping' });
    return true;
  }
  
  if (request.type === 'UI_LOG') {
    broadcastUI({ kind: request.kind, message: request.message });
    if (request.message.includes('Clicking login button!') || request.message.includes('simulating Enter key')) {
      executionState.loginAttempted = true;
    }
    return false;
  }
});

async function handleStartTests(request) {
  if (executionState.running) {
    return { status: 'Already running' };
  }

  executionState.running = true;
  executionState.abortRequested = false;

  // Persist so popup can restore if user reopens while execution is running
  chrome.storage.local.set({
    executionState: {
      isRunning: true,
      logLines: [],
      currentStep: '',
      progress: { total: 0, passed: 0, failed: 0, pct: 0 },
      totalCases: 0,
      countdownSecs: 0,
      tcCount: 0,
      stepCount: 0
    },
    lastResults: null
  });

  try {
    // Get active tab
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    var tabId = tab.id;
    executionState.tabId = tabId;

    // Navigate to app URL
    broadcastUI({ kind: 'info', message: 'Opening application URL...' });
    await chrome.tabs.update(tabId, { url: request.url });
    await waitForTabLoad(tabId);
    broadcastUI({ kind: 'step-pass', message: 'Page loaded successfully' });

    // Perform login if credentials supplied
    if (request.loginCreds && request.loginCreds.username) {
      await performLogin(tabId, request.loginCreds);
      await sleep(1500);
    }

    // Execute test cases
    var results = await executeTestCases(request.testCases, tabId);
    
    executionState.running = false;
    return { status: 'Completed', results: results };
  } catch (err) {
    executionState.running = false;
    throw err;
  }
}

async function performLogin(tabId, creds) {
  broadcastUI({ kind: 'info', message: 'Performing login with provided credentials (chasing redirects)...' });
  executionState.loginAttempted = false;
  var maxRetries = 4; // 4 attempts * ~15 seconds inside content.js = 60s total tolerance

  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var hasSuccess = false;
      
      if (chrome.webNavigation && chrome.webNavigation.getAllFrames) {
        var frames = await chrome.webNavigation.getAllFrames({ tabId: tabId });
        
        // Forcefully inject content.js into all frames to combat rapid OAuth redirects
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            files: ['content.js']
          });
        } catch (injectionErr) {
          console.warn('Manual script injection skipped bounds:', injectionErr);
        }

        // Send the PERFORM_LOGIN message to EVERY frame individually.
        var promises = frames.map(function(frame) {
          return new Promise(function(resolve) {
            chrome.tabs.sendMessage(tabId, { type: 'PERFORM_LOGIN', creds: creds }, { frameId: frame.frameId }, function(response) {
              if (chrome.runtime.lastError) resolve(null);
              else resolve(response);
            });
          });
        });

        var results = await Promise.all(promises);
        hasSuccess = results.some(function(r) { return r && r.status === 'Success'; });
        
      } else {
        // Fallback
        var response = await new Promise(function(resolve) {
          chrome.tabs.sendMessage(tabId, { type: 'PERFORM_LOGIN', creds: creds }, function(res) {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(res);
          });
        });
        hasSuccess = response && response.status === 'Success';
      }

      // If the content script successfully returned, or if the UI_LOG channel reported a button click:
      if (hasSuccess || executionState.loginAttempted) {
        await sleep(2000);
        await waitForTabLoad(tabId);
        broadcastUI({ kind: 'step-pass', message: 'Login completed' });
        return; // Success! Exit the loop.
      } else {
        // Did not succeed, page might be redirecting still. Wait and retry.
        broadcastUI({ kind: 'info', message: '[Injector] Login injection returned no success. Retrying (' + attempt + '/' + maxRetries + ')...' });
        await sleep(3000);
      }
    } catch (e) {
      if (executionState.loginAttempted) {
        await sleep(2000);
        await waitForTabLoad(tabId);
        broadcastUI({ kind: 'step-pass', message: 'Login completed' });
        return; 
      }
      broadcastUI({ kind: 'info', message: '[Injector] Caught disconnect during injection, retrying...' });
      await sleep(3000);
    }
  }

  // If we exhaust the loop:
  broadcastUI({ kind: 'step-fail', message: 'Login engines timed out without success after chasing redirects.' });
}

function waitForTabLoad(tabId) {
  return new Promise(function(resolve) {
    function finalize() {
      // Add a small generic sleep after "complete" so SPAs finish rendering UI
      setTimeout(resolve, 2000); 
    }
    
    chrome.tabs.get(tabId, function(tab) {
      if (tab && tab.status === 'complete') {
        finalize();
        return;
      }
      
      var timeoutId;
      function check(tId, changeInfo) {
        if (tId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(check);
          clearTimeout(timeoutId);
          finalize();
        }
      }
      chrome.tabs.onUpdated.addListener(check);
      
      // Fallback after 10 seconds
      timeoutId = setTimeout(function() {
        chrome.tabs.onUpdated.removeListener(check);
        finalize();
      }, 10000);
    });
  });
}

function captureScreenshot() {
  return chrome.tabs.captureVisibleTab(null, { format: 'png' }).catch(function() { return null; });
}

function broadcastUI(payload) {
  var msg = (typeof payload === 'string')
    ? { type: 'UI_UPDATE', kind: 'info', message: payload }
    : Object.assign({ type: 'UI_UPDATE', kind: 'info' }, payload);
  chrome.runtime.sendMessage(msg).catch(function() {});
}

function broadcastStatus(results, finished) {
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', results: results, finished: !!finished }).catch(function() {});
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}
