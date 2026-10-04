import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid 
} from 'recharts';
import { BookOpen, Repeat, BrainCircuit, Activity } from 'lucide-react';

export function GlobalAnalyticsDashboard() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  const [analytics, setAnalytics] = useState<any>(null);
  const [yearAnalysis, setYearAnalysis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('teacherToken');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [analyticsRes, yearRes] = await Promise.all([
        fetch('http://localhost:5000/api/pyq/analytics', { headers }),
        fetch('http://localhost:5000/api/pyq/analytics/year-analysis', { headers })
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (yearRes.ok) setYearAnalysis(await yearRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-2xl border animate-pulse ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
        <div className="h-6 w-48 bg-white/10 rounded mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/10 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total PYQs', value: analytics?.totalPYQs || 0, icon: BookOpen, color: 'text-blue-500' },
    { label: 'Total Questions', value: analytics?.totalQuestions || 0, icon: Activity, color: 'text-purple-500' },
    { label: 'Avg Question Repetition', value: `${analytics?.questionRepetition || 0}%`, icon: Repeat, color: 'text-emerald-500' },
    { label: 'Most Repeated Concept', value: analytics?.mostRepeatedConcept || 'N/A', icon: BrainCircuit, color: 'text-amber-500', isText: true }
  ];

  return (
    <div className="space-y-6 mb-8">
      <h2 className="text-xl font-bold tracking-tight">Global Library Analytics</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-5 rounded-2xl border shadow-sm ${isDark ? 'bg-[#111113] border-white/10' : 'bg-white border-black/10'}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-opacity-10 ${stat.color.replace('text-', 'bg-')}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className={`text-sm font-medium ${isDark ? 'text-white/60' : 'text-black/60'}`}>
                {stat.label}
              </span>
            </div>
            <div className={`font-bold ${stat.isText ? 'text-lg truncate' : 'text-3xl'}`}>
              {stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-2xl border shadow-sm ${isDark ? 'bg-[#111113] border-white/10' : 'bg-white border-black/10'}`}>
          <h3 className="text-sm font-semibold mb-6">Questions per Year</h3>
          <div className="h-64">
            {yearAnalysis.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} vertical={false} />
                  <XAxis dataKey="year" stroke={isDark ? '#666' : '#999'} fontSize={12} />
                  <YAxis stroke={isDark ? '#666' : '#999'} fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#111' : '#fff',
                      borderColor: isDark ? '#333' : '#eee',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="totalQuestions" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center opacity-50">No data available</div>
            )}
          </div>
        </div>

        <div className={`p-6 rounded-2xl border shadow-sm ${isDark ? 'bg-[#111113] border-white/10' : 'bg-white border-black/10'}`}>
          <h3 className="text-sm font-semibold mb-6">Concept Coverage Trend</h3>
          <div className="h-64">
            {yearAnalysis.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} vertical={false} />
                  <XAxis dataKey="year" stroke={isDark ? '#666' : '#999'} fontSize={12} />
                  <YAxis stroke={isDark ? '#666' : '#999'} fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#111' : '#fff',
                      borderColor: isDark ? '#333' : '#eee',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line type="monotone" dataKey="totalConcepts" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center opacity-50">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
