import React from 'react';
import Link from 'next/link';
import styles from './Landing.module.css';
import { Bot, CalendarClock, MessageSquareText } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <h1 className={styles.title}>موظف الاستقبال الذكي لعيادتك</h1>
        <p className={styles.subtitle}>
          أول نظام SaaS متكامل يجمع بين قوة الذكاء الاصطناعي (Gemini) ومرونة الواتساب (Meta API). دع الذكاء الاصطناعي يرد على مرضاك، يحجز المواعيد، ويرسل رسائل التذكير والمتابعة تلقائياً 24/7.
        </p>
        <Link href="/dashboard">
          <button className={styles.ctaBtn}>ابدأ تجربتك المجانية الآن</button>
        </Link>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <Bot size={32} />
          </div>
          <h3 className={styles.featureTitle}>رد آلي ذكي (AI)</h3>
          <p className={styles.featureDesc}>
            ردود طبيعية بلهجة مصرية ودودة. يفهم استفسارات المرضى ويجيب عليها بناءً على إعدادات عيادتك الخاصة ومواعيدك وأسعارك.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <CalendarClock size={32} />
          </div>
          <h3 className={styles.featureTitle}>حجز المواعيد تلقائياً</h3>
          <p className={styles.featureDesc}>
            يسأل العميل عن الخدمة المطلوبة والموعد المناسب، ثم يسجل الحجز فوراً في قاعدة بياناتك لتشاهده حياً في لوحة تحكمك.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <MessageSquareText size={32} />
          </div>
          <h3 className={styles.featureTitle}>متابعة وتذكير عبر الواتساب</h3>
          <p className={styles.featureDesc}>
            منبه تلقائي يرسل رسالة تذكير للمريض قبل ميعاده بـ 24 ساعة، ورسالة متابعة بعد الكشف تطلب منه تقييم العيادة على جوجل!
          </p>
        </div>
      </section>
    </div>
  );
}
