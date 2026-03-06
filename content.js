/**
 * content.js
 * Injected into all web pages. Listens for actions from the background,
 * locates elements using a 10-level priority strategy, and executes them.
 */

(function() {
  'use strict';

  // ─── Locator Strategies (Priority Order) ────────────────────────────────────
  var strategies = [
    // 1. ID
    function(t) { return document.getElementById(t); },
    // 2. data-testid
    function(t) { return document.querySelector('[data-testid="' + t + '"]'); },
    // 3. name
    function(t) { return document.querySelector('[name="' + t + '"]'); },
    // 4. aria-label
    function(t) { return document.querySelector('[aria-label="' + t + '"]'); },
    // 5. placeholder
    function(t) { return document.querySelector('[placeholder="' + t + '"]'); },
    // 6. associated label text
    function(t) { return findByLabelText(t); },
    // 7. visible text content
    function(t) { return findByVisibleText(t); },
    // 8. role
    function(t) { return document.querySelector('[role="' + t + '"]'); },
    // 9. CSS selector (try/catch)
    function(t) {
      try { return document.querySelector(t); } catch (e) { return null; }
    },
    // 10. XPath
    function(t) { return findByXPath(t); }
  ];

  function findByLabelText(text) {
    var labels = Array.from(document.querySelectorAll('label'));
    var matched = labels.find(function(l) {
      return l.textContent.trim().toLowerCase().includes(text.toLowerCase());
    });
    if (!matched) return null;
    if (matched.control) return matched.control;
    var forAttr = matched.getAttribute('for');
    return forAttr ? document.getElementById(forAttr) : null;
  }

  function findByVisibleText(text) {
    var selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"], span, div, td, th, li';
    var els = Array.from(document.querySelectorAll(selectors));
    var lText = text.toLowerCase();
    // Exact match first
    var exact = els.find(function(el) {
      return (el.textContent || el.value || '').trim().toLowerCase() === lText && isVisible(el);
    });
    if (exact) return exact;
    // Partial match
    return els.find(function(el) {
      return (el.textContent || el.value || '').trim().toLowerCase().includes(lText) && isVisible(el);
    });
  }

  function findByXPath(xpath) {
    try {
      return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) { return null; }
  }

  function getTargetCandidates(target) {
    if (!target || typeof target !== 'string') return [];
    var t = target.trim();
    var candidates = [t];
    var stripped = t.replace(/^["']|["']$/g, '').trim();
    if (stripped !== t) candidates.push(stripped);
    var words = t.split(/\s+/).filter(function(w) { return w.length >= 2; });
    for (var i = 0; i < words.length; i++) {
      var w = words[i].replace(/^["']|["']$/g, '');
      if (w && candidates.indexOf(w) === -1) candidates.push(w);
    }
    return candidates;
  }

  function locateElement(target) {
    if (!target) return null;
    var candidates = getTargetCandidates(target);
    for (var c = 0; c < candidates.length; c++) {
      var attempt = candidates[c];
      for (var i = 0; i < strategies.length; i++) {
        try {
          var el = strategies[i](attempt);
          if (el && isVisible(el)) return el;
        } catch (e) {}
      }
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0 && r.width > 0;
  }

  // ─── Message Listener ────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'EXECUTE_ACTION') {
      executeAction(request.action).then(sendResponse);
      return true;
    }
    if (request.type === 'PERFORM_LOGIN') {
      // Don't even respond if this is an empty tracking iframe - avoids channel collisions
      if (document.querySelectorAll('input').length === 0 && window !== window.top) {
        return false;
      }
      performLogin(request.creds).then(sendResponse);
      return true;
    }
  });

  // ─── Login Handler ───────────────────────────────────────────────────────────
  function logUI(msg) {
    try { chrome.runtime.sendMessage({ type: 'UI_LOG', kind: 'info', message: '[Injector] ' + msg }); } catch(e){}
  }

  async function performLogin(creds) {
    try {
      logUI('Scanning page for login fields...');
      var userEl = null, pwEl = null, btnEl = null;
      var maxWaitSteps = 30; // 15 seconds
      
      // 1. Wait for username field
      for (var i = 0; i < maxWaitSteps; i++) {
        userEl = document.getElementById('signInName') ||
                 document.getElementById('email') ||
                 document.getElementById('username') ||
                 locateElement('username') ||
                 locateElement('email') ||
                 locateElement('login') ||
                 document.querySelector('input[type="email"]') ||
                 document.querySelector('input[name="loginfmt"]') ||
                 document.querySelector('input[name="username"]') ||
                 document.querySelector('input[name="email"]') ||
                 document.querySelector('input[name="Sign in name"]');
        if (userEl && isVisible(userEl) && !userEl.disabled) break;
        await wait(500);
      }
      
      if (!userEl && window !== window.top) {
        return { status: 'Ignored', message: 'Not the auth frame' };
      }
      
      if (userEl) {
        logUI('Found username field: ' + (userEl.id || userEl.name || 'email input') + '. Entering email...');
        fillInput(userEl, creds.username);
        await wait(800);
      } else {
        logUI('Error: Could not locate username field.');
        return { status: 'Failed', error: 'Could not find username field' };
      }

      // 2. Wait for password field
      for (var i = 0; i < maxWaitSteps; i++) {
        pwEl = document.getElementById('password') ||
               document.getElementById('passwd') ||
               locateElement('password') ||
               document.querySelector('input[type="password"]') ||
               document.querySelector('input[name="passwd"]');
        if (pwEl && isVisible(pwEl) && !pwEl.disabled) break;
        await wait(500);
      }
      
      if (pwEl) {
        logUI('Found password field: ' + (pwEl.id || pwEl.name || 'password input') + '. Entering password...');
        fillInput(pwEl, creds.password);
        await wait(800);
      } else {
        logUI('Error: Could not locate password field.');
      }

      // 3. Wait for login button
      logUI('Searching for login button...');
      for (var i = 0; i < maxWaitSteps; i++) {
        btnEl = document.getElementById('next') ||
                document.getElementById('idSIButton9') ||
                findByVisibleText('Sign in') ||
                findByVisibleText('Sign In') ||
                findByVisibleText('Login') ||
                findByVisibleText('Continue') ||
                document.querySelector('button[type="submit"]') ||
                document.querySelector('input[type="submit"]');
        if (btnEl && isVisible(btnEl) && !btnEl.disabled) break;
        await wait(500);
      }
      
      if (btnEl) {
        logUI('Clicking login button!');
        btnEl.click();
      } else if (pwEl) {
        logUI('Login button not found, simulating Enter key.');
        pwEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        if (pwEl.form) pwEl.form.submit();
      }

      return { status: 'Success', message: 'Login attempted' };
    } catch (e) {
      logUI('Login script error: ' + e.message);
      return { status: 'Failed', error: e.message };
    }
  }

  // ─── Action Executor ─────────────────────────────────────────────────────────
  async function executeAction(action) {
    try {
      if (action.type === 'navigate') {
        window.location.href = action.value || action.url;
        return { status: 'Success' };
      }

      if (action.type === 'scroll') {
        window.scrollBy(0, action.value === 'down' ? 500 : -500);
        return { status: 'Success' };
      }

      var el = locateElement(action.target);

      if (action.type === 'validate') {
        var text = (action.target || '').toLowerCase();
        var expected = (action.value || '').toLowerCase();

        // URL validation
        if (text.includes('url') || text.includes('page')) {
          var currentUrl = window.location.href.toLowerCase();
          var passed = expected ? currentUrl.includes(expected) : true;
          return { status: passed ? 'Passed' : 'Failed', actual: 'Current URL: ' + window.location.href };
        }

        // Text validation
        if (el) {
          var elText = (el.textContent || el.value || '').trim();
          var textPassed = expected ? elText.toLowerCase().includes(expected) : isVisible(el);
          return { status: textPassed ? 'Passed' : 'Failed', actual: 'Text: "' + elText + '"' };
        }

        // URL fallback when no element but expected given
        if (expected && !el) {
          var urlPassed = window.location.href.toLowerCase().includes(expected) ||
                          document.body.innerText.toLowerCase().includes(expected);
          return { status: urlPassed ? 'Passed' : 'Failed', actual: 'Searched in page content' };
        }

        return { status: 'Failed', actual: 'Element not found: ' + action.target };
      }

      if (!el) {
        return { status: 'Failed', error: 'Element not found: "' + action.target + '"' };
      }

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(300);

      switch (action.type) {
        case 'click':
          el.focus();
          el.click();
          break;
        case 'type':
          fillInput(el, action.value || action.text || '');
          break;
        case 'select':
          el.value = action.value || action.text || '';
          el.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        case 'hover':
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          break;
        default:
          if (typeof el.click === 'function') el.click();
      }

      await wait(1000); // Wait longer after interactions
      return { status: 'Success' };
    } catch (err) {
      return { status: 'Failed', error: err.message };
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────
  function fillInput(el, value) {
    el.focus();
    el.click(); // Needed for some single-page-app authentication flows
    
    // React15/16 hack
    var tracker = el._valueTracker;
    if (tracker) tracker.setValue('');
    
    // Native setter override (critical for modern frameworks)
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');

    if (el.tagName.toLowerCase() === 'textarea' && nativeTextAreaValueSetter && nativeTextAreaValueSetter.set) {
      nativeTextAreaValueSetter.set.call(el, value);
    } else if (nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    el.blur();
  }

  function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

})();
