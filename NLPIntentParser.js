/**
 * NLPIntentParser.js
 * 
 * Enterprise NLP Validation Engine
 * Role: Tokenizes Expected Result strings, identifies validation intent category, and extracts targets.
 */

globalThis.NLPIntentParser = {
    
    parseIntent: function(expectedResultText) {
        if (!expectedResultText || expectedResultText === '-') {
            return { Intent: 'None', Target: null, Confidence: 0 };
        }

        var text = expectedResultText.toLowerCase().trim();
        var result = {
            RawText: expectedResultText,
            Intent: 'Unknown',
            Target: null,
            Confidence: 50
        };

        // 1. Navigation Validation mapped via semantics
        if (this.matchesAny(text, ['navigated', 'redirected', 'lands on', 'taken to', 'opens', 'url'])) {
            result.Intent = 'NavigationValidation';
            result.Target = this.extractTargetOrPage(text);
            result.Confidence = 90;
            return result;
        }

        // 2. Message / Toast Validation mapped via semantics
        if (this.matchesAny(text, ['success message', 'alert', 'toast', 'notification', 'warning', 'error message', 'popup', 'shows message', 'message displayed', 'successfully'])) {
            result.Intent = 'MessageValidation';
            result.Target = this.extractQuotedOrKeyword(expectedResultText, ['message', 'alert', 'toast', 'successfully', 'warning']);
            result.Confidence = 85;
            return result;
        }

        // 3. UI State Validation (Visibility, Button Enablement)
        if (this.matchesAny(text, ['displayed', 'shown', 'visible', 'appears', 'hidden', 'disappears', 'disabled', 'enabled'])) {
            result.Intent = 'UIStateValidation';
            result.Target = this.extractTargetOrPage(expectedResultText);
            
            if (this.matchesAny(text, ['hidden', 'disappears', 'removed', 'not visible', 'no longer'])) {
                result.SubIntent = 'NegativeVisibility';
            } else if (this.matchesAny(text, ['disabled', 'greyed out'])) {
                result.SubIntent = 'DisabledState';
            } else {
                result.SubIntent = 'PositiveVisibility';
            }
            
            result.Confidence = 80;
            return result;
        }

        // 4. Data / Text Validation (Strict value matches)
        if (this.matchesAny(text, ['value is', 'contains', 'equals', 'updated to', 'saved as'])) {
            result.Intent = 'DataValidation';
            result.Target = this.extractQuoted(expectedResultText) || this.extractTargetOrPage(expectedResultText);
            result.Confidence = 75;
            return result;
        }

        // Fallback: Ambiguous / Unknown. We will rely on UIStateScanner to do a generic keyword scan.
        result.Target = this.extractQuoted(expectedResultText) || expectedResultText;
        return result;
    },

    matchesAny: function(text, keywords) {
        return keywords.some(function(kw) { return text.indexOf(kw) !== -1; });
    },

    extractQuoted: function(text) {
        var match = text.match(/["']([^"']+)["']/);
        return match ? match[1] : null;
    },

    extractQuotedOrKeyword: function(originalText, contextualWords) {
        // Prefer explicit quoted strings: "Record Saved Successfully"
        var quoted = this.extractQuoted(originalText);
        if (quoted) return quoted;

        // Fallback: Extract the segment of the sentence containing the meat.
        // E.g., "A success message stating saved successfully is displayed" -> "saved successfully"
        var lower = originalText.toLowerCase();
        for (var i = 0; i < contextualWords.length; i++) {
            var word = contextualWords[i];
            if (lower.indexOf(' ' + word) !== -1) {
                 // Try to grab the phrase surrounding the contextual word
                 var parts = originalText.split(new RegExp('\\b' + word + '\\b', 'i'));
                 if (parts.length > 1) {
                     return (parts[0] + ' ' + word + ' ' + parts[1]).trim().replace(/^(should be|is|a|the|that)\s+/i, '');
                 }
            }
        }
        return originalText; 
    },

    extractTargetOrPage: function(text) {
        var quoted = this.extractQuoted(text);
        if (quoted) return quoted;

        // Strip structural NLP filler
        var stopWords = 'user|should|be|able|to|see|view|that|the|is|are|a|an|navigated|redirected|lands|on|page|screen|dashboard|displayed|shown|visible|appears';
        var clean = text.replace(new RegExp('\\b(' + stopWords + ')\\b', 'gi'), ' ').replace(/\s+/g, ' ').trim();
        return clean || text;
    }
};
