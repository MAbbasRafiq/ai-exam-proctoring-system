import { useEffect, useRef, useState } from "react";
import {
  listMyExams,
  createExam,
  updateExam,
  publishExam,
  unpublishExam,
  deleteExam,
  addExamQuestion,
  updateExamQuestion,
  deleteExamQuestion,
  fetchExamResults,
  fetchExamQuestions,
  fetchAttemptGrading,
  saveAttemptGrades,
  resultsCsvUrl,
} from "../api/examApi";
import {
  SHORT_QUESTIONS_ENABLED,
  QR_START_APPROVAL_ENABLED,
  CODE_START_APPROVAL_ENABLED,
} from "../config";
import QrApproveScanner from "../components/QrApproveScanner";
import CodeApprovePanel from "../components/CodeApprovePanel";
import MathSymbolToolbar, {
  insertAtCursor,
} from "../components/MathSymbolToolbar";

function emptyOptions() {
  return [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ];
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TeacherDashboard() {
  const [exams, setExams] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [results, setResults] = useState([]);
  const [questionPreview, setQuestionPreview] = useState([]);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(10);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [qText, setQText] = useState("");
  const [options, setOptions] = useState(emptyOptions());
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [settingsStarts, setSettingsStarts] = useState("");
  const [settingsEnds, setSettingsEnds] = useState("");
  const [settingsDuration, setSettingsDuration] = useState(10);
  const [settingsShuffle, setSettingsShuffle] = useState(true);
  const [settingsMathSymbols, setSettingsMathSymbols] = useState(false);
  const [message, setMessage] = useState("");
  const [questionType, setQuestionType] = useState("mcq");
  const [shortMaxPoints, setShortMaxPoints] = useState("");
  /** "question" | option index — last focused field for symbol insert */
  const [mathInsertTarget, setMathInsertTarget] = useState("question");
  const qTextRef = useRef(null);
  const optionInputRefs = useRef([]);
  const [gradingAttemptId, setGradingAttemptId] = useState(null);
  const [gradingUsername, setGradingUsername] = useState("");
  const [gradingItems, setGradingItems] = useState([]);
  const [gradingSaving, setGradingSaving] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const username = localStorage.getItem("username") || "Teacher";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    if (localStorage.getItem("role") !== "teacher") {
      window.location.href = "/";
      return;
    }
    refreshExams();
  }, []);

  async function refreshExams() {
    const data = await listMyExams();
    setExams(Array.isArray(data) ? data : []);
  }

  async function selectExam(id) {
    setSelectedId(id);
    setMessage("");
    setEditingQuestionId(null);
    setQText("");
    setOptions(emptyOptions());
    setQuestionType("mcq");
    setShortMaxPoints("");
    setMathInsertTarget("question");
    setGradingAttemptId(null);
    setGradingItems([]);
    try {
      const [resData, qData] = await Promise.all([
        fetchExamResults(id),
        fetchExamQuestions(id),
      ]);
      setResults(resData?.results || []);
      setQuestionPreview(qData?.questions || []);
      const exam = qData?.exam || resData?.exam;
      if (exam) {
        setSettingsStarts(toLocalInputValue(exam.starts_at));
        setSettingsEnds(toLocalInputValue(exam.ends_at));
        setSettingsDuration(exam.duration_minutes || 10);
        setSettingsShuffle(exam.shuffle_questions !== false);
        setSettingsMathSymbols(!!exam.allow_math_symbols);
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleCreate() {
    try {
      const exam = await createExam({
        title: title.trim(),
        duration_minutes: Number(duration) || 10,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        shuffle_questions: shuffle,
      });
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setMessage(`Created "${exam.title}" — join code: ${exam.join_code}`);
      await refreshExams();
      selectExam(exam.id);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleSaveSettings() {
    if (!selectedId) return;
    try {
      const payload = {
        duration_minutes: Number(settingsDuration) || 10,
        shuffle_questions: settingsShuffle,
        allow_math_symbols: !!settingsMathSymbols,
      };
      if (!settingsStarts && !settingsEnds) {
        payload.clear_window = true;
      } else {
        payload.starts_at = settingsStarts || null;
        payload.ends_at = settingsEnds || null;
      }
      await updateExam(selectedId, payload);
      setMessage("Exam settings saved");
      await refreshExams();
      selectExam(selectedId);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handlePublish() {
    if (!selectedId) return;
    try {
      const exam = await publishExam(selectedId);
      setMessage(`Published. Students join with code: ${exam.join_code}`);
      await refreshExams();
      selectExam(selectedId);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleUnpublish() {
    if (!selectedId) return;
    try {
      await unpublishExam(selectedId);
      setMessage("Exam unpublished (students cannot join until published again)");
      await refreshExams();
      selectExam(selectedId);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleDeleteExam() {
    const exam = exams.find((e) => e.id === selectedId);
    if (!selectedId || !exam) return;
    const ok = window.confirm(
      `Delete exam "${exam.title}"?\n\nThis will permanently remove all questions, student attempts, and results. This cannot be undone.`
    );
    if (!ok) return;
    try {
      const titleDeleted = exam.title;
      await deleteExam(selectedId);
      setMessage(`Deleted exam "${titleDeleted}"`);
      setSelectedId(null);
      setQuestionPreview([]);
      setResults([]);
      setEditingQuestionId(null);
      setQText("");
      setOptions(emptyOptions());
      await refreshExams();
    } catch (err) {
      setMessage(err.message);
    }
  }

  function setCorrectIndex(idx) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
  }

  function resetQuestionForm() {
    setEditingQuestionId(null);
    setQText("");
    setOptions(emptyOptions());
    setQuestionType("mcq");
    setShortMaxPoints("");
    setMathInsertTarget("question");
  }

  function handleTeacherMathInsert(symbol) {
    if (mathInsertTarget === "question") {
      insertAtCursor(qTextRef.current, qText, symbol, setQText);
      return;
    }
    const idx = Number(mathInsertTarget);
    if (Number.isNaN(idx) || idx < 0) return;
    const el = optionInputRefs.current[idx];
    const current = options[idx]?.text ?? "";
    insertAtCursor(el, current, symbol, (next) => {
      setOptions((prev) =>
        prev.map((o, i) => (i === idx ? { ...o, text: next } : o))
      );
    });
  }

  function beginEdit(q) {
    setEditingQuestionId(q.id);
    setQText(q.question);
    const qtype = q.question_type || "mcq";
    setQuestionType(qtype);
    setShortMaxPoints(
      q.max_points != null && qtype === "short" ? String(q.max_points) : ""
    );
    setMathInsertTarget("question");
    if (qtype === "short") {
      setOptions(emptyOptions());
      return;
    }
    const opts = (q.options || []).map((o) =>
      typeof o === "string"
        ? { text: o, is_correct: false }
        : { text: o.text, is_correct: !!o.is_correct }
    );
    while (opts.length < 4) opts.push({ text: "", is_correct: false });
    if (!opts.some((o) => o.is_correct) && opts.length) opts[0].is_correct = true;
    setOptions(opts.slice(0, 4));
  }

  async function handleSaveQuestion() {
    if (!selectedId) {
      setMessage("Select an exam first");
      return;
    }
    const isShort = SHORT_QUESTIONS_ENABLED && questionType === "short";
    const cleaned = options
      .map((o) => ({ text: o.text.trim(), is_correct: o.is_correct }))
      .filter((o) => o.text);
    const payload = {
      question: qText.trim(),
      question_type: isShort ? "short" : "mcq",
      options: isShort ? [] : cleaned,
    };
    if (isShort && shortMaxPoints.trim() !== "") {
      payload.max_points = Number(shortMaxPoints);
    }
    if (!isShort && cleaned.length < 2) {
      setMessage("MCQ needs at least 2 options");
      return;
    }
    try {
      if (editingQuestionId) {
        await updateExamQuestion(selectedId, editingQuestionId, payload);
        setMessage("Question updated");
      } else {
        await addExamQuestion(selectedId, payload);
        setMessage("Question added");
      }
      resetQuestionForm();
      await refreshExams();
      selectExam(selectedId);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleDeleteQuestion(qid) {
    if (!selectedId) return;
    if (!confirm("Delete this question?")) return;
    try {
      await deleteExamQuestion(selectedId, qid);
      setMessage("Question deleted");
      if (String(editingQuestionId) === String(qid)) {
        resetQuestionForm();
      }
      await refreshExams();
      selectExam(selectedId);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function openGrading(attemptId, uname) {
    if (!selectedId) return;
    try {
      const data = await fetchAttemptGrading(selectedId, attemptId);
      if (!data) return;
      setGradingAttemptId(attemptId);
      setGradingUsername(data.username || uname || "");
      setGradingItems(
        (data.items || []).map((it) => ({
          ...it,
          pointsInput:
            it.points_awarded != null ? String(it.points_awarded) : "",
        }))
      );
      if ((data.items || []).length === 0) {
        setMessage("No short questions in this exam");
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleSaveGrades() {
    if (!selectedId || !gradingAttemptId) return;
    setGradingSaving(true);
    try {
      const grades = gradingItems.map((it) => ({
        question_id: Number(it.question_id),
        points_awarded: Number(it.pointsInput || 0),
      }));
      await saveAttemptGrades(selectedId, gradingAttemptId, grades);
      setMessage(`Grades saved for ${gradingUsername}`);
      setGradingAttemptId(null);
      setGradingItems([]);
      await selectExam(selectedId);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setGradingSaving(false);
    }
  }

  async function downloadCsv() {
    if (!selectedId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(resultsCsvUrl(selectedId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setMessage("CSV download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const examTitle =
        exams.find((e) => e.id === selectedId)?.title || `exam_${selectedId}`;
      const safeTitle = examTitle.replace(/[^\w\-]+/g, "_").slice(0, 40);
      a.download = `${safeTitle}_results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`CSV downloaded: ${a.download}`);
    } catch (err) {
      setMessage("CSV download failed — is the backend running?");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "/login";
  }

  const selected = exams.find((e) => e.id === selectedId);
  const examHasShortQuestions = questionPreview.some(
    (q) => (q.question_type || "mcq") === "short"
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
          <p className="text-sm text-gray-600">Signed in as {username}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {CODE_START_APPROVAL_ENABLED && (
            <button
              type="button"
              onClick={() => setShowCodePanel(true)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-blue-700"
            >
              Enter code
            </button>
          )}
          {QR_START_APPROVAL_ENABLED && (
            <button
              type="button"
              onClick={() => setShowQrScanner(true)}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-semibold hover:bg-green-700"
            >
              Scan QR
            </button>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      {CODE_START_APPROVAL_ENABLED && (
        <CodeApprovePanel
          open={showCodePanel}
          onClose={() => setShowCodePanel(false)}
          onApproved={(data) => {
            setMessage(
              `Approved start: ${data.student_username || "student"} — ${
                data.exam_title || "exam"
              }`
            );
          }}
        />
      )}

      {QR_START_APPROVAL_ENABLED && (
        <QrApproveScanner
          open={showQrScanner}
          onClose={() => setShowQrScanner(false)}
          onApproved={(data) => {
            setMessage(
              `Approved start: ${data.student_username || "student"} — ${
                data.exam_title || "exam"
              }`
            );
          }}
        />
      )}

      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="border rounded-lg p-4">
          <h2 className="font-bold mb-3">Create exam</h2>
          <input
            className="border p-2 w-full rounded mb-2"
            placeholder="Exam title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="text-sm text-gray-600">Duration (minutes)</label>
          <input
            type="number"
            min={1}
            max={180}
            className="border p-2 w-full rounded mb-2"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <label className="text-sm text-gray-600">Window start (optional)</label>
          <input
            type="datetime-local"
            className="border p-2 w-full rounded mb-2"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <label className="text-sm text-gray-600">Window end (optional)</label>
          <input
            type="datetime-local"
            className="border p-2 w-full rounded mb-2"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
            />
            Shuffle questions & options per student
          </label>
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Create
          </button>
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="font-bold mb-3">Your exams</h2>
          {exams.length === 0 && (
            <p className="text-sm text-gray-500">No exams yet.</p>
          )}
          <ul className="space-y-2">
            {exams.map((exam) => (
              <li key={exam.id}>
                <button
                  onClick={() => selectExam(exam.id)}
                  className={`w-full text-left p-3 rounded border ${
                    selectedId === exam.id
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="font-semibold">{exam.title}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Code:{" "}
                    <span className="font-mono font-bold">{exam.join_code}</span>
                    {" · "}
                    {exam.duration_minutes} min · {exam.question_count} Q ·{" "}
                    {exam.is_published ? "Published" : "Draft"}
                    {exam.shuffle_questions ? " · Shuffle" : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {selected && (
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <section className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <h2 className="font-bold">Manage: {selected.title}</h2>
              <div className="flex gap-2 flex-wrap">
                {!selected.is_published ? (
                  <button
                    onClick={handlePublish}
                    className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600"
                  >
                    Publish
                  </button>
                ) : (
                  <button
                    onClick={handleUnpublish}
                    className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-600"
                  >
                    Unpublish
                  </button>
                )}
                <button
                  onClick={downloadCsv}
                  className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800"
                >
                  Export CSV
                </button>
                <button
                  onClick={handleDeleteExam}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700"
                >
                  Delete exam
                </button>
              </div>
            </div>
            <p className="text-sm mb-4">
              Share join code{" "}
              <span className="font-mono text-lg font-bold">
                {selected.join_code}
              </span>
            </p>

            <div className="border rounded p-3 mb-4 bg-gray-50">
              <h3 className="font-semibold mb-2 text-sm">Exam settings</h3>
              <label className="text-xs text-gray-600">Duration (min)</label>
              <input
                type="number"
                className="border p-2 w-full rounded mb-2"
                value={settingsDuration}
                onChange={(e) => setSettingsDuration(e.target.value)}
              />
              <label className="text-xs text-gray-600">Window start</label>
              <input
                type="datetime-local"
                className="border p-2 w-full rounded mb-2"
                value={settingsStarts}
                onChange={(e) => setSettingsStarts(e.target.value)}
              />
              <label className="text-xs text-gray-600">Window end</label>
              <input
                type="datetime-local"
                className="border p-2 w-full rounded mb-2"
                value={settingsEnds}
                onChange={(e) => setSettingsEnds(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={settingsShuffle}
                  onChange={(e) => setSettingsShuffle(e.target.checked)}
                />
                Shuffle per student
              </label>
              <label className="flex items-start gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settingsMathSymbols}
                  onChange={(e) => setSettingsMathSymbols(e.target.checked)}
                />
                <span>
                  Math symbol toolbar
                  <span className="block text-xs text-gray-600">
                    For Discrete Math — shows symbol insert for teachers and students on this exam
                  </span>
                </span>
              </label>
              <button
                onClick={handleSaveSettings}
                className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
              >
                Save settings
              </button>
            </div>

            <h3 className="font-semibold mb-2">
              {editingQuestionId ? "Edit question" : "Add question"}
            </h3>
            {SHORT_QUESTIONS_ENABLED && (
              <div className="flex gap-4 mb-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={questionType === "mcq"}
                    onChange={() => setQuestionType("mcq")}
                  />
                  MCQ (auto grade)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={questionType === "short"}
                    onChange={() => setQuestionType("short")}
                  />
                  Short answer (manual grade)
                </label>
              </div>
            )}
            {settingsMathSymbols && (
              <>
                <MathSymbolToolbar
                  onInsert={handleTeacherMathInsert}
                  className="mb-2"
                />
                <p className="text-[11px] text-gray-500 mb-2">
                  Click a field below, then tap a symbol to insert at the cursor.
                </p>
              </>
            )}
            <textarea
              ref={qTextRef}
              className="border p-2 w-full rounded mb-2"
              rows={2}
              placeholder="Question text"
              value={qText}
              onFocus={() => setMathInsertTarget("question")}
              onChange={(e) => setQText(e.target.value)}
            />
            {SHORT_QUESTIONS_ENABLED && questionType === "short" && (
              <div className="mb-3">
                <label className="text-xs text-gray-600 block mb-1">
                  Max marks (optional — leave blank to set marks only when grading)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="border p-2 w-32 rounded"
                  placeholder="e.g. 5"
                  value={shortMaxPoints}
                  onChange={(e) => setShortMaxPoints(e.target.value)}
                />
              </div>
            )}
            {questionType === "mcq" &&
              options.map((opt, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input
                  type="radio"
                  name="correct"
                  checked={opt.is_correct}
                  onChange={() => setCorrectIndex(idx)}
                  title="Mark as correct"
                />
                <input
                  ref={(el) => {
                    optionInputRefs.current[idx] = el;
                  }}
                  className="border p-2 flex-1 rounded"
                  placeholder={`Option ${idx + 1}`}
                  value={opt.text}
                  onFocus={() => setMathInsertTarget(idx)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOptions((prev) =>
                      prev.map((o, i) => (i === idx ? { ...o, text: val } : o))
                    );
                  }}
                />
              </div>
            ))}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSaveQuestion}
                disabled={!qText.trim()}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {editingQuestionId ? "Update question" : "Add question"}
              </button>
              {editingQuestionId && (
                <button
                  onClick={resetQuestionForm}
                  className="px-3 py-2 border rounded text-sm"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <h3 className="font-semibold mt-2 mb-2">
              Questions ({questionPreview.length})
            </h3>
            <ul className="text-sm space-y-2 max-h-56 overflow-auto">
              {questionPreview.map((q) => (
                <li
                  key={q.id}
                  className="border-b pb-2 flex justify-between gap-2 items-start"
                >
                  <span>
                    <span className="text-xs font-mono mr-2 text-gray-500">
                      {(q.question_type || "mcq").toUpperCase()}
                    </span>
                    {q.question}
                  </span>
                  <span className="flex gap-1 shrink-0">
                    <button
                      onClick={() => beginEdit(q)}
                      className="text-blue-600 text-xs underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-red-600 text-xs underline"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border rounded-lg p-4">
            <div className="flex justify-between items-center gap-2 mb-3 flex-wrap">
              <h2 className="font-bold">
                Results ({results.length} submitted)
              </h2>
              <button
                onClick={downloadCsv}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700"
              >
                Download CSV
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              CSV includes scores + each short-answer text. Use Grade to mark written
              answers.
            </p>

            {gradingAttemptId && gradingItems.length > 0 && (
              <div className="mb-4 border border-blue-300 bg-blue-50 rounded p-4">
                <h3 className="font-bold mb-2">
                  Grade short answers — {gradingUsername}
                </h3>
                <ul className="space-y-4 mb-3 max-h-96 overflow-auto">
                  {gradingItems.map((it, idx) => {
                    const text = (it.answer_text ?? "").trim();
                    const empty = text.length === 0;
                    return (
                      <li
                        key={it.question_id}
                        className="text-sm border rounded bg-white p-3"
                      >
                        <p className="font-medium text-gray-900">
                          Short Q{idx + 1}: {it.question}
                        </p>
                        <p className="text-xs font-semibold text-gray-500 mt-2 mb-1">
                          Student answer
                        </p>
                        <div
                          className={`whitespace-pre-wrap break-words rounded border p-3 min-h-[4rem] ${
                            empty
                              ? "bg-gray-50 text-gray-400 italic border-dashed"
                              : "bg-yellow-50 text-gray-900 border-yellow-200"
                          }`}
                        >
                          {empty ? "(no answer written)" : it.answer_text}
                        </div>
                        {!empty && (
                          <p className="text-xs text-gray-400 mt-1">
                            {text.length} characters
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <label className="text-xs font-medium">Marks</label>
                          <input
                            type="number"
                            min={0}
                            max={it.max_points ?? 100}
                            className="border p-1 w-20 rounded"
                            value={it.pointsInput}
                            onChange={(e) =>
                              setGradingItems((prev) =>
                                prev.map((row) =>
                                  row.question_id === it.question_id
                                    ? { ...row, pointsInput: e.target.value }
                                    : row
                                )
                              )
                            }
                          />
                          {it.max_points != null && (
                            <span className="text-xs text-gray-500">
                              / max {it.max_points}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveGrades}
                    disabled={gradingSaving}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                  >
                    {gradingSaving ? "Saving…" : "Save grades"}
                  </button>
                  <button
                    onClick={() => {
                      setGradingAttemptId(null);
                      setGradingItems([]);
                    }}
                    className="px-3 py-2 border rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {results.length === 0 ? (
              <p className="text-sm text-gray-500">No submissions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1">Student</th>
                    <th>Score</th>
                    <th>MCQ</th>
                    <th>Short</th>
                    <th>Tab logs</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.user_id} className="border-b">
                      <td className="py-1">{r.username}</td>
                      <td>
                        {r.score}/{r.total}
                      </td>
                      <td className="text-xs">
                        {r.mcq_score ?? 0}/{r.mcq_total ?? 0}
                      </td>
                      <td className="text-xs">
                        {r.short_pending ? (
                          <span className="text-orange-600">pending</span>
                        ) : (
                          <>
                            {r.short_score ?? 0}/{r.short_total ?? 0}
                          </>
                        )}
                      </td>
                      <td>{r.integrity_events ?? 0}</td>
                      <td className="text-xs text-gray-600">
                        {r.submitted_at
                          ? new Date(r.submitted_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        {examHasShortQuestions && r.attempt_id && (
                          <button
                            type="button"
                            onClick={() => openGrading(r.attempt_id, r.username)}
                            className="text-blue-600 text-xs underline"
                          >
                            {r.short_pending ? "Grade" : "Regrade"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
