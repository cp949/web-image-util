import { CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'

const theme = createTheme({
  palette: {
    mode: 'light', 
  },
  components: {
    // React Router 통합
    MuiButtonBase: {
      defaultProps: {
        LinkComponent: React.forwardRef<HTMLAnchorElement>((props, ref) => (
          <a ref={ref} {...props} />
        ))
      }
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)