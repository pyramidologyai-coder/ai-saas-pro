'use client';

import React from 'react';
import styles from './Header.module.css';
import { Search, Bell, Moon, Sun, Languages } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const Header = () => {
  const { toggleLanguage, t, lang } = useLanguage();

  const [theme, setTheme] = React.useState('dark');

  React.useEffect(() => {
    // Check local storage on mount
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <header className={styles.header}>
      <div 
        className={styles.searchBar} 
        style={{ cursor: 'pointer', border: '1px solid var(--accent-primary)' }}
        onClick={() => window.dispatchEvent(new Event('open-neural-cmd'))}
      >
        <Search size={18} className="text-[var(--accent-primary)]" />
        <input 
          type="text" 
          placeholder="إسأل الذكاء الاصطناعي (أو اضغط Ctrl+K)" 
          style={{ cursor: 'pointer', pointerEvents: 'none' }}
          readOnly 
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.langBtn} onClick={toggleLanguage}>
          <Languages size={18} />
          <span>{t.language}</span>
        </button>
        
        <button className={styles.iconBtn} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <button className={styles.iconBtn}>
          <Bell size={20} />
          <span className={styles.badge}></span>
        </button>
      </div>
    </header>
  );
};

export default Header;
