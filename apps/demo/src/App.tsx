import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import packageJson from '../package.json';
import * as basicModule from './demos/01-basic';
import basicSource from './demos/01-basic.ts?raw';
import * as fitModesModule from './demos/02-fit-modes';
import fitModesSource from './demos/02-fit-modes.ts?raw';
import { DemoPage } from './shell/DemoPage';
import { Sidebar, type SidebarItem } from './shell/Sidebar';

const items: SidebarItem[] = [
  { path: '/basic', title: '01. 빠른 시작' },
  { path: '/fit-modes', title: '02. Fit 모드 비교' },
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
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}
