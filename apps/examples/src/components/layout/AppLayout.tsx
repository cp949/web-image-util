import React, { useState } from 'react'
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
  useTheme
} from '@mui/material'
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  PhotoSizeSelectActual as BasicIcon,
  Dashboard as PresetsIcon,
  AutoFixHigh as AdvancedIcon,
  FilterBAndW as FiltersIcon,
  SwapHoriz as ConvertersIcon,
  ViewModule as BatchIcon,
  Speed as PerformanceIcon,
  DeveloperMode as DevToolsIcon,
  Build as SvgIcon,
  Transform as ConverterTestIcon
} from '@mui/icons-material'
import { Link, useLocation } from 'react-router'

const DRAWER_WIDTH = 280

const navigationItems = [
  { path: '/', label: '홈', icon: <HomeIcon /> },
  { path: '/basic', label: '기본 처리', icon: <BasicIcon /> },
  { path: '/presets', label: '프리셋 기능', icon: <PresetsIcon /> },
  { path: '/advanced', label: '고급 기능', icon: <AdvancedIcon /> },
  { path: '/filters', label: '필터 효과', icon: <FiltersIcon /> },
  { path: '/converters', label: '변환 도구', icon: <ConvertersIcon /> },
  { path: '/image-source-converter', label: 'ImageSourceConverter', icon: <ConverterTestIcon /> },
  { path: '/batch', label: '배치 처리', icon: <BatchIcon /> },
  { path: '/performance', label: '성능 테스트', icon: <PerformanceIcon /> },
  { path: '/dev-tools', label: '개발자 도구', icon: <DevToolsIcon /> },
  { path: '/svg-compatibility', label: 'SVG 호환성', icon: <SvgIcon /> }
]

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const theme = useTheme()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

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
              to={item.path}
              selected={location.pathname === item.path}
              onClick={() => isMobile && setMobileOpen(false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

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
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {navigationItems.find(item => item.path === location.pathname)?.label || '예제 앱'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
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
          mt: 8, // AppBar 높이만큼 여백
        }}
      >
        {children}
      </Box>
    </Box>
  )
}