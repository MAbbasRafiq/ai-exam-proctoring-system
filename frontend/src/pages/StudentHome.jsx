import { useEffect, useState } from "react";
import { joinExamByCode } from "../api/examApi";

function StudentHome() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submittedInfo, setSubmittedInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const username = localStorage.getItem("username") || "Student";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    if (localStorage.getItem("role") === "teacher") {
      window.location.href = "/teacher";
    }
  }, []);

  async function handleJoin(e) {
    e.preventDefault();
    setError("");
    setSubmittedInfo(null);
    setLoading(true);
    try {
      const exam = await joinExamByCode(code.trim().toUpperCase());
      if (!exam) return;

      if (exam.attempt_status === "submitted") {
        setSubmittedInfo({
          title: exam.title,
          score: exam.score,
          total: exam.total,
          examId: exam.id,
        });
        return;
      }

      if (exam.window_ok === false) {
        setError(exam.window_message || "Exam is outside the allowed time window.");
        return;
      }

      window.location.href = `/exam/${exam.id}`;
    } catch (err) {
      setError(err.message || "Could not join exam");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    window.location.href = "/login";
  }

  return (
    <div className="p-6 max-w-lg mx-auto mt-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Student Portal</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      <p className="mb-6 text-gray-700">
        Hi <span className="font-semibold">{username}</span>. Enter the join code
        from your teacher to start the quiz.
      </p>

      <form onSubmit={handleJoin} className="border rounded-lg p-6 bg-gray-50">
        <label className="block text-sm font-medium mb-2">Join code</label>
        <input
          className="border p-3 w-full rounded text-center text-2xl tracking-widest uppercase mb-4"
          placeholder="ABC123"
          value={code}
          maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.trim().length < 4}
          className="bg-blue-500 text-white w-full py-3 rounded font-semibold hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Join Exam"}
        </button>
      </form>

      {submittedInfo && (
        <div className="mt-6 border border-green-300 bg-green-50 rounded-lg p-5">
          <h2 className="font-bold text-lg mb-2">Already submitted</h2>
          <p className="text-gray-800 mb-1">{submittedInfo.title}</p>
          <p className="text-2xl font-bold my-3">
            Score: {submittedInfo.score}
            {submittedInfo.total != null ? ` / ${submittedInfo.total}` : ""}
          </p>
          <p className="text-sm text-gray-600 mb-3">
            You only get one attempt. Answers cannot be changed.
          </p>
          <a
            href={`/exam/${submittedInfo.examId}`}
            className="text-blue-600 underline text-sm"
          >
            Open exam page
          </a>
        </div>
      )}
    </div>
  );
}

export default StudentHome;
