/**
 * aiHealer.js
 * Deep target heuristic resolution & robust self-healing mechanisms.
 * Dynamically generates CSS/XPath locators and performs partial/case-insensitive searches if exact match fails.
 */

(function() {
    'use strict';
  
    window.aihealer = window.aihealer || {};
  
    window.aihealer.healLocator = function(targetText, contextSectionText) {
        console.log("[AI QA Agent] Attempting Self-Healing for target: '" + targetText + "' in context: '" + contextSectionText + "'");
        
        var bodyTextLower = document.body.innerText.toLowerCase();
        var tLower = (targetText || "").toLowerCase();
        
        // Strategy 1: Smart map lookup (if aiDomAnalyzer ran)
        if (window.aidom && window.aidom.buildMentalMap) {
            var map = window.aidom.buildMentalMap();
            var matches = map.interactables.filter(function(i) {
                return i.label.toLowerCase().includes(tLower);
            });
            
            if (matches.length > 0) {
                if (contextSectionText) {
                    var ctxLower = contextSectionText.toLowerCase();
                    var strictMatch = matches.find(function(i) { return i.context.toLowerCase().includes(ctxLower); });
                    if (strictMatch) {
                        console.log("[AI QA Agent] Healed using Contextual Map:", strictMatch.el);
                        return strictMatch.el;
                    }
                }
                console.log("[AI QA Agent] Healed using DOM Map (Partial match):", matches[0].el);
                return matches[0].el;
            }
        }
        
        // Strategy 2: Dynamic XPath generation
        // e.g., //*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),'schema')]
        var dynamicXPaths = [
            `//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${tLower}')]`,
            `//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${tLower}')]`,
            `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${tLower}')]`,
            `//*[@placeholder[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${tLower}')]]`,
            `//*[@aria-label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${tLower}')]]`
        ];
        
        for (var i = 0; i < dynamicXPaths.length; i++) {
            var el = findByXPath(dynamicXPaths[i]);
            if (el && isVisible(el)) {
                console.log(`[AI QA Agent] Healed using Dynamic XPath: ${dynamicXPaths[i]}`, el);
                return el;
            }
        }
        
        // Strategy 3: Role-based CSS queries & text content searching deep sweep
        var allEls = document.querySelectorAll('*');
        for (var i = 0; i < allEls.length; i++) {
            var e = allEls[i];
            if (e.children.length === 0 && e.textContent && e.textContent.toLowerCase().includes(tLower) && isVisible(e)) {
                console.log("[AI QA Agent] Healed using Deep Sweep (Leaf Node):", e);
                return e;
            }
        }

        console.warn("[AI QA Agent] Self-Healing Exhausted. Element not found: " + targetText);
        return null;
    };
  
    function findByXPath(xpath) {
        try {
            return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch (e) {
            return null;
        }
    }

    function isVisible(el) {
        if (!el) return false;
        var r = el.getBoundingClientRect();
        var style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0 && r.width > 0 && r.height > 0;
    }
  
    // Interceptor hook for content.js messages
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'AI_EXECUTE_ACTION') {
            // Note: We trigger this from executionEngine if standard execution fails.
            var action = request.action;
            var healedElement = window.aihealer.healLocator(action.target, action.section);
            
            if (healedElement) {
                healedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                try {
                    if (action.type === 'type') {
                        healedElement.value = action.value;
                        healedElement.dispatchEvent(new Event('input', { bubbles: true }));
                        healedElement.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        healedElement.click();
                    }
                    sendResponse({ status: 'Success', healed: true });
                } catch(e) {
                    sendResponse({ status: 'Failed', error: 'Healed element found, but interaction failed: ' + e.message });
                }
            } else {
                var reason = 'AI Healer could not locate element: "' + action.target + '". ';
                reason += 'Checked dynamic XPaths, context sections, and deep DOM text search, but no matching visible element was found. ';
                reason += 'Possible causes: Incorrect step text, element not loaded yet, or navigating on wrong page.';
                sendResponse({ status: 'Failed', error: reason });
            }
            return true;
        }
    });

})();
