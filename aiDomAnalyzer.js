/**
 * aiDomAnalyzer.js
 * Injected into the page. Builds a mental map of the current page layout.
 * Discovers interactable elements, visible text, inputs, buttons, and context sections.
 */

(function() {
    'use strict';
  
    window.aidom = window.aidom || {};
  
    // Map of logical page sections and their interactable elements
    var currentDomMap = {
        sections: [],
        interactables: []
    };
  
    window.aidom.buildMentalMap = function() {
        currentDomMap.interactables = [];
        currentDomMap.sections = [];
        
        // 1. Identify high-level contextual sections
        var sectionSelectors = 'section, article, main, header, footer, aside, [role="region"], div[class*="card"], div[class*="panel"], div[class*="section"], div[class*="container"]';
        var sections = Array.from(document.querySelectorAll(sectionSelectors)).filter(isVisible);
        
        sections.forEach(function(sec) {
            var text = (sec.innerText || "").substring(0, 100).trim();
            if (text) {
                currentDomMap.sections.push({ el: sec, previewText: text });
            }
        });
  
        // 2. Identify all interactables (Buttons, Links, Inputs)
        var interactableSelectors = 'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], .btn, .button';
        var elements = Array.from(document.querySelectorAll(interactableSelectors)).filter(isVisible);
        
        elements.forEach(function(el) {
            var label = computeElementLabel(el);
            if (label) {
                currentDomMap.interactables.push({
                    el: el,
                    tag: el.tagName.toLowerCase(),
                    label: label,
                    context: findClosestSectionText(el, currentDomMap.sections)
                });
            }
        });
        
        console.log("[AI QA Agent] Built DOM Mental Map:", currentDomMap);
        return currentDomMap;
    };
  
    function computeElementLabel(el) {
        var text = (el.innerText || el.textContent || "").trim();
        if (text) return text;
        if (el.value) return el.value;
        if (el.placeholder) return el.placeholder;
        if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
        if (el.name) return el.name;
        if (el.id) return el.id;
        
        // Check associated label for inputs
        if (el.id) {
            var labelEl = document.querySelector('label[for="' + el.id + '"]');
            if (labelEl) return (labelEl.innerText || labelEl.textContent || "").trim();
        }
        
        return null;
    }
  
    function findClosestSectionText(el, sectionsArray) {
        var parent = el.parentElement;
        while (parent && parent !== document.body) {
            var matchedSection = sectionsArray.find(function(s) { return s.el === parent; });
            if (matchedSection) return matchedSection.previewText;
            parent = parent.parentElement;
        }
        return "Global/Body";
    }
  
    function isVisible(el) {
        if (!el) return false;
        var r = el.getBoundingClientRect();
        var style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0 && r.width > 0 && r.height > 0;
    }
  
    // Listen for requests to analyze the page
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'AI_ANALYZE_DOM') {
            window.aidom.buildMentalMap();
            sendResponse({ status: 'Map Built' });
        }
    });

  })();
  
