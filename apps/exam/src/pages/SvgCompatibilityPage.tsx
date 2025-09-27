'use client'

import { enhanceBrowserCompatibility, SvgCompatibilityOptions } from '../../../../sub/web-image-util/dist';
import { CheckCircle, Clear, ContentCopy, Memory, Refresh, Speed, Warning } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { CodeSnippet } from '../components/common/CodeSnippet';
import { ImageUploader } from '../components/common/ImageUploader';

interface SvgCompatibilityReport {
  addedNamespaces: string[];
  fixedDimensions: boolean;
  modernizedSyntax: number;
  warnings: string[];
  infos?: string[];
  processingTimeMs: number;
}

// 테스트 케이스 프리셋
const TEST_PRESETS = {
  'namespace-missing': {
    name: '네임스페이스 없음',
    svg: `<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
  <text x="50" y="50" text-anchor="middle" fill="white">SVG</text>
</svg>`,
    description: 'xmlns 네임스페이스가 누락된 SVG',
    color: 'error',
  },
  'size-missing': {
    name: '크기 정보 없음 (0×0 렌더링 문제)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg"> <rect x="10" y="10" width="80" height="60" fill="red"/> <circle cx="50" cy="50" r="20" fill="yellow"/> </svg>`,
    description: 'width, height, viewBox가 없어서 HTML에서 0×0으로 렌더링되는 SVG',
    color: 'warning',
  },
  'xlink-legacy': {
    name: '구식 xlink 문법',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="150" height="150">
  <defs>
    <circle id="dot" r="3" fill="black"/>
  </defs>
  <use xlink:href="#dot" x="30" y="30"/>
  <use xlink:href="#dot" x="60" y="60"/>
  <use xlink:href="#dot" x="90" y="90"/>
</svg>`,
    description: 'xlink:href 구문이 사용된 구식 SVG',
    color: 'info',
  },
  'perfect-svg': {
    name: '완벽한 SVG',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="80" fill="url(#grad1)"/>
  <text x="100" y="100" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial" font-size="20">Perfect</text>
</svg>`,
    description: '모든 호환성 요소가 완벽하게 갖춰진 SVG',
    color: 'success',
  },
};

export function SvgCompatibilityPage() {
  // State
  const [svgInput, setSvgInput] = useState<string>('');
  const [enhancedSvg, setEnhancedSvg] = useState<string>('');
  const [report, setReport] = useState<SvgCompatibilityReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // 옵션 State
  const [options, setOptions] = useState<SvgCompatibilityOptions>({
    addNamespaces: true,
    fixDimensions: true,
    modernizeSyntax: true,
    addPreserveAspectRatio: true,
    preferResponsive: false, // 0×0 방지를 위해 width/height 주입
    mode: 'preserve-framing', // 기본은 프레이밍 보존
    paddingPercent: 0.0,
    enableLiveBBox: false, // SSR/보안 고려 기본 OFF
    enableHeuristicBBox: true,
    ensureNonZeroViewport: true,
  });

  // SVG 처리 함수
  const processSvg = useCallback(
    async (inputSvg: string) => {
      if (!inputSvg.trim()) {
        setEnhancedSvg('');
        setReport(null);
        setError('');
        return;
      }

      setIsProcessing(true);
      setError('');

      try {
        console.log('Input SVG:', inputSvg);
        console.log('Options:', options);
        const result = enhanceBrowserCompatibility(inputSvg, options);
        console.log('Result:', result);
        setEnhancedSvg(result.enhancedSvg);
        setReport(result.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
        console.error('SVG 처리 오류:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [options]
  );

  // 입력 변경 시 자동 처리 (디바운스)
  useEffect(() => {
    const timer = setTimeout(() => {
      processSvg(svgInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [svgInput, processSvg]);

  // 프리셋 로드
  const loadPreset = (presetKey: string) => {
    const preset = TEST_PRESETS[presetKey as keyof typeof TEST_PRESETS];
    if (preset) {
      setSvgInput(preset.svg);
    }
  };

  // 클립보드 복사
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((source: File | string) => {
    if (typeof source === 'string') {
      // URL이나 샘플 이미지인 경우 - SVG가 아닐 수 있으므로 처리 안함
      return;
    } else if (source.type === 'image/svg+xml' || source.name.endsWith('.svg')) {
      // SVG 파일인 경우 텍스트로 읽어서 처리
      const reader = new FileReader();
      reader.onload = (e) => {
        const svgContent = e.target?.result as string;
        setSvgInput(svgContent);
      };
      reader.readAsText(source);
    }
  }, []);

  // 코드 예제 생성
  const generateCodeExamples = () => {
    const basicCode = `import { enhanceBrowserCompatibility } from '@cp949/web-image-util';

// 기본 SVG 호환성 개선
const result = enhanceBrowserCompatibility(svgString, {
  addNamespaces: ${options.addNamespaces},
  fixDimensions: ${options.fixDimensions},
  modernizeSyntax: ${options.modernizeSyntax},
  addPreserveAspectRatio: ${options.addPreserveAspectRatio},
  preferResponsive: ${options.preferResponsive},
  ensureNonZeroViewport: ${options.ensureNonZeroViewport},
  mode: '${options.mode}'
});

console.log('개선된 SVG:', result.enhancedSvg);
console.log('리포트:', result.report);`;

    const advancedCode = `// 다양한 호환성 문제 한번에 해결
const problematicSvgs = [
  '<svg><circle cx="50" cy="50" r="20"/></svg>', // 네임스페이스 없음
  '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', // 크기 없음
  '<svg><use xlink:href="#icon"/></svg>' // 구식 xlink 문법
];

const enhancedSvgs = problematicSvgs.map(svg => {
  return enhanceBrowserCompatibility(svg, {
    addNamespaces: true,
    fixDimensions: true,
    modernizeSyntax: true,
    addPreserveAspectRatio: true,
    ensureNonZeroViewport: true
  });
});

console.log('모든 SVG가 호환성 문제 해결됨:', enhancedSvgs);`;

    return [
      {
        title: '기본 사용법',
        code: basicCode,
        language: 'typescript',
      },
      {
        title: '고급 사용법',
        code: advancedCode,
        language: 'typescript',
      },
    ];
  };

  // SVG 미리보기 컴포넌트
  const SvgPreview: React.FC<{ svgContent: string; title: string }> = ({ svgContent }) => {
    const [previewError, setPreviewError] = useState<string>('');

    useEffect(() => {
      setPreviewError('');
    }, [svgContent]);

    if (!svgContent.trim()) {
      return (
        <Box
          sx={{
            border: '2px dashed #ccc',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            bgcolor: '#f9f9f9',
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="textSecondary">
            SVG를 입력해주세요
          </Typography>
        </Box>
      );
    }

    try {
      return (
        <Box
          sx={{
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            p: 2,
            bgcolor: '#fff',
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: svgContent }} />
          <Chip label="✓ 렌더링 성공" size="small" color="success" sx={{ position: 'absolute', top: 8, right: 8 }} />
        </Box>
      );
    } catch (err) {
      return (
        <Box
          sx={{
            border: '2px solid #f44336',
            borderRadius: 2,
            p: 2,
            bgcolor: '#ffebee',
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="error">
            ❌ 렌더링 오류: {previewError || '유효하지 않은 SVG'}
          </Typography>
        </Box>
      );
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h3" component="h1" gutterBottom>
        SVG 호환성 개선
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        브라우저 간 SVG 호환성 문제를 실시간으로 해결해보세요. 네임스페이스, 크기 정보, 현대적 문법 등을 자동으로
        개선합니다.
      </Typography>

      <Grid container spacing={4}>
        {/* 좌측: 입력 및 옵션 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            {/* SVG 파일 업로더 */}
            <ImageUploader
              onImageSelect={handleFileSelect}
              supportedFormats={['svg']}
              maxSize={1} // SVG는 보통 작으므로 1MB 제한
            />

            {/* 테스트 케이스 프리셋 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  테스트 케이스 프리셋
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(TEST_PRESETS).map(([key, preset]) => (
                    <Button
                      key={key}
                      variant="outlined"
                      size="small"
                      onClick={() => loadPreset(key)}
                      fullWidth
                      sx={{ textAlign: 'left', justifyContent: 'flex-start' }}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* SVG 입력 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  SVG 코드 입력
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={svgInput}
                  onChange={(e) => setSvgInput(e.target.value)}
                  placeholder="<svg>...</svg>"
                  variant="outlined"
                  sx={{ mb: 2, fontFamily: 'monospace' }}
                />
                <Stack direction="row" spacing={1}>
                  <Button startIcon={<Clear />} onClick={() => setSvgInput('')} size="small" variant="outlined">
                    지우기
                  </Button>
                  <Button startIcon={<Refresh />} onClick={() => processSvg(svgInput)} size="small" variant="contained">
                    재처리
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* 옵션 설정 */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  호환성 개선 옵션
                </Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.addNamespaces ?? true}
                        onChange={(e) => setOptions({ ...options, addNamespaces: e.target.checked })}
                      />
                    }
                    label="네임스페이스 추가"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.fixDimensions ?? true}
                        onChange={(e) => setOptions({ ...options, fixDimensions: e.target.checked })}
                      />
                    }
                    label="크기 정보 수정"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.modernizeSyntax ?? true}
                        onChange={(e) => setOptions({ ...options, modernizeSyntax: e.target.checked })}
                      />
                    }
                    label="구문 현대화 (xlink → href)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.addPreserveAspectRatio ?? true}
                        onChange={(e) => setOptions({ ...options, addPreserveAspectRatio: e.target.checked })}
                      />
                    }
                    label="preserveAspectRatio 추가"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.preferResponsive ?? true}
                        onChange={(e) => setOptions({ ...options, preferResponsive: e.target.checked })}
                      />
                    }
                    label="반응형 우선 (width/height 주입 최소화)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.ensureNonZeroViewport ?? true}
                        onChange={(e) => setOptions({ ...options, ensureNonZeroViewport: e.target.checked })}
                      />
                    }
                    label="0×0 렌더링 방지 (width/height 자동 주입)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={options.enableHeuristicBBox ?? true}
                        onChange={(e) => setOptions({ ...options, enableHeuristicBBox: e.target.checked })}
                      />
                    }
                    label="휴리스틱 BBox 계산 활성화"
                  />
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  고급 옵션
                </Typography>
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>viewBox 처리 모드</InputLabel>
                    <Select
                      value={options.mode || 'preserve-framing'}
                      label="viewBox 처리 모드"
                      onChange={(e) =>
                        setOptions({ ...options, mode: e.target.value as 'preserve-framing' | 'fit-content' })
                      }
                    >
                      <MenuItem value="preserve-framing">Preserve Framing (기본)</MenuItem>
                      <MenuItem value="fit-content">Fit Content (콘텐츠에 맞춤)</MenuItem>
                    </Select>
                  </FormControl>

                  {options.mode === 'fit-content' && (
                    <TextField
                      fullWidth
                      label="패딩 비율 (%)"
                      type="number"
                      size="small"
                      value={(options.paddingPercent || 0) * 100}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          paddingPercent: (parseFloat(e.target.value) || 0) / 100,
                        })
                      }
                      slotProps={{
                        htmlInput: { min: 0, max: 50, step: 1 },
                      }}
                      helperText="fit-content 모드에서 콘텐츠 주변 여백"
                    />
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* 우측: 결과 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {/* 처리 상태 */}
            {isProcessing && <LinearProgress />}

            {/* 에러 표시 */}
            {error && <Alert severity="error">{error}</Alert>}

            {/* 성능 정보 */}
            {report && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    처리 결과
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Speed color="primary" />
                        <Typography variant="caption" display="block">
                          처리 시간
                        </Typography>
                        <Typography variant="h6">{report.processingTimeMs.toFixed(2)}ms</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Memory color="primary" />
                        <Typography variant="caption" display="block">
                          코드 크기
                        </Typography>
                        <Typography variant="body2">
                          {svgInput.length} → {enhancedSvg.length}자
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <CheckCircle color="success" />
                        <Typography variant="caption" display="block">
                          네임스페이스
                        </Typography>
                        <Typography variant="body2">
                          {report.addedNamespaces.length > 0 ? report.addedNamespaces.join(', ') : '없음'}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Warning color="warning" />
                        <Typography variant="caption" display="block">
                          경고
                        </Typography>
                        <Typography variant="body2">{report.warnings.length}개</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* 개선 내역 */}
            {report && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    호환성 개선 내역
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="subtitle2">크기 정보 수정:</Typography>
                      <Chip
                        label={report.fixedDimensions ? '수정됨' : '필요없음'}
                        color={report.fixedDimensions ? 'success' : 'default'}
                        size="small"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="subtitle2">현대화된 구문:</Typography>
                      <Chip
                        label={`${report.modernizedSyntax}개 항목`}
                        color={report.modernizedSyntax > 0 ? 'info' : 'default'}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                  {report.warnings.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="warning.main">
                        경고사항:
                      </Typography>
                      {report.warnings.map((warning, index) => (
                        <Alert key={index} severity="warning" sx={{ mt: 1 }}>
                          {warning}
                        </Alert>
                      ))}
                    </Box>
                  )}
                  {report.infos && report.infos.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="info.main">
                        처리 정보:
                      </Typography>
                      {report.infos.map((info, index) => (
                        <Alert key={index} severity="info" sx={{ mt: 1 }}>
                          {info}
                        </Alert>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 코드 예제 */}
            {svgInput && <CodeSnippet title="현재 설정의 코드 예제" examples={generateCodeExamples()} />}

            {/* 코드 비교 */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">원본 SVG</Typography>
                      <Tooltip title="복사">
                        <IconButton size="small" onClick={() => copyToClipboard(svgInput)}>
                          <ContentCopy />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: '#f5f5f5',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        maxHeight: 200,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {svgInput || '코드를 입력하세요'}
                    </Paper>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">개선된 SVG</Typography>
                      <Tooltip title="복사">
                        <IconButton size="small" onClick={() => copyToClipboard(enhancedSvg)} disabled={!enhancedSvg}>
                          <ContentCopy />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: enhancedSvg ? '#e8f5e8' : '#f5f5f5',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        maxHeight: 200,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {enhancedSvg || '개선된 코드가 여기 표시됩니다'}
                    </Paper>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* 시각적 비교 */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      원본 미리보기
                    </Typography>
                    <SvgPreview svgContent={svgInput} title="원본" />
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      개선된 미리보기
                    </Typography>
                    <SvgPreview svgContent={enhancedSvg} title="개선" />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}

export default SvgCompatibilityPage;
