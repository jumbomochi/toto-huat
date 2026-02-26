import { Routes, Route } from "react-router"
import { Layout } from "@/components/layout"
import DashboardPage from "@/pages/dashboard"
import FrequencyPage from "@/pages/frequency"
import TrendsPage from "@/pages/trends"
import HistoryPage from "@/pages/history"

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/frequency" element={<FrequencyPage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </Layout>
  )
}
