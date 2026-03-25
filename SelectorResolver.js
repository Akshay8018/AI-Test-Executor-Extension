/**
 * SelectorResolver.js
 * 
 * Enterprise Enhancement Layer 4
 * Role: Hierarchical locator lookup mechanism and AI selector fallback generation.
 */

window.SelectorResolver = {
    // 1. data-testid
    // 2. aria-label
    // 3. role + name
    // 4. ExactMatchEngine
    // 5. associated label
    // 6. xpath fallback
    
    resolveLocator: function(structuredAction) {
        var target = structuredAction.Target;
        if (!target) return null;

        var contextContainer = window.ContextValidator ? window.ContextValidator.findContextContainer(structuredAction.Context) : null;
        var scope = contextContainer || document;

        // Strip quotes
        var pureTarget = target.replace(/^["']|["']$/g, '').trim();

        // Level 1: Data-TestId
        var el = scope.querySelector('[data-testid="' + pureTarget + '"]');
        if (this.isValid(el)) return { element: el, strategy: 'data-testid', priority: 1 };

        // Level 2: Aria-Label
        el = scope.querySelector('[aria-label="' + pureTarget + '"]');
        if (this.isValid(el)) return { element: el, strategy: 'aria-label', priority: 2 };

        // Level 3: Role
        el = scope.querySelector('[role="' + pureTarget + '"]');
        if (this.isValid(el)) return { element: el, strategy: 'role', priority: 3 };

        // Level 4: Exact Text Match Pipeline
        if (window.ExactMatchEngine) {
            var exactResult = window.ExactMatchEngine.findExactElement(pureTarget, scope, structuredAction.Type);
            if (exactResult && this.isValid(exactResult.element)) {
                return { element: exactResult.element, strategy: 'Exact Text (' + exactResult.matchType + ')', priority: 4 };
            }
        }

        // Level 5: Associated Label (For Inputs)
        el = this.findInputByLabelText(pureTarget, scope);
        if (this.isValid(el)) return { element: el, strategy: 'label-association', priority: 5 };

        // Level 6: Safely formatted XPath string
        el = this.findByXPath(pureTarget, scope);
        if (this.isValid(el)) return { element: el, strategy: 'xpath', priority: 6 };

        return null; // Locator fully failed
    },

    isValid: function(el) {
        return window.ExactMatchEngine ? window.ExactMatchEngine.isValidUI(el) : !!el;
    },

    findInputByLabelText: function(text, scope) {
        var labels = Array.from(scope.querySelectorAll('label'));
        var exactMatch = labels.find(function(l) { return l.textContent.trim().toLowerCase() === text.toLowerCase(); });
        if (exactMatch) {
            if (exactMatch.control) return exactMatch.control;
            if (exactMatch.getAttribute('for')) return document.getElementById(exactMatch.getAttribute('for'));
        }
        return null;
    },

    findByXPath: function(xpath, scope) {
        // Quick check if standard raw xpath was sent from excel
        if (xpath.startsWith('/') || xpath.startsWith('(')) {
            try { return document.evaluate(xpath, scope === document ? document : document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; } catch (e) { return null; }
        }
        return null;
    },

    generateHealingSuggestion: function(targetName) {
        // Creates a highly precise backup XPath that locks the text bounds
        return "//*[normalize-space(text())='" + targetName.replace(/'/g, "\\'") + "'] or //*[@placeholder='" + targetName.replace(/'/g, "\\'") + "']";
    }
};
