/**
 * StepParserEnhancer.js
 * 
 * Enterprise Enhancement Layer 1
 * Role: Sits above the legacy stepInterpreter.js.
 * Provides semantic NLP extraction, structured actions, and context validation definitions.
 */

function enhanceStepSemantic(stepDescription, testData, legacyAction) {
  var actionPayload = {
    // Legacy mapping support
    type: legacyAction.type,
    target: legacyAction.target,
    value: legacyAction.value,
    section: legacyAction.section,

    // Enterprise NLP Enrichment
    Action: legacyAction.type,
    Target: legacyAction.target,
    Type: 'Unknown',
    Context: legacyAction.section || null,
    IsEnhanced: true,
    Confidence: 100,
    RawText: stepDescription,
    ExpectedData: testData
  };

  var lowerDesc = (stepDescription || '').toLowerCase();

  // Deduce Element Type expectations explicitly
  if (lowerDesc.includes('button')) { actionPayload.Type = 'Button'; }
  else if (lowerDesc.includes('link')) { actionPayload.Type = 'Link'; }
  else if (lowerDesc.includes('label')) { actionPayload.Type = 'Label'; }
  else if (lowerDesc.includes('input') || lowerDesc.includes('field') || lowerDesc.includes('box')) { actionPayload.Type = 'Input'; }
  else if (lowerDesc.includes('dropdown') || lowerDesc.includes('select')) { actionPayload.Type = 'Dropdown'; }
  else if (lowerDesc.includes('checkbox') || lowerDesc.includes('toggle')) { actionPayload.Type = 'Checkbox'; }
  else if (lowerDesc.includes('table') || lowerDesc.includes('row')) { actionPayload.Type = 'TableElement'; }
  
  // Deduce explicit Action verb if legacy parser mapped aggressively
  if (lowerDesc.includes('click') || lowerDesc.includes('tap') || lowerDesc.includes('press')) { actionPayload.Action = 'Click'; }
  else if (lowerDesc.includes('enter') || lowerDesc.includes('type') || lowerDesc.includes('fill')) { actionPayload.Action = 'Type'; }
  else if (lowerDesc.includes('verify') || lowerDesc.includes('assert') || lowerDesc.includes('ensure')) { actionPayload.Action = 'Verify'; }
  else if (lowerDesc.includes('select') || lowerDesc.includes('choose')) { actionPayload.Action = 'Select'; }

  // Context Extractor Regex
  var contextMatch = stepDescription.match(/in the (.*?) (section|panel|card|form)/i) || 
                     stepDescription.match(/under (.*?) (section|panel|card|form)/i) ||
                     stepDescription.match(/from the (.*?) (section|panel|card|form|card\.)/i);
  if (contextMatch && contextMatch[1]) {
    actionPayload.Context = contextMatch[1].trim();
  }

  // Pre-process exact boundaries (removes ambiguity strings)
  var cleanTarget = actionPayload.Target;
  if (cleanTarget) {
    cleanTarget = cleanTarget.replace(/^["']|["']$/g, '').trim(); // Strip outer quotes
    
    // Aggressively remove the context string from the target string if it accidentally bled in
    // e.g. "schem" "schem (1)" -> "schem"
    if (actionPayload.Context) {
      var safeContext = actionPayload.Context.replace(/^["']|["']$/g, '').trim();
      var contextRegex = new RegExp(escapeRegex(safeContext), 'gi');
      cleanTarget = cleanTarget.replace(contextRegex, '').trim();
    }
    
    // Remove lingering structural words that bleed in from stepInterpreter.js gaps
    cleanTarget = cleanTarget.replace(/(card|section|panel|form)\.?\s*$/i, '').trim();
    
    // Final cleanup of floating quotes if the regex replacement orphaned them
    cleanTarget = cleanTarget.replace(/^["']|["']$/g, '').trim();
    cleanTarget = cleanTarget.replace(/["']/g, '').trim(); // Strip internal quotes from bad splits

    actionPayload.Target = cleanTarget;
    actionPayload.target = cleanTarget; // Fix legacy execution payload as well
    actionPayload.ExactBoundaryRegex = '\\b' + escapeRegex(cleanTarget) + '\\b';
  }

  return actionPayload;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
