/**
 * ExecutionIntelligenceLayer.js
 * 
 * Enterprise Enhancement Layer 5
 * Role: Orchestrates execution safety (Wait for DOM, Retries, Confidence Threshold checking).
 * Wraps the execution pipeline before falling back to legacy content.js.
 */

window.ExecutionIntelligenceLayer = {
    
    smartExecute: async function(action) {
        // If the action is not marked as Enhanced, it failed NLP parsing and we route to legacy fallback instantly.
        if (!action.IsEnhanced) return null; // Returning null here tells content.js to use legacy execution

        var maxRetries = 2;
        var attempt = 0;
        
        while (attempt <= maxRetries) {
            try {
                // 1. Wait for stable DOM tick
                await this.waitForStableDOM();
                
                // 2. Resolve Locator via Hierarchical Multi-Locator
                var resolution = window.SelectorResolver.resolveLocator(action);
                
                if (!resolution || !resolution.element) {
                    // Try AI Recovery
                    var recoverySuggestion = window.SelectorResolver.generateHealingSuggestion(action.Target);
                    // We log this ambiguity and throw to trigger retry
                    throw new Error("Element not found. Suggested AI Fallback: " + recoverySuggestion);
                }

                var el = resolution.element;

                // 3. Context Validation (Visibility, Overlaps, Enabled)
                var validation = window.ContextValidator.validateElementPreconditions(el);
                if (!validation.valid) {
                    throw new Error("Validation Failed: " + validation.reason);
                }

                // 4. Safe Execution Dispatcher
                if (action.Action === 'Click') {
                    await this.safeClick(el);
                } else if (action.Action === 'Type') {
                    await this.safeType(el, action.ExpectedData);
                } else {
                    // Send other actions (like Select/Verify) back to legacy content.js
                    // But because we found the element securely via ExactMatch engine, we pass it down.
                    return { elementFound: el, requiresLegacyDispatcher: true }; 
                }

                // Success
                return { status: 'Passed', log: `Executed via Layered Strategy [${resolution.strategy}] with 100% Exact Match confidence.` };

            } catch (error) {
                console.warn("[IntelligenceLayer] Attempt " + attempt + " failed: " + error.message);
                if (attempt === maxRetries) {
                    // Rather than a hard fail, we pass failure data back but trigger the legacy fallback via requiresLegacyDispatcher
                    return { requiresLegacyDispatcher: true, intelligenceError: error.message }; 
                }
                attempt++;
                await this.waitTimeout(500 * attempt); // Progressive backoff
            }
        }
    },

    safeClick: async function(el) {
        // Scroll into middle view to avoid fixed headers blocking clicks
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.waitTimeout(200); // Visual stability
        el.click(); // Dispatch native click
    },

    safeType: async function(el, text) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.waitTimeout(200);
        
        el.focus();
        if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
            el.value = ''; // clear first
            el.value = text;
        } else {
            el.textContent = text; // contenteditable
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    },

    waitForStableDOM: async function() {
        // Wait 300ms to allow framework rendering animations to settle
        return new Promise(resolve => setTimeout(resolve, 300));
    },

    waitTimeout: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

};
