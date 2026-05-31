import { parseGraduateReportHtml } from "./graduate-report-parser.js";
import { parseTranscriptHtml } from "./transcript-parser.js";
import { evaluateEe112 } from "./evaluator.js";

export function createSnapshot({ transcriptHtml, graduateReportHtml, source = "live" }) {
  const transcript = parseTranscriptHtml(transcriptHtml);
  const graduateReport = parseGraduateReportHtml(graduateReportHtml);
  const snapshot = {
    version: "ee112-v1",
    source,
    generatedAt: new Date().toISOString(),
    student: {
      name: transcript.student.name,
      currentSemester: transcript.student.currentSemester,
      program: transcript.student.program,
      department: graduateReport.major.department
    },
    transcript,
    graduateReport
  };

  snapshot.evaluation = evaluateEe112(snapshot);
  return snapshot;
}
