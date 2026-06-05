// =============================================================
// src/pages/Login.jsx
// Login page where users enter their username and password.
// On success, saves the JWT token and redirects to the exam.
// =============================================================

import { useState } from "react";

function Login() {
  // State variables for the form inputs
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");


  // Called when the user clicks "Login"
  async function handleLogin() {
    try {
      // Send login request to backend
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.token) {
        // Save the JWT token in localStorage so other pages can use it
        localStorage.setItem("token", data.token);

        // Redirect to exam page
        window.location.href = "/";
      } else {
        alert("Invalid username or password");
      }
    } catch (err) {
      console.error(err);
      alert("Login failed. Is the backend running?");
    }
  }


  return (
    <div className="p-10 max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6">Login to Exam</h1>

      {/* Username field */}
      <input
        className="border p-2 block mb-3 w-full rounded"
        placeholder="Username"
        value={username}
        onChange={function(e) { setUsername(e.target.value); }}
      />

      {/* Password field */}
      <input
        className="border p-2 block mb-4 w-full rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={function(e) { setPassword(e.target.value); }}
      />

      {/* Login button */}
      <button
        onClick={handleLogin}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600"
      >
        Login
      </button>

      {/* Link to register page */}
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
