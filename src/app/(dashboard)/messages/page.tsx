'use client';

import React, { useState } from 'react';
import styles from './Messages.module.css';
import { 
  Search, 
  Send, 
  MoreVertical, 
  MessageCircle, 
  Loader2,
  CheckCheck
} from 'lucide-react';

const MessagesPage = () => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'أهلاً بك يا فندم! منورنا في عيادة النخبة. أقدر أساعد حضرتك في حجز أي موعد النهاردة؟', sender: 'outgoing', time: 'الآن' },
  ]);

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

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>المحادثات</h2>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input type="text" placeholder="بحث..." />
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
              {msg.text}
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
