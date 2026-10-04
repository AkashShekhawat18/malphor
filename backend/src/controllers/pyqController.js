const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const FormData = require('form-data');
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';

const uploadToCloudinary = (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    // 60 second timeout to prevent infinite hanging
    const timeout = setTimeout(() => {
      reject(new Error('Cloudinary upload timed out'));
    }, 60000);

    const ext = originalname ? require('path').extname(originalname) : '.pdf';
    const public_id = `file_${Date.now()}${ext}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'malphor/resources', resource_type: 'auto', public_id },
      (error, result) => {
        clearTimeout(timeout);
        if (result) resolve(result);
        else reject(error || new Error('Unknown Cloudinary Error'));
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

exports.extractForPreview = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    
    // 1. Upload to Cloudinary (need to store it somewhere for the eventual record)
    const uploadResult = await uploadToCloudinary(file.buffer, file.originalname);
    const publicUrl = uploadResult.secure_url;
    
    // 2. Call AI Service to purely EXTRACT questions
    const form = new FormData();
    form.append('file', file.buffer, { filename: file.originalname });
    
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/ai/pyq/extract`, form, {
      headers: { ...form.getHeaders() }
    });
    
    const questions = aiResponse.data.questions || [];
    
    res.status(200).json({
      fileUrl: publicUrl,
      originalFileName: file.originalname,
      questions: questions
    });
  } catch (error) {
    console.error('Extract For Preview Error:', error);
    res.status(500).json({ error: 'Failed to extract questions' });
  }
};

exports.savePreviewedPaper = async (req, res) => {
  try {
    const { 
      title, subjectName, courseCode, semester, academicYear, examType, 
      fileUrl, originalFileName, questions 
    } = req.body;
    
    // 1. Create Document Record
    const pyqPaper = await prisma.pYQPaper.create({
      data: {
        title: title || originalFileName || 'Untitled Paper',
        subjectName: subjectName || 'Unknown Subject',
        semester: semester ? parseInt(semester) : null,
        examType: examType || null,
        year: academicYear ? parseInt(academicYear) : new Date().getFullYear(),
        fileUrl: fileUrl,
        originalFileName: originalFileName,
        uploadedById: req.user.id,
        isProcessed: true,
        status: 'COMPLETED'
      }
    });
    
    // 2. Save extracted questions
    const questionPromises = (questions || []).map(q => {
      return prisma.pYQQuestion.create({
        data: {
          paperId: pyqPaper.id,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          marks: q.marks,
          topic: q.topic || null
        }
      });
    });
    
    await Promise.all(questionPromises);
    
    res.status(201).json({ message: 'PYQ saved successfully', paperId: pyqPaper.id });
  } catch (error) {
    console.error('Save Previewed Paper Error:', error);
    res.status(500).json({ error: 'Failed to save paper and questions' });
  }
};

exports.getPYQLibrary = async (req, res) => {
  try {
    const filters = {};
    if (req.query.subjectName) filters.subjectName = { contains: req.query.subjectName, mode: 'insensitive' };
    if (req.query.year) filters.year = parseInt(req.query.year);
    
    const papers = await prisma.pYQPaper.findMany({
      where: filters,
      include: {
        _count: {
          select: { questions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json(papers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch PYQ library' });
  }
};

exports.previewPYQ = async (req, res) => {
  try {
    const paper = await prisma.pYQPaper.findUnique({ where: { id: req.params.id } });
    if (!paper) return res.status(404).send('Paper not found');

    const response = await axios({
      method: 'get',
      url: paper.fileUrl,
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + (paper.originalFileName || 'paper.pdf') + '"');
    
    response.data.pipe(res);
  } catch (error) {
    console.error('Preview proxy error:', error);
    res.status(500).send('Failed to load preview');
  }
};

exports.analyzeCurrentPaper = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    
    // Upload file to Cloudinary for history reference
    const uploadStart = Date.now();
    const uploadResult = await uploadToCloudinary(file.buffer, file.originalname);
    const publicUrl = uploadResult.secure_url;
    
    const form = new FormData();
    form.append('file', file.buffer, file.originalname);
    
    const extractStart = Date.now();
    const extractResponse = await axios.post(`${AI_SERVICE_URL}/api/ai/pyq/extract`, form, {
      headers: { ...form.getHeaders() },
      timeout: 120000 // 2 minutes
    });
    
    const currentQuestions = extractResponse.data.questions || [];
    
    const historicalQuestions = await prisma.pYQQuestion.findMany({
      include: {
        metadata: true,
        paper: {
          select: { title: true, subjectName: true, year: true }
        }
      }
    });
    
    const formattedPool = historicalQuestions.map(q => ({
      id: q.id,
      questionText: q.questionText || '',
      marks: q.marks,
      metadata: q.metadata ? {
        concept: q.metadata.concept || '',
        subconcept: q.metadata.subconcept || '',
        questionIntent: q.metadata.questionIntent || '',
        requiredFormula: q.metadata.requiredFormula || '',
        solvingMethod: q.metadata.solvingMethod || '',
        difficulty: q.metadata.difficulty || '',
        logic: q.metadata.logic || ''
      } : {}
    }));
    
    const simResponse = await axios.post(`${AI_SERVICE_URL}/api/ai/pyq/similarity`, {
      questions: currentQuestions,
      historical_pool: formattedPool
    }, {
      timeout: 120000 // 2 minutes
    });
    
    const overallRepetition = simResponse.data.summary?.averageSimilarity || 
      (simResponse.data.similarityResults.reduce((acc, curr) => acc + curr.overallSimilarity, 0) / (simResponse.data.similarityResults.length || 1));

    const historyRecord = await prisma.pYQAnalysisHistory.create({
      data: {
        userId: req.user.id,
        title: file.originalname,
        fileUrl: publicUrl,
        overallRepetition: overallRepetition,
        status: 'COMPLETED',
        extractedQuestions: currentQuestions,
        similarityResult: simResponse.data
      }
    });
    
    res.status(200).json({
      ...simResponse.data,
      analysisId: historyRecord.id
    });
  } catch (error) {
    console.error('Analyze Paper Error:', error);
    res.status(500).json({ error: 'Failed to analyze paper' });
  }
};

/**
 * SSE-based analyze endpoint.
 * Sends real-time progress events to the frontend as each pipeline stage completes.
 * Uses Server-Sent Events (text/event-stream).
 */
exports.analyzeCurrentPaperSSE = async (req, res) => {
  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const sendEvent = (stage, data) => {
    const payload = JSON.stringify({ stage, ...(data || {}) });
    res.write(`data: ${payload}\n\n`);
  };

  const sendError = (message) => {
    const payload = JSON.stringify({ stage: 'ERROR', error: message });
    res.write(`data: ${payload}\n\n`);
    res.end();
  };

  try {
    const file = req.file;
    if (!file) {
      sendError('No file uploaded');
      return;
    }

    // --- Stage 1: Upload to Cloudinary ---
    sendEvent('UPLOAD_STARTED');
    let publicUrl;
    try {
      const uploadResult = await uploadToCloudinary(file.buffer, file.originalname);
      publicUrl = uploadResult.secure_url;
    } catch (uploadErr) {
      console.error('Cloudinary Upload Error:', uploadErr);
      sendError('File upload to cloud storage failed.');
      return;
    }
    sendEvent('UPLOAD_FINISHED');

    // --- Stages 2-6: Stream extraction from Python AI Service ---
    // The Python service emits NDJSON events for VISION, OCR, LATEX, QUESTION_EXTRACTION, EMBEDDING
    const form = new FormData();
    form.append('file', file.buffer, file.originalname);

    let currentQuestions = [];
    let extractionError = null;

    try {
      const extractResponse = await axios.post(
        `${AI_SERVICE_URL}/api/ai/pyq/extract?stream=true`,
        form,
        {
          headers: { ...form.getHeaders() },
          responseType: 'stream',
          timeout: 300000 // 5 minutes for streaming
        }
      );

      // Process NDJSON stream from Python
      await new Promise((resolve, reject) => {
        let buffer = '';

        extractResponse.data.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.event === 'progress') {
                sendEvent(parsed.stage);
              } else if (parsed.event === 'result') {
                currentQuestions = parsed.questions || [];
              } else if (parsed.event === 'error') {
                extractionError = parsed.message;
              }
            } catch (parseErr) {
              // Skip malformed lines
              console.warn('Skipping malformed NDJSON line:', trimmed);
            }
          }
        });

        extractResponse.data.on('end', () => {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (parsed.event === 'result') {
                currentQuestions = parsed.questions || [];
              } else if (parsed.event === 'error') {
                extractionError = parsed.message;
              }
            } catch (e) { /* ignore */ }
          }
          resolve();
        });

        extractResponse.data.on('error', (err) => {
          reject(err);
        });
      });

    } catch (streamErr) {
      console.error('AI Service Stream Error:', streamErr);
      sendError('AI extraction service failed.');
      return;
    }

    if (extractionError) {
      sendError(extractionError);
      return;
    }

    if (!currentQuestions || currentQuestions.length === 0) {
      sendError('No questions could be extracted from the document.');
      return;
    }

    // --- Stage 7: Similarity Matching ---
    sendEvent('SIMILARITY_STARTED');

    const historicalQuestions = await prisma.pYQQuestion.findMany({
      include: {
        metadata: true,
        paper: {
          select: { title: true, subjectName: true, year: true }
        }
      }
    });

    const formattedPool = historicalQuestions.map(q => ({
      id: q.id,
      questionText: q.questionText || '',
      marks: q.marks,
      metadata: q.metadata ? {
        concept: q.metadata.concept || '',
        subconcept: q.metadata.subconcept || '',
        questionIntent: q.metadata.questionIntent || '',
        requiredFormula: q.metadata.requiredFormula || '',
        solvingMethod: q.metadata.solvingMethod || '',
        difficulty: q.metadata.difficulty || '',
        logic: q.metadata.logic || ''
      } : {}
    }));

    let simData;
    try {
      const simResponse = await axios.post(`${AI_SERVICE_URL}/api/ai/pyq/similarity`, {
        questions: currentQuestions,
        historical_pool: formattedPool
      }, {
        timeout: 120000
      });
      simData = simResponse.data;
    } catch (simErr) {
      const detail = simErr.response?.data?.detail || simErr.message || 'Unknown error';
      console.error('Similarity Error:', detail);
      sendError(`Similarity analysis failed: ${detail}`);
      return;
    }
    sendEvent('SIMILARITY_COMPLETED');

    // --- Stage 8: Report Generation ---
    sendEvent('REPORT_STARTED');
    const overallRepetition = simData.summary?.averageSimilarity ||
      (simData.similarityResults.reduce((acc, curr) => acc + curr.overallSimilarity, 0) / (simData.similarityResults.length || 1));
    sendEvent('REPORT_COMPLETED');

    // --- Stage 9: Database Save ---
    sendEvent('DB_SAVE_STARTED');
    let historyRecord;
    try {
      // 1. Save to PYQPaper
      const pyqPaper = await prisma.pYQPaper.create({
        data: {
          title: req.body.title || file.originalname || 'Auto-Detected Title',
          collegeName: req.body.collegeName || 'Unknown College',
          subjectName: req.body.subjectName || 'Unknown Subject',
          semester: req.body.semester ? parseInt(req.body.semester) : null,
          examType: req.body.examType || null,
          year: req.body.year ? parseInt(req.body.year) : new Date().getFullYear(),
          fileUrl: publicUrl,
          originalFileName: file.originalname,
          uploadedById: req.user.id,
          isProcessed: true,
          status: 'COMPLETED'
        }
      });
      
      // 2. Save questions
      const questionIdMap = {}; // mapping from python extraction id (if any) or index to actual db id
      const questionPromises = currentQuestions.map(async (q, idx) => {
        const imagesData = (q.images || []).filter(img => img.url).map(img => ({
          imageUrl: img.url,
          caption: img.description || img.type
        }));

        const dbQuestion = await prisma.pYQQuestion.create({
          data: {
            paperId: pyqPaper.id,
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            marks: q.marks,
            topic: q.topic,
            subParts: q.subParts,
            latex: q.latex,
            diagramContext: q.diagramContext,
            images: {
              create: imagesData
            },
            metadata: q.metadata ? {
              create: {
                concept: q.metadata.concept,
                subconcept: q.metadata.subconcept,
                questionIntent: q.metadata.questionIntent,
                requiredFormula: q.metadata.requiredFormula,
                solvingMethod: q.metadata.solvingMethod,
                difficulty: q.metadata.difficulty,
                logic: q.metadata.logic
              }
            } : undefined
          }
        });
        questionIdMap[q.id || String(idx)] = dbQuestion.id;
        // Assign the new db id back to the object so similarity matching uses it
        q.id = dbQuestion.id;
        return dbQuestion;
      });
      
      await Promise.all(questionPromises);

      // 3. Save Similarity Reports
      if (simData && simData.similarityResults) {
        const simPromises = simData.similarityResults.map(async (sim) => {
          if (sim.targetQuestionId) {
             // ensure it's not trying to save a string to an int column, etc. targetQuestionId should be valid string UUID
             await prisma.pYQSimilarityReport.create({
               data: {
                 sourceQuestionId: questionIdMap[sim.sourceQuestionId] || sim.sourceQuestionId || questionIdMap[String(simData.similarityResults.indexOf(sim))],
                 targetQuestionId: sim.targetQuestionId,
                 conceptMatch: sim.conceptMatch,
                 logicMatch: sim.logicMatch,
                 formulaMatch: sim.formulaMatch,
                 patternMatch: sim.patternMatch,
                 valuesMatch: sim.valuesMatch,
                 languageSimilarity: sim.languageSimilarity,
                 overallSimilarity: sim.overallSimilarity,
                 matchType: sim.matchType,
                 reasoning: sim.reasoning
               }
             });
          }
        });
        await Promise.all(simPromises);
      }

      historyRecord = await prisma.pYQAnalysisHistory.create({
        data: {
          userId: req.user.id,
          title: file.originalname,
          fileUrl: publicUrl,
          overallRepetition: overallRepetition,
          status: 'COMPLETED',
          extractedQuestions: currentQuestions,
          similarityResult: simData
        }
      });
    } catch (dbErr) {
      console.error('DB Save Error:', dbErr);
      sendError('Failed to save analysis to database.');
      return;
    }
    sendEvent('DB_SAVE_FINISHED');

    // --- Stage 10: Completed - send final result ---
    const finalResult = {
      ...simData,
      analysisId: historyRecord.id
    };
    sendEvent('COMPLETED', { result: finalResult });

    res.end();

  } catch (error) {
    console.error('Analyze Paper SSE Error:', error);
    try {
      sendError('An unexpected error occurred during analysis.');
    } catch (writeErr) {
      // Response already ended
    }
  }
};


exports.replaceQuestion = async (req, res) => {
  try {
    const { originalQuestion } = req.body;
    
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/pyq/replace`, originalQuestion);
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Replace Question Error:', error);
    res.status(500).json({ error: 'Failed to replace question' });
  }
};

exports.getAnalysisHistory = async (req, res) => {
  try {
    const history = await prisma.pYQAnalysisHistory.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        overallRepetition: true,
        status: true,
        createdAt: true,
        fileUrl: true
      }
    });
    res.status(200).json(history);
  } catch (error) {
    console.error('Get Analysis History Error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

exports.getAnalysisById = async (req, res) => {
  try {
    const record = await prisma.pYQAnalysisHistory.findUnique({
      where: { id: req.params.id }
    });
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    res.status(200).json(record);
  } catch (error) {
    console.error('Get Analysis By ID Error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
};

exports.deleteAnalysis = async (req, res) => {
  try {
    const record = await prisma.pYQAnalysisHistory.findUnique({
      where: { id: req.params.id }
    });
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    await prisma.pYQAnalysisHistory.delete({
      where: { id: req.params.id }
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete Analysis Error:', error);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
};

exports.generatePDF = async (req, res) => {
  try {
    const { questions, title } = req.body;
    
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/pyq/generate-pdf`, { questions, title }, {
      responseType: 'arraybuffer'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="updated_${Date.now()}.pdf"`);
    res.send(response.data);
  } catch (error) {
    console.error('Generate PDF Error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

exports.deletePYQ = async (req, res) => {
  try {
    const { id } = req.params;
    
    const paper = await prisma.pYQPaper.findUnique({ where: { id } });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Delete from DB (will cascade to questions)
    await prisma.pYQPaper.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Paper deleted successfully' });
  } catch (error) {
    console.error('Delete PYQ Error Details:', error);
    res.status(500).json({ error: 'Failed to delete PYQ paper', details: error.message });
  }
};
