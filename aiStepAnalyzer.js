/**
 * aiStepAnalyzer.js
 * Advanced Natural Language Understanding for manual test steps.
 * Provides logical extraction of: Action, Target Element, Context, Expected Outcome.
 * Falls back to the original stepInterpreter if parsing is simple.
 */

function analyzeStepIntent(stepDescription, expectedResult) {
  var step = (stepDescription || "").trim();
  var expected = (expectedResult || "").trim();

  var intent = {
    originalText: step,
    actionType: "unknown",
    targetElement: null,
    contextSection: null,
    expectedOutcome: expected,
    validationType: null
  };

  // 1. Context Extraction (e.g., "under the PAR section", "from the selected PAR")
  var contextMatch = step.match(/(?:under|in|from|within|inside)(?:\s+the)?\s+(.+?)(?:\s+section|card|panel|area|form|\.|$)/i);
  if (contextMatch && contextMatch[1]) {
    intent.contextSection = cleanText(contextMatch[1]);
  }

  // 2. Action & Target Extraction
  var lowerStep = step.toLowerCase();
  
  if (matchesAny(lowerStep, ["click", "press", "tap", "hit", "select", "choose"])) {
    intent.actionType = "click";
    intent.targetElement = extractTarget(step, ["click", "press", "tap", "hit", "select", "choose"]);
  } 
  else if (matchesAny(lowerStep, ["enter", "type", "input", "write", "fill"])) {
    intent.actionType = "type";
    intent.targetElement = extractTarget(step, ["in", "into", "field", "box"]);
    // Try to extract quoted text as the value to type
    var quoted = step.match(/["'](.*?)["']/);
    if (quoted && quoted[1]) {
        intent.expectedOutcome = quoted[1];
    }
  } 
  else if (matchesAny(lowerStep, ["verify", "assert", "check", "ensure", "validate"])) {
    intent.actionType = "validate";
    intent.targetElement = extractTarget(step, ["verify", "assert", "check", "ensure", "validate"]);
    if (lowerStep.includes("visible") || lowerStep.includes("displayed")) {
        intent.validationType = "visibility";
    } else if (lowerStep.includes("value") || lowerStep.includes("text")) {
        intent.validationType = "text";
    }
  }
  else if (matchesAny(lowerStep, ["scroll", "move down", "move up"])) {
      intent.actionType = "scroll";
      intent.targetElement = lowerStep.includes("down") ? "down" : "up";
  }
  else if (matchesAny(lowerStep, ["upload", "attach"])) {
      intent.actionType = "upload";
      intent.targetElement = extractTarget(step, ["to", "into", "field"]);
  }

  // 3. Fallback targeting if the extraction was weak
  if (!intent.targetElement || intent.targetElement.length < 2) {
      var words = step.split(" ");
      if (words.length > 1 && !matchesAny(words[0].toLowerCase(), ["click", "enter", "verify"])) {
          // It might just be the name of a button without an action verb
          intent.targetElement = step;
          if (intent.actionType === "unknown") intent.actionType = "click";
      }
  }

  return intent;
}

function cleanText(text) {
    return text.replace(/["']/g, "").trim();
}

function extractTarget(text, stopwords) {
    var clean = text.replace(/["']/g, " ");
    stopwords.forEach(function(word) {
        var reg = new RegExp("\\b" + word + "\\b", "ig");
        clean = clean.replace(reg, " ");
    });
    // Remove "on the", "in the", "value" to isolate the element name
    clean = clean.replace(/\b(on the|in the|value|field|button|link|under the|under|from)\b/ig, " ");
    return clean.replace(/\s+/g, " ").trim();
}

function matchesAny(text, keywords) {
    return keywords.some(function(kw) { return text.includes(kw); });
}

// Interceptor hook for executionEngine
function buildActionFromIntent(intent, originalAction) {
    if (intent.actionType === "unknown" || !intent.targetElement) {
        return originalAction; // Fallback
    }
    
    return {
        type: intent.actionType,
        target: intent.targetElement,
        section: intent.contextSection,
        value: intent.expectedOutcome,
        validation: intent.validationType,
        isAiResolved: true
    };
}
