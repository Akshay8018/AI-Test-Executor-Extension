/**
 * ExactMatchEngine.js
 * 
 * Enterprise Enhancement Layer 2
 * Role: Strict Text Matching Engine
 * Implements priority: 1. Exact, 2. Insensitive Exact, 3. Word Boundary. Substrings banned.
 */

window.ExactMatchEngine = {
  
  findExactElement: function(targetText, container, elementType) {
    if (!targetText) return null;
    var scope = container || document;
    
    // Convert target to lower case but retain original for exact checks
    var lowerTarget = targetText.toLowerCase().trim();
    var exactTarget = targetText.trim();
    
    // Choose selectors based on expected element type
    var selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"], span, div, td, th, li';
    if (elementType === 'Button') selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
    if (elementType === 'Input') selectors = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea';
    if (elementType === 'Dropdown') selectors = 'select, [role="combobox"], [role="listbox"]';
    
    var els = Array.from(scope.querySelectorAll(selectors));
    
    // 1. Strict Exact Text Match (Case Sensitive)
    for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!this.isValidUI(el)) continue;
        var textContent = (el.textContent || el.value || '').trim();
        if (textContent === exactTarget) {
            return { element: el, matchType: 'Strict Exact', confidence: 100 };
        }
    }
    
    // 2. Case-Insensitive Exact Match
    for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!this.isValidUI(el)) continue;
        var textContent = (el.textContent || el.value || '').trim().toLowerCase();
        if (textContent === lowerTarget) {
            return { element: el, matchType: 'Case-Insensitive Exact', confidence: 95 };
        }
    }
    
    // 3. Exact Word Boundary Regex (e.g., 'schem' won't match 'schem (1)' or 'schematic')
    var boundaryRegex = new RegExp('^\\b' + this.escapeRegex(lowerTarget) + '\\b$', 'i');
    for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!this.isValidUI(el)) continue;
        var textContent = (el.textContent || el.value || '').trim().toLowerCase();
        if (boundaryRegex.test(textContent)) {
            return { element: el, matchType: 'Word Boundary', confidence: 90 };
        }
    }
    
    return null; // Guarantee explicit failure instead of falling back to substring
  },
  
  isValidUI: function(el) {
    // Is not null and effectively visible structurally
    if (!el) return false;
    if (el.offsetParent === null && window.getComputedStyle(el).position !== 'fixed') return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    var style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) return false;
    return true;
  },

  escapeRegex: function(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};
