'use client'
import { CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { AppLayout } from '../layout/AppLayout'

const theme = createTheme({
  palette: {
    mode: 'light',
  },
})

interface ClientThemeProviderProps {
  children: React.ReactNode
}

export function ClientThemeProvider({ children }: ClientThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppLayout>
        {children}
      </AppLayout>
    </ThemeProvider>
  )
}