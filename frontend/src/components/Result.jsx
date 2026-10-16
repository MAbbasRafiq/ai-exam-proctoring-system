// =============================================================
// Score-only result (no correct-answer review for students).
// =============================================================

function Result({
  score,
  total,
  mcqScore,
  mcqTotal,
  shortScore,
  shortTotal,
  shortPending,
}) {
  const showSplit =
    mcqTotal != null &&
    mcqTotal > 0 &&
    (shortTotal > 0 || shortPending || (shortScore != null && shortScore > 0));

  return (
    <div className="mt-6 border border-green-300 bg-green-50 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-2">Exam submitted</h2>
      <p className="text-3xl font-semibold">
        Your Score: {score ?? 0} / {total ?? 0}
      </p>
      {showSplit && (
        <div className="mt-3 text-sm text-gray-700 space-y-1">
          <p>
            MCQ: {mcqScore ?? 0} / {mcqTotal}
          </p>
          {shortPending ? (
            <p>
              Written questions: {shortScore ?? 0} / {shortTotal || "—"} —{" "}
              <span className="font-medium">teacher marking pending</span>
            </p>
          ) : (
            <p>
              Written questions: {shortScore ?? 0} / {shortTotal ?? 0}
            </p>
          )}
        </div>
      )}
      {shortPending && !showSplit && (
        <p className="text-sm text-gray-600 mt-2">
          Written answers will be marked by your teacher.
        </p>
      )}
      <p className="text-sm text-gray-600 mt-3">One attempt only</p>
    </div>
  );
}

export default Result;
