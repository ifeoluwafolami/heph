import { Route, HashRouter, Routes, Navigate } from "react-router-dom"
import Homepage from "./pages/Homepage"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import ExpenseTracker from "./pages/ExpenseTracker"
import Mementos from "./pages/Mementos"
import Ounje from "./pages/Ounje"
import Odyssey from "./pages/Odyssey"
import { RequireAuth } from "@/lib/auth"

function App() {

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Homepage />}></Route>
        <Route path="/login" element={<Login />}></Route>
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/owo" element={<RequireAuth><ExpenseTracker /></RequireAuth>} />
        <Route path="/mementos" element={<RequireAuth><Mementos /></RequireAuth>} />
        <Route path="/ounje" element={<RequireAuth><Ounje /></RequireAuth>} />
        <Route path="/odyssey" element={<RequireAuth><Odyssey /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
