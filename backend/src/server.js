require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const pyqRoutes = require('./routes/pyqRoutes');

const app = express();

// Security Middleware
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false, // Disabled in favor of CSP frame-ancestors
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "accounts.google.com"],
      "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      "img-src": ["'self'", "data:", "blob:", "res.cloudinary.com", "lh3.googleusercontent.com"],
      "media-src": ["'self'", "res.cloudinary.com"],
      "font-src": ["'self'", "fonts.gstatic.com", "data:"],
      "connect-src": [
        "'self'", 
        "http://127.0.0.1:8001", 
        "http://localhost:8001", 
        "https://api.openweathermap.org", 
        "ws:", 
        "wss:", 
        "accounts.google.com",
        frontendUrl
      ],
      "frame-ancestors": ["'self'", frontendUrl],
      "frame-src": ["'self'", "accounts.google.com"],
      "worker-src": ["'self'", "blob:"],
      "child-src": ["'self'", "blob:"],
      "upgrade-insecure-requests": process.env.NODE_ENV === "production" ? [] : null,
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Route-Specific Rate Limiting
const createLimiter = (max, message) => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max,
  message: { error: message }
});

// Authentication
app.use('/api/auth', createLimiter(20, 'Too many login attempts, please try again later.'));

// Weather
app.use('/api/teacher/weather', createLimiter(50, 'Too many weather requests, please try again later.'));
app.use('/api/student/weather', createLimiter(50, 'Too many weather requests, please try again later.'));

// Streaming (must be defined before broader routes if we want separate counting, though they compound)
app.use('/api/ai/chat/stream', createLimiter(15, 'Streaming limit exceeded. Please try again later.'));
app.use('/api/ai/pyq/chat/stream', createLimiter(15, 'Streaming limit exceeded. Please try again later.'));

// CampusGPT & PYQ AI
app.use('/api/ai/chat', createLimiter(30, 'CampusGPT limit exceeded. Please wait before sending more messages.'));
app.use('/api/ai/pyq/chat', createLimiter(30, 'PYQ Chat limit exceeded. Please wait before sending more messages.'));

// OCR
app.use('/api/ai/pyq/extract', createLimiter(10, 'OCR extraction limit exceeded, please try again later.'));

// Assessment AI
app.use('/api/assessment', createLimiter(10, 'Assessment AI limit exceeded. Please try again later.'));

// Large uploads
app.use('/api/ai/upload', createLimiter(50, 'Upload limit exceeded to prevent abuse. Please try again later.'));
app.use('/api/pyq/upload', createLimiter(50, 'Upload limit exceeded to prevent abuse. Please try again later.'));
app.use('/api/pyq/analyze', createLimiter(50, 'Upload limit exceeded to prevent abuse. Please try again later.'));

// No global limiter is used to ensure unaffected performance on non-expensive routes.

// Proxy for Python AI Microservice (must be before body parsers for streaming/multipart)
const { createProxyMiddleware } = require('http-proxy-middleware');
app.use('/api/ai', createProxyMiddleware({
  target: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001',
  changeOrigin: true,
  pathRewrite: function (path, req) {
    return req.originalUrl;
  },
  // Ensure SSE streams correctly
  onProxyRes: function (proxyRes, req, res) {
    proxyRes.headers['Cache-Control'] = 'no-cache';
  }
}));

// Parse JSON and URL-encoded bodies with conditional limits
app.use((req, res, next) => {
  // Allow 50MB only on upload, AI, and analysis routes. 2MB everywhere else.
  const isLargeRoute = req.path.includes('/upload') || 
                       req.path.includes('/ai') || 
                       req.path.includes('/pyq') || 
                       req.path.includes('/chat') || 
                       req.path.includes('/assessment');
  
  const limit = isLargeRoute ? '50mb' : '2mb';
  
  express.json({ limit })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true, limit })(req, res, next);
  });
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
const adminRoutes = require('./routes/adminRoutes');
const adminERPRoutes = require('./routes/adminERPRoutes');
const modelRoutes = require('./routes/modelRoutes');
const aiRouterRoutes = require('./routes/aiRouterRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/erp', adminERPRoutes);
app.use('/api/pyq', pyqRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/ai-router', aiRouterRoutes);
app.use('/api/admin/marketplace', marketplaceRoutes);
app.use('/api/assessment', assessmentRoutes);


// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CampusGPT Backend is running.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
