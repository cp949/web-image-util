import { Container, Typography, Paper, Box } from '@mui/material';

function HelloWorldExample() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <Typography variant="h3" component="h1" gutterBottom>
            Hello World!
          </Typography>
          <Typography variant="h6" color="text.secondary" textAlign="center">
            Web Image Util Examples 앱입니다.
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            이 앱에서는 @cp949/web-image-util 라이브러리의 다양한 예제를 보여줍니다.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default HelloWorldExample;