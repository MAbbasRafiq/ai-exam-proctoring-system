// =============================================================
// Feature flags (Vite env). Restart `npm run dev` after changes.
// =============================================================

/**
 * Real AI frame analysis (POST /monitoring/analyze + YOLO).
 *
 * false (default for class day): analyze/violation polling is NOT called.
 * All monitoring code remains — set true to turn AI back on.
 */
export const AI_MONITORING_ENABLED =
  String(import.meta.env.VITE_AI_MONITORING_ENABLED ?? "false")
    .toLowerCase()
    .trim() === "true";

/**
 * Webcam preview for deterrence / AI pipeline.
 *
 * false: no getUserMedia, no video element.
 * true: show live camera (still no YOLO unless AI_MONITORING_ENABLED).
 */
export const WEBCAM_ENABLED =
  String(import.meta.env.VITE_WEBCAM_ENABLED ?? "true")
    .toLowerCase()
    .trim() === "true";

/** MCQ-only when false; when true, teacher can add short (manually graded) questions. */
export const SHORT_QUESTIONS_ENABLED =
  String(import.meta.env.VITE_SHORT_QUESTIONS_ENABLED ?? "false")
    .toLowerCase()
    .trim() === "true";

/**
 * When true, first exam start waits for teacher to scan student QR on phone.
 * Backend QR_START_APPROVAL_ENABLED must also be true (enforced on /start).
 */
export const QR_START_APPROVAL_ENABLED =
  String(import.meta.env.VITE_QR_START_APPROVAL_ENABLED ?? "false")
    .toLowerCase()
    .trim() === "true";

/**
 * When true, student shows a 4-digit code; teacher types it in dashboard.
 * Backend CODE_START_APPROVAL_ENABLED must also be true.
 */
export const CODE_START_APPROVAL_ENABLED =
  String(import.meta.env.VITE_CODE_START_APPROVAL_ENABLED ?? "false")
    .toLowerCase()
    .trim() === "true";

/** True if either QR or code approval gates the first start. */
export const START_APPROVAL_REQUIRED =
  QR_START_APPROVAL_ENABLED || CODE_START_APPROVAL_ENABLED;
