/**
 * stepInterpreter.js
 * Converts natural language step descriptions into Action objects.
 * Loaded as a classic script — no ES6 exports.
 */

function interpretStep(stepDescription, testData) {
  var text = (stepDescription || '').toLowerCase();
  var section = extractSection(stepDescription);
  var fullTarget = cleanTarget(stepDescription);
  var target = fullTarget;
  if (section) {
    var withoutSection = fullTarget.replace(new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
    if (withoutSection) target = withoutSection;
    else target = fullTarget.split(/\s+/)[0] || fullTarget;
  }

  if (matchesAny(text, ['navigate to', 'open url', 'go to', 'launch'])) {
    var url = extractUrl(stepDescription) || testData;
    return { type: 'navigate', target: url, value: url };
  }

  if (matchesAny(text, ['click', 'press', 'tap', 'submit', 'hit'])) {
    return { type: 'click', target: target, section: section || undefined, value: null };
  }

  if (matchesAny(text, ['enter', 'type', 'input', 'fill in', 'write'])) {
    return { type: 'type', target: target, section: section || undefined, value: testData || extractQuoted(stepDescription) };
  }

  if (matchesAny(text, ['select', 'choose', 'pick'])) {
    return { type: 'select', target: target, section: section || undefined, value: testData };
  }

  if (matchesAny(text, ['verify', 'validate', 'check', 'assert', 'confirm', 'ensure', 'wait for'])) {
    return { type: 'validate', target: target, section: section || undefined, value: testData || null };
  }

  if (matchesAny(text, ['scroll down', 'scroll up'])) {
    return { type: 'scroll', target: null, value: text.includes('down') ? 'down' : 'up' };
  }

  if (matchesAny(text, ['hover', 'mouse over'])) {
    return { type: 'hover', target: target, section: section || undefined, value: null };
  }

  if (matchesAny(text, ['upload', 'attach', 'browse for'])) {
    return { type: 'upload', target: target, section: section || undefined, value: testData };
  }

  return { type: 'click', target: target, section: section || undefined, value: null };
}

/**
 * Extract section/context from step so we can find "that section" on the page first.
 * e.g. "click the Continue button from the FracPro Live+ card" -> "FracPro Live+ card"
 */
function extractSection(stepDescription) {
  var step = (stepDescription || '').trim();
  var patterns = [
    /(?:from the|in the|on the|within the)\s+(.+?)(?=\s+and\s+|\s*\.|$)/i,
    /(?:from|in|on|within)\s+the\s+(.+?)(?=\s+and\s+|\s*\.|$)/i,
    /(?:in|from)\s+(.+?\s+section)(?=\s+and\s+|\s*\.|$)/i,
    /(?:on|from)\s+(.+?\s+card)(?=\s+and\s+|\s*\.|$)/i,
    /(?:in|from)\s+(.+?\s+form)(?=\s+and\s+|\s*\.|$)/i,
    /(?:in|from)\s+(.+?\s+panel)(?=\s+and\s+|\s*\.|$)/i,
    /(?:in|from)\s+(.+?\s+area)(?=\s+and\s+|\s*\.|$)/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = step.match(patterns[i]);
    if (m && m[1]) {
      var section = m[1].trim();
      if (section.length >= 2) return section;
    }
  }
  return null;
}

function matchesAny(text, keywords) {
  return keywords.some(function(kw) { return text.includes(kw); });
}

function cleanTarget(text) {
  // Use word boundaries (\b) so we only remove whole words, not substrings.
  // Without \b, "on" and "in" inside "Continue" were removed → "C t ue", causing "Element not found".
  var stopWords = 'navigate to|open url|go to|launch|click on|click|press|tap|submit|enter|type|input|fill in|write|select|choose|verify that|verify|validate|check|assert|confirm|ensure|wait for|hover over|hover|scroll down|scroll up|upload|attach|the|on|in|into|button|link|field|box|element|checkbox|dropdown|menu|section|from';
  var out = (text || '')
    .replace(new RegExp('\\b(' + stopWords + ')\\b', 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Remove quote marks around phrases so locator matches visible text (e.g. "Continue" -> Continue)
  out = out.replace(/["']([^"']+)["']/g, '$1').trim();
  return out;
}

function extractUrl(text) {
  var match = (text || '').match(/https?:\/\/[^\s"']+/);
  return match ? match[0] : null;
}

function extractQuoted(text) {
  var match = (text || '').match(/["']([^"']+)["']/);
  return match ? match[1] : null;
}
