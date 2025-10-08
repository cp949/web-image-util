import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab
} from '@mui/material'
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon
} from '@mui/icons-material'

interface CodeExample {
  title: string
  code: string
  language: string
}

interface CodeSnippetProps {
  examples: CodeExample[]
  title?: string
}

export function CodeSnippet({ examples, title = "Code Example" }: CodeSnippetProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const currentExample = examples[activeTab]

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{title}</Typography>
          <Tooltip title={copied ? "Copied!" : "Copy code"}>
            <IconButton
              onClick={() => copyToClipboard(currentExample.code)}
              color={copied ? "success" : "default"}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {examples.length > 1 && (
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ mb: 2 }}
          >
            {examples.map((example, index) => (
              <Tab key={index} label={example.title} />
            ))}
          </Tabs>
        )}

        <Box sx={{ position: 'relative' }}>
          {/* Simple code display - without syntax highlighting */}
          <Box
            component="pre"
            sx={{
              p: 2,
              bgcolor: '#2d3748',
              color: '#e2e8f0',
              borderRadius: 2,
              overflow: 'auto',
              fontSize: '14px',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              margin: 0
            }}
          >
            <code>{currentExample.code}</code>
          </Box>
        </Box>

        {copied && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Code has been copied to clipboard!
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}