import './App.css'
import BenchMarkTest from './component/benchMarkTesting'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";



function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<BenchMarkTest />} />
      </Routes>
    </Router>
  )
}

export default App
