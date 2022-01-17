import {
    Box,
    Button,
    ButtonBase,
    ButtonBaseProps,
    Checkbox,
    FormControl,
    FormControlLabel,
    Grid,
    Radio,
    RadioGroup,
    Slider,
    SxProps,
    Tooltip,
} from "@mui/material";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Images, ImagePaddingType } from "@cp949/web-image-util";

const COLOR_RED = "#f00";
const COLOR_WHITE = "#fff";
const COLOR_BLACK = "#000";
const COLOR_GRAY = "#ccc";
const COLOR_TRANSPARENT = "transparent";

function getPadding(padding: ImagePaddingType): number {
    if (!padding) return 0;
    if (typeof padding === "number") {
        return padding;
    }
    return padding.top;
}

const rootSx: SxProps = {
    "& .ResizeImage-sliderBox": {
        display: "flex",
        alignItems: "center",
        mx: 2,
        "& .ResizeImage-sliderLabel": {
            display: "inline-block",
            minWidth: 100,
            color: "#555",
        },
        "& .MuiSlider-root": {
            flex: 1,
        },
        "& .ResizeImage-sliderValue": {
            display: "inline-block",
            ml: 3,
            minWidth: 100,
            fontWeight: 600,
            color: "secondary.main",
        },
    },
};

type Props = {
    className?: string;
    img: HTMLImageElement;
};

type CustomScaleType = "centerInside" | "centerCrop" | "fit" | "fill" | "noChange";
type ImageResizeOptions = {
    backgroundColor?: string;
    crossOrigin?: "Anonymous";
    padding: number;
    quality: number;
    size?: {
        width: number;
        height: number;
    };
    trim: boolean;
    scale: number;
};

const ColorBox = ({
    color,
    sx,
    selected,
    ...restProps
}: { color: string; selected: boolean } & Omit<ButtonBaseProps, "component">) => {
    return (
        <Tooltip title={color}>
            <ButtonBase
                component="span"
                {...restProps}
                sx={[
                    {
                        display: "inline-block",
                        width: 20,
                        height: 20,
                        borderRadius: 1,
                        border: selected ? "3px solid #000" : "1px solid #888",
                        backgroundColor: color,
                    },
                    ...(Array.isArray(sx) ? sx : [sx ?? false]),
                ]}
            />
        </Tooltip>
    );
};

export default function DemoResizer(props: Props) {
    const { className, img } = props;
    const [resizedImg, setResizedImg] = useState<HTMLImageElement>();
    const [format, setFormat] = useState<"png" | "jpeg">("png");
    const [scaleType, setScaleType] = useState<CustomScaleType>("centerInside");

    const [options, setOptions] = useState<Omit<ImageResizeOptions, "scaleType">>({
        backgroundColor: COLOR_GRAY,
        crossOrigin: "Anonymous",
        padding: 0,
        quality: 1,
        size: {
            width: 300,
            height: 300,
        },
        trim: false,
        scale: 1,
    });

    const loadImage = useCallback(
        async (
            img: HTMLImageElement,
            scaleType: CustomScaleType,
            format: "png" | "jpeg",
            options: Omit<ImageResizeOptions, "scaleType">
        ) => {
            if (scaleType === "noChange") {
                setResizedImg(
                    await Images.resizeFrom(img)
                        .centerCrop({
                            padding: options.padding,
                            crossOrigin: options.crossOrigin,
                            backgroundColor: options.backgroundColor,
                            quality: options.quality,
                            scale: options.scale,
                        })
                        .toElement(format)
                );
                return;
            }

            const opts = { ...options, scaleType };
            if (opts.scaleType === "centerInside") {
                setResizedImg(
                    await Images.resizeFrom(img)
                        .centerInside({
                            padding: options.padding,
                            crossOrigin: options.crossOrigin,
                            backgroundColor: options.backgroundColor,
                            quality: options.quality,
                            size: options.size,
                            trim: options.trim,
                            scale: options.scale,
                        })
                        .toElement(format)
                );
            } else if (opts.scaleType === "centerCrop") {
                setResizedImg(
                    await Images.resizeFrom(img)
                        .centerCrop({
                            padding: options.padding,
                            crossOrigin: options.crossOrigin,
                            backgroundColor: options.backgroundColor,
                            quality: options.quality,
                            size: options.size,
                            scale: options.scale,
                        })
                        .toElement(format)
                );
            } else if (opts.scaleType === "fit") {
                setResizedImg(
                    await Images.resizeFrom(img)
                        .fit({
                            padding: options.padding,
                            crossOrigin: options.crossOrigin,
                            backgroundColor: options.backgroundColor,
                            quality: options.quality,
                            size: options.size,
                            scale: options.scale,
                        })
                        .toElement(format)
                );
            } else if (opts.scaleType === "fill") {
                setResizedImg(
                    await Images.resizeFrom(img)
                        .fill({
                            padding: options.padding,
                            crossOrigin: options.crossOrigin,
                            backgroundColor: options.backgroundColor,
                            quality: options.quality,
                            size: options.size,
                            scale: options.scale,
                        })
                        .toElement(format)
                );
            }
        },
        []
    );

    useEffect(() => {
        if (!img) return;

        loadImage(img, scaleType, format, options);
    }, [img, loadImage, scaleType, format, options]);

    return (
        <Box component="section" sx={rootSx} className={clsx("ResizeImage-root", className)}>
            <Grid container>
                <Grid item xs={12} md={options.size ? 6 : 12}>
                    <Box sx={{ p: 2 }}>
                        <Box>
                            <FormControl component="fieldset">
                                <RadioGroup
                                    row
                                    aria-label="scale type"
                                    value={scaleType}
                                    onChange={(e) => setScaleType(e.target.value as CustomScaleType)}
                                    name="row-radio-buttons-group"
                                >
                                    <FormControlLabel value="noChange" control={<Radio />} label="Not Change" />
                                    <FormControlLabel value="centerInside" control={<Radio />} label="Center inside" />
                                    <FormControlLabel value="centerCrop" control={<Radio />} label="Center crop" />
                                    <FormControlLabel value="fit" control={<Radio />} label="Fit" />
                                    <FormControlLabel value="fill" control={<Radio />} label="Fill" />
                                </RadioGroup>
                            </FormControl>
                        </Box>

                        <Box>
                            <FormControl component="fieldset">
                                <RadioGroup
                                    row
                                    aria-label="scale type"
                                    value={format}
                                    onChange={(e) => setFormat(e.target.value as "png" | "jpeg")}
                                >
                                    <FormControlLabel value="png" control={<Radio />} label="png" />
                                    <FormControlLabel value="jpeg" control={<Radio />} label="jpeg" />
                                </RadioGroup>
                            </FormControl>
                        </Box>
                        <Box>
                            <FormControlLabel
                                label="크기 지정"
                                disabled={scaleType === "noChange"}
                                control={
                                    <Checkbox
                                        checked={!!options.size}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            if (checked) {
                                                setOptions((p) => ({
                                                    ...p,
                                                    size: { width: 300, height: 300 },
                                                }));
                                            } else {
                                                setOptions((p) => ({ ...p, size: undefined }));
                                            }
                                        }}
                                    />
                                }
                            />
                        </Box>
                        <Box>
                            <Box className="ResizeImage-sliderBox">
                                <span className="ResizeImage-sliderLabel">최대 너비</span>

                                <Slider
                                    step={1}
                                    min={1}
                                    max={800}
                                    disabled={!options.size || scaleType === "noChange"}
                                    value={options.size?.width ?? 300}
                                    onChange={(e, v) => {
                                        setOptions((p) => {
                                            const size = {
                                                height: p.size?.height ?? 0,
                                                width: v as number,
                                            };
                                            return {
                                                ...p,
                                                size,
                                            };
                                        });
                                    }}
                                    valueLabelDisplay="auto"
                                />
                                <span className="ResizeImage-sliderValue">{options.size?.width}</span>
                            </Box>
                        </Box>

                        <Box>
                            <Box className="ResizeImage-sliderBox">
                                <span className="ResizeImage-sliderLabel">최대 높이</span>

                                <Slider
                                    step={1}
                                    min={1}
                                    max={800}
                                    disabled={!options.size || scaleType === "noChange"}
                                    value={options.size?.height ?? 300}
                                    onChange={(e, v) => {
                                        setOptions((p) => {
                                            const size = {
                                                width: p.size?.width ?? 0,
                                                height: v as number,
                                            };
                                            return {
                                                ...p,
                                                size,
                                            };
                                        });
                                    }}
                                    valueLabelDisplay="auto"
                                />
                                <span className="ResizeImage-sliderValue">{options.size?.height}</span>
                            </Box>
                        </Box>
                        <Box>
                            <Box className="ResizeImage-sliderBox">
                                <span className="ResizeImage-sliderLabel">Scale</span>
                                <Slider
                                    aria-label="Scale steps"
                                    step={0.2}
                                    min={0}
                                    disabled={!!options.size}
                                    max={10}
                                    value={options.scale ?? 1}
                                    onChange={(e, v) => {
                                        setOptions((p) => ({
                                            ...p,
                                            scale: v as number,
                                        }));
                                    }}
                                    valueLabelDisplay="auto"
                                />
                                <span className="ResizeImage-sliderValue">{options.scale}</span>
                            </Box>
                        </Box>
                        <Box>
                            <Box className="ResizeImage-sliderBox">
                                <span className="ResizeImage-sliderLabel">Quality</span>
                                <Slider
                                    aria-label="Quality steps"
                                    step={0.1}
                                    marks
                                    min={0}
                                    max={1}
                                    value={options.quality ?? 1}
                                    onChange={(e, v) => {
                                        setOptions((p) => ({
                                            ...p,
                                            quality: v as number,
                                        }));
                                    }}
                                    valueLabelDisplay="auto"
                                />
                                <span className="ResizeImage-sliderValue">{options.quality}</span>
                            </Box>
                        </Box>

                        <Box>
                            <Box className="ResizeImage-sliderBox">
                                <span className="ResizeImage-sliderLabel">Padding</span>
                                <Slider
                                    aria-label="Small steps"
                                    step={1}
                                    min={0}
                                    max={30}
                                    value={getPadding(options.padding)}
                                    onChange={(e, v) => {
                                        setOptions((p) => ({
                                            ...p,
                                            padding: v as number,
                                        }));
                                    }}
                                    valueLabelDisplay="auto"
                                />
                                <span className="ResizeImage-sliderValue">{options.padding}</span>
                            </Box>
                        </Box>
                        <Box>
                            <FormControlLabel
                                label="TRIM"
                                disabled={scaleType !== "centerInside"}
                                control={
                                    <Checkbox
                                        checked={options.trim ?? false}
                                        onChange={(e) => setOptions((p) => ({ ...p, trim: e.target.checked }))}
                                    />
                                }
                            />
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center" }}>
                            배경색
                            {[COLOR_RED, COLOR_BLACK, COLOR_GRAY, COLOR_WHITE, COLOR_TRANSPARENT].map((c) => (
                                <ColorBox
                                    color={c}
                                    key={c}
                                    selected={options.backgroundColor === c}
                                    sx={{ m: 0.5 }}
                                    onClick={() => setOptions((p) => ({ ...p, backgroundColor: c }))}
                                />
                            ))}
                        </Box>

                        <Box sx={{ p: 2, display: "flex" }}>
                            <span>config = </span>
                            <Box sx={{ ml: 1, flex: 1, whiteSpace: "pre-wrap" }}>
                                {JSON.stringify(options, null, 4)}
                            </Box>
                        </Box>
                    </Box>
                </Grid>
                <Grid item xs={12} md={options.size && scaleType !== "noChange" ? 6 : 12}>
                    {resizedImg && (
                        <Box
                            sx={{
                                mx: 2,
                                my: 1,
                                textAlign: "center",
                            }}
                        >
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => Images.download(resizedImg.src, "다운로드.png")}
                            >
                                다운로드
                            </Button>
                        </Box>
                    )}
                    {resizedImg && (
                        <Box
                            sx={{
                                textAlign: "center",
                                my: 2,
                                color: "secondary.main",
                                "& span": {
                                    color: "#aaa",
                                },
                            }}
                        >
                            <span>조정된 이미지 크기</span> {resizedImg.width}x{resizedImg.height}
                        </Box>
                    )}

                    <Box
                        sx={{
                            width: options.size?.width ?? "100%",
                            outline: "1px dashed red",
                            display: "flex",
                            margin: "auto",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <Box
                            component="img"
                            src={resizedImg?.src}
                            sx={{
                                outline: "1px dashed blue",
                                width: resizedImg?.width ?? "auto",
                                height: resizedImg?.height ?? "auto",
                            }}
                        />
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
