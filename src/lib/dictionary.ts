export type BusinessType =
  | 'clinic'
  | 'real_estate'
  | 'salon'
  | 'car_rental'
  | 'ecommerce'
  | 'restaurant'
  | 'other';

export type Locale = 'ar' | 'en';

export interface Dictionary {
  team: string;
  customers: string;
  bookings: string;
  services: string;
  totalBookings: string;
  newCustomers: string;
  revenue: string;
  recentActivity: string;
  provider: string;
  item: string;
}

const dictionaries: Record<Locale, Record<BusinessType, Dictionary>> = {
  ar: {
    clinic: { team: 'الأطباء والتخصصات', customers: 'المرضى', bookings: 'الحجوزات والكشوفات', services: 'الخدمات الطبية', totalBookings: 'إجمالي الكشوفات', newCustomers: 'مرضى جدد', revenue: 'الإيرادات المتوقعة', recentActivity: 'أحدث الحجوزات', provider: 'طبيب', item: 'خدمة طبية' },
    real_estate: { team: 'الوكلاء العقاريون', customers: 'العملاء المستثمرون', bookings: 'مواعيد المعاينات', services: 'العقارات المتاحة', totalBookings: 'المعاينات المحجوزة', newCustomers: 'عملاء جدد', revenue: 'العمولات المتوقعة', recentActivity: 'أحدث طلبات المعاينة', provider: 'وكيل عقاري', item: 'عقار' },
    salon: { team: 'المتخصصات / الخبراء', customers: 'العميلات', bookings: 'حجوزات الجلسات', services: 'خدمات التجميل', totalBookings: 'إجمالي الجلسات', newCustomers: 'عميلات جدد', revenue: 'الإيرادات المتوقعة', recentActivity: 'أحدث الحجوزات', provider: 'متخصصة', item: 'خدمة تجميل' },
    car_rental: { team: 'مسؤولو المبيعات', customers: 'المستأجرون / المشترون', bookings: 'طلبات الإيجار / المعاينة', services: 'أسطول السيارات', totalBookings: 'إجمالي الطلبات', newCustomers: 'عملاء جدد', revenue: 'الإيرادات المتوقعة', recentActivity: 'أحدث الطلبات', provider: 'مسؤول مبيعات', item: 'سيارة' },
    ecommerce: { team: 'فريق المبيعات والدعم', customers: 'المتسوقون', bookings: 'طلبات الشراء', services: 'المنتجات', totalBookings: 'إجمالي الطلبات', newCustomers: 'متسوقون جدد', revenue: 'المبيعات المتوقعة', recentActivity: 'أحدث الطلبات', provider: 'مسؤول مبيعات', item: 'منتج' },
    restaurant: { team: 'طاقم العمل', customers: 'الزبائن', bookings: 'حجوزات الطاولات', services: 'قائمة الطعام (المنيو)', totalBookings: 'إجمالي الحجوزات', newCustomers: 'زبائن جدد', revenue: 'الإيرادات المتوقعة', recentActivity: 'أحدث الحجوزات', provider: 'موظف', item: 'وجبة' },
    other: { team: 'فريق العمل', customers: 'العملاء', bookings: 'الحجوزات / الطلبات', services: 'الخدمات / المنتجات', totalBookings: 'إجمالي الطلبات', newCustomers: 'عملاء جدد', revenue: 'الإيرادات المتوقعة', recentActivity: 'أحدث الطلبات', provider: 'موظف', item: 'خدمة' },
  },
  en: {
    clinic: { team: 'Doctors and Specialties', customers: 'Patients', bookings: 'Appointments and Consultations', services: 'Medical Services', totalBookings: 'Total Consultations', newCustomers: 'New Patients', revenue: 'Expected Revenue', recentActivity: 'Recent Appointments', provider: 'Doctor', item: 'Medical Service' },
    real_estate: { team: 'Real Estate Agents', customers: 'Investor Clients', bookings: 'Property Viewings', services: 'Available Properties', totalBookings: 'Booked Viewings', newCustomers: 'New Clients', revenue: 'Expected Commissions', recentActivity: 'Recent Viewing Requests', provider: 'Real Estate Agent', item: 'Property' },
    salon: { team: 'Specialists / Experts', customers: 'Clients', bookings: 'Session Bookings', services: 'Beauty Services', totalBookings: 'Total Sessions', newCustomers: 'New Clients', revenue: 'Expected Revenue', recentActivity: 'Recent Bookings', provider: 'Specialist', item: 'Beauty Service' },
    car_rental: { team: 'Sales Representatives', customers: 'Renters / Buyers', bookings: 'Rental / Viewing Requests', services: 'Vehicle Fleet', totalBookings: 'Total Requests', newCustomers: 'New Customers', revenue: 'Expected Revenue', recentActivity: 'Recent Requests', provider: 'Sales Representative', item: 'Vehicle' },
    ecommerce: { team: 'Sales and Support Team', customers: 'Shoppers', bookings: 'Purchase Orders', services: 'Products', totalBookings: 'Total Orders', newCustomers: 'New Shoppers', revenue: 'Expected Sales', recentActivity: 'Recent Orders', provider: 'Sales Representative', item: 'Product' },
    restaurant: { team: 'Staff', customers: 'Guests', bookings: 'Table Reservations', services: 'Menu', totalBookings: 'Total Reservations', newCustomers: 'New Guests', revenue: 'Expected Revenue', recentActivity: 'Recent Reservations', provider: 'Staff Member', item: 'Menu Item' },
    other: { team: 'Team', customers: 'Customers', bookings: 'Bookings / Requests', services: 'Services / Products', totalBookings: 'Total Requests', newCustomers: 'New Customers', revenue: 'Expected Revenue', recentActivity: 'Recent Requests', provider: 'Team Member', item: 'Service' },
  },
};

function isBusinessType(type: string): type is BusinessType {
  return type in dictionaries.ar;
}

export function getDictionary(type: string | null | undefined, locale: Locale | string = 'ar'): Dictionary {
  const selectedLocale: Locale = locale === 'en' ? 'en' : 'ar';
  const selectedType: BusinessType = type && isBusinessType(type) ? type : type ? 'other' : 'clinic';
  return dictionaries[selectedLocale][selectedType];
}
