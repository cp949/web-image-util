'use client';

import {
  AutoFixHigh as AdvancedIcon,
  PhotoSizeSelectActual as BasicIcon,
  CompareArrows as BatchComparisonIcon,
  ViewModule as BatchIcon,
  Timeline as BenchmarkIcon,
  Transform as ConverterTestIcon,
  DeveloperMode as DevToolsIcon,
  FilterBAndW as FiltersIcon,
  CompareArrows as FitModeIcon,
  PhotoLibrary as FormatIcon,
  Home as HomeIcon,
  Menu as MenuIcon,
  Padding as PaddingIcon,
  Speed as PerformanceIcon,
  Dashboard as PresetsIcon,
  ViewQuilt as PreviewGalleryIcon,
  HighQuality as QualityIcon,
  AutoAwesome as QuickPreviewIcon,
  RocketLaunch as ShortcutApiIcon,
} from '@mui/icons-material';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';

const DRAWER_WIDTH = 280;

const navigationItems = [
  { path: '/', label: 'Home', icon: <HomeIcon /> },
  { path: '/quick-preview', label: 'Quick Preview', icon: <QuickPreviewIcon /> },
  { path: '/basic', label: 'Basic Processing', icon: <BasicIcon /> },
  { path: '/shortcut-api', label: 'Shortcut API', icon: <ShortcutApiIcon /> },
  { path: '/padding', label: 'Padding', icon: <PaddingIcon /> },
  { path: '/preview-gallery', label: 'Preview Gallery', icon: <PreviewGalleryIcon /> },
  { path: '/presets', label: 'Presets', icon: <PresetsIcon /> },
  { path: '/advanced', label: 'Advanced Features', icon: <AdvancedIcon /> },
  { path: '/filters', label: 'Filter Effects', icon: <FiltersIcon /> },
  { path: '/image-source-converter', label: 'ImageSourceConverter', icon: <ConverterTestIcon /> },
  { path: '/batch', label: 'Batch Processing', icon: <BatchIcon /> },
  { path: '/batch-comparison', label: 'Batch Comparison', icon: <BatchComparisonIcon /> },
  { path: '/performance', label: 'Performance Test', icon: <PerformanceIcon /> },
  { path: '/dev-tools', label: 'Developer Tools', icon: <DevToolsIcon /> },
  // SVG Features Section
  { path: '/svg-fit-modes', label: 'SVG Fit Mode Comparison', icon: <FitModeIcon /> },
  { path: '/svg-quality', label: 'SVG High-Quality Rendering', icon: <QualityIcon /> },
  // v2.0 New Features
  { path: '/svg-quality-comparison', label: 'SVG Quality Comparison', icon: <QualityIcon /> },
  { path: '/smart-format', label: 'Smart Format Selection', icon: <FormatIcon /> },
  { path: '/performance-benchmark', label: 'Performance Benchmark', icon: <BenchmarkIcon /> },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const theme = useTheme();
  const pathname = usePathname();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Web Image Util
        </Typography>
      </Toolbar>
      <List>
        {navigationItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              href={item.path}
              selected={pathname === item.path}
              onClick={() => isMobile && setMobileOpen(false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {navigationItems.find((item) => item.path === pathname)?.label || 'Example App'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8, // Margin for AppBar height
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
