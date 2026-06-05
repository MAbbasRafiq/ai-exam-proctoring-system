// =============================================================
// src/pages/Register.jsx
// Registration page for new users.
// After registration, automatically logs them in and redirects.
// =============================================================

import { useState } from "react";

function Register() {
  // State variables for the form inputs
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");


  // Called when the user clicks "Register"
  async function handleRegister() {
    try {
      // Step 1: Create a new account
      const res = await fetch("http://127.0.0.1:8000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.message !== "User created") {
        // Registration failed (e.g. username already taken)
        alert(data.error || "Registration failed");
        return;
      }

      // Step 2: Auto login after successful registration
      const loginRes = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const loginData = await loginRes.json();

      // Step 3: Save token
      localStorage.setItem("token", loginData.token);

      // Step 4: Redirect to exam
      window.location.href = "/";

    } catch (err) {
      console.error(err);
      alert("Something went wrong. Is the backend running?");
    }
  }


  return (
    <div className="p-10 max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-6">Create an Account</h1>

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

      {/* Register button */}
      <button
        onClick={handleRegister}
        className="bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600"
      >
        Register
      </button>

      {/* Link to login page */}
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
