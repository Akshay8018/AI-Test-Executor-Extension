/**
 * Validator Engine
 * Contains logic to validate expected results against actual UI states.
 */
export const Validator = {
  checkState: (element, action) => {
    if (!element) return { passed: false, error: 'Element not found' };
    
    const text = action.target.toLowerCase();
    const expected = action.value || '';
    
    // Check various validation types based on action or target context
    if (text.includes('not visible') || text.includes('hidden')) {
      return { passed: !isElementVisible(element), actual: 'Element visibility check' };
    }
    
    if (text.includes('contains') || text.includes('has')) {
      const actualText = element.textContent || '';
      return { 
        passed: actualText.toLowerCase().includes(expected.toLowerCase()),
        actual: `Actual text: "${actualText}"`
      };
    }

    // Default: Check visibility
    return { 
      passed: isElementVisible(element), 
      actual: isElementVisible(element) ? 'Element is visible' : 'Element is not visible' 
    };
  }
};

function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}
