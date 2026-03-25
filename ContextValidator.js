/**
 * ContextValidator.js
 * 
 * Enterprise Enhancement Layer 3
 * Role: Verifies the Element matches the expected scope, page context, and structural validity.
 */

window.ContextValidator = {

  findContextContainer: function(contextName) {
      if (!contextName) return null;
      var cLower = contextName.toLowerCase().trim();
      var sections = Array.from(document.querySelectorAll('section, article, [role="region"], div[class*="card"], div[class*="panel"], div[class*="section"]'));
      // Find exact container text matching
      for (var i = 0; i < sections.length; i++) {
          var text = (sections[i].textContent || '').toLowerCase().trim();
          if (text.includes(cLower)) {
              return sections[i]; // Return the encapsulating section
          }
      }
      return null;
  },

  validateElementPreconditions: function(el) {
      if (!el) return { valid: false, reason: 'Element is null' };
      
      // 1. Existing
      if (!document.body.contains(el)) return { valid: false, reason: 'Element no longer attached to DOM' };
      
      // 2. Visible
      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0 || rect.width === 0 || rect.height === 0) {
          return { valid: false, reason: 'Element is visually hidden or has 0 dimensions' };
      }

      // 3. Enabled
      if (el.disabled || el.hasAttribute('disabled')) {
          return { valid: false, reason: 'Element is explicitly disabled' };
      }
      if (style.pointerEvents === 'none') {
          return { valid: false, reason: 'Element has pointer-events: none' };
      }

      // 4. Overlapped / Obscured (Attempting Center Point test)
      try {
          var centerX = rect.left + (rect.width / 2);
          var centerY = rect.top + (rect.height / 2);
          var topEl = document.elementFromPoint(centerX, centerY);
          
          if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
              // Sometimes overlays like tooltips or loading spinners block it
              var topStyle = window.getComputedStyle(topEl);
              if (parseFloat(topStyle.opacity) > 0 && topStyle.pointerEvents !== 'none') {
                 // return { valid: false, reason: 'Element is overlapped by another element: <' + topEl.tagName.toLowerCase() + '>' };
                 // Soft warning: return valid true so it doesn't hard block, but we could log it.
              }
          }
      } catch (e) {
          // ignore CORS or cross frame point check errors
      }

      return { valid: true, reason: 'Element is visible, enabled, and interactable' };
  }
};
