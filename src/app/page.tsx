import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './Landing.module.css';
import { Bot, CalendarClock, MessageSquareText, ChevronLeft, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className={styles.container} dir="rtl">
      {/* Background glow effect */}
      <div className={styles.bgGlow}></div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.logo}>
          <Bot size={32} color="#8b5cf6" />
          <span style={{ fontWeight: 900 }}>AI SAAS PRO</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>المميزات</a>
          <a href="#pricing" className={styles.navLink}>الأسعار</a>
          <a href="#contact" className={styles.navLink}>تواصل معنا</a>
        </div>
        <Link href="/admind>
          <button className={styles.loginBtn}>تسجيل الدخول</button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.badge}>
          <Sparkles size={16} /> المدعوم بأحدث نماذج الذكاء الاصطناعي
        </div>
        <h1 className={styles.title}>
          حوّل عيادتك أو نشاطك ليعمل بذكاء اصطناعي 100% 
        </h1>
        <p className={styles.subtitle}>
          وداعاً للأنظمة القديمة. أول نظام <strong>Cyber-Omniscience</strong> في الشرق الأوسط يقدم استجابة فورية للعملاء، تدقيق مالي ذاتي، وشريط أوامر عصبي متقدم لإدارة عملك في أجزاء من الثانية.
        </p>
        <div className={styles.ctaGroup}>
          <Link href="/auth?signup=true">
            <button className={styles.primaryCta}>
              ابدأ الآن (التسجيل الذاتي) <ChevronLeft size={20} />
            </button>
          </Link>
          <Link href="/admind>
            <button className={styles.secondaryCta}>تجربة النظام (Live Demo)</button>
          </Link>
        </div>

        {/* 3D Mockup Image */}
        <div className={styles.mockupContainer}>
          <Image 
            src="/hero-mockup.png" 
            alt="Dashboard Mockup" 
            width={1200} 
            height={600} 
            className={styles.mockupImage} 
            priority
          />
        </div>
      </section>

      {/* USPs Section */}
      <section id="features" className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>لماذا نحن الجيل القادم؟ (Vs. Gabster)</h2>
        <div className={styles.featuresGrid}>
          
          <div className={styles.featureCard}>
            <div className={styles.iconBox}>
              <Sparkles size={36} />
            </div>
            <h3>استجابة لحظية (Zero-Latency)</h3>
            <p>
              يعمل نظامنا على بيئة Edge Runtime مما يضمن زمن استجابة أقل من 400ms، لتجربة محادثات وتحليل بيانات فورية لا تقارن بالأنظمة التقليدية.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconBox}>
              <Bot size={36} />
            </div>
            <h3>شريط الأوامر العصبي (Neural-Cmd)</h3>
            <p>
              بضغطة (Ctrl+K) يمكنك إصدار أوامر صوتية أو نصية للنظام بالكامل للبحث، الاستعلام عن الأرباح، أو تغيير الإعدادات بدون التنقل بين الصفحات.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconBox}>
              <CalendarClock size={36} />
            </div>
            <h3>تدقيق مالي ذاتي (Auto-Reconciled)</h3>
            <p>
              لوحة القيادة تحلل حجوزات الواتساب وتطابقها مع مدفوعات Stripe تلقائياً لتعطيك صافي الربح الحقيقي بدقة تامة دون أي تدخل بشري.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconBox}>
              <MessageSquareText size={36} />
            </div>
            <h3>جدار حماية 6-Stage Firewall</h3>
            <p>
              تشفير كامل للبيانات (Tokenization) وعزل حتمي باستخدام (RLS)، لضمان استحالة تداخل بيانات العيادات وحمايتها بمعايير HIPAA العالمية.
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}
