function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const missingList =
    check.missingItems && check.missingItems.length
      ? `<p class="meta-row"><strong>Missing:</strong> ${escapeHtml(check.missingItems.join(", "))}</p>`
      : "";
  const categoryList =
    check.categories && check.categories.length
      ? `<div class="category-grid">${check.categories
          .map(
            (category) => `
              <div class="category-chip">
                <span>${escapeHtml(category.title)}</span>
                <strong>${escapeHtml(category.credits)} cr</strong>
              </div>
            `
          )
          .join("")}</div>`
      : "";

  return `
    <article class="card ${check.pass ? "card-pass" : "card-fail"}">
      <div class="card-head">
        <div>
          <p class="eyebrow">${escapeHtml(check.source)}</p>
          <h3>${escapeHtml(check.title)}</h3>
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
      <p class="meta-row">${escapeHtml(check.details || "")}</p>
      ${missingList}
      ${categoryList}
    </article>
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
          <td>${escapeHtml(course.scoreText)}</td>
          <td>${escapeHtml(course.passStatus)}</td>
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
            <span>Current semester</span>
            <strong>${escapeHtml(student.currentSemester || "Unknown")}</strong>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <p class="eyebrow">Custom checks</p>
          <h2>EE112 derived rules</h2>
        </div>
        <div class="card-grid">
          ${evaluation.derivedChecks.map(renderCheckCard).join("")}
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <p class="eyebrow">Portal-backed</p>
          <h2>Requirements still sourced from Graduate Report</h2>
        </div>
        <div class="card-grid">
          ${evaluation.portalOnlyChecks.map(renderCheckCard).join("")}
        </div>
      </section>

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
