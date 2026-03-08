/**
 * UIStateScanner.js
 * 
 * Enterprise NLP Validation Engine
 * Role: Content Script layer. Evaluates the physical UI state against the structured NLP Intent.
 * Supports deep Modal/Toast inspection and DOM recursive checks.
 */

window.UIStateScanner = {

    validateState: function(validationPayload) {
        var intent = validationPayload.Intent;
        var target = validationPayload.Target || validationPayload.RawText;

        switch (intent) {
            case 'NavigationValidation':
                return this.validateNavigation(target);
            case 'MessageValidation':
                return this.validateMessageOrToast(target);
            case 'UIStateValidation':
                return this.validateUIState(target, validationPayload.SubIntent);
            case 'DataValidation':
                return this.validateData(target);
            default:
                // Fallback Ambiguous execution: Scan everything
                return this.performFallbackScan(target);
        }
    },

    validateNavigation: function(expectedSegment) {
        var currentUrl = window.location.href.toLowerCase();
        var lowerExpected = expectedSegment.toLowerCase().trim();
        
        // 1. Direct URL Match
        if (currentUrl.includes(lowerExpected)) {
            return { status: 'Passed', log: 'URL explicitly matches expected navigation: ' + currentUrl };
        }

        // 2. Page Title or Main Header match
        var title = document.title.toLowerCase();
        if (title.includes(lowerExpected)) {
            return { status: 'Passed', log: 'Page title matches expected navigation: ' + title };
        }

        var h1s = Array.from(document.querySelectorAll('h1, h2, .page-title, .header-title'));
        for (var i = 0; i < h1s.length; i++) {
            if (this.isVisible(h1s[i]) && h1s[i].textContent.toLowerCase().includes(lowerExpected)) {
                return { status: 'Passed', log: 'Page header matches expected navigation: ' + h1s[i].textContent.trim() };
            }
        }

        return { status: 'Failed', log: 'Navigation verification failed. Current URL: ' + currentUrl + ', Expected marker: ' + lowerExpected };
    },

    validateMessageOrToast: function(expectedMessage) {
        var lowerMsg = expectedMessage.toLowerCase().trim();
        
        // Target high-z-index, role=alert, or absolute positioned elements common for Toasts/Snackbar
        var messageContainers = Array.from(document.querySelectorAll('[role="alert"], [role="status"], [class*="toast"], [class*="snackbar"], [class*="message"], [class*="notification"], [class*="alert"]'));
        
        for (var i = 0; i < messageContainers.length; i++) {
            var el = messageContainers[i];
            if (this.isVisible(el)) {
                var text = el.textContent.toLowerCase().trim();
                // Semantic loosening: check if all major words are present
                var words = lowerMsg.split(/\s+/).filter(w => w.length > 3);
                var matchCount = 0;
                words.forEach(w => { if (text.includes(w)) matchCount++; });
                
                if (text.includes(lowerMsg) || (words.length > 0 && matchCount >= words.length - 1)) {
                    return { status: 'Passed', log: 'Message successfully detected in UI: "' + text + '"' };
                }
            }
        }

        // Deep Fallback: It might just be embedded in a standard div near the top or as a modal
        return this.performFallbackScan(expectedMessage, 'Successfully verified message present in UI: "' + expectedMessage + '"');
    },

    validateUIState: function(targetText, subIntent) {
        var lowerTarget = targetText.toLowerCase().trim();
        var elements = Array.from(document.querySelectorAll('button, a, input, [role="button"], label, div, span, h1, h2, h3'));
        
        var foundVisible = false;
        var foundDisabled = false;

        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var text = (el.textContent || el.value || '').toLowerCase().trim();
            
            if (text === lowerTarget || (text.length > 3 && text.includes(lowerTarget))) {
                if (this.isVisible(el)) {
                    foundVisible = true;
                    if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled')) {
                        foundDisabled = true;
                    }
                    break;
                }
            }
        }

        if (subIntent === 'NegativeVisibility') {
            if (!foundVisible) return { status: 'Passed', log: 'Element confirmed as NOT visible or removed.' };
            return { status: 'Failed', log: 'Element is still visible in the DOM when it should be hidden.' };
        }
        
        if (subIntent === 'DisabledState') {
            if (foundVisible && foundDisabled) return { status: 'Passed', log: 'Element found and confirmed Disabled.' };
            if (!foundVisible) return { status: 'Failed', log: 'Element not found.' };
            return { status: 'Failed', log: 'Element is active and enabled, but expected Disabled state.' };
        }

        // Positive Visibility (Default)
        if (foundVisible) return { status: 'Passed', log: 'Element successfully verified as Visible.' };
        return { status: 'Failed', log: 'Required UI state element not found or not visible: ' + targetText };
    },

    validateData: function(expectedData) {
        return this.performFallbackScan(expectedData, 'Successfully verified expected data in UI: "' + expectedData + '"');
    },

    performFallbackScan: function(targetText, passMessage) {
        var lowerTarget = targetText.toLowerCase().trim();
        // A generic text scan inside body
        var bodyText = document.body.innerText.toLowerCase();
        
        var words = lowerTarget.split(/\s+/).filter(w => w.length > 3);
        if (words.length === 0) return { status: 'Failed', log: 'Validation phrase too ambiguous or empty.' };

        var matches = 0;
        words.forEach(w => { if (bodyText.includes(w)) matches++; });

        var acceptableThreshold = Math.ceil(words.length * 0.75); // 75% word match
        if (matches >= acceptableThreshold) {
            return { status: 'Passed', log: passMessage || 'Successfully verified presence of expected text: "' + targetText + '"' };
        }

        return { status: 'Failed', log: 'Failed semantic Fallback Scan. Could not confidently locate expected text.' };
    },

    isVisible: function(el) {
        if (!el || !document.body.contains(el)) return false;
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }
};
