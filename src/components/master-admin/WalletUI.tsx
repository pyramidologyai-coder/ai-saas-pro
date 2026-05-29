'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  DollarSign, 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { addWalletCreditAction, addTenantCreditAction } from '@/app/(dashboard)/master-admin/wallet/actions';

interface Transaction {
  id: string;
  agency_id: string | null;
  tenant_id: string | null;
  agency_name: string | null;
  tenant_name?: string | null;
  transaction_type: string;
  credit: number;
  debit: number;
  description: string;
  reference_id: string | null;
  created_at: string;
}

interface Agency {
  id: string;
  name: string;
  contact_email: string;
}

interface WalletUIProps {
  initialSummary: {
    total_credited: number;
    total_debited: number;
    current_balance: number;
    agencies_count: number;
  };
  initialTransactions: Transaction[];
  agencies: Agency[];
  directTenants?: any[];
  initialLang: 'ar' | 'en' | 'fr';
}

const DICT = {
  ar: {
    title: 'نظام إدارة الرصيد والمحافظ',
    subtitle: 'إدارة الشحن اليدوي ومتابعة العمليات المالية لجميع الوكالات الشريكة.',
    totalCredited: 'إجمالي الرصيد المشحون',
    totalSpent: 'إجمالي المصروف',
    currentBalance: 'الرصيد الحالي',
    totalAgencies: 'عدد الوكالات',
    rechargeTitle: 'شحن رصيد لوكالة شريكة',
    selectAgency: 'اختر الوكالة',
    amount: 'المبلغ المطلوب ($)',
    description: 'سبب الشحن / ملاحظات',
    rechargeBtn: 'تأكيد شحن الرصيد',
    recharging: 'جاري الشحن...',
    transactionsTitle: 'سجل المعاملات والعمليات المالية',
    filterAgency: 'تصفية حسب الوكالة',
    filterType: 'تصفية حسب نوع المعاملة',
    all: 'كل الوكالات',
    allTypes: 'كل الأنواع',
    colAgency: 'الوكالة الشريكة',
    colType: 'نوع العملية',
    colAmount: 'المبلغ',
    colDesc: 'الوصف',
    colRef: 'المعرّف المرجعي',
    colDate: 'التاريخ والوقت',
    emptyState: 'لا يوجد أي معاملات مالية متطابقة حالياً.',
    successMsg: 'تم شحن رصيد الوكالة بنجاح! 💰 ✓',
    errorMsg: 'فشلت عملية الشحن، يرجى المحاولة مرة أخرى.',
    typeDeposit: '📥 إيداع / شحن',
    typeSubscription: '💳 رسوم اشتراك',
    typeUsage: '⚡ استهلاك AI',
    typePayout: '📤 سحب أرباح',
    typeRefund: '🔄 استرداد',
    tabAgency: '🏢 شحن وكالة شريكة',
    tabTenant: '👤 شحن عميل مباشر',
    selectTenant: 'اختر العميل المباشر',
    successTenantMsg: 'تم شحن رصيد العميل المباشر بنجاح! 👤 ✓'
  },
  en: {
    title: 'Wallet & Ledger Management',
    subtitle: 'Manage manual recharges and track financial ledger events for reseller partner agencies.',
    totalCredited: 'Total Recharged',
    totalSpent: 'Total Spent',
    currentBalance: 'Current Balance',
    totalAgencies: 'Active Resellers',
    rechargeTitle: 'Recharge Reseller Wallet',
    selectAgency: 'Select Agency',
    amount: 'Amount in USD ($)',
    description: 'Transaction Description / Notes',
    rechargeBtn: 'Confirm Recharge',
    recharging: 'Recharging...',
    transactionsTitle: 'Double-Entry Financial Ledger',
    filterAgency: 'Filter by Agency',
    filterType: 'Filter by Transaction Type',
    all: 'All Agencies',
    allTypes: 'All Types',
    colAgency: 'Partner Agency',
    colType: 'Transaction Type',
    colAmount: 'Amount',
    colDesc: 'Description',
    colRef: 'Reference ID',
    colDate: 'Timestamp',
    emptyState: 'No ledger transactions match your criteria.',
    successMsg: 'Wallet recharged successfully! 💰 ✓',
    errorMsg: 'Failed to recharge. Please try again.',
    typeDeposit: '📥 Deposit',
    typeSubscription: '💳 Subscription',
    typeUsage: '⚡ AI Usage',
    typePayout: '📤 Payout',
    typeRefund: '🔄 Refund',
    tabAgency: '🏢 Recharge Agency Partner',
    tabTenant: '👤 Recharge Direct Tenant',
    selectTenant: 'Select Direct Tenant',
    successTenantMsg: 'Direct tenant wallet recharged successfully! 👤 ✓'
  },
  fr: {
    title: 'Gestion du Portefeuille & Grand Livre',
    subtitle: 'Gérerez les recharges manuelles et suivez les transactions financières pour tous les partenaires.',
    totalCredited: 'Total Rechargé',
    totalSpent: 'Total Dépensé',
    currentBalance: 'Solde Actuel',
    totalAgencies: 'Agences Partenaires',
    rechargeTitle: 'Recharger le Portefeuille',
    selectAgency: 'Sélectionner l\'Agence',
    amount: 'Montant en USD ($)',
    description: 'Description / Notes',
    rechargeBtn: 'Confirmer la Recharge',
    recharging: 'Recharge en cours...',
    transactionsTitle: 'Grand Livre Comptable',
    filterAgency: 'Filtrer par Agence',
    filterType: 'Filtrer par Type',
    all: 'Toutes les Agences',
    allTypes: 'Tous les Types',
    colAgency: 'Agence Partenaire',
    colType: 'Type de Transaction',
    colAmount: 'Montant',
    colDesc: 'Description',
    colRef: 'ID de Référence',
    colDate: 'Date et Heure',
    emptyState: 'Aucune transaction ne correspond à vos critères.',
    successMsg: 'Portefeuille rechargé avec succès! 💰 ✓',
    errorMsg: 'Échec de la recharge. Veuillez réessayer.',
    typeDeposit: '📥 Dépôt',
    typeSubscription: '💳 Abonnement',
    typeUsage: '⚡ Utilisation IA',
    typePayout: '📤 Paiement',
    typeRefund: '🔄 Remboursement',
    tabAgency: '🏢 Recharger le Partenaire',
    tabTenant: '👤 Recharger le Client Direct',
    selectTenant: 'Sélectionner le Client Direct',
    successTenantMsg: 'Portefeuille du client direct rechargé avec succès! 👤 ✓'
  }
};

export function WalletUI({
  initialSummary,
  initialTransactions,
  agencies,
  directTenants,
  initialLang
}: WalletUIProps) {
  const safeTransactions = Array.isArray(initialTransactions) ? initialTransactions : [];
  const safeAgencies = Array.isArray(agencies) ? agencies : [];
  const safeDirectTenants = Array.isArray(directTenants) ? directTenants : [];

  const router = useRouter();
  const [lang, setLang] = useState<'ar' | 'en' | 'fr'>(initialLang);
  const t = DICT[lang];

  const [activeFormTab, setActiveFormTab] = useState<'agency' | 'tenant'>('agency');
  const [summary, setSummary] = useState(initialSummary);
  const [transactions, setTransactions] = useState<Transaction[]>(safeTransactions);

  // Recharge Form State
  const [rechargeForm, setRechargeForm] = useState({
    agency_id: '',
    amount: '',
    description: ''
  });
  const [loadingRecharge, setLoadingRecharge] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [agencyFilter, setAgencyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const isRtl = lang === 'ar';

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const amountNum = parseFloat(rechargeForm.amount);
    if (!rechargeForm.agency_id) {
      setError(activeFormTab === 'agency'
        ? (isRtl ? 'يرجى اختيار الوكالة أولاً.' : 'Please select an agency.')
        : (isRtl ? 'يرجى اختيار العميل أولاً.' : 'Please select a tenant.')
      );
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(isRtl ? 'المبلغ يجب أن يكون أكبر من الصفر.' : 'Amount must be greater than zero.');
      return;
    }

    setLoadingRecharge(true);
    try {
      let res;
      if (activeFormTab === 'agency') {
        res = await addWalletCreditAction(
          rechargeForm.agency_id,
          amountNum,
          rechargeForm.description
        );
      } else {
        res = await addTenantCreditAction(
          rechargeForm.agency_id, // contains selected tenantId
          amountNum,
          rechargeForm.description
        );
      }

      if (res.success) {
        setSuccess(activeFormTab === 'agency' ? t.successMsg : t.successTenantMsg);
        
        // Optimistically update cards
        setSummary(prev => ({
          ...prev,
          total_credited: prev.total_credited + amountNum,
          current_balance: prev.current_balance + amountNum
        }));

        // Reset form
        setRechargeForm({
          agency_id: '',
          amount: '',
          description: ''
        });

        // Trigger dynamic router reload to fetch latest data on server
        router.refresh();

        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || t.errorMsg);
    } finally {
      setLoadingRecharge(false);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return t.typeDeposit;
      case 'subscription_fee': return t.typeSubscription;
      case 'ai_usage_fee': return t.typeUsage;
      case 'payout': return t.typePayout;
      case 'refund': return t.typeRefund;
      default: return type;
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesAgency = agencyFilter ? tx.agency_id === agencyFilter : true;
    const matchesType = typeFilter ? tx.transaction_type === typeFilter : true;
    return matchesAgency && matchesType;
  });

  return (
    <div style={{ padding: '2rem', color: 'var(--text-main)', direction: isRtl ? 'rtl' : 'ltr' }}>
      
      {/* Header with Language Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Wallet size={36} color="var(--accent-primary)" />
            {t.title}
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>{t.subtitle}</p>
        </div>

        {/* Language switch controls */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.3rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          {(['ar', 'en', 'fr'] as const).map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); router.push(`?lang=${l}`); }}
              style={{
                background: lang === l ? 'var(--accent-primary)' : 'transparent',
                color: lang === l ? 'white' : 'var(--text-dim)',
                border: 'none',
                padding: '0.4rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Cards Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        
        {/* Total Credited */}
        <div style={{ background: 'var(--card-bg)', padding: '1.6rem', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <TrendingUp color="#10b981" size={24} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.2rem', color: '#10b981' }}>
            ${(Number(summary?.total_credited) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{t.totalCredited}</div>
        </div>

        {/* Total Spent */}
        <div style={{ background: 'var(--card-bg)', padding: '1.6rem', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <TrendingDown color="#ef4444" size={24} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.2rem', color: '#ef4444' }}>
            ${(Number(summary?.total_debited) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{t.totalSpent}</div>
        </div>

        {/* Current Balance */}
        <div style={{ background: 'var(--card-bg)', padding: '1.6rem', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <DollarSign color="var(--accent-primary)" size={24} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.2rem', color: 'var(--text-main)' }}>
            ${(Number(summary?.current_balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{t.currentBalance}</div>
        </div>

        {/* Total Agencies */}
        <div style={{ background: 'var(--card-bg)', padding: '1.6rem', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <Building2 color="#8b5cf6" size={24} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.2rem', color: '#8b5cf6' }}>
            {Number(summary?.agencies_count) || 0}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{t.totalAgencies}</div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '3rem' }}>
        
        {/* Recharge Form Container */}
        <div style={{ 
          background: 'var(--card-bg)', 
          borderRadius: '28px', 
          border: '1px solid var(--glass-border)', 
          padding: '2rem',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '850', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <PlusCircle size={22} color="var(--accent-primary)" />
            {t.rechargeTitle}
          </h2>

          {/* Premium Form Tab Switcher */}
          <div style={{ 
            display: 'flex', 
            gap: '0.8rem', 
            marginBottom: '1.5rem', 
            borderBottom: '1px solid var(--glass-border)', 
            paddingBottom: '0.8rem' 
          }}>
            <button
              type="button"
              onClick={() => {
                setActiveFormTab('agency');
                setRechargeForm({ agency_id: '', amount: '', description: '' });
                setError(null);
                setSuccess(null);
              }}
              style={{
                background: activeFormTab === 'agency' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                color: activeFormTab === 'agency' ? 'var(--accent-primary)' : 'var(--text-dim)',
                border: activeFormTab === 'agency' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                padding: '0.6rem 1.2rem',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              <span>{t.tabAgency}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFormTab('tenant');
                setRechargeForm({ agency_id: '', amount: '', description: '' });
                setError(null);
                setSuccess(null);
              }}
              style={{
                background: activeFormTab === 'tenant' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                color: activeFormTab === 'tenant' ? 'var(--accent-primary)' : 'var(--text-dim)',
                border: activeFormTab === 'tenant' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                padding: '0.6rem 1.2rem',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              <span>{t.tabTenant}</span>
            </button>
          </div>

          {success && (
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid #10b981', 
              color: '#10b981', 
              padding: '1rem', 
              borderRadius: '12px', 
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontWeight: 'bold'
            }}>
              <CheckCircle2 size={20} />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid #ef4444', 
              color: '#ef4444', 
              padding: '1rem', 
              borderRadius: '12px', 
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontWeight: 'bold'
            }}>
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRecharge} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', alignItems: 'end' }}>
            
            {/* Conditional Dropdown Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: '600', fontSize: '0.9rem' }}>
                {activeFormTab === 'agency' ? t.selectAgency : t.selectTenant} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={rechargeForm.agency_id}
                onChange={(e) => setRechargeForm({...rechargeForm, agency_id: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)', 
                  background: 'rgba(255,255,255,0.03)', 
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="" style={{ background: '#0f172a' }}>
                  -- {activeFormTab === 'agency' ? t.selectAgency : t.selectTenant} --
                </option>
                {activeFormTab === 'agency' 
                  ? safeAgencies.map(a => (
                      <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name} ({a.contact_email})</option>
                    ))
                  : safeDirectTenants.map(dt => (
                      <option key={dt.id} value={dt.id} style={{ background: '#0f172a' }}>{dt.name} ({dt.plan_type})</option>
                    ))
                }
              </select>
            </div>

            {/* Amount input */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: '600', fontSize: '0.9rem' }}>
                {t.amount} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="100.00"
                value={rechargeForm.amount}
                onChange={(e) => setRechargeForm({...rechargeForm, amount: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)', 
                  background: 'rgba(255,255,255,0.03)', 
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  direction: 'ltr',
                  textAlign: isRtl ? 'right' : 'left'
                }}
              />
            </div>

            {/* Notes description input */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontWeight: '600', fontSize: '0.9rem' }}>
                {t.description}
              </label>
              <input
                type="text"
                placeholder={isRtl ? 'شحن يدوي للرصيد...' : 'Manual balance recharge...'}
                value={rechargeForm.description}
                onChange={(e) => setRechargeForm({...rechargeForm, description: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)', 
                  background: 'rgba(255,255,255,0.03)', 
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Submit button */}
            <div>
              <button
                type="submit"
                disabled={loadingRecharge}
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  borderRadius: '12px', 
                  border: 'none', 
                  background: 'var(--accent-primary)', 
                  color: 'white', 
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)',
                  opacity: loadingRecharge ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {loadingRecharge ? t.recharging : t.rechargeBtn}
              </button>
            </div>

          </form>
        </div>

      </div>

      {/* Transaction Table ledger Container */}
      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '28px', 
        border: '1px solid var(--glass-border)', 
        padding: '2rem',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
      }}>
        
        {/* Table Title and Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '850', margin: 0 }}>{t.transactionsTitle}</h2>
          
          {/* Filters controls */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            
            {/* Filter by Agency */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}><Search size={14} /></span>
              <select
                value={agencyFilter}
                onChange={(e) => setAgencyFilter(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(0,0,0,0.4)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="" style={{ background: '#0f172a' }}>{t.all}</option>
                {safeAgencies.map(a => (
                  <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Type */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(0,0,0,0.4)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="" style={{ background: '#0f172a' }}>{t.allTypes}</option>
                <option value="deposit" style={{ background: '#0f172a' }}>{t.typeDeposit}</option>
                <option value="subscription_fee" style={{ background: '#0f172a' }}>{t.typeSubscription}</option>
                <option value="ai_usage_fee" style={{ background: '#0f172a' }}>{t.typeUsage}</option>
                <option value="payout" style={{ background: '#0f172a' }}>{t.typePayout}</option>
                <option value="refund" style={{ background: '#0f172a' }}>{t.typeRefund}</option>
              </select>
            </div>

          </div>
        </div>

        {/* Ledger Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.95rem' }}>
                <th style={{ textAlign: isRtl ? 'right' : 'left', padding: '1rem' }}>{t.colAgency}</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>{t.colType}</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>{t.colAmount}</th>
                <th style={{ textAlign: isRtl ? 'right' : 'left', padding: '1rem' }}>{t.colDesc}</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>{t.colRef}</th>
                <th style={{ textAlign: 'center', padding: '1rem' }}>{t.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const amount = tx.credit > 0 ? tx.credit : -tx.debit;
                const isCredit = tx.credit > 0;

                // Defensive client-side lookup for tenant name in case tx.tenant_name is not filled yet
                const matchingTenant = tx.tenant_id ? safeDirectTenants.find(t => t.id === tx.tenant_id) : null;
                const finalTenantName = tx.tenant_name || matchingTenant?.name || null;

                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                    <td style={{ padding: '1.2rem', fontWeight: '600' }}>
                      {tx.agency_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                            {isRtl ? 'وكالة' : 'Agency'}
                          </span>
                          <span>{tx.agency_name}</span>
                        </div>
                      ) : finalTenantName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent-primary)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                            {isRtl ? 'عميل مباشر' : 'Direct Tenant'}
                          </span>
                          <span>{finalTenantName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>
                          {isRtl ? 'المنصة الرئيسية' : 'Master Platform'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1.2rem', textAlign: 'center', fontSize: '0.9rem' }}>
                      {getTransactionTypeLabel(tx.transaction_type)}
                    </td>
                    <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        color: isCredit ? '#10b981' : '#ef4444'
                      }}>
                        {isCredit ? '+' : ''}${Math.abs(amount).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem', fontSize: '0.9rem', color: 'var(--text-main)', maxWidth: '280px', wordWrap: 'break-word' }}>
                      {tx.description}
                    </td>
                    <td style={{ padding: '1.2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {tx.reference_id || '-'}
                    </td>
                    <td style={{ padding: '1.2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      {new Date(tx.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    {t.emptyState}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
