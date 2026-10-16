import { BrowserRouter, Routes, Route } from "react-router-dom";
import Exam from "./pages/Exam";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentHome from "./pages/StudentHome";
import TeacherDashboard from "./pages/TeacherDashboard";
import ApproveStart from "./pages/ApproveStart";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudentHome />} />
        <Route path="/exam/:examId" element={<Exam />} />
        <Route path="/approve/:token" element={<ApproveStart />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
