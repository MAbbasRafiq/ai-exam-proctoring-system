import { useState } from "react";
import { loginRequest } from "../api/examApi";

function safeNextPath(raw) {
  if (!raw || typeof raw !== "string") return null;
  // Only same-origin relative paths (blocks open redirects)
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      alert("Please enter username and password");
      return;
    }
    setLoading(true);
    try {
      const { ok, data } = await loginRequest(u, p);
      if (ok && data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role || "student");
        localStorage.setItem("username", data.username || u);
        const params = new URLSearchParams(window.location.search);
        const next = safeNextPath(params.get("next"));
        if (next && data.role === "teacher") {
          window.location.href = next;
        } else {
          window.location.href = data.role === "teacher" ? "/teacher" : "/";
        }
      } else {
        alert(data.detail || "Invalid username or password");
      }
    } catch (err) {
      console.error(err);
      alert("Login failed. Is the backend running? Check VITE_API_URL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-10 max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6">Login to Exam</h1>

      <input
        className="border p-2 block mb-3 w-full rounded"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        className="border p-2 block mb-4 w-full rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      <p className="mt-4 text-sm text-center">
        Don't have an account?{" "}
        <a href="/register" className="text-blue-600 underline">
          Register here
        </a>
      </p>
    </div>
  );
}

export default Login;
