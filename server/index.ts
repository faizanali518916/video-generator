import { createApplication } from './app';

const port = Number(process.env.PORT || 4174);
const { app } = await createApplication();
app.listen(port, '127.0.0.1', () => console.log(`Video Generator API: http://127.0.0.1:${port}`));
