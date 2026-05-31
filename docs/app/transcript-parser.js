import {
  collapseWhitespace,
  extractTableCells,
  normalizeCourseCode,
  parseNumberLike
} from "./html-utils.js";

function extractReadonlyValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<div class="fmlabel">${escaped}<\\/div>[\\s\\S]*?<span class="fmreadonly form-control">([\\s\\S]*?)<\\/span>`,
    "i"
  );
  const match = html.match(pattern);
  return match ? collapseWhitespace(match[1]) : "";
}

function extractStudentName(html) {
  const match = html.match(/bi-person-fill[^>]*><\/i>([^<]+)/i);
  return match ? match[1].trim() : "";
}

function extractCurrentSemester(html) {
  const match = html.match(/學期&nbsp;([0-9]{4})/i);
  return match ? match[1] : "";
}

function parseSemesterCode(label) {
  const match = label.match(/第([0-9]+)學年度第([0-9]+)學期/);
  return match ? `${match[1]}${match[2]}` : "";
}

function parseScoreStatus(scoreText) {
  const numericScore = parseNumberLike(scoreText);

  if (numericScore !== null) {
    return {
      numericScore,
      passStatus: numericScore >= 60 ? "passed" : "failed"
    };
  }

  if (/通過|pass/i.test(scoreText)) {
    return {
      numericScore: null,
      passStatus: "passed"
    };
  }

  if (/未到|not entered|修課中|in progress/i.test(scoreText)) {
    return {
      numericScore: null,
      passStatus: "in_progress"
    };
  }

  if (/不通過|failed/i.test(scoreText)) {
    return {
      numericScore: null,
      passStatus: "failed"
    };
  }

  return {
    numericScore: null,
    passStatus: "unknown"
  };
}

function parseSemesterSummary(tableHtml) {
  const summaryMatch = tableHtml.match(
    /操行成績：([^、<]+)、學期平均：([^、<]+)、修習學分數：([^、<]+)、學期實得學分\(不含暑修、抵免\)：([^、<]+)、EMI實得學分：([^<]+)/i
  );

  if (!summaryMatch) {
    return null;
  }

  return {
    conductScore: parseNumberLike(summaryMatch[1]),
    semesterAverage: parseNumberLike(summaryMatch[2]),
    enrolledCredits: parseNumberLike(summaryMatch[3]) ?? 0,
    earnedCredits: parseNumberLike(summaryMatch[4]) ?? 0,
    emiEarnedCredits: parseNumberLike(summaryMatch[5]) ?? 0
  };
}

function parseCourseRow(rowHtml, semesterCode, semesterLabel, rowIndex) {
  const cells = extractTableCells(rowHtml);

  if (cells.length < 8) {
    return null;
  }

  const courseId = normalizeCourseCode(collapseWhitespace(cells[0]));
  if (!courseId) {
    return null;
  }

  const courseNameRaw = collapseWhitespace(cells[2]);
  const [courseName, courseNameEn = ""] = courseNameRaw
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  const credits = parseNumberLike(collapseWhitespace(cells[5])) ?? 0;
  const scoreText = collapseWhitespace(cells[6]);
  const memo = collapseWhitespace(cells[7]);
  const { numericScore, passStatus } = parseScoreStatus(scoreText);

  return {
    id: `${semesterCode}:${courseId}:${rowIndex}`,
    semester: semesterCode,
    semesterLabel,
    courseId,
    className: collapseWhitespace(cells[1]),
    courseName: courseName ?? "",
    courseNameEn,
    courseAttribute: collapseWhitespace(cells[3]),
    programAttribute: collapseWhitespace(cells[4]),
    credits,
    scoreText,
    numericScore,
    passStatus,
    countedCredits: passStatus === "passed" ? credits : 0,
    memo
  };
}

export function parseTranscriptHtml(html) {
  const transcriptSection = html.split("學期成績")[1] ?? html;
  const tables = [...transcriptSection.matchAll(/<table>([\s\S]*?)<\/table>/gi)];
  const semesters = [];
  const courses = [];

  for (const tableMatch of tables) {
    const tableHtml = tableMatch[1];
    const titleMatch = tableHtml.match(/<th colspan="9">[\s\S]*?(第[^<]+)<\/th>/i);

    if (!titleMatch) {
      continue;
    }

    const semesterLabel = collapseWhitespace(titleMatch[1]);
    const semesterCode = parseSemesterCode(semesterLabel);
    const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const semesterCourses = [];

    for (let index = 2; index < rows.length; index += 1) {
      const rowHtml = rows[index][1];

      if (/colspan="9"/i.test(rowHtml)) {
        continue;
      }

      const course = parseCourseRow(rowHtml, semesterCode, semesterLabel, semesterCourses.length);
      if (!course) {
        continue;
      }

      semesterCourses.push(course);
      courses.push(course);
    }

    semesters.push({
      semester: semesterCode,
      label: semesterLabel,
      summary: parseSemesterSummary(tableHtml),
      courses: semesterCourses
    });
  }

  return {
    student: {
      name: extractStudentName(html),
      currentSemester: extractCurrentSemester(html),
      program: extractReadonlyValue(html, "學制")
    },
    totals: {
      cumulativeCredits: parseNumberLike(extractReadonlyValue(html, "累計學分")) ?? 0,
      cumulativeAverage: parseNumberLike(extractReadonlyValue(html, "學業平均成績")),
      emiCredits: parseNumberLike(extractReadonlyValue(html, "EMI課程學分")) ?? 0
    },
    semesters,
    courses
  };
}
