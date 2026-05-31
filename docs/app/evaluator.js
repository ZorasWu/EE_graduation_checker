import { EE112_CONFIG } from "./ee112-config.js";
import { normalizeCourseCode, uniqueBy } from "./html-utils.js";

const REQUIREMENT_GROUP_CONFIG = {
  overall: { title: "整體畢業", order: 10 },
  commonRequired: { title: "共同必修", order: 20 },
  campusRequirements: { title: "服務與校級條件", order: 30 },
  majorRequired: { title: "系訂必修", order: 40 },
  majorElectives: { title: "系訂選修與限制", order: 50 },
  other: { title: "其他條件", order: 90 }
};

const CHECK_PRESENTATION = {
  "graduation-credits": { groupKey: "overall", title: "最低畢業學分", order: 10 },
  "freshman-english": { groupKey: "commonRequired", title: "大一英文", order: 10 },
  "service-learning": { groupKey: "campusRequirements", title: "服務學習", order: 10 },
  "required-course-set-a": { groupKey: "majorRequired", title: "一般系訂必修學分", order: 10 },
  "department-college-elective": { groupKey: "majorElectives", title: "本系或資電學院選修 12 學分", order: 10 },
  "star-elective": { groupKey: "majorElectives", title: "星號選修 18 學分", order: 20 },
  "lab-elective": { groupKey: "majorElectives", title: "跨組實驗 9 學分", order: 30 },
  "project-cap": { groupKey: "majorElectives", title: "專題學分上限", order: 40 }
};

const PORTAL_RULE_PRESENTATION = {
  "11320": { groupKey: "commonRequired", title: "通識課程", order: 30 },
  "11400": { groupKey: "commonRequired", title: "國文", order: 20 },
  "18100": { groupKey: "commonRequired", title: "操行", order: 60 },
  "18200": { groupKey: "commonRequired", title: "體育", order: 40 },
  "18300": { groupKey: "commonRequired", title: "軍訓", order: 50 },
  "18500": { groupKey: "campusRequirements", title: "學生學習護照", order: 20 },
  "19200": { groupKey: "campusRequirements", title: "英語能力檢定", order: 30 },
  "19230": { groupKey: "majorElectives", title: "本系選修與自訂它系課程總學分", order: 50 }
};

function courseSortValue(course) {
  return Number.parseInt(course.semester || "0", 10);
}

function pickBestCourse(existing, candidate) {
  if (!existing) {
    return candidate;
  }

  const existingScore = existing.numericScore ?? -1;
  const candidateScore = candidate.numericScore ?? -1;

  if (candidate.passStatus === "passed" && existing.passStatus !== "passed") {
    return candidate;
  }

  if (candidate.passStatus === existing.passStatus && candidateScore > existingScore) {
    return candidate;
  }

  if (candidate.passStatus === existing.passStatus && courseSortValue(candidate) > courseSortValue(existing)) {
    return candidate;
  }

  return existing;
}

function buildCourseIndexes(courses) {
  const bestByCode = new Map();
  const completedByCode = new Map();
  const inProgressByCode = new Map();

  for (const course of courses) {
    const code = normalizeCourseCode(course.courseId);
    if (!code) {
      continue;
    }

    bestByCode.set(code, pickBestCourse(bestByCode.get(code), course));

    if (course.passStatus === "passed") {
      completedByCode.set(code, pickBestCourse(completedByCode.get(code), course));
    }

    if (course.passStatus === "in_progress" || course.passStatus === "not_entered") {
      inProgressByCode.set(code, pickBestCourse(inProgressByCode.get(code), course));
    }
  }

  return { bestByCode, completedByCode, inProgressByCode };
}

function comparePortalPass(portalRule, derivedPass) {
  if (!portalRule) {
    return null;
  }

  if (portalRule.portalPass === derivedPass) {
    return null;
  }

  return {
    portalRuleId: portalRule.ruleId,
    portalRuleName: portalRule.ruleName,
    portalPass: portalRule.portalPass,
    derivedPass
  };
}

function buildStatusText(pass) {
  return pass ? "Pass" : "Missing";
}

function sanitizePortalMemo(memo) {
  return String(memo ?? "")
    .replace(/※未通過類別:18101,?/g, "")
    .replace(/\(尚未達到畢業基礎門檻,詳細資料請參考:服務櫃台>訊息與活動>活動報名>時數儀表板\)/g, "")
    .trim();
}

function annotateCheck(check) {
  const portalPresentation = check.portalRuleId ? PORTAL_RULE_PRESENTATION[check.portalRuleId] : null;
  const checkPresentation = CHECK_PRESENTATION[check.id] ?? null;
  const presentation = checkPresentation ?? portalPresentation;
  return {
    ...check,
    displayTitle: presentation?.title ?? check.title,
    groupKey: presentation?.groupKey ?? "other",
    displayOrder: presentation?.order ?? 999
  };
}

function buildRequirementGroups(derivedChecks, portalOnlyChecks) {
  const grouped = new Map();
  const checks = [...derivedChecks, ...portalOnlyChecks].map(annotateCheck);

  for (const check of checks) {
    const groupKey = check.groupKey ?? "other";
    const config = REQUIREMENT_GROUP_CONFIG[groupKey] ?? REQUIREMENT_GROUP_CONFIG.other;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        key: groupKey,
        title: config.title,
        order: config.order,
        checks: []
      });
    }

    grouped.get(groupKey).checks.push(check);
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      checks: group.checks.sort((left, right) => {
        if (left.displayOrder !== right.displayOrder) {
          return left.displayOrder - right.displayOrder;
        }

        return left.displayTitle.localeCompare(right.displayTitle, "zh-Hant");
      })
    }))
    .sort((left, right) => left.order - right.order);
}

function formatPortalCourseLabel(course) {
  const status =
    course.passStatus === "not_entered" ? "未輸入" : course.passStatus === "in_progress" ? "修課中" : null;
  const statusSuffix = status ? ` (${status})` : "";
  return `${course.courseId} ${course.courseName}${statusSuffix}`.trim();
}

function classifyPortalCourses(courses) {
  const passed = [];
  const pending = [];

  for (const course of courses) {
    if (course.passStatus === "passed") {
      passed.push(course);
      continue;
    }

    if (course.passStatus === "in_progress" || course.passStatus === "not_entered") {
      pending.push(course);
    }
  }

  return { passed, pending };
}

function buildPortalSections(graduateReport, sectionConfigs) {
  return sectionConfigs.map((config) => {
    const rule = graduateReport.rulesById[config.ruleId];
    const courses = rule?.matchedCourses ?? [];
    const classified = classifyPortalCourses(courses);
    const passedLines = classified.passed.map(formatPortalCourseLabel);
    const pendingLines = classified.pending.map(formatPortalCourseLabel);
    const missingCount = Math.max(0, (rule?.requiredCourses ?? 0) - classified.passed.length - classified.pending.length);
    const missingLines = Array.from({ length: missingCount }, (_, index) => `${config.title}待完成 ${index + 1}`);

    return {
      label: config.title,
      lines: passedLines,
      pendingLines,
      missingLines
    };
  });
}

function formatCourseLabel(courseOrRequirement) {
  return `${courseOrRequirement.courseId} ${courseOrRequirement.title ?? courseOrRequirement.courseName ?? ""}`.trim();
}

function formatPendingCourseLabel(courseOrRequirement, passStatus) {
  const status = passStatus === "not_entered" ? "未輸入" : "修課中";
  return `${formatCourseLabel(courseOrRequirement)} (${status})`;
}

function buildCategoryAssignments(indexes, config) {
  const categoryEntries = Object.entries(config.categories).map(([key, category], index) => ({
    key,
    order: index,
    title: category.title,
    courseIds: new Set(category.courseIds),
    credits: 0,
    matchedCourses: [],
    pendingCourses: []
  }));
  const categoryMap = new Map(categoryEntries.map((entry) => [entry.key, entry]));
  const completedCandidates = uniqueBy(
    categoryEntries
      .flatMap((entry) => [...entry.courseIds].map((courseId) => indexes.completedByCode.get(courseId)).filter(Boolean)),
    (course) => course.courseId
  );
  const pendingCandidates = uniqueBy(
    categoryEntries
      .flatMap((entry) => [...entry.courseIds].map((courseId) => indexes.inProgressByCode.get(courseId)).filter(Boolean)),
    (course) => course.courseId
  );

  function getCandidateCategories(course) {
    return categoryEntries.filter((entry) => entry.courseIds.has(course.courseId));
  }

  for (const course of completedCandidates
    .map((course) => ({ course, categories: getCandidateCategories(course) }))
    .sort((left, right) => left.categories.length - right.categories.length || left.course.courseId.localeCompare(right.course.courseId))) {
    const targetCategory = [...course.categories]
      .sort((left, right) => {
        const leftEmpty = left.matchedCourses.length === 0 ? 0 : 1;
        const rightEmpty = right.matchedCourses.length === 0 ? 0 : 1;
        if (leftEmpty !== rightEmpty) {
          return leftEmpty - rightEmpty;
        }

        if (left.credits !== right.credits) {
          return left.credits - right.credits;
        }

        return left.order - right.order;
      })[0];

    targetCategory.matchedCourses.push({
      ...course.course,
      countedCategory: targetCategory.key,
      countedCategoryTitle: targetCategory.title,
      possibleCategories: course.categories.map((category) => category.title)
    });
    targetCategory.credits += course.course.credits;
  }

  for (const course of pendingCandidates
    .map((course) => ({ course, categories: getCandidateCategories(course) }))
    .sort((left, right) => left.categories.length - right.categories.length || left.course.courseId.localeCompare(right.course.courseId))) {
    const targetCategory = [...course.categories]
      .sort((left, right) => left.pendingCourses.length - right.pendingCourses.length || left.order - right.order)[0];

    targetCategory.pendingCourses.push({
      ...course.course,
      countedCategory: targetCategory.key,
      countedCategoryTitle: targetCategory.title,
      possibleCategories: course.categories.map((category) => category.title)
    });
  }

  return {
    categories: categoryEntries.map((entry) => ({
      key: entry.key,
      title: entry.title,
      credits: entry.credits,
      matchedCourses: entry.matchedCourses,
      pendingCourses: entry.pendingCourses
    })),
    countedCourseIds: new Set(completedCandidates.map((course) => course.courseId)),
    totalCredits: completedCandidates.reduce((sum, course) => sum + course.credits, 0),
    matchedCategoryCount: categoryEntries.filter((entry) => entry.credits > 0).length
  };
}

function evaluateRequiredCourseSet(indexes) {
  const missing = [];
  const pending = [];
  const matchedCourses = [];

  for (const requirement of EE112_CONFIG.requiredCourseSetA) {
    const course = indexes.completedByCode.get(requirement.courseId);
    if (!course) {
      const pendingCourse = indexes.inProgressByCode.get(requirement.courseId);
      if (pendingCourse) {
        pending.push({
          requirement,
          course: pendingCourse
        });
        continue;
      }

      missing.push(requirement);
      continue;
    }

    matchedCourses.push(course);
  }

  return {
    id: "required-course-set-a",
    title: "Core required courses",
    source: "Derived",
    portalRuleId: EE112_CONFIG.derivedPortalMappings.requiredCourseSetA,
    pass: missing.length === 0 && pending.length === 0,
    statusText: buildStatusText(missing.length === 0 && pending.length === 0),
    currentValue: `${matchedCourses.length}/${EE112_CONFIG.requiredCourseSetA.length} courses`,
    requiredValue: "23 courses / 55 credits",
    details:
      missing.length || pending.length
        ? `${missing.length} missing, ${pending.length} in progress.`
        : "All EE112 core required courses are completed.",
    missingItems: missing.map((item) => `${item.courseId} ${item.title}`),
    pendingItems: pending.map(({ requirement, course }) => `${requirement.courseId} ${requirement.title} (${course.passStatus === "not_entered" ? "未輸入" : "修課中"})`)
  };
}

function evaluateCreditCategories(indexes, config, label) {
  const assignment = buildCategoryAssignments(indexes, config);
  const pass = assignment.totalCredits >= config.minCredits && assignment.matchedCategoryCount >= config.minCategories;
  return {
    id: label,
    title: label === "star-elective" ? "Star elective requirement" : "Cross-group lab requirement",
    source: "Derived",
    portalRuleId: config.portalRuleId,
    pass,
    statusText: buildStatusText(pass),
    currentValue: `${assignment.totalCredits} credits / ${assignment.matchedCategoryCount} categories`,
    requiredValue: `${config.minCredits} credits / ${config.minCategories} categories`,
    details: `Matched ${assignment.matchedCategoryCount} categories with ${assignment.totalCredits} credits.`,
    categories: assignment.categories,
    countedCourseIds: [...assignment.countedCourseIds]
  };
}

function evaluateDepartmentCollegeElective(indexes, excludedCourseIds) {
  const allowedPrefixes = EE112_CONFIG.departmentCollegeElective.allowedPrefixes;
  const matchesAllowedCode = (courseId) => allowedPrefixes.some((prefix) => new RegExp(`^${prefix}\\d{4}$`).test(courseId));
  const isEligibleElective = (course) =>
    Boolean(course) &&
    matchesAllowedCode(course.courseId) &&
    course.courseAttribute === "選修" &&
    !excludedCourseIds.has(course.courseId);
  const completedCourses = [...indexes.completedByCode.values()].filter(isEligibleElective);
  const pendingCourses = [...indexes.inProgressByCode.values()].filter(isEligibleElective);
  const totalCredits = completedCourses.reduce((sum, course) => sum + course.credits, 0);
  const pass = totalCredits >= EE112_CONFIG.departmentCollegeElective.minCredits;

  return {
    id: "department-college-elective",
    title: "本系或資電學院選修 12 學分",
    source: "Derived",
    pass,
    statusText: buildStatusText(pass),
    currentValue: `${totalCredits} credits`,
    requiredValue: `${EE112_CONFIG.departmentCollegeElective.minCredits} credits`,
    details: EE112_CONFIG.departmentCollegeElective.description,
    detailLines: completedCourses.map(formatCourseLabel),
    pendingItems: pendingCourses.map((course) => formatPendingCourseLabel(course, course.passStatus))
  };
}

function evaluateProjectCap(indexes) {
  const completedCourses = EE112_CONFIG.projectCapCourseIds
    .map((courseId) => indexes.completedByCode.get(courseId))
    .filter(Boolean);
  const totalCredits = completedCourses.reduce((sum, course) => sum + course.credits, 0);
  const pass = totalCredits <= EE112_CONFIG.projectCapCredits;

  return {
    id: "project-cap",
    title: "Capstone credit cap",
    source: "Derived",
    portalRuleId: EE112_CONFIG.derivedPortalMappings.projectCap,
    pass,
    statusText: pass ? "Within cap" : "Over cap",
    totalCredits,
    currentValue: `${totalCredits} credits`,
    requiredValue: `Max ${EE112_CONFIG.projectCapCredits} credits`,
    details: `Courses counted: ${completedCourses.map((course) => course.courseId).join(", ") || "none"}`
  };
}

function evaluateFreshmanEnglish(indexes) {
  const matchedCourses = EE112_CONFIG.freshmanEnglishCourseIds
    .map((courseId) => indexes.completedByCode.get(courseId))
    .filter(Boolean);
  const totalCredits = matchedCourses.reduce((sum, course) => sum + course.credits, 0);
  const pass = totalCredits >= EE112_CONFIG.freshmanEnglishCredits;

  return {
    id: "freshman-english",
    title: "Freshman English",
    source: "Derived",
    portalRuleId: EE112_CONFIG.derivedPortalMappings.freshmanEnglish,
    pass,
    statusText: buildStatusText(pass),
    currentValue: `${totalCredits} credits`,
    requiredValue: `${EE112_CONFIG.freshmanEnglishCredits} credits`,
    details: matchedCourses.length ? "Completed freshman-English courses." : "No qualifying freshman-English courses found.",
    detailLines: matchedCourses.map((course) => `${course.courseId} ${course.courseName}`)
  };
}

function evaluateServiceLearning(indexes) {
  const matchedCourses = EE112_CONFIG.serviceLearningCourseIds
    .map((courseId) => indexes.completedByCode.get(courseId))
    .filter(Boolean);
  const pass = matchedCourses.length >= EE112_CONFIG.serviceLearningCourseIds.length;

  return {
    id: "service-learning",
    title: "Service-learning",
    source: "Derived",
    portalRuleId: EE112_CONFIG.derivedPortalMappings.serviceLearning,
    pass,
    statusText: buildStatusText(pass),
    currentValue: `${matchedCourses.length} courses`,
    requiredValue: "2 courses",
    details: matchedCourses.length ? "Completed service-learning courses." : "No qualifying service-learning courses found.",
    detailLines: matchedCourses.map((course) => `${course.courseId} ${course.courseName}`)
  };
}

function evaluateGraduationCredits(transcriptTotals, projectCap) {
  const overCap = Math.max(0, projectCap.totalCredits - EE112_CONFIG.projectCapCredits);
  const adjustedCredits = transcriptTotals.cumulativeCredits - overCap;
  const pass = adjustedCredits >= EE112_CONFIG.graduationCredits;

  return {
    id: "graduation-credits",
    title: "Graduation credits",
    source: "Derived",
    pass,
    statusText: buildStatusText(pass),
    currentValue: `${adjustedCredits} credits`,
    requiredValue: `${EE112_CONFIG.graduationCredits} credits`,
    details: overCap > 0 ? `Adjusted by ${overCap} capstone credits above the 6-credit cap.` : "Uses transcript cumulative credits."
  };
}

function buildPortalOnlyChecks(graduateReport) {
  return EE112_CONFIG.portalOnlyRuleIds
    .map((ruleId) => graduateReport.rulesById[ruleId])
    .filter(Boolean)
    .map((rule) => {
      const baseCheck = {
        id: `portal-${rule.ruleId}`,
        title: rule.ruleName,
        source: "Graduate Report",
        portalRuleId: rule.ruleId,
        pass: rule.portalPass,
        statusText: buildStatusText(rule.portalPass),
        currentValue: `${rule.currentCredits} credits / ${rule.currentCourses} courses`,
        requiredValue: `${rule.requiredCredits} credits / ${rule.requiredCourses} courses`,
        details: sanitizePortalMemo(rule.memo) || "Portal-only requirement."
      };

      if (rule.ruleId === "11400") {
        return {
          ...baseCheck,
          details: "需通過 2 門大一國文。",
          detailSections: buildPortalSections(graduateReport, [{ ruleId: "11401", title: "國文課程" }])
        };
      }

      if (rule.ruleId === "18200") {
        return {
          ...baseCheck,
          details: "需通過 2 門大一體育與 3 門興趣體育。",
          detailSections: buildPortalSections(graduateReport, [
            { ruleId: "18201", title: "大一體育" },
            { ruleId: "18202", title: "興趣體育" }
          ])
        };
      }

      return baseCheck;
    });
}

export function evaluateEe112(snapshot) {
  const indexes = buildCourseIndexes(snapshot.transcript.courses);
  const starElective = evaluateCreditCategories(indexes, EE112_CONFIG.starElective, "star-elective");
  const labElective = evaluateCreditCategories(indexes, EE112_CONFIG.labElective, "lab-elective");
  const excludedDepartmentElectiveCourseIds = new Set([
    ...starElective.countedCourseIds,
    ...labElective.countedCourseIds
  ]);
  const departmentCollegeElective = evaluateDepartmentCollegeElective(indexes, excludedDepartmentElectiveCourseIds);
  const projectCap = evaluateProjectCap(indexes);
  const derivedChecks = [
    evaluateGraduationCredits(snapshot.transcript.totals, projectCap),
    evaluateFreshmanEnglish(indexes),
    evaluateServiceLearning(indexes),
    evaluateRequiredCourseSet(indexes),
    departmentCollegeElective,
    starElective,
    labElective,
    projectCap
  ];
  const portalOnlyChecks = buildPortalOnlyChecks(snapshot.graduateReport);
  const discrepancies = derivedChecks
    .map((check) => {
      const portalRule = check.portalRuleId ? snapshot.graduateReport.rulesById[check.portalRuleId] : null;
      const mismatch = comparePortalPass(portalRule, check.pass);
      if (!mismatch) {
        return null;
      }

      return {
        checkTitle: check.title,
        ...mismatch
      };
    })
    .filter(Boolean);
  const overallPass = [...derivedChecks, ...portalOnlyChecks].every((check) => check.pass);

  return {
    overallPass,
    derivedChecks,
    portalOnlyChecks,
    requirementGroups: buildRequirementGroups(derivedChecks, portalOnlyChecks),
    discrepancies
  };
}
