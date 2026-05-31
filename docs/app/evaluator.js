import { EE112_CONFIG } from "./ee112-config.js";
import { normalizeCourseCode, uniqueBy } from "./html-utils.js";

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

function evaluateRequiredChoice(indexes) {
  const group = EE112_CONFIG.requiredChoiceGroups[0];
  const completedChoice = group.groups.some((choiceGroup) =>
    choiceGroup.some((courseId) => indexes.completedByCode.has(courseId))
  );
  const optionCourseIds = [...new Set(group.groups.flat())];
  const pendingItems = optionCourseIds
    .map((courseId) => indexes.inProgressByCode.get(courseId))
    .filter(Boolean);
  const pendingChoice = !completedChoice && pendingItems.length > 0;

  return {
    id: "required-choice",
    title: optionCourseIds.length === 1 ? "Configured required-choice course" : "Configured required-choice group",
    source: "Derived",
    portalRuleId: EE112_CONFIG.derivedPortalMappings.requiredChoice,
    pass: completedChoice,
    statusText: buildStatusText(completedChoice),
    currentValue: completedChoice ? "1/1 course" : "0/1 course",
    requiredValue: "1 course",
    details: completedChoice
      ? "Configured required-choice requirement is completed."
      : pendingChoice
        ? "Configured required-choice requirement is in progress."
        : "Configured required-choice requirement is still missing.",
    missingItems: completedChoice || pendingChoice ? [] : optionCourseIds,
    pendingItems: completedChoice
      ? []
      : optionCourseIds
          .map((courseId) => indexes.inProgressByCode.get(courseId))
          .filter(Boolean)
          .map((course) => `${course.courseId}${course.courseName ? ` ${course.courseName}` : ""} (${course.passStatus === "not_entered" ? "未輸入" : "修課中"})`)
  };
}

function evaluateCreditCategories(indexes, config, label) {
  let totalCredits = 0;
  let matchedCategoryCount = 0;
  const categoryDetails = [];

  for (const [categoryKey, category] of Object.entries(config.categories)) {
    const matchedCourses = uniqueBy(
      category.courseIds
        .map((courseId) => indexes.completedByCode.get(courseId))
        .filter(Boolean),
      (course) => course.courseId
    );
    const inProgressCourses = uniqueBy(
      category.courseIds
        .map((courseId) => indexes.inProgressByCode.get(courseId))
        .filter(Boolean),
      (course) => course.courseId
    );
    const categoryCredits = matchedCourses.reduce((sum, course) => sum + course.credits, 0);

    totalCredits += categoryCredits;
    if (categoryCredits > 0) {
      matchedCategoryCount += 1;
    }

    categoryDetails.push({
      key: categoryKey,
      title: category.title,
      credits: categoryCredits,
      matchedCourses,
      inProgressCourses
    });
  }

  const pass = totalCredits >= config.minCredits && matchedCategoryCount >= config.minCategories;
  return {
    id: label,
    title: label === "star-elective" ? "Star elective requirement" : "Cross-group lab requirement",
    source: "Derived",
    portalRuleId: config.portalRuleId,
    pass,
    statusText: buildStatusText(pass),
    currentValue: `${totalCredits} credits / ${matchedCategoryCount} categories`,
    requiredValue: `${config.minCredits} credits / ${config.minCategories} categories`,
    details: `Matched ${matchedCategoryCount} categories with ${totalCredits} credits.`,
    categories: categoryDetails
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
    .map((rule) => ({
      id: `portal-${rule.ruleId}`,
      title: rule.ruleName,
      source: "Graduate Report",
      portalRuleId: rule.ruleId,
      pass: rule.portalPass,
      statusText: buildStatusText(rule.portalPass),
      currentValue: `${rule.currentCredits} credits / ${rule.currentCourses} courses`,
      requiredValue: `${rule.requiredCredits} credits / ${rule.requiredCourses} courses`,
      details: sanitizePortalMemo(rule.memo) || "Portal-only requirement."
    }));
}

export function evaluateEe112(snapshot) {
  const indexes = buildCourseIndexes(snapshot.transcript.courses);
  const projectCap = evaluateProjectCap(indexes);
  const derivedChecks = [
    evaluateGraduationCredits(snapshot.transcript.totals, projectCap),
    evaluateFreshmanEnglish(indexes),
    evaluateServiceLearning(indexes),
    evaluateRequiredCourseSet(indexes),
    evaluateRequiredChoice(indexes),
    evaluateCreditCategories(indexes, EE112_CONFIG.starElective, "star-elective"),
    evaluateCreditCategories(indexes, EE112_CONFIG.labElective, "lab-elective"),
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
    discrepancies
  };
}
