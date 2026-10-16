import { useState } from "react";
import { registerRequest, loginRequest } from "../api/examApi";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const u = username.trim();
    const p = password;
    if (u.length < 3) {
      alert("Username must be at least 3 characters");
      return;
    }
    if (!p || p.length < 4) {
      alert("Password must be at least 4 characters");
      return;
    }
    setLoading(true);
    try {
      // Public signup is students only (teachers created by admin).
      const { ok, data } = await registerRequest(u, p, "student");
      if (!ok) {
        const detail = data.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join("\n")
          : detail || data.error || "Registration failed";
        alert(msg);
        return;
      }

      const login = await loginRequest(u, p);
      if (!login.ok || !login.data.token) {
        alert("Account created. Please login.");
        window.location.href = "/login";
        return;
      }

      localStorage.setItem("token", login.data.token);
      localStorage.setItem("role", login.data.role || "student");
      localStorage.setItem("username", login.data.username || u);
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-10 max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6">Create Student Account</h1>

      <input
        className="border p-2 block mb-3 w-full rounded"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        className="border p-2 block mb-1 w-full rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="text-xs text-gray-500 mb-3">
        Set a strong password (at least 4 characters).
      </p>

      <p className="text-xs text-gray-500 mb-4">
        Teacher accounts are created by the admin — not via public signup.
      </p>

      <button
        onClick={handleRegister}
        disabled={loading}
        className="bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Register"}
      </button>

      <p className="mt-4 text-sm text-center">
        Already have an account?{" "}
        <a href="/login" className="text-blue-600 underline">
          Login here
        </a>
      </p>
    </div>
  );
}

export default Register;
