import { Box, Slider } from '@mui/material'
import React, { HTMLProps, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'react-use'

type Props = HTMLProps<HTMLCanvasElement> & {
    onChangeSize: (scale: number) => void
}

const SampleCanvas = React.forwardRef<HTMLCanvasElement, Props>((props, ref) => {
    const { onChangeSize, width = 600, height = 300, ...restProps } = props
    const onChangeSizeRef = useRef<any>()
    onChangeSizeRef.current = onChangeSize
    const [scale, setScale] = useState<number>(1)

    const [debouncedBufferSize, setDebouncedBufferSize] = useState(scale)
    useDebounce(
        () => {
            setDebouncedBufferSize(scale)
        },
        50,
        [scale],
    )

    useEffect(() => {
        onChangeSizeRef.current?.(debouncedBufferSize)
    }, [debouncedBufferSize])

    return (
        <Box>
            <Box
                sx={{
                    '& .SampleCanvas-sliderBox': {
                        display: 'flex',
                        alignItems: 'center',
                        mx: 2,
                        '& .SampleCanvas-sliderLabel': {
                            display: 'inline-block',
                            minWidth: 60,
                            color: '#555',
                        },
                        '& .MuiSlider-root': {
                            flex: 1,
                        },
                        '& .SampleCanvas-sliderValue': {
                            display: 'inline-block',
                            ml: 1,
                            color: '#555',
                        },
                    },
                }}
            >
                <Box className="SampleCanvas-sliderBox">
                    <span className="SampleCanvas-sliderLabel">Scale</span>
                    <Slider
                        aria-label="Small steps"
                        step={0.01}
                        marks
                        min={0.01}
                        value={scale}
                        onChange={(e, v) => {
                            setScale(v as number)
                        }}
                        max={2}
                        valueLabelDisplay="auto"
                    />
                    <span className="SampleCanvas-sliderValue">{scale}</span>
                </Box>
            </Box>
            <canvas ref={ref} width={width} height={height} {...restProps}></canvas>
        </Box>
    )
})

export default SampleCanvas
