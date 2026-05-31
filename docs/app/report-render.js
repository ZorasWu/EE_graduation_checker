function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitInlineList(text) {
  return String(text ?? "")
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCourseStatus(passStatus) {
  switch (passStatus) {
    case "passed":
      return "通過";
    case "failed":
      return "不通過";
    case "in_progress":
      return "修課中";
    case "not_entered":
      return "未輸入";
    default:
      return "未判定";
  }
}

function formatScoreText(course) {
  if (course.passStatus === "not_entered") {
    return "未輸入";
  }

  if (course.passStatus === "in_progress") {
    return "修課中";
  }

  return course.scoreText;
}

function renderDetailList(lines, label = "") {
  if (!lines.length) {
    return "";
  }

  const labelBlock = label ? `<strong>${escapeHtml(label)}</strong>` : "";
  return `
    <div class="meta-row">
      ${labelBlock}
      <div class="detail-list">
        ${lines.map((line) => `<div class="detail-item">${escapeHtml(line)}</div>`).join("")}
      </div>
    </div>
  `;
}

function renderCategoryBreakdown(check) {
  if (!check.categories?.length) {
    return "";
  }

  return `
    <div class="meta-row">
      <strong>Category breakdown</strong>
      <div class="category-accordion">
        ${check.categories
          .map((category, index) => {
            const countedCourses = category.matchedCourses.map(
              (course) =>
                `${course.courseId} ${course.courseName} (${course.credits} credits${course.possibleCategories?.length > 1 ? `，可列入 ${course.possibleCategories.join(" / ")}` : ""})`
            );
            const pendingCourses = category.pendingCourses.map(
              (course) =>
                `${course.courseId} ${course.courseName} (${course.passStatus === "not_entered" ? "未輸入" : "修課中"}${course.possibleCategories?.length > 1 ? `，可列入 ${course.possibleCategories.join(" / ")}` : ""})`
            );
            const detailSections = [
              renderDetailList(countedCourses, "Counted"),
              renderDetailList(pendingCourses, "In progress")
            ]
              .filter(Boolean)
              .join("");
            const emptyState = detailSections ? "" : `<div class="detail-item">No matched courses.</div>`;

            return `
              <div class="category-entry">
                <button type="button" class="category-toggle" data-accordion-button aria-expanded="false" aria-controls="category-panel-${escapeHtml(check.id)}-${index}">
                  <span>${escapeHtml(category.title)}</span>
                  <strong>${escapeHtml(category.credits)} cr</strong>
                </button>
                <div id="category-panel-${escapeHtml(check.id)}-${index}" class="category-panel" data-accordion-panel hidden>
                  ${detailSections || emptyState}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function attachAnimatedAccordions(root) {
  const buttons = root.querySelectorAll("[data-accordion-button]");

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const panel = button.parentElement?.querySelector("[data-accordion-panel]");
      if (!panel) {
        return;
      }

      const isExpanded = button.getAttribute("aria-expanded") === "true";
      const startHeight = `${panel.offsetHeight}px`;

      if (isExpanded) {
        const endHeight = "0px";
        panel.animate([{ height: startHeight, opacity: 1 }, { height: endHeight, opacity: 0 }], {
          duration: 180,
          easing: "ease"
        }).onfinish = () => {
          panel.hidden = true;
          panel.style.height = "";
          panel.style.opacity = "";
        };
        button.setAttribute("aria-expanded", "false");
        return;
      }

      panel.hidden = false;
      const expandedHeight = `${panel.scrollHeight}px`;
      panel.style.height = "0px";
      panel.style.opacity = "0";
      panel.animate([{ height: "0px", opacity: 0 }, { height: expandedHeight, opacity: 1 }], {
        duration: 220,
        easing: "ease"
      }).onfinish = () => {
        panel.style.height = "";
        panel.style.opacity = "";
      };
      button.setAttribute("aria-expanded", "true");
    });
  }
}

function summarizeTranscriptProgress(transcript) {
  return transcript.courses.reduce(
    (summary, course) => {
      if (course.passStatus === "in_progress") {
        summary.inProgress += 1;
      }

      if (course.passStatus === "not_entered") {
        summary.notEntered += 1;
      }

      return summary;
    },
    { inProgress: 0, notEntered: 0 }
  );
}

function formatDiagnosticPayload(payload) {
  if (payload === undefined) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function renderDiagnostics(diagnostics = []) {
  if (!diagnostics.length) {
    return "";
  }

  return `
    <section class="panel">
      <div class="section-head">
        <p class="eyebrow">Diagnostics</p>
        <h2>Bridge trace</h2>
      </div>
      <div class="card-grid">
        ${diagnostics
          .map((entry, index) => {
            const payloadBlock =
              entry.payload !== undefined
                ? `<pre class="diagnostic-payload">${escapeHtml(formatDiagnosticPayload(entry.payload))}</pre>`
                : "";

            return `
              <article class="card">
                <p class="eyebrow">Step ${index + 1}${entry.time ? ` · ${escapeHtml(entry.time)}` : ""}</p>
                <h3>${escapeHtml(entry.step || "event")}</h3>
                <p class="meta-row">${escapeHtml(entry.detail || "")}</p>
                ${payloadBlock}
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderCheckCard(check) {
  const detailLines = Array.isArray(check.detailLines) && check.detailLines.length ? check.detailLines : splitInlineList(check.details);
  const showDetailLines = !check.categories?.length && detailLines.length > 1;
  const missingList = renderDetailList(check.missingItems ?? [], "Missing");
  const pendingList = renderDetailList(check.pendingItems ?? [], "In progress");
  const categoryList = renderCategoryBreakdown(check);
  const detailText = showDetailLines ? "" : check.details || "";
  const extraDetailLines = showDetailLines ? renderDetailList(detailLines) : "";

  return `
    <article class="card ${check.pass ? "card-pass" : "card-fail"}">
      <div class="card-head">
        <div>
          <p class="eyebrow">${escapeHtml(check.source)}</p>
          <h3>${escapeHtml(check.displayTitle || check.title)}</h3>
        </div>
        <span class="status-pill ${check.pass ? "status-pass" : "status-fail"}">${escapeHtml(check.statusText)}</span>
      </div>
      <div class="value-row">
        <div>
          <span class="meta-label">Current</span>
          <strong>${escapeHtml(check.currentValue)}</strong>
        </div>
        <div>
          <span class="meta-label">Required</span>
          <strong>${escapeHtml(check.requiredValue)}</strong>
        </div>
      </div>
      ${detailText ? `<p class="meta-row">${escapeHtml(detailText)}</p>` : ""}
      ${extraDetailLines}
      ${missingList}
      ${pendingList}
      ${categoryList}
    </article>
  `;
}

function renderRequirementGroup(group) {
  return `
    <section class="panel">
      <div class="section-head">
        <p class="eyebrow">Requirements</p>
        <h2>${escapeHtml(group.title)}</h2>
      </div>
      <div class="card-grid">
        ${group.checks.map(renderCheckCard).join("")}
      </div>
    </section>
  `;
}

function renderDiscrepancy(discrepancy) {
  return `
    <article class="discrepancy-card">
      <h3>${escapeHtml(discrepancy.checkTitle)}</h3>
      <p>Custom EE112 result: <strong>${discrepancy.derivedPass ? "Pass" : "Missing"}</strong></p>
      <p>Portal rule ${escapeHtml(discrepancy.portalRuleId)} (${escapeHtml(discrepancy.portalRuleName)}): <strong>${discrepancy.portalPass ? "Pass" : "Missing"}</strong></p>
    </article>
  `;
}

function renderSemesterTable(semester) {
  const rows = semester.courses
    .map(
      (course) => `
        <tr>
          <td>${escapeHtml(course.courseId)}</td>
          <td>${escapeHtml(course.courseName || course.courseNameEn)}</td>
          <td>${escapeHtml(course.courseAttribute)}</td>
          <td>${escapeHtml(course.credits)}</td>
          <td>${escapeHtml(formatScoreText(course))}</td>
          <td>${escapeHtml(formatCourseStatus(course.passStatus))}</td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="semester-block">
      <div class="semester-head">
        <h3>${escapeHtml(semester.label)}</h3>
        <p>${escapeHtml(semester.summary?.earnedCredits ?? 0)} earned / ${escapeHtml(semester.summary?.enrolledCredits ?? 0)} enrolled</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Name</th>
            <th>Attr</th>
            <th>Credits</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

export function renderReport(root, snapshot) {
  const { evaluation, transcript, graduateReport, student } = snapshot;
  const progressSummary = summarizeTranscriptProgress(transcript);
  const requirementSections = evaluation.requirementGroups.map(renderRequirementGroup).join("");
  const discrepancySection = evaluation.discrepancies.length
    ? `
      <section class="panel">
        <div class="section-head">
          <p class="eyebrow">Review</p>
          <h2>Portal discrepancies</h2>
        </div>
        <div class="discrepancy-grid">
          ${evaluation.discrepancies.map(renderDiscrepancy).join("")}
        </div>
      </section>
    `
    : "";

  root.innerHTML = `
    <main class="layout">
      <section class="hero ${evaluation.overallPass ? "hero-pass" : "hero-fail"}">
        <div>
          <p class="eyebrow">NCU EE 112 Graduation Checker</p>
          <h1>${escapeHtml(student.name || "Student")}<span>${escapeHtml(student.department || "EE 112")}</span></h1>
          <p class="hero-copy">A transcript-first graduation report with EE112 custom rules layered on top of the official portal data.</p>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <span>Overall</span>
            <strong>${evaluation.overallPass ? "Ready" : "Not yet"}</strong>
          </div>
          <div class="hero-stat">
            <span>Transcript credits</span>
            <strong>${escapeHtml(transcript.totals.cumulativeCredits)}</strong>
          </div>
          <div class="hero-stat">
            <span>Portal major status</span>
            <strong>${escapeHtml(graduateReport.major.portalStatusText || "Unknown")}</strong>
          </div>
          <div class="hero-stat">
            <span>修課中</span>
            <strong>${escapeHtml(progressSummary.inProgress)}</strong>
          </div>
          <div class="hero-stat">
            <span>未輸入</span>
            <strong>${escapeHtml(progressSummary.notEntered)}</strong>
          </div>
          <div class="hero-stat">
            <span>Current semester</span>
            <strong>${escapeHtml(student.currentSemester || "Unknown")}</strong>
          </div>
        </div>
      </section>

      ${requirementSections}

      ${discrepancySection}

      <section class="panel">
        <div class="section-head">
          <p class="eyebrow">Transcript</p>
          <h2>Semester breakdown</h2>
        </div>
        <div class="semester-stack">
          ${transcript.semesters.map(renderSemesterTable).join("")}
        </div>
      </section>
    </main>
  `;
  attachAnimatedAccordions(root);
}

export function renderMessage(root, title, body, tone = "neutral", diagnostics = []) {
  root.innerHTML = `
    <main class="layout">
      <section class="hero hero-${escapeHtml(tone)}">
        <div>
          <p class="eyebrow">NCU EE 112 Graduation Checker</p>
          <h1>${escapeHtml(title)}</h1>
          <p class="hero-copy">${escapeHtml(body)}</p>
        </div>
      </section>
      ${renderDiagnostics(diagnostics)}
    </main>
  `;
}
