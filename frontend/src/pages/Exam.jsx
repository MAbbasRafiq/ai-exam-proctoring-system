// =============================================================
// src/pages/Exam.jsx
// The main exam page. This is the most important page.
//
// It does THREE things:
//   1. Shows exam questions with a countdown timer
//   2. Runs AI monitoring via the webcam (face + phone detection)
//   3. Reports violations to the backend and shows alerts
//
// AI Monitoring works like this:
//   - We access the user's webcam using the browser MediaDevices API
//   - Every 3 seconds, we capture a frame from the video
//   - We send that frame to the backend /monitoring/analyze endpoint
//   - The backend runs YOLOv8 (phone) and OpenCV (face) on it
//   - If a violation is found, we show an alert and log it
// =============================================================

import { useEffect, useRef, useState } from "react";
import { fetchQuestions, submitExam, reportViolation, fetchViolations } from "../api/examApi";
import QuestionCard from "../components/QuestionCard";
import Result from "../components/Result";
import MonitoringPanel from "../components/MonitoringPanel";

function Exam() {
  // -------------------------------------------------------
  // State for exam
  // -------------------------------------------------------
  const [questions, setQuestions] = useState([]);         // all exam questions
  const [answers, setAnswers] = useState({});             // user's selected answers
  const [score, setScore] = useState(null);               // null until submitted
  const [correctAnswers, setCorrectAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);      // prevent double submit
  const [timeLeft, setTimeLeft] = useState(600);          // 10 minutes = 600 seconds

  // -------------------------------------------------------
  // State for AI monitoring
  // -------------------------------------------------------
  const [alerts, setAlerts] = useState([]);               // live alerts shown in panel
  const [violations, setViolations] = useState([]);        // logged violations from DB
  const [cameraError, setCameraError] = useState(null);   // if webcam access fails

  // -------------------------------------------------------
  // Refs (these don't trigger re-renders when changed)
  // -------------------------------------------------------
  const videoRef = useRef(null);    // reference to the <video> element
  const canvasRef = useRef(null);   // hidden canvas used to capture frames
  const streamRef = useRef(null);   // webcam stream, so we can stop it later

  // Generate a session ID once when the component loads
  // This ID links all violations from this exam session together
  const sessionId = useRef(
    "SESSION_" + new Date().toISOString().replace(/[:.]/g, "-")
  );

  // -------------------------------------------------------
  // Check login — redirect to /login if not authenticated
  // -------------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
    }
  }, []);

  // -------------------------------------------------------
  // Fetch exam questions on load
  // -------------------------------------------------------
  useEffect(() => {
    fetchQuestions().then(setQuestions);
  }, []);

  // -------------------------------------------------------
  // Start the webcam when the page loads
  // -------------------------------------------------------
  useEffect(() => {
    startWebcam();

    // Cleanup: stop the webcam when user leaves this page
    return () => {
      stopWebcam();
    };
  }, []);

  // -------------------------------------------------------
  // Countdown timer
  // Decreases by 1 every second. Auto-submits when it hits 0.
  // -------------------------------------------------------
  useEffect(() => {
    // Don't run if exam is done or time is up
    if (submitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(function(prev) {
        return prev - 1;
      });
    }, 1000);

    // Clear the timer when component unmounts or dependencies change
    return () => clearInterval(timer);
  }, [submitted, timeLeft]);

  // Auto-submit when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && !submitted) {
      handleSubmit();
    }
  }, [timeLeft]);

  // -------------------------------------------------------
  // Run AI monitoring check every 3 seconds
  // -------------------------------------------------------
  useEffect(() => {
    // Don't monitor after exam is submitted
    if (submitted) return;

    const monitoringInterval = setInterval(() => {
      runMonitoringCheck();
    }, 3000);  // check every 3 seconds

    return () => clearInterval(monitoringInterval);
  }, [submitted]);

  // -------------------------------------------------------
  // Fetch violations list every 10 seconds (for the panel)
  // -------------------------------------------------------
  useEffect(() => {
    fetchViolations().then(setViolations);  // fetch immediately on load

    const refreshInterval = setInterval(() => {
      fetchViolations().then(setViolations);
    }, 10000);  // refresh every 10 seconds

    return () => clearInterval(refreshInterval);
  }, []);


  // =======================================================
  // FUNCTION: startWebcam
  // Asks the browser for webcam access and shows the stream
  // in the <video> element.
  // =======================================================
  async function startWebcam() {
    try {
      // Ask browser for camera access
      // { video: true } means we only need video (no microphone)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      // Save stream reference so we can stop it later
      streamRef.current = stream;

      // Connect the stream to our <video> element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      // Camera permission denied or no camera found
      setCameraError("Camera access denied. AI monitoring is disabled.");
      console.error("Webcam error:", err);
    }
  }


  // =======================================================
  // FUNCTION: stopWebcam
  // Stops all webcam tracks to release the camera.
  // Called when exam ends or user leaves the page.
  // =======================================================
  function stopWebcam() {
    if (streamRef.current) {
      // Stop every individual track in the stream
      streamRef.current.getTracks().forEach(function(track) {
        track.stop();
      });
    }
  }


  // =======================================================
  // FUNCTION: runMonitoringCheck
  // Captures a frame from the webcam, converts it to a
  // base64 image, and sends it to the backend for analysis.
  // =======================================================
  async function runMonitoringCheck() {
    // Make sure both the video and canvas elements are ready
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match the video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the canvas
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert the canvas image to a base64 JPEG string
    // This lets us send the image as text in a JSON request
    const imageData = canvas.toDataURL("image/jpeg", 0.7);  // 0.7 = 70% quality

    try {
      // Send the image to the backend for AI analysis
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/monitoring/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            session_id: sessionId.current,
            image: imageData  // base64 image string
          })
        }
      );

      const data = await res.json();

      // data.violations is a list like ["Mobile Phone Detected", "Candidate Absent"]
      if (data.violations && data.violations.length > 0) {
        // Add each violation as an alert in the panel
        data.violations.forEach(function(violationType) {
          addAlert(violationType);
        });

        // Refresh the violations list from the database
        fetchViolations().then(setViolations);
      }

    } catch (err) {
      // Don't crash the exam if monitoring fails
      console.error("Monitoring check failed:", err);
    }
  }


  // =======================================================
  // FUNCTION: addAlert
  // Adds a new alert message to the live alerts list.
  // =======================================================
  function addAlert(message) {
    // Add new alert at the beginning (most recent first)
    setAlerts(function(prevAlerts) {
      return [message, ...prevAlerts];
    });
  }


  // =======================================================
  // FUNCTION: handleSelect
  // Called when the user clicks an answer option.
  // Updates the answers state with the selected option.
  // =======================================================
  function handleSelect(questionId, option) {
    setAnswers(function(prev) {
      // Spread existing answers and add/update this question's answer
      return { ...prev, [questionId]: option };
    });
  }


  // =======================================================
  // FUNCTION: handleSubmit
  // Sends the user's answers to the backend for grading.
  // Also stops the webcam monitoring.
  // =======================================================
  async function handleSubmit() {
    // Don't submit twice
    if (submitted) return;

    setSubmitted(true);

    // Stop the webcam since the exam is over
    stopWebcam();

    // Send answers to backend
    const data = await submitExam(answers);
    if (!data) return;

    // Save results to state (triggers Result component to show)
    setScore(data.score);
    setCorrectAnswers(data.correct_answers);

    // Do a final fetch of violations to show complete log
    fetchViolations().then(setViolations);
  }


  // =======================================================
  // FUNCTION: handleLogout
  // Clears the token and redirects to the login page.
  // =======================================================
  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }


  // =======================================================
  // Helper: Format seconds into MM:SS display
  // Example: 125 seconds -> "2:05"
  // =======================================================
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    // padStart(2, "0") makes single digits show as "05" instead of "5"
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }


  // =======================================================
  // RENDER
  // =======================================================
  return (
    <div className="p-4">

      {/* Top bar: Logout button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">📝 Online Exam</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* Main layout: 2 columns */}
      {/* Left column = exam questions (wider), Right column = monitoring panel */}
      <div className="flex gap-6">

        {/* ============================================
            LEFT COLUMN: Webcam + Questions / Result
        ============================================ */}
        <div className="flex-1">

          {/* Webcam video feed (small, at the top) */}
          <div className="mb-4">
            {cameraError ? (
              // Show error message if camera failed
              <p className="text-red-500 text-sm">{cameraError}</p>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-1">📷 Webcam (AI Monitoring Active)</p>
                {/* Video element - shows live webcam feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-48 h-36 border rounded object-cover"
                />
                {/* Hidden canvas used only to capture frames for analysis */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>

          {/* Show exam questions OR result based on submission status */}
          {score === null ? (
            // ---- EXAM IN PROGRESS ----
            <div>
              {/* Timer display — turns red when under 30 seconds */}
              <h2 className={`text-xl font-bold mb-4 ${timeLeft < 30 ? "text-red-600" : ""}`}>
                ⏱ Time Left: {formatTime(timeLeft)}
              </h2>

              {/* List all questions */}
              {questions.map(function(q) {
                return (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    selected={answers[q.id]}   // pass what user selected for this question
                    onSelect={handleSelect}
                    disabled={false}           // questions are clickable during exam
                  />
                );
              })}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                className="mt-4 mb-8 bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600"
              >
                Submit Exam
              </button>
            </div>
          ) : (
            // ---- EXAM SUBMITTED: Show result ----
            <Result
              questions={questions}
              answers={answers}
              correctAnswers={correctAnswers}
              score={score}
            />
          )}
        </div>

        {/* ============================================
            RIGHT COLUMN: AI Monitoring Panel
        ============================================ */}
        <div className="w-72">
          <MonitoringPanel
            alerts={alerts}
            violations={violations}
          />
        </div>

      </div>
    </div>
  );
}

export default Exam;
