"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Upload, FileText, CheckCircle, AlertCircle, X, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type PYQDocument = {
  id: string;
  title: string;
  subjectName: string;
  year: number;
  _count: {
    questions: number;
  };
};

export default function PYQAnalyzerStep1() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // Metadata Form State
  const [metadata, setMetadata] = useState({
    subject: '',
    courseCode: '',
    semester: '',
    academicYear: '',
    examType: ''
  });

  // File State
  const [file, setFile] = useState<File | null>(null);
  
  // App State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Dashboard State
  const [recentDocs, setRecentDocs] = useState<PYQDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const token = localStorage.getItem("teacherToken");
      const res = await fetch(`http://localhost:5000/api/pyq/library`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentDocs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setMetadata(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isFormValid = () => {
    return metadata.subject && metadata.courseCode && metadata.semester && metadata.academicYear && metadata.examType;
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isFormValid()) {
      alert("Please fill all metadata fields before uploading.");
      return;
    }
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isFormValid()) {
      alert("Please fill all metadata fields before uploading.");
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadStage('Uploading...');
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const token = localStorage.getItem("teacherToken");
      setUploadStage('Extracting text & detecting questions...');
      
      const res = await fetch(`http://localhost:5000/api/pyq/upload`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.questions || data.questions.length === 0) {
        alert("Extraction failed or no questions found in the PDF.");
        setPreviewData(null);
      } else {
        setPreviewData(data);
        setUploadStage('Ready for review');
      }
    } catch (e) {
      console.error(e);
      alert("Extraction failed. Network or API error.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!previewData) return;
    setIsSaving(true);
    
    try {
      const payload = {
        title: file?.name || 'PYQ Document',
        subjectName: metadata.subject,
        courseCode: metadata.courseCode,
        semester: metadata.semester,
        academicYear: metadata.academicYear,
        examType: metadata.examType,
        fileUrl: previewData.fileUrl,
        originalFileName: previewData.originalFileName,
        questions: previewData.questions
      };

      const token = localStorage.getItem("teacherToken");
      const res = await fetch(`http://localhost:5000/api/pyq/save`, {
        method: 'POST',
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to save to database");
      }

      // Success
      setPreviewData(null);
      setFile(null);
      // Reset form if you want
      setMetadata({
        subject: '',
        courseCode: '',
        semester: '',
        academicYear: '',
        examType: ''
      });
      fetchDocuments();
      alert("Questions saved successfully to the database!");
    } catch (error) {
      console.error(error);
      alert("Database saving failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("Delete this PYQ from the database?")) return;
    
    try {
      const token = localStorage.getItem("teacherToken");
      const res = await fetch(`http://localhost:5000/api/pyq/library/${id}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDocuments();
      } else {
        alert("Failed to delete document.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while deleting.");
    }
  };

  const inputClass = `w-full px-4 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isDark ? 'bg-[#111113] border-white/10 text-white placeholder-white/30' : 'bg-white border-black/10 text-black placeholder-black/30'}`;
  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-black/60'}`;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="border-b pb-6 border-black/5 dark:border-white/5">
        <h1 className="text-3xl font-black tracking-tight">PYQ Analyzer</h1>
        <p className={`text-sm mt-2 font-medium ${isDark ? 'text-white/50' : 'text-black/50'}`}>
          Upload previous-year question papers and build your institutional question database.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!previewData ? (
          <motion.div 
            key="upload-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* 3. PYQ METADATA */}
            <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#1a1a1c] border-white/10' : 'bg-gray-50 border-black/10'}`}>
              <h2 className="text-lg font-bold mb-4">Paper Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Subject *</label>
                  <input type="text" name="subject" value={metadata.subject} onChange={handleMetadataChange} placeholder="e.g. Database Management Systems" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Course Code *</label>
                  <input type="text" name="courseCode" value={metadata.courseCode} onChange={handleMetadataChange} placeholder="e.g. CS301" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Semester *</label>
                  <input type="number" name="semester" value={metadata.semester} onChange={handleMetadataChange} placeholder="e.g. 5" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Academic Year *</label>
                  <input type="number" name="academicYear" value={metadata.academicYear} onChange={handleMetadataChange} placeholder="e.g. 2025" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Exam Type *</label>
                  <select name="examType" value={metadata.examType} onChange={handleMetadataChange} className={inputClass}>
                    <option value="">Select Exam Type</option>
                    <option value="Mid Semester">Mid Semester</option>
                    <option value="End Semester">End Semester</option>
                    <option value="Class Test">Class Test</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. FILE UPLOAD */}
            <div className={`p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all ${
              !isFormValid() 
                ? (isDark ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed' : 'border-black/5 bg-black/5 opacity-50 cursor-not-allowed')
                : (isDark ? 'border-white/20 bg-[#111113] hover:border-blue-500/50' : 'border-black/20 bg-white hover:border-blue-500/50')
            }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <Upload className={`w-10 h-10 mb-4 ${isDark ? 'text-white/40' : 'text-black/40'}`} />
              <h3 className="text-lg font-bold mb-1">Upload PYQ</h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                Drag and drop your PDF here, or click to browse
              </p>
              
              <input 
                type="file" 
                accept=".pdf,.docx,.txt" 
                id="file-upload" 
                className="hidden" 
                onChange={handleFileSelect}
                disabled={!isFormValid() || isUploading}
              />
              <label 
                htmlFor="file-upload" 
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                  !isFormValid() 
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
                }`}
              >
                Select File
              </label>

              {file && (
                <div className="mt-6 p-4 rounded-xl border flex items-center justify-between gap-4 w-full max-w-md bg-white/5">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="text-left truncate">
                      <p className="text-sm font-semibold truncate">{file.name}</p>
                      <p className="text-xs opacity-60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => setFile(null)} className="p-1 rounded-md hover:bg-red-500/10 text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {file && (
              <div className="flex flex-col items-center">
                <button
                  onClick={handleUploadAndAnalyze}
                  disabled={isUploading}
                  className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${
                    isUploading 
                    ? 'bg-gray-500 text-white cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 w-full md:w-auto'
                  }`}
                >
                  {isUploading ? uploadStage : 'UPLOAD & EXTRACT'}
                </button>
                {isUploading && (
                  <p className="text-xs mt-3 animate-pulse opacity-70">{uploadStage}</p>
                )}
              </div>
            )}

            {/* 14. DASHBOARD LIST */}
            <div className="pt-8">
              <h2 className="text-lg font-bold mb-4">Recent PYQs</h2>
              {loadingDocs ? (
                <div className="text-sm opacity-50">Loading library...</div>
              ) : recentDocs.length === 0 ? (
                <div className={`p-6 rounded-2xl border text-center ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                  <p className="text-sm opacity-50">No PYQs uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDocs.map(doc => (
                    <div key={doc.id} className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'bg-[#111113] border-white/10' : 'bg-white border-black/10'}`}>
                      <div>
                        <h3 className="font-semibold text-sm">{doc.subjectName || doc.title} {doc.year}</h3>
                        <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                          {doc._count.questions} Questions
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteDoc(doc.id)} className={`p-2 rounded-lg text-red-500 transition-colors ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        ) : (
          /* 10. QUESTION PREVIEW */
          <motion.div 
            key="preview-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Please review extracted questions before saving to the database.</p>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Extracted Questions: {previewData.questions.length}</h2>
              <div className="flex gap-3">
                <button 
                  onClick={() => setPreviewData(null)}
                  disabled={isSaving}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-black/5 hover:bg-black/10'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveQuestions}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"
                >
                  {isSaving ? 'Saving...' : 'Save Questions'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {previewData.questions.map((q: any, idx: number) => (
                <div key={idx} className={`p-5 rounded-2xl border shadow-sm ${isDark ? 'bg-[#111113] border-white/10' : 'bg-white border-black/10'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="inline-block px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-xs font-bold">
                      {q.questionNumber || `Q${idx + 1}`}
                    </span>
                    <div className="flex gap-3">
                      {q.marks && (
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                          {q.marks} Marks
                        </span>
                      )}
                      {q.topic && (
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                          {q.topic}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                    {q.questionText}
                  </p>
                </div>
              ))}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
