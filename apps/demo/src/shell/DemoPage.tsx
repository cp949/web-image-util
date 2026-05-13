import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useEffect, useRef } from 'react';
import { CodePanel } from './CodePanel';

export type DemoModule = {
  meta: { title: string; description: string };
  run: (target: HTMLElement) => Promise<void>;
};

type Props = {
  source: string;
  module: DemoModule;
};

export function DemoPage({ source, module }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    target.innerHTML = '';
    let cancelled = false;
    module.run(target).catch((err) => {
      if (cancelled) return;
      target.innerHTML = `<pre style="color:#b00;white-space:pre-wrap">${String(err)}</pre>`;
    });
    return () => {
      cancelled = true;
      target.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
      });
      target.innerHTML = '';
    };
  }, [module]);

  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <Typography variant="h4" gutterBottom>
        {module.meta.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {module.meta.description}
      </Typography>
      <CodePanel source={source} />
      <Box
        sx={{
          mt: 3,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          minHeight: 200,
        }}
      >
        <div ref={ref} />
      </Box>
    </Box>
  );
}
