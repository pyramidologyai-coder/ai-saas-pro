export type BusinessType = 'clinic' | 'real_estate' | 'salon' | 'car_rental' | 'ecommerce' | 'restaurant' | 'other';

interface Dictionary {
  // Sidebar items
  team: string;
  customers: string;
  bookings: string;
  services: string;

  // Dashboard Stats
  totalBookings: string;
  newCustomers: string;
  revenue: string;
  recentActivity: string;

  // General Terms
  provider: string; // Doctor, Agent, Stylist, etc.
  item: string; // Service, Property, Car, Product
}

const dictionaries: Record<BusinessType, Dictionary> = {
  clinic: {
    team: 'الأطباء والتخصصات',
    customers: 'المرضى',
    bookings: 'الحجوزات والكشوفات',
    services: 'الخدمات الطبية',
    totalBookings: 'إجمالي الكشوفات',
    newCustomers: 'مرضى جدد',
    revenue: 'الإيرادات المتوقعة',
    recentActivity: 'أحدث الحجوزات',
    provider: 'طبيب',
    item: 'خدمة طبية'
  },
  real_estate: {
    team: 'الوكلاء العقاريين',
    customers: 'العملاء المستثمرين',
    bookings: 'مواعيد المعاينات',
    services: 'العقارات المتاحة',
    totalBookings: 'المعاينات المحجوزة',
    newCustomers: 'عملاء جدد',
    revenue: 'العمولات المتوقعة',
    recentActivity: 'أحدث طلبات المعاينة',
    provider: 'وكيل عقاري',
    item: 'عقار'
  },
  salon: {
    team: 'المتخصصات / الخبراء',
    customers: 'العميلات',
    bookings: 'حجوزات الجلسات',
    services: 'خدمات التجميل',
    totalBookings: 'إجمالي الجلسات',
    newCustomers: 'عميلات جدد',
    revenue: 'الإيرادات المتوقعة',
    recentActivity: 'أحدث الحجوزات',
    provider: 'متخصصة',
    item: 'خدمة تجميل'
  },
  car_rental: {
    team: 'مسؤولي المبيعات',
    customers: 'المستأجرين / المشترين',
    bookings: 'طلبات الإيجار / المعاينة',
    services: 'أسطول السيارات',
    totalBookings: 'إجمالي الطلبات',
    newCustomers: 'عملاء جدد',
    revenue: 'الإيرادات المتوقعة',
    recentActivity: 'أحدث الطلبات',
    provider: 'مسؤول مبيعات',
    item: 'سيارة'
  },
  ecommerce: {
    team: 'فريق المبيعات والدعم',
    customers: 'المتسوقين',
    bookings: 'طلبات الشراء',
    services: 'المنتجات',
    totalBookings: 'إجمالي الطلبات',
    newCustomers: 'متسوقين جدد',
    revenue: 'المبيعات المتوقعة',
    recentActivity: 'أحدث الطلبات',
    provider: 'مسؤول مبيعات',
    item: 'منتج'
  },
  restaurant: {
    team: 'طاقم العمل',
    customers: 'الزبائن',
    bookings: 'حجوزات الطاولات',
    services: 'قائمة الطعام (المنيو)',
    totalBookings: 'إجمالي الحجوزات',
    newCustomers: 'زبائن جدد',
    revenue: 'الإيرادات المتوقعة',
    recentActivity: 'أحدث الحجوزات',
    provider: 'موظف',
    item: 'وجبة'
  },
  other: {
    team: 'فريق العمل',
    customers: 'العملاء',
    bookings: 'الحجوزات / الطلبات',
    services: 'الخدمات / المنتجات',
    totalBookings: 'إجمالي الطلبات',
    newCustomers: 'عملاء جدد',
    revenue: 'الإيرادات المتوقعة',
    recentActivity: 'أحدث الطلبات',
    provider: 'موظف',
    item: 'خدمة'
  }
};

export function getDictionary(type: string | null | undefined): Dictionary {
  if (!type) return dictionaries['clinic']; // Default to clinic
  return dictionaries[type as BusinessType] || dictionaries['other'];
}
