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
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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
  { path: '/', label: '홈', icon: <HomeIcon />, primary: true },
  { path: '/basic', label: '기본처리', icon: <ProcessIcon />, primary: true },
  { path: '/presets', label: '프리셋', icon: <PresetsIcon />, primary: true },
  { path: '/advanced', label: '고급기능', icon: <AdvancedIcon /> },
  { path: '/filters', label: '필터', icon: <FiltersIcon /> },
  { path: '/converters', label: '변환도구', icon: <ConvertersIcon /> },
  { path: '/performance', label: '성능테스트', icon: <PerformanceIcon /> },
  { path: '/dev-tools', label: '개발자도구', icon: <DevToolsIcon /> },
]

export function MobileOptimizedLayout({ children }: MobileOptimizedLayoutProps) {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showFab, setShowFab] = useState(true)

  // 현재 경로에 맞는 네비게이션 값 찾기
  const getCurrentNavValue = () => {
    const primaryItems = navigationItems.filter(item => item.primary)
    const currentIndex = primaryItems.findIndex(item => item.path === location.pathname)
    return currentIndex >= 0 ? currentIndex : 0
  }

  const [bottomNavValue, setBottomNavValue] = useState(getCurrentNavValue())

  React.useEffect(() => {
    setBottomNavValue(getCurrentNavValue())
  }, [location.pathname])

  const handleBottomNavChange = (_: React.SyntheticEvent, newValue: number) => {
    setBottomNavValue(newValue)
    const primaryItems = navigationItems.filter(item => item.primary)
    if (primaryItems[newValue]) {
      navigate(primaryItems[newValue].path)
    }
  }

  const handleDrawerItemClick = (path: string) => {
    navigate(path)
    setDrawerOpen(false)
  }

  // 스크롤 감지로 FAB 숨김/표시
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
    return <>{children}</> // 데스크톱에서는 기본 레이아웃 사용
  }

  const primaryItems = navigationItems.filter(item => item.primary)
  const drawerItems = navigationItems

  return (
    <Box sx={{ pb: 7, minHeight: '100vh' }}>
      {children}

      {/* 모바일 하단 네비게이션 */}
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
            label="더보기"
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

      {/* 더보기 Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={() => setDrawerOpen(true)}
        disableSwipeToOpen={false}
        ModalProps={{
          keepMounted: true, // 성능 최적화
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
          {/* Drawer 헤더 */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            px: 2,
            pb: 1
          }}>
            <Typography variant="h6" component="h2">
              더 많은 기능
            </Typography>
            <IconButton 
              onClick={() => setDrawerOpen(false)}
              size="small"
              aria-label="닫기"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          {/* 네비게이션 아이템들 */}
          <List>
            {drawerItems.map((item) => {
              const isCurrentPath = location.pathname === item.path
              
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

      {/* 플로팅 액션 버튼 - 이미지 업로드 */}
      <Zoom in={showFab} timeout={200}>
        <Fab
          color="primary"
          aria-label="이미지 업로드"
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 999
          }}
          onClick={() => {
            // 파일 선택 다이얼로그 열기
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) {
                // 이미지가 선택되면 기본 처리 페이지로 이동
                navigate('/basic', { state: { uploadedFile: file } })
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