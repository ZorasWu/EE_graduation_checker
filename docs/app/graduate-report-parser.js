import {
  collapseWhitespace,
  decodeHtmlEntities,
  normalizeCourseCode,
  parseNumberLike
} from "./html-utils.js";

function parsePortalQualified(qualified, scoreText) {
  if (String(qualified) === "1") {
    return "passed";
  }

  if (/未到|not entered/i.test(scoreText)) {
    return "not_entered";
  }

  if (String(qualified) === "2") {
    return "in_progress";
  }

  if (String(qualified) === "0") {
    return "failed";
  }

  return "unknown";
}

function normalizePortalCourse(course) {
  const scoreText = collapseWhitespace(course.score ?? "");

  return {
    semester: String(course.semester ?? ""),
    courseId: normalizeCourseCode(course.c_id),
    courseName: collapseWhitespace(course?.crs_name?.tw ?? ""),
    courseNameEn: collapseWhitespace(course?.crs_name?.en ?? ""),
    credits: parseNumberLike(course.c_cred) ?? 0,
    listedCredits: parseNumberLike(course.l_cred) ?? 0,
    scoreText,
    passStatus: parsePortalQualified(course.qualified, scoreText),
    memo: collapseWhitespace(course?.memo?.tw ?? ""),
    replacement: course.replace ?? null
  };
}

function parseEmbedded(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value) || typeof value === "object") {
    return value;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  return trimmed;
}

function buildRuleNode(ruleId, rawRule, parentId = null) {
  const embedded = parseEmbedded(rawRule.course);
  const directChildren = Object.entries(rawRule).filter(([key, value]) => /^\d+$/.test(key) && value);
  const embeddedChildren =
    embedded && !Array.isArray(embedded) && typeof embedded === "object"
      ? Object.entries(embedded).filter(([key, value]) => /^\d+$/.test(key) && value)
      : [];
  const matchedCourses = Array.isArray(embedded) ? embedded.map(normalizePortalCourse) : [];
  const childRules = [...directChildren, ...embeddedChildren].map(([childRuleId, childRawRule]) =>
    buildRuleNode(childRuleId, childRawRule, ruleId)
  );

  return {
    ruleId,
    parentRuleId: parentId,
    ruleName: collapseWhitespace(rawRule.ruleName ?? ""),
    portalPass: String(rawRule.isPass) === "T",
    currentCredits: parseNumberLike(rawRule.creditCred) ?? 0,
    currentCourses: parseNumberLike(rawRule.creditCourse) ?? 0,
    requiredCredits: parseNumberLike(rawRule.lowCredits) ?? 0,
    requiredCourses: parseNumberLike(rawRule.lowCourses) ?? 0,
    memo: collapseWhitespace(rawRule.memo ?? ""),
    matchedCourses,
    children: childRules
  };
}

function flattenRuleTree(rule, bucket) {
  bucket[rule.ruleId] = rule;
  for (const child of rule.children) {
    flattenRuleTree(child, bucket);
  }
}

function extractMajorSummary(html) {
  const departmentMatch = html.match(/<p class="department">([^<]+)<\/p>/i);
  const currentCreditsMatch = html.match(/<p class="credit">[\s\S]*?<span>([0-9]+)<\/span>學分,[\s\S]*?<span>([0-9]+)<\/span>門課/i);
  const requiredCreditsMatch = html.match(/<p class="total-credits">應修([0-9]+)學分<\/p>/i);
  const statusMatch = html.match(/<p class="graduation-threshold[^"]*">([^<]+)<\/p>/i);

  return {
    department: departmentMatch ? collapseWhitespace(departmentMatch[1]) : "",
    currentCredits: currentCreditsMatch ? Number.parseInt(currentCreditsMatch[1], 10) : 0,
    currentCourses: currentCreditsMatch ? Number.parseInt(currentCreditsMatch[2], 10) : 0,
    requiredCredits: requiredCreditsMatch ? Number.parseInt(requiredCreditsMatch[1], 10) : 0,
    portalStatusText: statusMatch ? collapseWhitespace(statusMatch[1]) : "",
    portalPass: statusMatch ? /通過/.test(statusMatch[1]) : false
  };
}

export function parseGraduateReportHtml(html) {
  const blocks = [];
  const rulesById = {};
  const blockMatches = [
    ...html.matchAll(/class="text-block"\s+data-credits="([\s\S]*?)">\s*<div class="text-above-bar"/gi)
  ];

  for (const [index, match] of blockMatches.entries()) {
    const decoded = decodeHtmlEntities(match[1].replaceAll("&qquot;", "&quot;"));
    const payload = JSON.parse(decoded);
    const block = {
      id: `block-${index + 1}`,
      ruleName: collapseWhitespace(payload.ruleName ?? ""),
      portalPass: String(payload.isPass) === "T",
      currentCredits: parseNumberLike(payload.creditCred) ?? 0,
      currentCourses: parseNumberLike(payload.creditCourse) ?? 0,
      requiredCredits: parseNumberLike(payload.lowCredits) ?? 0,
      requiredCourses: parseNumberLike(payload.lowCourses) ?? 0,
      percentage: parseNumberLike(payload.percentage) ?? 0,
      memo: collapseWhitespace(payload.memo ?? ""),
      rules: []
    };

    const embedded = parseEmbedded(payload.course);
    if (embedded && !Array.isArray(embedded) && typeof embedded === "object") {
      for (const [ruleId, rawRule] of Object.entries(embedded)) {
        if (!/^\d+$/.test(ruleId)) {
          continue;
        }

        const rule = buildRuleNode(ruleId, rawRule);
        block.rules.push(rule);
        flattenRuleTree(rule, rulesById);
      }
    }

    blocks.push(block);
  }

  return {
    major: extractMajorSummary(html),
    blocks,
    rulesById
  };
}
