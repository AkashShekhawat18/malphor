const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAnalytics = async (req, res) => {
  try {
    const totalPYQs = await prisma.pYQPaper.count();
    const totalQuestions = await prisma.pYQQuestion.count();

    // To find repeated questions, we can look at PYQSimilarityReport where matchType indicates a repeat
    const repeatedQ = await prisma.pYQSimilarityReport.groupBy({
      by: ['targetQuestionId'],
      where: {
        matchType: { in: ['EXACT', 'HIGHLY_SIMILAR', 'CONCEPT_REPEATED'] }
      }
    });

    const repeatedQuestions = repeatedQ.length;
    const questionRepetition = totalQuestions > 0 ? (repeatedQuestions / totalQuestions) * 100 : 0;

    // Concept repetition: Count unique concepts that appear more than once
    const conceptGroups = await prisma.pYQQuestionMetadata.groupBy({
      by: ['concept'],
      _count: { concept: true },
      where: { concept: { not: null } },
      having: { concept: { _count: { gt: 1 } } }
    });

    const allConcepts = await prisma.pYQQuestionMetadata.count({ where: { concept: { not: null } } });
    let repeatedConceptCount = 0;
    conceptGroups.forEach(g => { repeatedConceptCount += g._count.concept; });
    const conceptRepetition = allConcepts > 0 ? (repeatedConceptCount / allConcepts) * 100 : 0;

    let mostRepeatedConcept = null;
    if (conceptGroups.length > 0) {
      mostRepeatedConcept = conceptGroups.sort((a, b) => b._count.concept - a._count.concept)[0].concept;
    }

    res.status(200).json({
      totalPYQs,
      totalQuestions,
      repeatedQuestions,
      questionRepetition: parseFloat(questionRepetition.toFixed(1)),
      conceptRepetition: parseFloat(conceptRepetition.toFixed(1)),
      mostRepeatedConcept
    });
  } catch (error) {
    console.error('Error fetching PYQ Analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

exports.getYearAnalysis = async (req, res) => {
  try {
    const papers = await prisma.pYQPaper.findMany({
      include: {
        questions: {
          include: {
            metadata: true
          }
        }
      },
      orderBy: { year: 'asc' }
    });

    const yearData = {};
    papers.forEach(p => {
      const yr = p.year || new Date().getFullYear();
      if (!yearData[yr]) {
        yearData[yr] = { totalQuestions: 0, concepts: new Set(), marks: 0 };
      }
      yearData[yr].totalQuestions += p.questions.length;
      p.questions.forEach(q => {
        yearData[yr].marks += (q.marks || 0);
        if (q.metadata && q.metadata.concept) {
          yearData[yr].concepts.add(q.metadata.concept);
        }
      });
    });

    const response = Object.keys(yearData).map(yr => ({
      year: parseInt(yr),
      totalQuestions: yearData[yr].totalQuestions,
      totalConcepts: yearData[yr].concepts.size,
      averageMarks: yearData[yr].totalQuestions > 0 ? (yearData[yr].marks / yearData[yr].totalQuestions).toFixed(1) : 0
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('Error in getYearAnalysis:', error);
    res.status(500).json({ error: 'Failed to fetch year analysis' });
  }
};

exports.getMostRepeatedQuestions = async (req, res) => {
  try {
    const repeated = await prisma.pYQSimilarityReport.groupBy({
      by: ['targetQuestionId'],
      _count: { targetQuestionId: true },
      _avg: { overallSimilarity: true },
      where: { matchType: { in: ['EXACT', 'HIGHLY_SIMILAR', 'CONCEPT_REPEATED'] } },
      orderBy: { _count: { targetQuestionId: 'desc' } },
      take: 10
    });

    const result = [];
    for (const r of repeated) {
      const q = await prisma.pYQQuestion.findUnique({
        where: { id: r.targetQuestionId },
        include: { paper: true }
      });
      if (q) {
        result.push({
          id: q.id,
          questionText: q.questionText,
          marks: q.marks,
          year: q.paper?.year,
          frequency: r._count.targetQuestionId + 1, // original + repeats
          similarity: (r._avg.overallSimilarity * 100).toFixed(1)
        });
      }
    }
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching most repeated questions:', error);
    res.status(500).json({ error: 'Failed to fetch most repeated questions' });
  }
};

exports.getMostRepeatedConcepts = async (req, res) => {
  try {
    const concepts = await prisma.pYQQuestionMetadata.groupBy({
      by: ['concept'],
      _count: { concept: true },
      where: { concept: { not: null } },
      orderBy: { _count: { concept: 'desc' } },
      take: 10
    });

    const result = await Promise.all(concepts.map(async (c) => {
      // Find average marks for this concept
      const qs = await prisma.pYQQuestionMetadata.findMany({
        where: { concept: c.concept },
        include: { question: true }
      });
      let totalM = 0;
      let validQs = 0;
      qs.forEach(meta => {
        if (meta.question.marks) {
          totalM += meta.question.marks;
          validQs++;
        }
      });
      return {
        concept: c.concept,
        occurrences: c._count.concept,
        averageMarks: validQs > 0 ? (totalM / validQs).toFixed(1) : 0,
        totalMarks: totalM
      };
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching most repeated concepts:', error);
    res.status(500).json({ error: 'Failed to fetch most repeated concepts' });
  }
};

exports.getTopicAnalysis = async (req, res) => {
  try {
    const topics = await prisma.pYQQuestion.groupBy({
      by: ['topic'],
      _count: { topic: true },
      _sum: { marks: true },
      where: { topic: { not: null } },
      orderBy: { _count: { topic: 'desc' } },
      take: 10
    });
    
    // We would calculate topic repetition based on similarity reports belonging to questions in this topic
    res.status(200).json(topics.map(t => ({
      topic: t.topic,
      totalQuestions: t._count.topic,
      totalMarks: t._sum.marks || 0
    })));
  } catch (error) {
    console.error('Error fetching topic analysis:', error);
    res.status(500).json({ error: 'Failed to fetch topic analysis' });
  }
};

exports.search = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    const questions = await prisma.pYQQuestion.findMany({
      where: {
        OR: [
          { questionText: { contains: query, mode: 'insensitive' } },
          { topic: { contains: query, mode: 'insensitive' } },
          { metadata: { concept: { contains: query, mode: 'insensitive' } } }
        ]
      },
      include: {
        paper: true,
        metadata: true
      },
      take: 20
    });

    res.status(200).json(questions);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};
