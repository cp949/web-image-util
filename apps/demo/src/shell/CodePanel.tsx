import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Props = { source: string };

export function CodePanel({ source }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Paper variant="outlined" sx={{ position: 'relative', overflow: 'auto' }}>
      <Tooltip title={copied ? '복사됨' : '복사'} placement="left">
        <IconButton
          onClick={onCopy}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, color: '#9cdcfe' }}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <SyntaxHighlighter
        language="typescript"
        style={vscDarkPlus}
        showLineNumbers
        customStyle={{ margin: 0, padding: '16px', fontSize: 13 }}
      >
        {source}
      </SyntaxHighlighter>
    </Paper>
  );
}
