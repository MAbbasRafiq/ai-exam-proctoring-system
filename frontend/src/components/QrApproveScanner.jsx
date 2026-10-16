// =============================================================
// In-dashboard QR scanner for teacher start-approval.
// =============================================================

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { approveStartApproval } from "../api/examApi";

const SCANNER_REGION_ID = "teacher-qr-reader";

/** Extract approval token from full /approve/URL or raw token string. */
export function extractApprovalToken(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "approve");
    if (idx >= 0 && parts[idx + 1]) {
      return decodeURIComponent(parts[idx + 1]);
    }
  } catch {
    // not a URL — maybe raw token
  }
  const m = text.match(/\/approve\/([^/?#]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  // raw token (url-safe base64-ish)
  if (/^[A-Za-z0-9_-]{16,}$/.test(text)) return text;
  return null;
}

function QrApproveScanner({ open, onClose, onApproved }) {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Starting camera…");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const scannerRef = useRef(null);
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setError("");
    setStatus("Starting camera…");
    setLastResult(null);
    handlingRef.current = false;

    const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
    scannerRef.current = scanner;

    async function start() {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            if (cancelled || handlingRef.current) return;
            const token = extractApprovalToken(decoded);
            if (!token) {
              setError("QR not recognized as an exam approval code");
              return;
            }
            handlingRef.current = true;
            await approveToken(token);
          },
          () => {
            // ignore per-frame "not found"
          }
        );
        if (!cancelled) setStatus("Point camera at student QR");
      } catch (err) {
        if (!cancelled) {
          setStatus("Camera unavailable");
          setError(
            err?.message ||
              "Could not open camera. On some phones HTTP LAN blocks camera — paste token below or use phone Lens."
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s?.isScanning) {
        s.stop().catch(() => {});
      }
      try {
        s?.clear();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function approveToken(token) {
    setBusy(true);
    setError("");
    setStatus("Approving…");
    try {
      // Pause scan while approving to avoid double-fire
      const s = scannerRef.current;
      if (s?.isScanning) {
        try {
          await s.pause(true);
        } catch {
          // ignore
        }
      }

      const data = await approveStartApproval(token);
      if (!data) return;
      setLastResult(data);
      setStatus("Approved");
      onApproved?.(data);
    } catch (err) {
      setError(err.message || "Approve failed");
      setStatus("Ready to scan again");
      handlingRef.current = false;
      const s = scannerRef.current;
      if (s?.isScanning) {
        try {
          s.resume();
        } catch {
          // ignore
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleManualApprove() {
    const token = extractApprovalToken(manual);
    if (!token) {
      setError("Enter the approval URL or token from the student screen");
      return;
    }
    handlingRef.current = true;
    await approveToken(token);
  }

  async function handleScanNext() {
    setLastResult(null);
    setError("");
    setManual("");
    setStatus("Point camera at student QR");
    handlingRef.current = false;
    const s = scannerRef.current;
    if (s?.isScanning) {
      try {
        s.resume();
      } catch {
        // ignore
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-3 gap-2">
          <div>
            <h2 className="text-xl font-bold">Scan student QR</h2>
            <p className="text-sm text-gray-600">{status}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm font-semibold px-2 py-1"
          >
            Close
          </button>
        </div>

        <div
          id={SCANNER_REGION_ID}
          className="w-full overflow-hidden rounded-lg bg-black mb-3 min-h-[220px]"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
            {error}
          </p>
        )}

        {lastResult && (
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
              onClick={handleScanNext}
              disabled={busy}
              className="mt-3 w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              Scan next student
            </button>
          </div>
        )}

        <div className="border-t pt-3 mt-1">
          <p className="text-xs text-gray-500 mb-2">
            Camera blocked? Paste approval link or token:
          </p>
          <input
            className="border p-2 w-full rounded text-sm mb-2"
            placeholder="https://…/approve/… or token"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            onClick={handleManualApprove}
            disabled={busy || !manual.trim()}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Approving…" : "Approve from paste"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QrApproveScanner;
