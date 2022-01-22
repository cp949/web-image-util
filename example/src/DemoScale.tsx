import { Images } from "@cp949/web-image-util";
import { Box, Button, Container, Slider, Stack, SxProps } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

const IMAGE_BG_COLOR = "#ddd";

const BOX_WIDTH = 300;
const BOX_HEIGHT = 300;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 23.88 22" width="23.88" height="22"><defs><linearGradient id="a" x1="11.82" y1="8.78" x2="17.29" y2="16.62" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#ff8c82"/><stop offset="0.98" stop-color="#f9eaff"/></linearGradient><radialGradient id="b" cx="17" cy="9" r="4.71" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#ff5aab"/><stop offset="0.98" stop-color="#f973ff" stop-opacity="0"/></radialGradient><radialGradient id="c" cx="7" r="4.71" xlink:href="#b"/><linearGradient id="d" x1="11.52" y1="9.89" x2="10.31" y2="9.58" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-opacity="0.3"/><stop offset="0.98" stop-opacity="0"/></linearGradient></defs><title>game_heart_on</title><path d="M12,20.5a.48.48,0,0,1-.26-.07c-.37-.22-9.13-5.52-10.07-9.26A7.7,7.7,0,0,1,2.9,4.69,5.64,5.64,0,0,1,7.53,2.5,4.56,4.56,0,0,1,12,5.23,4.56,4.56,0,0,1,16.47,2.5,5.64,5.64,0,0,1,21.1,4.69a7.7,7.7,0,0,1,1.23,6.48c-.94,3.74-9.7,9-10.07,9.26A.48.48,0,0,1,12,20.5Z" fill="url(#a)"/><path d="M16.47,3c4.48,0,6.27,4.47,5.37,8.05S12,20,12,20s-8.95-5.37-9.84-8.95.89-8,5.37-8S12,7.45,12,7.47h0S12,3,16.47,3m0-1A5.06,5.06,0,0,0,12,4.19,5.06,5.06,0,0,0,7.53,2a6.14,6.14,0,0,0-5,2.38A8.22,8.22,0,0,0,1.19,11.3c1,3.86,9.34,9,10.3,9.56a1,1,0,0,0,1,0c1-.57,9.33-5.7,10.3-9.56A8.22,8.22,0,0,0,21.5,4.38a6.14,6.14,0,0,0-5-2.38Z" fill="#261010"/><path d="M20.87,10.81a6.24,6.24,0,0,0-.95-5.2A4.21,4.21,0,0,0,16.47,4,3.34,3.34,0,0,0,13,7.48a1,1,0,0,1-1,1h0a1,1,0,0,1-1-1A3.34,3.34,0,0,0,7.53,4,4.21,4.21,0,0,0,4.08,5.61a6.24,6.24,0,0,0-1,5.2c.55,2.2,5.53,5.94,8.87,8C15.34,16.75,20.32,13,20.87,10.81Z" fill="#ff5252"/><path d="M20.87,10.34c-.55,2.2-5.53,5.94-8.87,8-3.34-2.08-8.32-5.82-8.87-8A6.26,6.26,0,0,1,3,9.05a6.16,6.16,0,0,0,.18,1.76c.55,2.2,5.53,5.94,8.87,8,3.34-2.08,8.32-5.82,8.87-8a6.16,6.16,0,0,0,.18-1.76A6.26,6.26,0,0,1,20.87,10.34Z" fill="#ffe1ec"/><ellipse cx="15" cy="6" rx="1" ry="0.5" transform="translate(1.6 15.02) rotate(-55.76)" fill="#fff"/><path d="M14.63,4.5s-2.13,1-3.13,5L13,8.75Z" fill="#ff5252"/><ellipse cx="17" cy="9" rx="4" ry="5.33" opacity="0.61" fill="url(#b)"/><path d="M9.5,4.5S12,7,12,9l-1,1Z" fill="#ff5252"/><g opacity="0.15"><path d="M11,8h.17A1,1,0,0,1,11,7.48,3.78,3.78,0,0,0,9.8,4.73,6,6,0,0,0,3,9.09a6.21,6.21,0,0,0,.18,1.72,4.84,4.84,0,0,0,1,1.76C7.15,5.12,11,8,11,8Z" fill="#fff"/></g><g opacity="0.15"><path d="M5.15,13.62c.3.3.63.6,1,.9a10.28,10.28,0,0,1,5.29-6.25,1.62,1.62,0,0,1-.19-.18A8,8,0,0,0,5.15,13.62Z" fill="#fff"/></g><ellipse cx="7" cy="9" rx="4" ry="5.33" opacity="0.61" fill="url(#c)"/><ellipse cx="5" cy="6" rx="1" ry="0.5" transform="translate(-2.77 6.76) rotate(-55.76)" fill="#fff"/><ellipse cx="4.3" cy="8.3" rx="0.64" ry="0.5" transform="translate(-4.98 7.18) rotate(-55.76)" fill="#fff"/><path d="M11.88,8.13a9,9,0,0,0-.84,2.7L9,13l1.08-4.75L11,6Z" opacity="0.65" fill="url(#d)"/></svg>`;

const rootSx: SxProps = {
    minWidth: 1000,
    "& .DemoScale-title": {
        fontSize: "2rem",
        fontWeight: 900,
        textAlign: "center",
        mb: 1,
        mt: 4,
    },
    "& .DemoScale-sectionHeader": {
        background: "#f0f0f0",
        color: "primary.main",
        textAlign: "center",
        py: 1,
        fontSize: "1rem",
    },
    "& .DemoScale-sectionImageInfo": {
        mt: 1,
        fontSize: "0.8rem",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        "& > div + div": {},
        "& > div": {
            fontSize: "0.9rem",
            "& span": {
                fontSize: "0.75rem",
                display: "inline-block",
                minWidth: 100,
            },
            minWidth: 300,
        },
    },
    "& .DemoScale-sectionImageBox": {
        position: "relative",
        outline: "1px dashed red",
        color: "primary.main",
        textAlign: "center",

        width: 300,
        height: 300,
        mx: "auto",
        my: 2,
        "&::after": {
            postion: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 300,
            border: "1px dashed red",
        },
        "& img": {
            display: "block",
            margin: "auto",
            outline: "2px dashed blue",
        },
    },

    "& .DemoScale-sliderBox": {
        my: 2,
        textAlign: "center",
    },
};

// const SRC_SMALL = "/sample-200x150.png";

const SRC_SMALL = SVG;

export default function DemoScale() {
    const [image1, setImage1] = useState<HTMLImageElement>();
    const [image2, setImage2] = useState<HTMLImageElement>();
    const [scale1, setScale1] = useState(1);
    const [scale2, setScale2] = useState({ scaleX: 1, scaleY: 1 });

    const loadImages = useCallback(async () => {
        Images.resizeFrom(SRC_SMALL).scale(scale1).toElement("png").then(setImage1);
        Images.resizeFrom(SRC_SMALL).scale(scale2).toElement("png").then(setImage2);
    }, [scale1, scale2]);
    useEffect(() => {
        loadImages();
    }, [loadImages]);

    return (
        <Box className="DemoScale-root" sx={rootSx}>
            <Box className="DemoScale-title">JUST scale(DemoScale.tsx)</Box>
            <Container maxWidth="lg" fixed>
                <Stack direction="row">
                    <Box flex={1}>
                        <Box className="DemoScale-sectionHeader">Scale</Box>
                        <Box className="DemoScale-sectionImageInfo">
                            <Box sx={{ color: "secondary.main", fontWeight: 700 }}>
                                <span>Original</span> {image1?.width} x {image1?.height}
                            </Box>
                        </Box>
                        <Box className="DemoScale-sliderBox">
                            <Slider
                                aria-label="Scale steps"
                                step={0.2}
                                min={0}
                                max={5}
                                sx={{ maxWidth: 280 }}
                                value={scale1}
                                onChange={(e, v) => {
                                    setScale1(v as number);
                                }}
                                valueLabelDisplay="auto"
                            />
                        </Box>
                        <Box className="DemoScale-sectionImageBox">
                            <img src={image1?.src} alt="" />
                        </Box>
                        <Box sx={{ my: 2, textAlign: "center" }}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    image1 && Images.download(image1, "sample.png");
                                }}
                            >
                                다운로드
                            </Button>
                        </Box>
                    </Box>

                    <Box flex={1}>
                        <Box className="DemoScale-sectionHeader">ScaleX,Y</Box>
                        <Box className="DemoScale-sectionImageInfo">
                            <Box sx={{ color: "secondary.main", fontWeight: 700 }}>
                                <span>Scale</span> {scale1}
                            </Box>
                            <Box sx={{ color: "secondary.main", fontWeight: 700 }}>
                                <span>Result(Blue)</span> {image2?.width} x {image2?.height}
                            </Box>
                            <Box sx={{ color: "secondary.main", fontWeight: 700 }}>
                                <span>ScaleX</span> {scale2.scaleX}
                            </Box>
                            <Box sx={{ color: "secondary.main", fontWeight: 700 }}>
                                <span>ScaleY</span> {scale2.scaleY}
                            </Box>
                        </Box>
                        <Box>
                            <Box className="DemoScale-sliderBox">
                                <Slider
                                    aria-label="Scale steps"
                                    step={0.2}
                                    min={0}
                                    max={5}
                                    sx={{ maxWidth: 280 }}
                                    value={scale2.scaleX}
                                    onChange={(e, v) => {
                                        setScale2((p) => ({ ...p, scaleX: v as number }));
                                    }}
                                    valueLabelDisplay="auto"
                                />
                                <br />
                                <Slider
                                    aria-label="Scale steps"
                                    step={0.2}
                                    min={0}
                                    max={5}
                                    sx={{ maxWidth: 280 }}
                                    value={scale2.scaleY}
                                    onChange={(e, v) => {
                                        setScale2((p) => ({ ...p, scaleY: v as number }));
                                    }}
                                    valueLabelDisplay="auto"
                                />
                            </Box>
                        </Box>
                        <Box className="DemoScale-sectionImageBox">
                            <Box component="img" src={image2?.src} />
                        </Box>
                        <Box sx={{ my: 2, textAlign: "center" }}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    image2 && Images.download(image2, "sample.png");
                                }}
                            >
                                다운로드
                            </Button>
                        </Box>
                    </Box>
                </Stack>
            </Container>
        </Box>
    );
}
