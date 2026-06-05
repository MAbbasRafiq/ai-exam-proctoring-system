// =============================================================
// src/components/MonitoringPanel.jsx
// NEW COMPONENT: Displays real-time AI monitoring alerts and
// a list of all violations recorded during the exam session.
//
// This panel appears on the right side of the Exam page.
// =============================================================

// Props:
//   alerts     - list of alert strings shown to the user (e.g. "Phone detected!")
//   violations - list of violation objects from the backend
function MonitoringPanel({ alerts, violations }) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50 h-full">
      <h2 className="text-lg font-bold mb-3">🔍 AI Monitoring</h2>

      {/* --------------------------------------------------------
          Live Alerts Section
          Shows alerts as they happen in real time.
          New alerts are added to the top of the list.
      -------------------------------------------------------- */}
      <div className="mb-4">
        <p className="font-semibold text-sm text-gray-600 mb-2">Live Alerts:</p>

        {alerts.length === 0 ? (
          // No alerts yet — everything is normal
          <p className="text-green-600 text-sm">✅ No violations detected</p>
        ) : (
          // Show each alert in a styled box
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-sm"
              >
                ⚠️ {alert}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Horizontal divider */}
      <hr className="my-3" />

      {/* --------------------------------------------------------
          Violation Log Section
          Shows all violations recorded for this session.
          Data comes from the backend database.
      -------------------------------------------------------- */}
      <div>
        <p className="font-semibold text-sm text-gray-600 mb-2">
          Violation Log ({violations.length} total):
        </p>

        {violations.length === 0 ? (
          <p className="text-gray-400 text-sm">No violations recorded yet.</p>
        ) : (
          // List each violation
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {violations.map((v) => (
              <div
                key={v.id}
                className={`text-sm px-3 py-2 rounded border ${
                  v.severity === "High"
                    ? "bg-red-100 border-red-400 text-red-800"
                    : "bg-orange-100 border-orange-400 text-orange-800"
                }`}
              >
                {/* Violation type */}
                <p className="font-semibold">{v.violation_type}</p>

                {/* Severity badge */}
                <p>Severity: {v.severity}</p>

                {/* Timestamp */}
                <p className="text-xs text-gray-500">{v.timestamp}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MonitoringPanel;
