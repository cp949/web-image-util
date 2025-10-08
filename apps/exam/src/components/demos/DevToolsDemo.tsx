'use client'

import { processImage, features } from '@cp949/web-image-util';
import {
  BugReport as BugIcon,
  Code as CodeIcon,
  Build as DevIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import React, { useState } from 'react';
import { CodeSnippet } from '../common/CodeSnippet';
import { ImageUploader } from '../common/ImageUploader';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
  operation?: string;
}

interface BrowserInfo {
  userAgent: string;
  vendor: string;
  platform: string;
  language: string;
  cookieEnabled: boolean;
  onlineStatus: boolean;
  webpSupport: boolean;
  avifSupport: boolean;
  offscreenCanvasSupport: boolean;
  webWorkerSupport: boolean;
  memory?: {
    used: number;
    total: number;
    limit: number;
  };
}

export function DevToolsDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [apiResponse, setApiResponse] = useState<unknown>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [debugMode, setDebugMode] = useState(false);

  const [codeGenOptions, setCodeGenOptions] = useState({
    operation: 'resize',
    width: 300,
    height: 200,
    format: 'jpeg',
    quality: 80,
    includeErrorHandling: true,
    includeTypeScript: true,
    includeComments: true,
  });

  // Log entry function
  const addLog = (level: LogEntry['level'], message: string, data?: unknown, operation?: string) => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      level,
      message,
      data,
      operation,
    };
    setLogs((prev) => [logEntry, ...prev].slice(0, 100)); // Keep maximum 100 logs
  };

  // Browser compatibility check
  const getBrowserInfo = (): BrowserInfo => {
    const performanceExt = performance as ExtendedPerformance;
    const memory = performanceExt.memory;

    return {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      webpSupport: features.webp,
      avifSupport: features.avif,
      offscreenCanvasSupport: features.offscreenCanvas,
      webWorkerSupport: typeof Worker !== 'undefined',
      memory: memory
        ? {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
          }
        : undefined,
    };
  };

  const [browserInfo] = useState<BrowserInfo>(getBrowserInfo());

  const handleImageSelect = async (source: File | string) => {
    addLog('info', 'Image selected', {
      source: typeof source === 'string' ? source : `File: ${source.name}`,
    });

    try {
      addLog('debug', 'Starting image processing', null, 'processImage');

      const startTime = performance.now();
      const result = await processImage(source).resize({ fit: 'cover', width: 300, height: 200 }).toBlob();
      const endTime = performance.now();

      const responseData = {
        success: true,
        processingTime: Math.round(endTime - startTime),
        input: {
          type: typeof source === 'string' ? 'url' : 'file',
          source:
            typeof source === 'string'
              ? source
              : {
                  name: source.name,
                  size: source.size,
                  type: source.type,
                },
        },
        output: {
          size: result.blob.size,
          type: result.blob.type,
          width: 300,
          height: 200,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          browser: browserInfo.userAgent.split(' ')[0],
          webpSupported: browserInfo.webpSupport,
          memoryUsage: browserInfo.memory,
        },
      };

      setApiResponse(responseData);
      addLog('info', 'Image processed successfully', responseData, 'processImage');
    } catch (error) {
      const errorData = {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        input: {
          type: typeof source === 'string' ? 'url' : 'file',
          source: typeof source === 'string' ? source : source.name,
        },
        timestamp: new Date().toISOString(),
      };

      setApiResponse(errorData);
      addLog('error', 'Image processing failed', errorData, 'processImage');
    }
  };

  const generateCode = () => {
    const { operation, width, height, format, quality, includeErrorHandling, includeTypeScript, includeComments } =
      codeGenOptions;

    let code = '';

    if (includeComments) {
      code += `// Generated code for ${operation} operation\n`;
      code += `// Created at: ${new Date().toLocaleString()}\n\n`;
    }

    if (includeTypeScript) {
      code += `import { processImage } from '@cp949/web-image-util';\n\n`;
      code += `async function processImageExample(source: File | string): Promise<Blob> {\n`;
    } else {
      code += `import { processImage } from '@cp949/web-image-util';\n\n`;
      code += `async function processImageExample(source) {\n`;
    }

    if (includeErrorHandling) {
      code += `  try {\n`;
      if (includeComments) {
        code += `    // Process the image with the specified parameters\n`;
      }
      code += `    const result = await processImage(source)\n`;
    } else {
      code += `  const result = await processImage(source)\n`;
    }

    switch (operation) {
      case 'resize':
        code += `      .resize(${width}, ${height})\n`;
        break;
      case 'thumbnail':
        code += `      .resize({ fit: 'cover', width: 150, height: 150 })\n`;
        break;
      case 'blur':
        code += `      .blur(5)\n`;
        break;
    }

    code += `      .toBlob({ format: '${format}', quality: ${quality / 100} });\n\n`;

    if (includeErrorHandling) {
      if (includeComments) {
        code += `    // Return the processed image blob\n`;
      }
      code += `    return result;\n`;
      code += `  } catch (error) {\n`;
      code += `    console.error('Image processing failed:', error);\n`;
      code += `    throw error;\n`;
      code += `  }\n`;
    } else {
      code += `  return result;\n`;
    }

    code += `}\n\n`;

    if (includeComments) {
      code += `// Usage example:\n`;
      code += `// const processedImage = await processImageExample(yourImageFile);\n`;
      code += `// const url = URL.createObjectURL(processedImage);\n`;
    }

    setGeneratedCode(code);
    addLog('info', 'Code generated', { operation, options: codeGenOptions });
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'Logs cleared');
  };

  const exportLogs = () => {
    const logData = {
      exportTime: new Date().toISOString(),
      browserInfo,
      logs,
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `web-image-util-logs-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addLog('info', 'Logs exported');
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warn':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      case 'debug':
        return <BugIcon color="action" />;
      default:
        return <SuccessIcon color="success" />;
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'error.main';
      case 'warn':
        return 'warning.main';
      case 'info':
        return 'info.main';
      case 'debug':
        return 'text.secondary';
      default:
        return 'success.main';
    }
  };

  const JsonViewer: React.FC<{ data: any }> = ({ data }) => (
    <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>{JSON.stringify(data, null, 2)}</pre>
    </Paper>
  );

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        Developer Tools
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Tools for development assistance including debugging, code generation, and browser compatibility checking.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <ImageUploader onImageSelect={handleImageSelect} />

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Developer Settings
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={debugMode}
                      onChange={(e) => {
                        setDebugMode(e.target.checked);
                        addLog('info', `Debug mode ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                    />
                  }
                  label="Debug Mode"
                  sx={{ mb: 2 }}
                />

                <Stack spacing={2}>
                  <Button variant="outlined" onClick={clearLogs} startIcon={<BugIcon />}>
                    Clear Logs
                  </Button>
                  <Button variant="outlined" onClick={exportLogs} startIcon={<DevIcon />}>
                    Export Logs
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Browser Compatibility */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Browser Compatibility
                </Typography>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">WebP Support</Typography>
                    <Chip
                      label={browserInfo.webpSupport ? 'Yes' : 'No'}
                      color={browserInfo.webpSupport ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">AVIF Support</Typography>
                    <Chip
                      label={browserInfo.avifSupport ? 'Yes' : 'No'}
                      color={browserInfo.avifSupport ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">OffscreenCanvas</Typography>
                    <Chip
                      label={browserInfo.offscreenCanvasSupport ? 'Yes' : 'No'}
                      color={browserInfo.offscreenCanvasSupport ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Web Worker</Typography>
                    <Chip
                      label={browserInfo.webWorkerSupport ? 'Yes' : 'No'}
                      color={browserInfo.webWorkerSupport ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>

                  {browserInfo.memory && (
                    <Box>
                      <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
                        Memory Usage
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Math.round(browserInfo.memory.used / 1024 / 1024)}MB /
                        {Math.round(browserInfo.memory.total / 1024 / 1024)}MB
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 3 }}>
                <Tab label="API Response" icon={<InfoIcon />} />
                <Tab label="Logs" icon={<BugIcon />} />
                <Tab label="Code Generator" icon={<CodeIcon />} />
                <Tab label="Browser Info" icon={<DevIcon />} />
              </Tabs>

              {/* API Response Tab */}
              {activeTab === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    API Response JSON Viewer
                  </Typography>

                  {apiResponse ? (
                    <JsonViewer data={apiResponse} />
                  ) : (
                    <Alert severity="info">Upload an image to view the API response.</Alert>
                  )}
                </Box>
              )}

              {/* Logs Tab */}
              {activeTab === 1 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Real-time Logs ({logs.length})</Typography>
                    <Button size="small" onClick={clearLogs}>
                      Clear All
                    </Button>
                  </Box>

                  <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                    {logs.length > 0 ? (
                      <List dense>
                        {logs.map((log) => (
                          <ListItem key={log.id} divider>
                            <ListItemIcon>{getLogIcon(log.level)}</ListItemIcon>
                            <ListItemText
                              primary={
                                <Box>
                                  <Typography variant="body2" component="span" sx={{ color: getLogColor(log.level) }}>
                                    [{log.level.toUpperCase()}]
                                  </Typography>
                                  {log.operation && (
                                    <Chip label={log.operation} size="small" sx={{ ml: 1, height: 20 }} />
                                  )}
                                  <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
                                    {log.message}
                                  </Typography>
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {log.timestamp.toLocaleTimeString()}
                                  </Typography>
                                  {log.data !== undefined && debugMode && (
                                    <Accordion sx={{ mt: 1 }}>
                                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="caption">View Data</Typography>
                                      </AccordionSummary>
                                      <AccordionDetails>
                                        <Box sx={{ fontSize: '0.75rem' }}>
                                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                            {JSON.stringify(log.data as Record<string, unknown>, null, 2)}
                                          </pre>
                                        </Box>
                                      </AccordionDetails>
                                    </Accordion>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Alert severity="info">No logs available. Try processing an image.</Alert>
                    )}
                  </Box>
                </Box>
              )}

              {/* Code Generator Tab */}
              {activeTab === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Code Generator
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Operation Type"
                        select
                        value={codeGenOptions.operation}
                        onChange={(e) =>
                          setCodeGenOptions((prev) => ({
                            ...prev,
                            operation: e.target.value,
                          }))
                        }
                      >
                        <MenuItem value="resize">Resize</MenuItem>
                        <MenuItem value="thumbnail">Thumbnail</MenuItem>
                        <MenuItem value="blur">Blur</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        fullWidth
                        label="Width"
                        type="number"
                        value={codeGenOptions.width}
                        onChange={(e) =>
                          setCodeGenOptions((prev) => ({
                            ...prev,
                            width: parseInt(e.target.value) || 300,
                          }))
                        }
                      />
                    </Grid>

                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        fullWidth
                        label="Height"
                        type="number"
                        value={codeGenOptions.height}
                        onChange={(e) =>
                          setCodeGenOptions((prev) => ({
                            ...prev,
                            height: parseInt(e.target.value) || 200,
                          }))
                        }
                      />
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={codeGenOptions.includeTypeScript}
                          onChange={(e) =>
                            setCodeGenOptions((prev) => ({
                              ...prev,
                              includeTypeScript: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="TypeScript"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={codeGenOptions.includeErrorHandling}
                          onChange={(e) =>
                            setCodeGenOptions((prev) => ({
                              ...prev,
                              includeErrorHandling: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Error Handling"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={codeGenOptions.includeComments}
                          onChange={(e) =>
                            setCodeGenOptions((prev) => ({
                              ...prev,
                              includeComments: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Comments"
                    />
                  </Stack>

                  <Button variant="contained" onClick={generateCode} startIcon={<CodeIcon />} sx={{ mb: 3 }}>
                    Generate Code
                  </Button>

                  {generatedCode && (
                    <CodeSnippet
                      title="Generated Code"
                      examples={[
                        {
                          title: 'Generated Code',
                          code: generatedCode,
                          language: codeGenOptions.includeTypeScript
                            ? ('typescript' as const)
                            : ('javascript' as const),
                        },
                      ]}
                    />
                  )}
                </Box>
              )}

              {/* Browser Info Tab */}
              {activeTab === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Browser Detailed Information
                  </Typography>

                  <JsonViewer data={browserInfo} />

                  <Alert severity="info" sx={{ mt: 2 }}>
                    This information helps identify which features the web image utility can use in your browser.
                  </Alert>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

// removed old export default;
