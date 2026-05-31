import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseTranscriptHtml } from "../docs/app/transcript-parser.js";
import { parseGraduateReportHtml } from "../docs/app/graduate-report-parser.js";
import { createSnapshot } from "../docs/app/snapshot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function loadFixture(name) {
  return readFile(path.join(repoRoot, name), "utf8");
}

test("transcript parser extracts student and semester data", async () => {
  const transcriptHtml = await loadFixture("sample_grade.html");
  const transcript = parseTranscriptHtml(transcriptHtml);

  assert.equal(transcript.student.name, "吳尚原");
  assert.equal(transcript.student.currentSemester, "1142");
  assert.equal(transcript.totals.cumulativeCredits, 115);
  assert.equal(transcript.totals.emiCredits, 9);
  assert.ok(transcript.semesters.length >= 5);
  assert.ok(transcript.courses.some((course) => course.courseId === "SC0003"));
  assert.ok(
    transcript.courses.some((course) => course.passStatus === "in_progress" || course.passStatus === "not_entered")
  );
});

test("graduate-report parser extracts major summary and rule IDs", async () => {
  const graduateReportHtml = await loadFixture("sample_graduatereport.html");
  const graduateReport = parseGraduateReportHtml(graduateReportHtml);

  assert.equal(graduateReport.major.currentCredits, 115);
  assert.equal(graduateReport.major.requiredCredits, 132);
  assert.ok(graduateReport.rulesById["18500"]);
  assert.equal(graduateReport.rulesById["18500"].ruleName, "學生學習護照");
  assert.equal(graduateReport.rulesById["18400"].portalPass, true);
  assert.equal(graduateReport.rulesById["19230"].requiredCredits, 39);
});

test("snapshot evaluation produces derived and portal-backed checks", async () => {
  const [transcriptHtml, graduateReportHtml] = await Promise.all([
    loadFixture("sample_grade.html"),
    loadFixture("sample_graduatereport.html")
  ]);
  const snapshot = createSnapshot({
    transcriptHtml,
    graduateReportHtml,
    source: "fixture"
  });

  assert.equal(snapshot.student.name, "吳尚原");
  assert.equal(snapshot.evaluation.overallPass, false);

  const requiredCourses = snapshot.evaluation.derivedChecks.find((check) => check.id === "required-course-set-a");
  const serviceLearning = snapshot.evaluation.derivedChecks.find((check) => check.id === "service-learning");
  const learningPassport = snapshot.evaluation.portalOnlyChecks.find((check) => check.portalRuleId === "18500");

  assert.ok(requiredCourses);
  assert.equal(requiredCourses.pass, false);
  assert.ok(serviceLearning);
  assert.equal(serviceLearning.pass, true);
  assert.ok(learningPassport);
  assert.equal(learningPassport.pass, false);
  assert.ok(Array.isArray(snapshot.evaluation.discrepancies));
});
