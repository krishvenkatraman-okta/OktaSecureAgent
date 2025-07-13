import express from 'express';
import path from 'path';
import { VercelRequest, VercelResponse } from '@vercel/node';

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from client/dist
app.use(express.static(path.join(process.cwd(), 'client/dist')));

// Basic API test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Minimal Express working', timestamp: new Date().toISOString() });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

// Fallback to serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client/dist/index.html'));
});

export default app;