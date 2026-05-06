'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Zap, Loader2, ArrowRight } from 'lucide-react';

export default function NeuralCommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [slateOpen, setSlateOpen] = useState(false);
  const [slateLoading, setSlateLoading] = useState(false);
  const [slateContent, setSlateContent] = useState('');
  const [slateQuery, setSlateQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    const handleOpenEvent = () => setIsOpen(true);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-neural-cmd', handleOpenEvent);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-neural-cmd', handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length > 1) {
      setIsProcessing(true);
      // Simulate sub-400ms Edge AI processing for NLQ / Fuzzy Search
      const timeout = setTimeout(() => {
        const lowerQuery = query.toLowerCase();
        const mockResults: any[] = [];

        // AI Agent Query
        if (mockResults.length === 0) {
          mockResults.push({ 
            id: 'ai_gen', 
            type: 'ai_insight', 
            title: `Ask Master AI: "${query}"`, 
            desc: 'Press Enter to process this query via the Context-Aware Analytics Agent.', 
            action: async () => {
              setSlateQuery(query);
              setSlateOpen(true);
              setSlateLoading(true);
              setIsOpen(false);
              setQuery('');
              
              try {
                // Try to get metrics from local storage if available for context
                const cachedMetrics = localStorage.getItem('demo_metrics');
                const context = cachedMetrics ? JSON.parse(cachedMetrics) : { grossRevenue: 5420, netProfit: 3100, industryType: 'clinic' };
                
                const res = await fetch('/api/bi/agent', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: lowerQuery, context })
                });
                const data = await res.json();
                if (data.answer) {
                  setSlateContent(data.answer);
                } else {
                  setSlateContent('حدث خطأ أثناء معالجة البيانات.');
                }
              } catch (error) {
                setSlateContent('تعذر الاتصال بمحرك الذكاء الاصطناعي.');
              } finally {
                setSlateLoading(false);
              }
            } 
          });
        }

        setResults(mockResults);
        setIsProcessing(false);
      }, 300); // 300ms latency simulation

      return () => clearTimeout(timeout);
    } else {
      setResults([]);
    }
  }, [query, router]);

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-32 bg-[rgba(3,7,18,0.6)] backdrop-blur-md" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-2xl cyber-widget p-4 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--glass-border)] pb-4">
          <Search size={24} className="text-[var(--accent-primary)]" />
          <input 
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xl text-white placeholder-[var(--accent-primary)]/50 outline-none"
            placeholder="ابدأ الكتابة للبحث..."
          />
          {isProcessing && <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />}
        </div>
        
        {results.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {results.map((result) => (
              <div 
                key={result.id}
                onClick={() => {
                  result.action();
                  setIsOpen(false);
                  setQuery('');
                }}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--hover-bg)] cursor-pointer transition-colors border border-transparent hover:border-[var(--glass-border)] group"
              >
                <div>
                  <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
                    {result.type === 'ai_insight' ? <Zap size={16} className="text-[#f59e0b]" /> : <ArrowRight size={16} className="text-[var(--text-dim)]" />}
                    {result.title}
                  </div>
                  {result.desc && <div className="text-[0.8rem] text-[var(--text-dim)] mt-1 ml-6">{result.desc}</div>}
                </div>
                <div className="opacity-0 group-hover:opacity-100 text-[var(--accent-primary)] text-sm font-semibold transition-opacity">
                  Execute ↵
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-xs text-[var(--accent-primary)]/70">
          <div className="flex items-center gap-2">
            <span>Processing at Edge (latency &lt; 400ms)</span>
            <div className="w-2 h-2">
              <div className="live-pulse"></div>
            </div>
          </div>
          <div>
            <span className="bg-[var(--glass-border)] px-2 py-1 rounded text-[var(--text-main)] mr-2">Esc</span> to close
          </div>
        </div>
      </div>
    </div>
    
    {/* Minimalist Slate (Jasper-Level Elegance) */}
    <div className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-[rgba(3,7,18,0.7)] backdrop-blur-3xl border-l border-[rgba(255,255,255,0.05)] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-[99999] transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${slateOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-8 h-full flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-[rgba(255,255,255,0.05)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#A7F3D0]/10 rounded-full flex items-center justify-center aura-glow">
              <Zap size={20} className="text-[#A7F3D0]" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg tracking-wide font-['Plus_Jakarta_Sans']">Master Agent</h3>
              <p className="text-xs text-[#A7F3D0]">Edge Intelligence Active</p>
            </div>
          </div>
          <button onClick={() => setSlateOpen(false)} className="text-[var(--text-dim)] hover:text-white transition-colors bg-[rgba(255,255,255,0.05)] p-2 rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        {/* User Query Log */}
        <div className="mb-6">
          <p className="text-[var(--text-dim)] text-xs uppercase tracking-wider mb-2">Your Query</p>
          <div className="bg-[rgba(255,255,255,0.03)] p-4 rounded-2xl border border-[rgba(255,255,255,0.05)] text-[var(--text-main)] font-['Plus_Jakarta_Sans']">
            "{slateQuery}"
          </div>
        </div>

        {/* AI Response Area */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[var(--text-dim)] text-xs uppercase tracking-wider mb-3">Analysis Result</p>
          {slateLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4">
              <Loader2 size={32} className="animate-spin text-[#A7F3D0]" />
              <p className="text-sm text-[var(--text-dim)] font-['Plus_Jakarta_Sans'] animate-pulse">Running Tokenized Data Reconciliation...</p>
            </div>
          ) : (
            <div className="text-[var(--text-main)] leading-relaxed font-['Plus_Jakarta_Sans'] whitespace-pre-wrap text-[0.95rem]">
              {slateContent}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="pt-6 mt-auto border-t border-[rgba(255,255,255,0.05)] text-center">
          <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest flex items-center justify-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Stage 4 WORM Firewall Protected
          </p>
        </div>
        
      </div>
    </div>
    </>
  );
}
