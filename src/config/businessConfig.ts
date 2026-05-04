export type BusinessType = 'clinic' | 'restaurant' | 'salon' | 'realestate' | 'store' | 'cars';

export const businessConfig = {
  clinic: {
    terms: { customer: 'مريض', booking: 'موعد', service: 'تخصص', team: 'طبيب' },
    sidebar: {
      services: 'الخدمات الطبية',
      bookings: 'مواعيد المرضى',
      customers: 'المرضى',
      team: 'الأطباء والتخصصات',
      checkinButton: 'تسجيل وصول المريض'
    }
  },
  restaurant: {
    terms: { customer: 'زبون', booking: 'طلب', service: 'وجبة', team: 'طاقم' },
    sidebar: {
      services: 'قائمة الطعام',
      bookings: 'الطلبات',
      customers: 'الزبائن',
      team: 'طاقم العمل',
      checkinButton: 'تأكيد استلام الطلب'
    }
  },
  salon: {
    terms: { customer: 'عميلة', booking: 'موعد', service: 'خدمة تجميل', team: 'فريق' },
    sidebar: {
      services: 'الخدمات',
      bookings: 'المواعيد',
      customers: 'العميلات',
      team: 'فريق الصالون',
      checkinButton: 'بدء الخدمة'
    }
  },
  realestate: {
    terms: { customer: 'مستثمر', booking: 'معاينة', service: 'عقار', team: 'وكيل' },
    sidebar: {
      services: 'العقارات المتاحة',
      bookings: 'مواعيد المعاينات',
      customers: 'العملاء المستثمرين',
      team: 'الوكلاء العقاريين',
      checkinButton: 'تأكيد المعاينة'
    }
  },
  store: {
    terms: { customer: 'مشتري', booking: 'طلب', service: 'منتج', team: 'فريق' },
    sidebar: {
      services: 'المنتجات',
      bookings: 'الطلبات',
      customers: 'المشترين',
      team: 'فريق المتجر',
      checkinButton: 'تأكيد الاستلام'
    }
  },
  cars: {
    terms: { customer: 'مشتري', booking: 'استفسار', service: 'سيارة', team: 'مبيعات' },
    sidebar: {
      services: 'السيارات المتاحة',
      bookings: 'مواعيد التجربة',
      customers: 'المشترين',
      team: 'فريق المبيعات',
      checkinButton: 'تأكيد التجربة'
    }
  }
};
