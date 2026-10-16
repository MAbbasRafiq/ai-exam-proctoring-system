// =============================================================
// Teacher types student 4-digit start code (no camera needed).
// =============================================================

import { useState } from "react";
import { approveStartByCode } from "../api/examApi";

function CodeApprovePanel({ open, onClose, onApproved }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);

  if (!open) return null;

  async function handleApprove(e) {
    e?.preventDefault?.();
    const cleaned = code.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length !== 4) {
      setError("Enter the 4-digit code from the student screen");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await approveStartByCode(cleaned);
      if (!data) return;
      setLastResult(data);
      setCode("");
      onApproved?.(data);
    } catch (err) {
      setError(err.message || "Approve failed");
      setLastResult(null);
    } finally {
      setBusy(false);
    }
  }

  function handleNext() {
    setLastResult(null);
    setError("");
    setCode("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
        <div className="flex justify-between items-start mb-4 gap-2">
          <div>
            <h2 className="text-xl font-bold">Enter student code</h2>
            <p className="text-sm text-gray-600">
              Type the 4-digit code shown on their screen
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm font-semibold px-2 py-1"
          >
            Close
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
            {error}
          </p>
        )}

        {lastResult ? (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-3 text-left">
            <p className="font-bold text-green-800">Approved</p>
            <p className="text-sm mt-1">
              <span className="text-gray-600">Student:</span>{" "}
              <span className="font-semibold">
                {lastResult.student_username || "—"}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-gray-600">Exam:</span>{" "}
              <span className="font-semibold">
                {lastResult.exam_title || "—"}
              </span>
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="mt-3 w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700"
            >
              Approve next student
            </button>
          </div>
        ) : (
          <form onSubmit={handleApprove}>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoFocus
              className="border-2 border-gray-300 p-4 w-full rounded-lg text-center text-4xl font-bold tracking-[0.4em] mb-3"
              placeholder="••••"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || code.length !== 4}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Approving…" : "Approve start"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default CodeApprovePanel;
