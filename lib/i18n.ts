/**
 * Page chrome in four languages. The AI itself replies in whatever language the
 * visitor writes in — this is only the furniture around it: buttons, headings,
 * the open/closed line.
 *
 * Adding a language is one entry here. Set `rtl: true` and the whole page
 * mirrors.
 */

export type LangCode = "en" | "ms" | "ar" | "zh";

export const LANGUAGES: { code: LangCode; label: string; rtl?: boolean }[] = [
  { code: "en", label: "English" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "ar", label: "العربية", rtl: true },
  { code: "zh", label: "中文" },
];

export type Copy = {
  askUs: string;
  chatWith: string;          // "Chat with {name}"
  openNow: string;
  closesAt: string;          // "Closes {time}"
  closedNow: string;
  opensAt: string;           // "Opens {day} {time}"
  closedToday: string;
  services: string;
  hours: string;
  findUs: string;
  callUs: string;
  from: string;
  minutes: string;           // "{n} min"
  askAboutIt: string;
  typeMessage: string;
  send: string;
  poweredNote: string;
  today: string;
  days: string[];            // Mon-first
  bookNow: string;
  close: string;
};

export const COPY: Record<LangCode, Copy> = {
  en: {
    askUs: "Ask us anything",
    chatWith: "Chat with {name}",
    openNow: "Open now",
    closesAt: "closes {time}",
    closedNow: "Closed",
    opensAt: "opens {day} {time}",
    closedToday: "Closed today",
    services: "Services and prices",
    hours: "Opening hours",
    findUs: "Find us",
    callUs: "Call",
    from: "from",
    minutes: "{n} min",
    askAboutIt: "Ask about this",
    typeMessage: "Type a message",
    send: "Send",
    poweredNote: "Replies are instant, day or night.",
    today: "Today",
    days: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    bookNow: "Book an appointment",
    close: "Close",
  },
  ms: {
    askUs: "Tanya kami apa sahaja",
    chatWith: "Berbual dengan {name}",
    openNow: "Buka sekarang",
    closesAt: "tutup {time}",
    closedNow: "Tutup",
    opensAt: "buka {day} {time}",
    closedToday: "Tutup hari ini",
    services: "Perkhidmatan dan harga",
    hours: "Waktu operasi",
    findUs: "Lokasi kami",
    callUs: "Telefon",
    from: "dari",
    minutes: "{n} minit",
    askAboutIt: "Tanya tentang ini",
    typeMessage: "Taip mesej",
    send: "Hantar",
    poweredNote: "Jawapan segera, siang atau malam.",
    today: "Hari ini",
    days: ["Isnin","Selasa","Rabu","Khamis","Jumaat","Sabtu","Ahad"],
    bookNow: "Buat temujanji",
    close: "Tutup",
  },
  ar: {
    askUs: "اسألنا عن أي شيء",
    chatWith: "تحدث مع {name}",
    openNow: "مفتوح الآن",
    closesAt: "يغلق {time}",
    closedNow: "مغلق",
    opensAt: "يفتح {day} {time}",
    closedToday: "مغلق اليوم",
    services: "الخدمات والأسعار",
    hours: "ساعات العمل",
    findUs: "موقعنا",
    callUs: "اتصل",
    from: "من",
    minutes: "{n} دقيقة",
    askAboutIt: "اسأل عن هذا",
    typeMessage: "اكتب رسالة",
    send: "إرسال",
    poweredNote: "ردود فورية، ليلاً أو نهاراً.",
    today: "اليوم",
    days: ["الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت","الأحد"],
    bookNow: "احجز موعداً",
    close: "إغلاق",
  },
  zh: {
    askUs: "有任何问题都可以问",
    chatWith: "与 {name} 对话",
    openNow: "现正营业",
    closesAt: "{time} 关门",
    closedNow: "休息中",
    opensAt: "{day} {time} 开门",
    closedToday: "今日休息",
    services: "服务与价格",
    hours: "营业时间",
    findUs: "地址",
    callUs: "致电",
    from: "起",
    minutes: "{n} 分钟",
    askAboutIt: "询问此项",
    typeMessage: "输入信息",
    send: "发送",
    poweredNote: "全天候即时回复。",
    today: "今天",
    days: ["星期一","星期二","星期三","星期四","星期五","星期六","星期日"],
    bookNow: "预约",
    close: "关闭",
  },
};

export function isRtl(code: LangCode): boolean {
  return LANGUAGES.find(l => l.code === code)?.rtl === true;
}

/** Replace {placeholders} in a copy string. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/** Guess a starting language from the browser, falling back to English. */
export function detectLang(): LangCode {
  if (typeof navigator === "undefined") return "en";
  const tags = navigator.languages ?? [navigator.language];
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "ar") return "ar";
    if (base === "ms" || base === "id") return "ms";
    if (base === "zh") return "zh";
    if (base === "en") return "en";
  }
  return "en";
}
