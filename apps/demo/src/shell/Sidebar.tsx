import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { NavLink, useLocation } from 'react-router-dom';

export type SidebarItem = { path: string; title: string };

type Props = { items: SidebarItem[]; version: string };

const WIDTH = 260;

export function Sidebar({ items, version }: Props) {
  const { pathname } = useLocation();

  return (
    <Drawer variant="permanent" sx={{ width: WIDTH, '& .MuiDrawer-paper': { width: WIDTH } }}>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          @cp949/web-image-util
        </Typography>
        <Typography variant="caption" color="text.secondary">
          v{version}
        </Typography>
      </Toolbar>
      <List>
        {items.map((item) => (
          <ListItemButton key={item.path} component={NavLink} to={item.path} selected={pathname === item.path}>
            <ListItemText primary={item.title} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}
