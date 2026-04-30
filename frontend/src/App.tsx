import { Route, BrowserRouter, Routes } from "react-router-dom"
import Homepage from "./pages/Homepage"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import ExpenseTracker from "./pages/ExpenseTracker"
import Mementos from "./pages/Mementos"
import Ounje from "./pages/Ounje"
import { RequireAuth } from "@/lib/auth"

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />}></Route>
        <Route path="/login" element={<Login />}></Route>
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/owo" element={<RequireAuth><ExpenseTracker /></RequireAuth>} />
        <Route path="/mementos" element={<RequireAuth><Mementos /></RequireAuth>} />
        <Route path="/ounje" element={<RequireAuth><Ounje /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
