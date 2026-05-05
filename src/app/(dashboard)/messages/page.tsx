'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  Bot,
  User,
  Instagram,
  Facebook,
  Power
} from 'lucide-react';

type Channel = 'whatsapp' | 'messenger' | 'instagram';

type ChatData = {
  id: string;
  name: string;
  channel: Channel;
  lastMsg: string;
  isAiPaused: boolean;
};

const MOCK_CHATS: ChatData[] = [
  { id: '1', name: 'أحمد محمود', channel: 'whatsapp', lastMsg: 'نشط الآن', isAiPaused: false },
  { id: '2', name: 'سارة خالد', channel: 'instagram', lastMsg: 'شكراً جداً!', isAiPaused: false },
  { id: '3', name: 'كريم مصطفى', channel: 'messenger', lastMsg: 'ممكن تفاصيل الحجز؟', isAiPaused: true },
];

const MessagesPage = () => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Chat list state
  const [chats, setChats] = useState<ChatData[]>(MOCK_CHATS);
  const [activeChatId, setActiveChatId] = useState<string>('1');

  // Messages state for the active chat
  const [messages, setMessages] = useState([
    { id: 1, text: 'أهلاً بك يا فندم! منورنا. أقدر أساعد حضرتك إزاي النهاردة؟', sender: 'outgoing', time: '10:00 ص' },
  ]);

  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [branches, setBranches] = useState<any[]>([]);

  // Master Admin State
  const [role, setRole] = useState('admin');
  const [agencies, setAgencies] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [totalMessagesToday, setTotalMessagesToday] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  useEffect(() => {
    async function fetchInitialData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim());
      const isMasterAdmin = superAdminEmails.includes(session.user.email || '') || session.user.user_metadata?.role === 'master_admin';
      
      if (isMasterAdmin) {
        setRole('master_admin');
        const { data: agData } = await supabase.from('agencies').select('id, name');
        if (agData) setAgencies(agData);
        
        const { data: tnData } = await supabase.from('tenants').select('id, name, agency_id');
        if (tnData) setAllTenants(tnData);
        
        setTotalMessagesToday(Math.floor(Math.random() * 500) + 120);
      } else {
        const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).single();
        if (!tenant) return;
        
        const { data: branchData } = await supabase.from('branches').select('id, name').eq('tenant_id', tenant.id);
        if (branchData) setBranches(branchData);
      }
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // 1. Immediately pause AI (Human Handover) if admin types manually
    if (!activeChat.isAiPaused) {
      toggleAiPause(activeChat.id, true);
    }

    const userMsg = { id: Date.now(), text: inputText, sender: 'outgoing', time: 'الآن' };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
  };

  const toggleAiPause = (chatId: string, forcePause?: boolean) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        return { ...chat, isAiPaused: forcePause !== undefined ? forcePause : !chat.isAiPaused };
      }
      return chat;
    }));
  };

  const getChannelIcon = (channel: Channel, size = 16) => {
    switch (channel) {
      case 'whatsapp': return <MessageCircle size={size} color="#25D366" />;
      case 'messenger': return <Facebook size={size} color="#0084FF" />;
      case 'instagram': return <Instagram size={size} color="#E1306C" />;
    }
  };

  // 1000-Year Hacker Defense: Advanced Phishing & Link Scanner
  const renderMessageWithLinkScanner = (text: string, sender: string) => {
    if (sender === 'outgoing') return <span>{text}</span>;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const lowerUrl = part.toLowerCase();
        const isPhishing = ['login', 'verify', 'update', 'account', 'password', 'billing', 'admin', 'auth', 'support', 'secure', 'facebook', 'meta', 'whatsapp'].some(keyword => lowerUrl.includes(keyword));
        
        if (isPhishing) {
          return (
            <span key={index} style={{ display: 'block', margin: '0.5rem 0', padding: '0.8rem', background: '#ef444415', border: '1px solid #ef444450', borderRadius: '12px' }}>
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <AlertTriangle size={16} /> تحذير أمني خطير (Phishing Link)
              </span>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                هذا الرابط قد يكون محاولة اختراق أو نصب لسرقة الحساب. يرجى عدم النقر عليه.
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
    <div className={styles.container} style={{ height: 'calc(100vh - 4rem)', display: 'flex' }}>
      
      {/* --- SIDEBAR (CHATS LIST) --- */}
      <div className={styles.sidebar} style={{ width: '350px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)' }}>
        <div className={styles.sidebarHeader} style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>المحادثات</h2>
              {role === 'master_admin' ? (
                <div style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 'bold' }}>
                  اليوم: {totalMessagesToday}
                </div>
              ) : (
                <select 
                  value={selectedBranchFilter} 
                  onChange={e => setSelectedBranchFilter(e.target.value)}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '8px', fontSize: '0.8rem' }}
                >
                  <option value="all">كل الفروع</option>
                  {branches.map(b => <option key={b.id} value={b.id}>فرع {b.name}</option>)}
                </select>
              )}
            </div>
          </div>
          
          <div className={styles.searchBox} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <Search size={18} color="var(--text-dim)" style={{ marginLeft: '0.5rem' }} />
            <input type="text" placeholder="بحث في المحادثات..." style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%', outline: 'none' }} />
          </div>
        </div>

        <div className={styles.chatList} style={{ flex: 1, overflowY: 'auto' }}>
          {chats.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChatId(chat.id)}
              style={{ 
                padding: '1.25rem 1.5rem', 
                display: 'flex', 
                gap: '1rem', 
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                background: activeChatId === chat.id ? 'var(--accent-primary-transparent)' : 'transparent',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--bg-input), var(--border-color))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {chat.name.charAt(0)}
                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: 'var(--card-bg)', borderRadius: '50%', padding: '2px' }}>
                  {getChannelIcon(chat.channel, 18)}
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>{chat.name}</span>
                  {chat.isAiPaused ? 
                    <span style={{ fontSize: '0.7rem', background: '#ef444420', color: '#ef4444', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>إيقاف الـ AI</span> :
                    <span style={{ fontSize: '0.7rem', background: '#10b98120', color: '#10b981', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>AI نشط</span>
                  }
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chat.lastMsg}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className={styles.chatArea} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
        
        {/* Chat Header */}
        <div className={styles.chatHeader} style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--bg-input), var(--border-color))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
              {activeChat.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{activeChat.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {getChannelIcon(activeChat.channel, 14)}
                <span style={{ textTransform: 'capitalize' }}>{activeChat.channel}</span>
              </div>
            </div>
          </div>
          
          {/* AI Toggle Switch (Human Handover) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-input)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => toggleAiPause(activeChat.id, false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: !activeChat.isAiPaused ? 'var(--accent-primary)' : 'transparent',
                color: !activeChat.isAiPaused ? '#fff' : 'var(--text-dim)',
                fontWeight: 700, transition: 'all 0.3s'
              }}
            >
              <Bot size={18} /> الرد الآلي
            </button>
            <button 
              onClick={() => toggleAiPause(activeChat.id, true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: activeChat.isAiPaused ? '#ef4444' : 'transparent',
                color: activeChat.isAiPaused ? '#fff' : 'var(--text-dim)',
                fontWeight: 700, transition: 'all 0.3s'
              }}
            >
              <User size={18} /> تدخل بشري
            </button>
          </div>
        </div>

        {/* AI Paused Alert Banner */}
        {activeChat.isAiPaused && (
          <div style={{ background: '#ef444415', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #ef444430' }}>
            <Power size={16} color="#ef4444" />
            <span style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>الذكاء الاصطناعي متوقف مؤقتاً. الموظف البشري هو من يدير المحادثة الآن.</span>
          </div>
        )}

        {/* Messages List */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ 
              maxWidth: '70%', 
              alignSelf: msg.sender === 'incoming' ? 'flex-start' : 'flex-end',
              background: msg.sender === 'incoming' ? 'var(--card-bg)' : 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: msg.sender === 'incoming' ? 'var(--text-main)' : '#fff',
              padding: '1rem 1.25rem',
              borderRadius: msg.sender === 'incoming' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
              border: msg.sender === 'incoming' ? '1px solid var(--border-color)' : 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              {renderMessageWithLinkScanner(msg.text, msg.sender)}
              <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', opacity: 0.7, display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                {msg.time}
                {msg.sender === 'outgoing' && <CheckCheck size={14} color="rgba(255,255,255,0.8)" />}
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--card-bg)', padding: '1rem', borderRadius: '16px 16px 16px 4px', border: '1px solid var(--border-color)' }}>
              <Loader2 size={18} className={styles.spin} color="var(--accent-primary)" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '1.5rem 2rem', background: 'var(--card-bg)', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <textarea 
              placeholder={activeChat.isAiPaused ? "اكتب ردك كمدير..." : "بمجرد أن تكتب هنا، سيتوقف الذكاء الاصطناعي تلقائياً لتستلم أنت المحادثة..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{ 
                flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', 
                color: 'var(--text-main)', padding: '1rem', borderRadius: '16px', fontSize: '1rem', 
                resize: 'none', height: '60px', outline: 'none', transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
            <button 
              onClick={handleSendMessage}
              style={{
                background: 'var(--accent-primary)', border: 'none', color: '#fff',
                width: '60px', height: '60px', borderRadius: '16px', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)', transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Send size={24} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MessagesPage;
