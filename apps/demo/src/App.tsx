import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import packageJson from '../package.json';
import * as placeholderModule from './demos/placeholder';
import placeholderSource from './demos/placeholder.ts?raw';
import { DemoPage } from './shell/DemoPage';
import { Sidebar, type SidebarItem } from './shell/Sidebar';

const items: SidebarItem[] = [{ path: '/basic', title: 'Placeholder (임시)' }];

export function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar items={items} version={packageJson.version} />
        <Box component="main" sx={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/basic" replace />} />
            <Route path="/basic" element={<DemoPage source={placeholderSource} module={placeholderModule} />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}
