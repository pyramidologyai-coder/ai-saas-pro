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
  AlertTriangle,
  ShieldAlert,
  Bot,
  User,
  Instagram,
  Facebook,
  Power,
  Layers,
  Zap,
  TrendingUp,
  Activity
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
  { id: '4', name: 'ياسر محمد', channel: 'whatsapp', lastMsg: 'هل يوجد حجز غداً؟', isAiPaused: false },
  { id: '2', name: 'سارة خالد', channel: 'instagram', lastMsg: 'شكراً جداً!', isAiPaused: false },
  { id: '5', name: 'نورهان علي', channel: 'instagram', lastMsg: 'بكام الكشف؟', isAiPaused: true },
  { id: '3', name: 'كريم مصطفى', channel: 'messenger', lastMsg: 'ممكن تفاصيل الحجز؟', isAiPaused: true },
];

export default function MessagesPage() {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Chat list state
  const [chats, setChats] = useState<ChatData[]>(MOCK_CHATS);
  const [activeChatId, setActiveChatId] = useState<string>('1');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'messenger' | 'instagram'>('all');

  // Messages state for active chat
  const [messages, setMessages] = useState([
    { id: 1, text: 'أهلاً بك يا فندم! منورنا. أقدر أساعد حضرتك إزاي النهاردة؟', sender: 'outgoing', time: '10:00 ص' },
  ]);

  // Roles & Hierarchy State
  const [role, setRole] = useState<'admin' | 'agency' | 'master_admin'>('admin');
  
  // Master Admin / Agency Dropdowns
  const [agencies, setAgencies] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState('all');
  
  // Clinic Admin Dropdown
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

  // Billing / Quota Counters (Mock data representing the real logic)
  const [aiQuotaUsed, setAiQuotaUsed] = useState(0);
  const [humanMessagesSent, setHumanMessagesSent] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const filteredChats = chats.filter(chat => channelFilter === 'all' || chat.channel === channelFilter);
  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  useEffect(() => {
    async function fetchInitialData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const superAdminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim());
      const isMaster = superAdminEmails.includes(session.user.email || '');
      
      if (isMaster) {
        setRole('master_admin');
        const { data: agData } = await supabase.from('agencies').select('id, name');
        if (agData) setAgencies(agData);
        const { data: tnData } = await supabase.from('tenants').select('id, name, agency_id');
        if (tnData) setAllTenants(tnData);
        
        // Master Admin sees massive global stats
        setAiQuotaUsed(8450);
        setHumanMessagesSent(1200);
      } else {
        // Check if Agency
        const { data: agencyData } = await supabase.from('agencies').select('id, name').eq('user_id', session.user.id).limit(1);
        if (agencyData && agencyData.length > 0) {
          setRole('agency');
          const { data: tnData } = await supabase.from('tenants').select('id, name').eq('agency_id', agencyData[0].id);
          if (tnData) setAllTenants(tnData);
          
          // Agency sees stats for all their sub-tenants
          setAiQuotaUsed(3240);
          setHumanMessagesSent(410);
        } else {
          // Normal Tenant (Clinic / Store Admin)
          setRole('admin');
          const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', session.user.id).single();
          if (tenant) {
            const { data: branchData } = await supabase.from('branches').select('id, name').eq('tenant_id', tenant.id);
            if (branchData) setBranches(branchData);
          }
          
          // Clinic Admin sees their exact active subscription quota usage
          setAiQuotaUsed(850);
          setHumanMessagesSent(120); // Free manual replies!
        }
      }
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    if (!activeChat.isAiPaused) {
      toggleAiPause(activeChat.id, true);
    }

    const userMsg = { id: Date.now(), text: inputText, sender: 'outgoing', time: 'الآن' };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    
    // Simulate incrementing FREE human messages
    setHumanMessagesSent(prev => prev + 1);
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

  const renderMessageWithLinkScanner = (text: string, sender: string) => {
    if (sender === 'outgoing') return <span>{text}</span>;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const lowerUrl = part.toLowerCase();
        const isPhishing = ['login', 'verify', 'update', 'account', 'password', 'billing', 'admin'].some(k => lowerUrl.includes(k));
        if (isPhishing) {
          return (
            <span key={index} style={{ display: 'block', margin: '0.5rem 0', padding: '0.8rem', background: '#ef444415', border: '1px solid #ef444450', borderRadius: '12px' }}>
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <AlertTriangle size={16} /> تحذير أمني خطير (Phishing Link)
              </span>
              <span style={{ color: '#ef4444', textDecoration: 'line-through', wordBreak: 'break-all', opacity: 0.7 }}>{part}</span>
            </span>
          );
        } else {
          return <a key={index} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', wordBreak: 'break-all' }}>{part}</a>;
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={styles.container} style={{ height: 'calc(100vh - 4rem)', display: 'flex' }}>
      
      {/* --- SIDEBAR (CHATS LIST) --- */}
      <div className={styles.sidebar} style={{ width: '380px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)' }}>
        <div className={styles.sidebarHeader} style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>المحادثات</h2>
            </div>

            {/* Role-Based Hierarchy Selectors */}
            {role === 'master_admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select value={selectedAgency} onChange={e => { setSelectedAgency(e.target.value); setSelectedTenant('all'); }} style={selectStyle}>
                  <option value="all">كل الوكالات (Global)</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)} style={selectStyle}>
                  <option value="all">كل الأنشطة في هذه الوكالة</option>
                  {allTenants.filter(t => selectedAgency === 'all' ? true : t.agency_id === selectedAgency).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {role === 'agency' && (
              <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)} style={selectStyle}>
                <option value="all">كل عملاء وكالتي</option>
                {allTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            {role === 'admin' && (
              <select value={selectedBranchFilter} onChange={e => setSelectedBranchFilter(e.target.value)} style={selectStyle}>
                <option value="all">كل فروع العيادة/المتجر</option>
                {branches.map(b => <option key={b.id} value={b.id}>فرع {b.name}</option>)}
              </select>
            )}
            
            {/* Live Quota & Billing Counters */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ flex: 1, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '0.6rem', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={12} color="var(--accent-primary)"/> رصيد AI مستهلك</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{aiQuotaUsed.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.6rem', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} color="#10b981"/> تدخل مجاني</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{humanMessagesSent.toLocaleString()}</div>
              </div>
            </div>

          </div>
          
          <div className={styles.searchBox} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
            <Search size={18} color="var(--text-dim)" style={{ marginLeft: '0.5rem' }} />
            <input type="text" placeholder="بحث باسم العميل..." style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%', outline: 'none' }} />
          </div>

          {/* CHANNEL TABS FILTER */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.4rem', borderRadius: '12px' }}>
            <button onClick={() => setChannelFilter('all')} style={{ ...tabStyle, background: channelFilter === 'all' ? 'var(--card-bg)' : 'transparent', color: channelFilter === 'all' ? 'var(--text-main)' : 'var(--text-dim)', flex: 1, boxShadow: channelFilter === 'all' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}>
              <Layers size={16} /> الكل
            </button>
            <button onClick={() => setChannelFilter('whatsapp')} style={{ ...tabStyle, background: channelFilter === 'whatsapp' ? '#25D36620' : 'transparent', color: channelFilter === 'whatsapp' ? '#25D366' : 'var(--text-dim)', flex: 1 }}>
              <MessageCircle size={16} />
            </button>
            <button onClick={() => setChannelFilter('messenger')} style={{ ...tabStyle, background: channelFilter === 'messenger' ? '#0084FF20' : 'transparent', color: channelFilter === 'messenger' ? '#0084FF' : 'var(--text-dim)', flex: 1 }}>
              <Facebook size={16} />
            </button>
            <button onClick={() => setChannelFilter('instagram')} style={{ ...tabStyle, background: channelFilter === 'instagram' ? '#E1306C20' : 'transparent', color: channelFilter === 'instagram' ? '#E1306C' : 'var(--text-dim)', flex: 1 }}>
              <Instagram size={16} />
            </button>
          </div>
        </div>

        <div className={styles.chatList} style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              لا توجد محادثات في هذه المنصة حالياً.
            </div>
          ) : (
            filteredChats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => setActiveChatId(chat.id)}
                style={{ 
                  padding: '1.25rem 1.5rem', 
                  display: 'flex', gap: '1rem', cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  background: activeChatId === chat.id ? 'var(--accent-primary-transparent)' : 'transparent',
                  transition: 'background 0.2s', position: 'relative'
                }}
              >
                {activeChatId === chat.id && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: 'var(--accent-primary)' }} />}
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
            ))
          )}
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-input)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => toggleAiPause(activeChat.id, false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: !activeChat.isAiPaused ? 'var(--accent-primary)' : 'transparent', color: !activeChat.isAiPaused ? '#fff' : 'var(--text-dim)', fontWeight: 700, transition: 'all 0.3s'
              }}
            >
              <Bot size={18} /> الرد الآلي (يُخصم من الباقة)
            </button>
            <button 
              onClick={() => toggleAiPause(activeChat.id, true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: activeChat.isAiPaused ? '#10b981' : 'transparent', color: activeChat.isAiPaused ? '#fff' : 'var(--text-dim)', fontWeight: 700, transition: 'all 0.3s'
              }}
            >
              <User size={18} /> تدخل بشري (مجاني)
            </button>
          </div>
        </div>

        {activeChat.isAiPaused && (
          <div style={{ background: '#10b98115', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #10b98130' }}>
            <Activity size={16} color="#10b981" />
            <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>أنت الآن في وضع التدخل البشري. إرسال الرسائل حالياً مجاني ولا يُخصم من الباقة.</span>
          </div>
        )}

        {/* Messages List */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ 
              maxWidth: '70%', alignSelf: msg.sender === 'incoming' ? 'flex-start' : 'flex-end',
              background: msg.sender === 'incoming' ? 'var(--card-bg)' : 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
              color: msg.sender === 'incoming' ? 'var(--text-main)' : '#fff', padding: '1rem 1.25rem',
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
              placeholder={activeChat.isAiPaused ? "اكتب ردك اليدوي هنا (مجاني)..." : "بمجرد أن تكتب هنا، سيتوقف الذكاء الاصطناعي وتستلم أنت المحادثة (مجاناً)..."}
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

const tabStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 700, fontSize: '0.9rem' };
const selectStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.4rem', borderRadius: '8px', fontSize: '0.8rem', width: '100%', outline: 'none' };
