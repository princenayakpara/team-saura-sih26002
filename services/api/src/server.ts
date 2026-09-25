import express from 'express';
import cors from 'cors';
import path from 'path';
import { serverConfig } from './config/database.js';
import { errorHandler } from './middleware/error-handler.js';
import apiRoutes from './routes/index.js';
import { testConnection } from './db/connection.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Routes
app.use('/api', apiRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = serverConfig.port;

app.listen(PORT, async () => {
  console.log(`[SauraRoute API] Server running on http://localhost:${PORT}`);
  console.log(`[SauraRoute API] Health check: http://localhost:${PORT}/api/health`);

  // Test database connection on startup
  try {
    const version = await testConnection();
    console.log(`[SauraRoute API] PostGIS connected — version: ${version}`);
  } catch (err) {
    console.warn(`[SauraRoute API] Database connection failed:`, (err as Error).message);
    console.warn(`[SauraRoute API] API will run but database features are unavailable.`);
  }
});

export default app;
