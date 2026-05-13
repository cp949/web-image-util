import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <>
    <CssBaseline />
    <Typography sx={{ p: 4 }}>apps/demo bootstrap</Typography>
  </>,
);
