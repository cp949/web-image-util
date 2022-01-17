import { Images } from "@cp949/web-image-util";
import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    Grid,
    Radio,
    RadioGroup,
    SxProps,
    Typography,
} from "@mui/material";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import DemoResizer from "./DemoResizer";
import { SAMPLE_SVG } from "./sample-svg";

const rootSx: SxProps = {
    p: 4,
    "& .DemoMain-section": {
        border: "1px solid #eee",
        "& .DemoMain-sectionTitle": {
            fontSize: "0.8rem",
            fontWeight: 700,
            backgroundColor: "#eee",
            py: 0.5,
            px: 1,
            textAlign: "center",
            color: "primary.main",
        },

        "& .DemoMain-imageBox": {
            display: "flex",
            justifyContent: "center",
            flexDirection: "column",
            alignItems: "center",
            p: 1,
            "& img": {
                border: "1px solid blue",
                // width: "100%",
                // height: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                maxWidth: 400,
                maxHeight: 400,
            },
        },
    },
};

const SAMPLE_URL = "https://aicodingblock.kt.co.kr/aimk-server/p/file/download/oi_i_v01_1031114_76x86_svg.svg";
export default function DemoMain() {
    const rootRef = useRef<HTMLDivElement>();
    const [sourceElement, setSourceElement] = useState<HTMLImageElement>();
    const [editingText, setEditingText] = useState<string>(SAMPLE_SVG);
    const [editingUrl, setEditingUrl] = useState<string>(SAMPLE_URL);
    const [svgXml, setSvgXml] = useState<string>();
    const [selectedFile, setSelectedFile] = useState<File>();
    const [selectedUrl, setSelectedUrl] = useState<string>(SAMPLE_URL);
    const [sourceType, setSourceType] = useState<"file" | "svg" | "url">("url");

    const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target?.files?.[0];
        setSelectedFile(file);
    }, []);

    useEffect(() => {
        if (sourceType === "file" && selectedFile) {
            Images.toImageElement(selectedFile).then(setSourceElement);
        } else if (sourceType === "svg" && svgXml && svgXml.length > 0) {
            Images.toImageElement(svgXml, {
                crossOrigin: "Anonymous",
            }).then((img) => {
                setSourceElement(img);
            });
        } else if (sourceType === "url" && selectedUrl && selectedUrl.length > 0) {
            Images.toImageElement(selectedUrl, {
                crossOrigin: "Anonymous",
            }).then((img) => {
                setSourceElement(img);
            });
        } else {
            setSourceElement(undefined);
        }
    }, [sourceType, selectedFile, selectedUrl, svgXml]);

    return (
        <Box ref={rootRef} sx={rootSx}>
            <Grid container sx={{ mb: 4 }} columnSpacing={2}>
                <Grid item xs={12} md={6}>
                    <Box className="DemoMain-section" sx={{ minHeight: 400 }}>
                        <Typography variant="subtitle1" className="DemoMain-sectionTitle">
                            원본 이미지
                        </Typography>
                        <Box sx={{ p: 2 }}>
                            <Box sx={{ mb: 2 }}>
                                <FormControl component="fieldset">
                                    <RadioGroup
                                        row
                                        aria-label="source type"
                                        value={sourceType}
                                        onChange={(e) => setSourceType(e.target.value as "file" | "svg" | "url")}
                                        name="image-source-type-group"
                                    >
                                        <FormControlLabel value="file" control={<Radio />} label="File" />
                                        <FormControlLabel value="svg" control={<Radio />} label="SVG XML" />
                                        <FormControlLabel value="url" control={<Radio />} label="URL" />
                                    </RadioGroup>
                                </FormControl>
                            </Box>
                            {sourceType === "file" && (
                                <>
                                    <Box
                                        component="input"
                                        type="file"
                                        onChange={handleFileChange}
                                        sx={{ display: "block" }}
                                    />

                                    {selectedFile && (
                                        <Box
                                            sx={{
                                                mt: 2,
                                                "& span": {
                                                    color: "#888",
                                                    display: "inline-block",
                                                    minWidth: 90,
                                                },
                                            }}
                                        >
                                            <Box>
                                                <span>fileName: </span> {selectedFile.name}
                                            </Box>
                                            <Box>
                                                <span>fileSize: </span> {selectedFile.size} bytes
                                            </Box>
                                            <Box>
                                                <span>fileType: </span>
                                                {selectedFile.type}
                                            </Box>
                                        </Box>
                                    )}
                                </>
                            )}

                            {sourceType === "svg" && (
                                <>
                                    <Box
                                        component="textarea"
                                        sx={{ width: "100%", height: 250, mt: 1 }}
                                        value={editingText ?? ""}
                                        onChange={(e: any) => {
                                            setEditingText((e as ChangeEvent<HTMLTextAreaElement>).target.value);
                                        }}
                                    />
                                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                        <Button variant="outlined" size="small" onClick={() => setSvgXml(editingText)}>
                                            적용
                                        </Button>
                                    </Box>
                                </>
                            )}

                            {sourceType === "url" && (
                                <>
                                    <Box
                                        component="textarea"
                                        sx={{ width: "100%", height: 250, mt: 1 }}
                                        value={selectedUrl ?? ""}
                                        onChange={(e: any) => {
                                            setEditingUrl((e as ChangeEvent<HTMLTextAreaElement>).target.value);
                                        }}
                                    />
                                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => setSelectedUrl(editingUrl)}
                                        >
                                            적용
                                        </Button>
                                    </Box>
                                </>
                            )}
                        </Box>
                    </Box>
                </Grid>

                <Grid item xs={12} md={6} sx={{ alignSelf: "stretch" }}>
                    <Box className="DemoMain-section" sx={{ height: "100%" }}>
                        <Typography variant="subtitle1" className="DemoMain-sectionTitle">
                            선택된 이미지
                        </Typography>
                        <Box className="DemoMain-imageBox">
                            {sourceElement && (
                                <>
                                    <Box component="img" src={sourceElement.src} />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        sx={{ mt: 2 }}
                                        onClick={() => {
                                            Images.download(sourceElement.src ?? "", "다운로드.png");
                                        }}
                                    >
                                        다운로드 {`${sourceElement.width}x${sourceElement.height}`}
                                    </Button>
                                </>
                            )}
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <Grid container columnSpacing={3} rowSpacing={5}>
                <Grid item xs={12}>
                    <Box className="DemoMain-section">
                        <Typography variant="subtitle1" className="DemoMain-sectionTitle">
                            Resize
                        </Typography>
                        {sourceElement && <DemoResizer img={sourceElement} className="DemoMain-scaleImage" />}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
