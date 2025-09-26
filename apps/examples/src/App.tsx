
import { Route, Routes } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { AdvancedPage } from './pages/AdvancedPage'
import { BasicProcessingPage } from './pages/BasicProcessingPage'
import { BatchPage } from './pages/BatchPage'
import { ConvertersPage } from './pages/ConvertersPage'
import { DevToolsPage } from './pages/DevToolsPage'
import { FiltersPage } from './pages/FiltersPage'
import { HomePage } from './pages/HomePage'
import { PerformancePage } from './pages/PerformancePage'
import { PresetsPage } from './pages/PresetsPage'
import { SvgCompatibilityPage } from './pages/SvgCompatibilityPage'

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/basic" element={<BasicProcessingPage />} />
        <Route path="/presets" element={<PresetsPage />} />
        <Route path="/advanced" element={<AdvancedPage />} />
        <Route path="/filters" element={<FiltersPage />} />
        <Route path="/converters" element={<ConvertersPage />} />
        <Route path="/batch" element={<BatchPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/dev-tools" element={<DevToolsPage />} />
        <Route path="/svg-compatibility" element={<SvgCompatibilityPage />} />
      </Routes>
    </AppLayout>
  )
}

export default App