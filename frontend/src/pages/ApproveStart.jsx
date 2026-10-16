// =============================================================
// Teacher phone page — opened by scanning student QR.
// =============================================================

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  approveStartApproval,
  fetchStartApprovalDetail,
} from "../api/examApi";

function ApproveStart() {
  const { token } = useParams();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const authToken = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!authToken || role !== "teacher") {
      const next = encodeURIComponent(`/approve/${token}`);
      window.location.href = `/login?next=${next}`;
      return;
    }
    if (!token) {
      setError("Invalid approval link");
      setLoading(false);
      return;
    }

    fetchStartApprovalDetail(token)
      .then((data) => {
        if (!data) return;
        setDetail(data);
        if (data.status === "approved" || data.status === "used") {
          setDone(true);
        }
      })
      .catch((err) => setError(err.message || "Could not load approval"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove() {
    setApproving(true);
    setError("");
    try {
      const data = await approveStartApproval(token);
      if (!data) return;
      setDetail(data);
      setDone(true);
    } catch (err) {
      setError(err.message || "Approve failed");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Approve exam start</h1>
        <p className="text-sm text-gray-500 mb-6">
          Teacher confirmation for this student
        </p>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </p>
        )}

        {detail && (
          <div className="text-left bg-slate-50 border rounded-lg p-4 mb-6 space-y-2">
            <p>
              <span className="text-gray-500 text-sm">Exam</span>
              <br />
              <span className="font-semibold text-lg">{detail.exam_title}</span>
            </p>
            <p>
              <span className="text-gray-500 text-sm">Student</span>
              <br />
              <span className="font-semibold text-lg">
                {detail.student_username}
              </span>
            </p>
            <p className="text-sm">
              Status:{" "}
              <span className="font-semibold uppercase">{detail.status}</span>
            </p>
          </div>
        )}

        {done ? (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
            <p className="text-green-800 font-bold text-lg">Approved</p>
            <p className="text-sm text-green-700 mt-1">
              Student screen will start the exam automatically.
            </p>
          </div>
        ) : (
          detail?.status === "pending" && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50"
            >
              {approving ? "Approving…" : "Approve start"}
            </button>
          )
        )}

        {(detail?.status === "expired" || detail?.status === "used") && !done && (
          <p className="text-amber-700 text-sm">
            This QR is no longer valid. Ask the student to request a new one.
          </p>
        )}

        <a href="/teacher" className="block mt-6 text-blue-600 underline text-sm">
          Teacher dashboard
        </a>
      </div>
    </div>
  );
}

export default ApproveStart;
