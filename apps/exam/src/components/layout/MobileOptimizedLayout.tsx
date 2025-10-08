'use client'

import {
  Tune as AdvancedIcon,
  Close as CloseIcon,
  SwapHoriz as ConvertersIcon,
  BugReport as DevToolsIcon,
  FilterVintage as FiltersIcon,
  Home as HomeIcon,
  MoreVert as MoreIcon,
  Speed as PerformanceIcon,
  Dashboard as PresetsIcon,
  PhotoSizeSelectActual as ProcessIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material'
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Divider,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  SwipeableDrawer,
  Typography,
  useMediaQuery,
  useTheme,
  Zoom
} from '@mui/material'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import React, { useState } from 'react'

interface MobileOptimizedLayoutProps {
  children: React.ReactNode
}

interface NavigationItem {
  path: string
  label: string
  icon: React.ReactElement
  primary?: boolean
}

const navigationItems: NavigationItem[] = [
  { path: '/', label: 'Home', icon: <HomeIcon />, primary: true },
  { path: '/basic', label: 'Basic', icon: <ProcessIcon />, primary: true },
  { path: '/presets', label: 'Presets', icon: <PresetsIcon />, primary: true },
  { path: '/advanced', label: 'Advanced', icon: <AdvancedIcon /> },
  { path: '/filters', label: 'Filters', icon: <FiltersIcon /> },
  { path: '/converters', label: 'Converters', icon: <ConvertersIcon /> },
  { path: '/performance', label: 'Performance', icon: <PerformanceIcon /> },
  { path: '/dev-tools', label: 'Dev Tools', icon: <DevToolsIcon /> },
]

export function MobileOptimizedLayout({ children }: MobileOptimizedLayoutProps) {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showFab, setShowFab] = useState(true)

  // Find navigation value matching current path
  const getCurrentNavValue = () => {
    const primaryItems = navigationItems.filter(item => item.primary)
    const currentIndex = primaryItems.findIndex(item => item.path === pathname)
    return currentIndex >= 0 ? currentIndex : 0
  }

  const [bottomNavValue, setBottomNavValue] = useState(getCurrentNavValue())

  React.useEffect(() => {
    setBottomNavValue(getCurrentNavValue())
  }, [pathname])

  const handleBottomNavChange = (_: React.SyntheticEvent, newValue: number) => {
    setBottomNavValue(newValue)
    const primaryItems = navigationItems.filter(item => item.primary)
    if (primaryItems[newValue]) {
      router.push(primaryItems[newValue].path)
    }
  }

  const handleDrawerItemClick = (path: string) => {
    router.push(path)
    setDrawerOpen(false)
  }

  // Hide/show FAB on scroll detection
  React.useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setShowFab(currentScrollY < lastScrollY || currentScrollY < 100)
      lastScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isMobile) {
    return <>{children}</> // Use default layout on desktop
  }

  const primaryItems = navigationItems.filter(item => item.primary)
  const drawerItems = navigationItems

  return (
    <Box sx={{ pb: 7, minHeight: '100vh' }}>
      {children}

      {/* Mobile bottom navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000
        }}
        elevation={8}
      >
        <BottomNavigation
          value={bottomNavValue}
          onChange={handleBottomNavChange}
          sx={{
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              maxWidth: 'none',
              '&.Mui-selected': {
                color: 'primary.main'
              }
            }
          }}
        >
          {primaryItems.map((item,  ) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
              sx={{
                fontSize: '0.75rem',
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.65rem',
                  '&.Mui-selected': {
                    fontSize: '0.65rem'
                  }
                }
              }}
            />
          ))}
          <BottomNavigationAction
            label="More"
            icon={<MoreIcon />}
            onClick={() => setDrawerOpen(true)}
            sx={{
              fontSize: '0.75rem',
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.65rem'
              }
            }}
          />
        </BottomNavigation>
      </Paper>

      {/* More drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={() => setDrawerOpen(true)}
        disableSwipeToOpen={false}
        ModalProps={{
          keepMounted: true, // Performance optimization
        }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '70vh',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 40,
              height: 4,
              backgroundColor: 'divider',
              borderRadius: 2
            }
          }
        }}
      >
        <Box sx={{ pt: 3 }}>
          {/* Drawer header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            pb: 1
          }}>
            <Typography variant="h6" component="h2">
              More Features
            </Typography>
            <IconButton
              onClick={() => setDrawerOpen(false)}
              size="small"
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          {/* Navigation items */}
          <List>
            {drawerItems.map((item) => {
              const isCurrentPath = pathname === item.path
              
              return (
                <ListItem 
                  key={item.path} 
                  disablePadding
                >
                  <ListItemButton
                    onClick={() => handleDrawerItemClick(item.path)}
                    selected={isCurrentPath}
                    sx={{
                      py: 1.5,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.50',
                        '&:hover': {
                          backgroundColor: 'primary.100',
                        }
                      }
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: isCurrentPath ? 'primary.main' : 'inherit'
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label}
                      slotProps={{
                        primary:{
                        variant: 'body2',
                        color: isCurrentPath ? 'primary' : 'inherit'
                        }
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )
            })}
          </List>
        </Box>
      </SwipeableDrawer>

      {/* Floating action button - Image upload */}
      <Zoom in={showFab} timeout={200}>
        <Fab
          color="primary"
          aria-label="Upload image"
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 999
          }}
          onClick={() => {
            // Open file selection dialog
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) {
                // Navigate to basic processing page when image is selected
                router.push('/basic')
              }
            }
            input.click()
          }}
        >
          <UploadIcon />
        </Fab>
      </Zoom>
    </Box>
  )
}