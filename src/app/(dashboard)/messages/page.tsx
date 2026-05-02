'use client';

import React, { useState, useEffect } from 'react';
import styles from './Messages.module.css';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  Send, 
  MoreVertical, 
  MessageCircle, 
  Loader2,
  CheckCheck,
  Filter,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';

const MessagesPage = () => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'أهلاً بك يا فندم! منورنا. أقدر أساعد حضرتك إزاي النهاردة؟', sender: 'outgoing', time: 'الآن' },
  ]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    async function fetchBranches() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).single();
      if (!tenant) return;
      
      const { data: branchData } = await supabase.from('branches').select('id, name').eq('tenant_id', tenant.id);
      if (branchData) {
        setBranches(branchData);
      }
    }
    fetchBranches();
  }, []);

  // Using real tenant id for chat if needed, but for now we keep the UI logic
  const tenantId = '13814bff-a653-439a-8891-2c5a81124eb8';

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg = { id: Date.now(), text: inputText, sender: 'incoming', time: 'الآن' };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = inputText;
    setInputText('');
    
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, tenantId, history: messages })
      });

      const data = await response.json();
      
      const aiMsg = { 
        id: Date.now() + 1, 
        text: data.replyMessage, 
        sender: 'outgoing', 
        time: 'الآن' 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = { id: Date.now() + 2, text: 'حصل عندي مشكلة بسيطة، حابب تحجز إيه وأنا هسجله عندي؟', sender: 'outgoing', time: 'الآن' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // 1000-Year Hacker Defense: Advanced Phishing & Link Scanner
  const renderMessageWithLinkScanner = (text: string, sender: string) => {
    // Only scan incoming messages from patients/strangers
    if (sender === 'outgoing') return <span>{text}</span>;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const lowerUrl = part.toLowerCase();
        // Check for common phishing keywords in the URL
        const isPhishing = ['login', 'verify', 'update', 'account', 'password', 'billing', 'admin', 'auth', 'support', 'secure', 'facebook', 'meta', 'whatsapp'].some(keyword => lowerUrl.includes(keyword));
        
        if (isPhishing) {
          return (
            <span key={index} style={{ display: 'block', margin: '0.5rem 0', padding: '0.8rem', background: '#ef444415', border: '1px solid #ef444450', borderRadius: '12px' }}>
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <AlertTriangle size={16} /> تحذير أمني خطير (Phishing Link)
              </span>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                هذا الرابط قد يكون محاولة اختراق أو نصب لسرقة حسابات العيادة. يرجى عدم النقر عليه أو إدخال أي أرقام سرية.
              </div>
              <span style={{ color: '#ef4444', textDecoration: 'line-through', wordBreak: 'break-all', opacity: 0.7 }}>{part}</span>
            </span>
          );
        } else {
          return (
            <span key={index} style={{ display: 'block', margin: '0.5rem 0', padding: '0.8rem', background: '#f59e0b15', border: '1px solid #f59e0b50', borderRadius: '12px' }}>
              <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <ShieldAlert size={16} /> تنبيه: رابط خارجي مجهول
              </span>
              <a href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', wordBreak: 'break-all' }}>{part}</a>
            </span>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>المحادثات</h2>
            <select 
              value={selectedBranchFilter} 
              onChange={e => setSelectedBranchFilter(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '0.4rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                maxWidth: '120px'
              }}
            >
              <option value="all">كل الفروع</option>
              <option value="unassigned">فرع غير محدد</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>فرع {b.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input type="text" placeholder="بحث بالاسم..." />
          </div>
        </div>
        <div className={styles.chatList}>
          <div className={`${styles.chatItem} ${styles.active}`}>
            <div className={styles.avatar}>أ
              <div className={styles.platformIcon}><MessageCircle size={14} color="#25D366" /></div>
            </div>
            <div className={styles.chatInfo}>
              <div className={styles.chatTop}><span className={styles.name}>أحمد محمود</span></div>
              <div className={styles.lastMsg}>نشط الآن</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.chatArea}>
        <div className={styles.chatHeader}>
          <div className={styles.headerInfo}>
            <div className={styles.avatar}>أ</div>
            <div>
              <div className={styles.name}>أحمد محمود</div>
              <div className={styles.time}>واتساب</div>
            </div>
          </div>
          <MoreVertical size={20} />
        </div>

        <div className={styles.messagesList}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.message} ${msg.sender === 'incoming' ? styles.incoming : styles.outgoing}`}>
              {renderMessageWithLinkScanner(msg.text, msg.sender)}
              <div style={{ fontSize: '0.65rem', marginTop: '4px', opacity: 0.6, display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                {msg.time}
                {msg.sender === 'outgoing' && <CheckCheck size={12} color="#25D366" />}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className={styles.incoming} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', width: 'fit-content' }}>
              <div className={styles.typingDots}>
                <span>.</span><span>.</span><span>.</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <input 
              type="text" 
              placeholder="اكتب ردك هنا..." 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
          </div>
          <button className={styles.sendBtn} onClick={handleSendMessage}>
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
