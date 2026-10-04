const express = require('express');
const router = express.Router();
const pyqController = require('../controllers/pyqController');
const { protect } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Public endpoints
router.get('/preview/:id', pyqController.previewPYQ);

// All routes are protected by default authentication
router.use(protect);

// PYQ Library endpoints
router.get('/debug-db', (req, res) => res.json({ db: process.env.DATABASE_URL }));
router.post('/upload', upload.single('file'), pyqController.extractForPreview);
router.post('/save', pyqController.savePreviewedPaper);
router.get('/library', pyqController.getPYQLibrary);
router.delete('/library/:id', pyqController.deletePYQ);

// PYQ Analytics endpoints
const pyqAnalyticsController = require('../controllers/pyqAnalyticsController');
router.get('/analytics', pyqAnalyticsController.getAnalytics);
router.get('/analytics/year-analysis', pyqAnalyticsController.getYearAnalysis);
router.get('/analytics/most-repeated-questions', pyqAnalyticsController.getMostRepeatedQuestions);
router.get('/analytics/most-repeated-concepts', pyqAnalyticsController.getMostRepeatedConcepts);
router.get('/analytics/topic-analysis', pyqAnalyticsController.getTopicAnalysis);
router.get('/analytics/search', pyqAnalyticsController.search);

// Current Paper Analyzer endpoints (Should be restricted to teachers, but using basic protect for now)
router.post('/analyze', upload.single('file'), pyqController.analyzeCurrentPaper);
router.post('/analyze/stream', upload.single('file'), pyqController.analyzeCurrentPaperSSE);
router.post('/replace', pyqController.replaceQuestion);
router.post('/generate-pdf', pyqController.generatePDF);
router.get('/analysis/history', pyqController.getAnalysisHistory);
router.get('/analysis/:id', pyqController.getAnalysisById);
router.delete('/analysis/:id', pyqController.deleteAnalysis);
const pyqChatController = require('../controllers/pyqChatController');

// Chat endpoints
router.get('/chat/history/:sessionId', pyqChatController.getChatHistory);
router.post('/chat/global', pyqChatController.globalChat);
router.post('/chat/paper/:analysisId', pyqChatController.paperChat);
router.post('/chat/debug/:analysisId', async (req, res) => {
  req.user = { id: 'test' }; // mock user
  await pyqChatController.paperChat(req, res);
});

module.exports = router;
