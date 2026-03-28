import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cloud Run provides the port via the PORT environment variable
const PORT = Number(process.env.PORT) || 8080;

// Serve static files from the 'dist' directory (created by npm run build)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA routing (handles client-side routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
