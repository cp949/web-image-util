import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import packageJson from '../package.json';
import * as basicModule from './demos/01-basic';
import basicSource from './demos/01-basic.ts?raw';
import * as fitModesModule from './demos/02-fit-modes';
import fitModesSource from './demos/02-fit-modes.ts?raw';
import * as svgModule from './demos/03-svg';
import svgSource from './demos/03-svg.ts?raw';
import * as presetsModule from './demos/04-presets';
import presetsSource from './demos/04-presets.ts?raw';
import * as shortcutModule from './demos/05-shortcut';
import shortcutSource from './demos/05-shortcut.ts?raw';
import * as chainModule from './demos/06-chain';
import chainSource from './demos/06-chain.ts?raw';
import * as filtersModule from './demos/07-filters';
import filtersSource from './demos/07-filters.ts?raw';
import * as sourcesModule from './demos/08-sources';
import sourcesSource from './demos/08-sources.ts?raw';
import * as outputFormatsModule from './demos/09-output-formats';
import outputFormatsSource from './demos/09-output-formats.ts?raw';
import * as outputMethodsModule from './demos/10-output-methods';
import outputMethodsSource from './demos/10-output-methods.ts?raw';
import * as svgSanitizerModule from './demos/11-svg-sanitizer';
import svgSanitizerSource from './demos/11-svg-sanitizer.ts?raw';
import * as advancedSvgModule from './demos/12-advanced-svg';
import advancedSvgSource from './demos/12-advanced-svg.ts?raw';
import * as errorsModule from './demos/13-errors';
import errorsSource from './demos/13-errors.ts?raw';
import * as workflowModule from './demos/14-workflow';
import workflowSource from './demos/14-workflow.ts?raw';
import { DemoPage } from './shell/DemoPage';
import { Sidebar, type SidebarItem } from './shell/Sidebar';

const items: SidebarItem[] = [
  { path: '/basic', title: '01. 빠른 시작' },
  { path: '/fit-modes', title: '02. Fit 모드 비교' },
  { path: '/svg', title: '03. SVG 처리' },
  { path: '/presets', title: '04. Presets' },
  { path: '/shortcut', title: '05. Shortcut API' },
  { path: '/chain', title: '06. 체이닝 + Blur' },
  { path: '/filters', title: '07. Filters 카탈로그' },
  { path: '/sources', title: '08. 입력 소스 갤러리' },
  { path: '/output-formats', title: '09. 출력 포맷 비교' },
  { path: '/output-methods', title: '10. 출력 메서드 비교' },
  { path: '/svg-sanitizer', title: '11. SVG 보안 (sanitizer)' },
  { path: '/advanced-svg', title: '12. Advanced: SVG 복잡도/호환성' },
  { path: '/errors', title: '13. 에러 처리 카탈로그' },
  { path: '/workflow', title: '14. 실전 워크플로' },
];

export function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar items={items} version={packageJson.version} />
        <Box component="main" sx={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/basic" replace />} />
            <Route path="/basic" element={<DemoPage source={basicSource} module={basicModule} />} />
            <Route path="/fit-modes" element={<DemoPage source={fitModesSource} module={fitModesModule} />} />
            <Route path="/svg" element={<DemoPage source={svgSource} module={svgModule} />} />
            <Route path="/presets" element={<DemoPage source={presetsSource} module={presetsModule} />} />
            <Route path="/shortcut" element={<DemoPage source={shortcutSource} module={shortcutModule} />} />
            <Route path="/chain" element={<DemoPage source={chainSource} module={chainModule} />} />
            <Route path="/filters" element={<DemoPage source={filtersSource} module={filtersModule} />} />
            <Route path="/sources" element={<DemoPage source={sourcesSource} module={sourcesModule} />} />
            <Route
              path="/output-formats"
              element={<DemoPage source={outputFormatsSource} module={outputFormatsModule} />}
            />
            <Route
              path="/output-methods"
              element={<DemoPage source={outputMethodsSource} module={outputMethodsModule} />}
            />
            <Route
              path="/svg-sanitizer"
              element={<DemoPage source={svgSanitizerSource} module={svgSanitizerModule} />}
            />
            <Route path="/advanced-svg" element={<DemoPage source={advancedSvgSource} module={advancedSvgModule} />} />
            <Route path="/errors" element={<DemoPage source={errorsSource} module={errorsModule} />} />
            <Route path="/workflow" element={<DemoPage source={workflowSource} module={workflowModule} />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}
