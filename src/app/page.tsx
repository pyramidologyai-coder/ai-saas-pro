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
        <Link href="/dashboard">
          <button className={styles.loginBtn}>تسجيل الدخول</button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.badge}>
          <Sparkles size={16} /> المدعوم بأحدث نماذج الذكاء الاصطناعي
        </div>
        <h1 className={styles.title}>
          حوّل عيادتك أو مطعمك ليعمل آلياً 24/7 مع سكرتير الذكاء الاصطناعي
        </h1>
        <p className={styles.subtitle}>
          أول نظام متكامل في الشرق الأوسط يجمع بين قوة الذكاء الاصطناعي ومرونة تطبيق الواتساب. 
          دع المساعد الذكي يرد على عملائك، يحجز المواعيد، يستقبل الطلبات، ويرسل التنبيهات تلقائياً.
        </p>
        <div className={styles.ctaGroup}>
          <Link href="/dashboard">
            <button className={styles.primaryCta}>
              ابدأ تجربتك المجانية <ChevronLeft size={20} />
            </button>
          </Link>
          <button className={styles.secondaryCta}>شاهد كيف يعمل</button>
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

      {/* Features Section */}
      <section id="features" className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>كل ما تحتاجه لإدارة عملك بذكاء</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.iconBox}>
              <Bot size={36} />
            </div>
            <h3>رد آلي طبيعي جداً</h3>
            <p>
              وداعاً للردود الآلية المملة. مساعدنا الذكي يتحدث بلهجة طبيعية، يفهم أسئلة عملائك المعقدة ويجيب عليها كأنه موظف بشري حقيقي متواجد طوال اليوم.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconBox}>
              <CalendarClock size={36} />
            </div>
            <h3>حجز واستقبال طلبات بدون أخطاء</h3>
            <p>
              يستعلم المساعد عن المواعيد والخدمات ويقوم بحجز الميعاد أو استقبال الطلب للعميل مباشرة في تقويم عملك مع ضمان الدقة الكاملة.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconBox}>
              <MessageSquareText size={36} />
            </div>
            <h3>متابعة وتقييم تلقائي</h3>
            <p>
              منبه تلقائي يرسل رسالة تذكير للعميل قبل موعده لتقليل نسبة التخلف عن الحضور، وبعد الزيارة يرسل رسالة تطلب منه تقييم عملك لرفع تصنيفك على خرائط جوجل.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
