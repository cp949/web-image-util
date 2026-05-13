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
import { DemoPage } from './shell/DemoPage';
import { Sidebar, type SidebarItem } from './shell/Sidebar';

const items: SidebarItem[] = [
  { path: '/basic', title: '01. 빠른 시작' },
  { path: '/fit-modes', title: '02. Fit 모드 비교' },
  { path: '/svg', title: '03. SVG 처리' },
  { path: '/presets', title: '04. Presets' },
  { path: '/shortcut', title: '05. Shortcut API' },
  { path: '/chain', title: '06. 체이닝 + Blur' },
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
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}
