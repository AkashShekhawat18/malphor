"use client";

import React, { useState } from 'react';
import { Clock, Calendar, Search, Filter, Trash2, FileText, ChevronRight, BarChart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalysisHistoryItem } from './types';

interface AnalysisHistoryProps {
  history: AnalysisHistoryItem[];
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  isDark: boolean;
}

export function AnalysisHistory({ history, loading, onOpen, onDelete, isDark }: AnalysisHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest_rep'>('newest');

  const filteredAndSorted = history
    .filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOrder === 'highest_rep') return b.overallRepetition - a.overallRepetition;
      return 0;
    });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      className={`w-full md:w-2/3 rounded-2xl border flex flex-col ${isDark ? 'bg-[#111113] border-white/5' : 'bg-white border-black/5'}`}
    >
      <div className={`p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? 'border-white/5' : 'border-black/5'}`}>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-500" /> Analysis History
        </h2>
        
        <div className="flex items-center gap-3">
          <div className={`relative flex items-center px-3 py-1.5 rounded-lg border ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
            <Search className="w-4 h-4 opacity-50 mr-2" />
            <input 
              type="text" 
              placeholder="Search papers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-32 focus:w-48 transition-all"
            />
          </div>
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className={`text-sm py-1.5 px-3 rounded-lg border outline-none cursor-pointer ${isDark ? 'bg-[#1a1a1c] border-white/10' : 'bg-white border-black/10'}`}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest_rep">Highest Repetition</option>
          </select>
        </div>
      </div>
      
      <div className="p-6 flex-1 max-h-[700px] overflow-y-auto space-y-3 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className={`text-center py-16 px-6 rounded-xl border border-dashed ${isDark ? 'border-white/10' : 'border-black/10'}`}>
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <h3 className="text-xl font-medium opacity-80 mb-2">No history found</h3>
            <p className="text-sm opacity-50">Upload a paper or change your search filters.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredAndSorted.map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, margin: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                onClick={() => onOpen(item.id)}
                className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1 ${
                  isDark 
                    ? 'bg-white/5 border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 shadow-black/20' 
                    : 'bg-white border-black/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 shadow-black/5'
                }`}
              >
                <div className="flex-1 pr-4">
                  <h4 className="font-bold text-lg mb-2 truncate pr-8 group-hover:text-emerald-500 transition-colors">{item.title}</h4>

                </div>
                
                <div className="mt-4 sm:mt-0 flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6">
                  <div className="text-left sm:text-right flex items-center gap-3">
                    <div className="hidden sm:block text-right">
                      <div className="text-[10px] uppercase tracking-wider font-bold opacity-40 mb-1">Repetition</div>
                      <div className="h-1.5 w-16 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${item.overallRepetition >= 70 ? 'bg-rose-500' : item.overallRepetition >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${item.overallRepetition}%` }}
                        />
                      </div>
                    </div>
                    <div className={`text-2xl font-black tabular-nums tracking-tighter ${item.overallRepetition >= 70 ? 'text-rose-500' : item.overallRepetition >= 40 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {item.overallRepetition ? item.overallRepetition.toFixed(1) : 0}%
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => onDelete(item.id, e)}
                      className={`p-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'hover:bg-rose-500/20 text-rose-400' : 'hover:bg-rose-100 text-rose-500'}`}
                      title="Delete Analysis"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className={`p-2.5 rounded-lg transition-all ${isDark ? 'bg-white/5 group-hover:bg-emerald-500/20 group-hover:text-emerald-400' : 'bg-black/5 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
