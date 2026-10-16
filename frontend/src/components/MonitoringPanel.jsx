// =============================================================
// Monitoring status (illusion / deterrence). Live alerts removed
// for class mode. Real AI code still lives in Exam.jsx + backend.
// =============================================================

function MonitoringPanel() {
  return (
    <div className="border rounded-lg p-4 bg-gray-50 h-full">
      <h2 className="text-lg font-bold mb-3">AI Monitoring</h2>
      <p className="text-sm text-gray-700 mb-2">
        AI monitoring is active for this exam session.
      </p>
      <p className="text-xs text-gray-500">
        Keep your face in view and stay in fullscreen. Leaving the exam may
        end your attempt.
      </p>
      <div className="mt-4 flex items-center gap-2 text-sm text-green-700 font-medium">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        Monitoring running
      </div>
    </div>
  );
}

export default MonitoringPanel;
