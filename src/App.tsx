import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { BobPipeline } from './pages/BobPipeline'
import { GeoffTrading } from './pages/GeoffTrading'
import { XenaSignals } from './pages/XenaSignals'
import { Tasks } from './pages/Tasks'

function App() {
  return (
    <BrowserRouter basename="/lifeos-mission-control/">
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bob" element={<BobPipeline />} />
            <Route path="/geoff" element={<GeoffTrading />} />
            <Route path="/xena" element={<XenaSignals />} />
            <Route path="/tasks" element={<Tasks />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
