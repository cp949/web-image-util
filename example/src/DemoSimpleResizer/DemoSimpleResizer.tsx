import { Box } from "@mui/material";
import DemoAtMostHeight from "./components/DemoAtMostHeight";
import DemoAtMostRect from "./components/DemoAtMostRect";
import DemoAtMostWidth from "./components/DemoAtMostWidth/DemoAtMostWidth";
import DemoForceHeight from "./components/DemoForceHeight";
import DemoForceWidth from "./components/DemoForceWidth";
import { rootSx } from "./style";

export default function DemoSimpleResizer() {
    return (
        <Box className="DemoSimpleResizer-root" sx={[rootSx]}>
            <DemoAtMostWidth />
            <DemoAtMostHeight />
            <DemoForceWidth />
            <DemoForceHeight />
            <DemoAtMostRect />
        </Box>
    );
}
