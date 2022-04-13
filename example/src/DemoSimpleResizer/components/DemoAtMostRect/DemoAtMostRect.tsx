import { Images } from "@cp949/web-image-util";
import { Slider, Box, Grid, Typography } from "@mui/material";
import { useState, ChangeEvent, useCallback, useEffect } from "react";
import { rootSx } from "./style";

export default function DemoAtMostRect() {
    const [size, setSize] = useState({ width: 100, height: 100 });
    const [selectedFile, setSelectedFile] = useState<File>();
    const [sourceElement, setSourceElement] = useState<HTMLImageElement>();
    const [resultElement, setResultElement] = useState<HTMLImageElement>();

    const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target?.files?.[0];
        setSelectedFile(file);
    }, []);

    useEffect(() => {
        if (selectedFile) {
            Images.toElement(selectedFile).then(setSourceElement);
        }
    }, [selectedFile]);

    useEffect(() => {
        if (sourceElement) {
            Images.simpleResizer
                .atMostRect(sourceElement, size)
                .then((it) => it.toElement("png"))
                .then(setResultElement);
        }
    }, [sourceElement, size]);

    return (
        <Box className="DemoAtMostRect-root" sx={[rootSx]}>
            <Box sx={{ py: 1 }}>
                <Typography variant="h5">Demo Images.simpleResizer.atMostRect()</Typography>
            </Box>
            <Grid container columnSpacing={2}>
                <Grid item xs={12} md={4}>
                    <Box>
                        <Box className="DemoAtMostRect-sliderBox">
                            <span className="DemoAtMostRect-sliderLabel">최대 너비</span>

                            <Slider
                                step={1}
                                min={1}
                                max={800}
                                value={size.width}
                                onChange={(_, v) => {
                                    setSize((p) => ({ ...p, width: v as number }));
                                }}
                                valueLabelDisplay="auto"
                            />
                            <span className="DemoAtMostRect-sliderValue">{size.width}</span>
                        </Box>
                    </Box>
                    <Box>
                        <Box className="DemoAtMostRect-sliderBox">
                            <span className="DemoAtMostRect-sliderLabel">최대 높이</span>

                            <Slider
                                step={1}
                                min={1}
                                max={800}
                                value={size.height}
                                onChange={(_, v) => {
                                    setSize((p) => ({ ...p, height: v as number }));
                                }}
                                valueLabelDisplay="auto"
                            />
                            <span className="DemoAtMostRect-sliderValue">{size.height}</span>
                        </Box>
                    </Box>
                </Grid>
                <Grid item xs={12} md={8}>
                    <Box>
                        <Box component="input" type="file" onChange={handleFileChange} sx={{ display: "block" }} />
                        <Box>
                            {sourceElement && (
                                <Box>
                                    {sourceElement.width}x{sourceElement.height}
                                </Box>
                            )}
                        </Box>
                        <Box>
                            {resultElement && (
                                <Box
                                    sx={{
                                        border: "1px solid red",
                                    }}
                                    component="img"
                                    src={resultElement.src}
                                />
                            )}
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
