import { Images } from "@cp949/web-image-util";
import { Container, Box, Button, Stack, SxProps } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

const SRC_SMALL = "/sample-200x150.png";
const SRC_LARGE = "/sample-600x450.png";

const IMAGE_BG_COLOR = "#ddd";

const BOX_WIDTH = 300;
const BOX_HEIGHT = 300;

const rootSx: SxProps = {
    "& .DemoCenterCrop-title": {
        fontSize: "2rem",
        fontWeight: 900,
        textAlign: "center",
        mb: 1,
        mt: 4,
    },
    "& .DemoCenterCrop-sectionHeader": {
        background: "#f0f0f0",
        color: "primary.main",
        textAlign: "center",
        py: 1,
        fontSize: "1rem",
    },
    "& .DemoCenterCrop-sectionImageInfo": {
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
    "& .DemoCenterCrop-sectionImageBox": {
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
};
export default function DemoCenterCrop() {
    const [smallImage, setSmallImage] = useState<HTMLImageElement>();
    const [largeImage, setLargeImage] = useState<HTMLImageElement>();

    const loadImages = useCallback(async () => {
        // 박스보다 큰 이미지
        Images.resizeFrom(SRC_SMALL)
            .centerCrop({
                size: { width: BOX_WIDTH, height: BOX_HEIGHT },
                backgroundColor: IMAGE_BG_COLOR,
            })
            .toElement("png")
            .then(setSmallImage);

        // 박스보다 큰 이미지
        Images.resizeFrom(SRC_LARGE)
            .centerCrop({
                size: { width: BOX_WIDTH, height: BOX_HEIGHT },
                backgroundColor: IMAGE_BG_COLOR,
            })
            .toElement("png")
            .then(setLargeImage);
    }, []);
    useEffect(() => {
        loadImages();
    }, [loadImages]);

    return (
        <Box className="DemoCenterCrop-root" sx={rootSx}>
            <Box className="DemoCenterCrop-title">Center Crop</Box>

            <Container maxWidth="md" fixed>
                <Stack direction="row">
                    <Box flex={1}>
                        <Box className="DemoCenterCrop-sectionHeader">박스보다 작은 이미지</Box>
                        <Box className="DemoCenterCrop-sectionImageInfo">
                            <div>
                                <span>Original</span> 200 x 150
                            </div>
                            <div>
                                <span>Box(Red)</span> {BOX_WIDTH} x {BOX_HEIGHT}
                            </div>
                            <Box sx={{ color: "secondary.main", fontWeight: 700 }}>
                                <span>Result(Blue)</span> {smallImage?.width} x {smallImage?.height}
                            </Box>
                            <div>
                                <span>Image Bg</span> {IMAGE_BG_COLOR}
                            </div>
                        </Box>

                        <Box className="DemoCenterCrop-sectionImageBox">
                            <Box component="img" src={smallImage?.src} />
                        </Box>
                        <Box sx={{ my: 2, textAlign: "center" }}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    smallImage && Images.download(smallImage, "sample.png");
                                }}
                            >
                                다운로드
                            </Button>
                        </Box>
                    </Box>
                    <Box flex={1}>
                        <Box className="DemoCenterCrop-sectionHeader">박스보다 큰 이미지</Box>
                        <Box className="DemoCenterCrop-sectionImageInfo">
                            <div>
                                <span>Original</span> 600 x 450
                            </div>
                            <div>
                                <span>Box(Red)</span> {BOX_WIDTH} x {BOX_HEIGHT}
                            </div>
                            <Box sx={{ color: "secondary.main", fontWeight: 700 }}>
                                <span>Result(Blue)</span> {largeImage?.width} x {largeImage?.height}
                            </Box>
                            <div>
                                <span>Image Bg</span> {IMAGE_BG_COLOR}
                            </div>
                        </Box>
                        <Box className="DemoCenterCrop-sectionImageBox">
                            <Box component="img" src={largeImage?.src} />
                        </Box>
                        <Box sx={{ my: 2, textAlign: "center" }}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    largeImage && Images.download(largeImage, "sample.png");
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
