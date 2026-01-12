
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, 
  Complaint, 
  ComplaintStatus, 
  Role,
  Message,
  AppNotification,
  TeamMessage,
  Attachment,
  LocationData
} from './types';
import { translations as t } from './translations';
import { StatusBadge } from './components/StatusBadge';
import { summarizeComplaint, extractIdData, generateAutoWelcome, refineResponseProfessionally } from './geminiService';

const AREAS = ['qanatar_center', 'village_shalaqan', 'village_monira', 'village_abughait', 'village_kharqania', 'village_bassous', 'village_barada'];
const CATEGORIES = ['cat_infrastructure', 'cat_healthcare', 'cat_education', 'cat_security', 'cat_utilities', 'cat_legal'];

const INITIAL_USERS: User[] = [
  { id: 'admin-health', fullName: 'د. سارة محمود', phoneNumber: '0111', password: '111', role: 'ADMIN', isActive: true, permittedCategories: ['الرعاية الصحية'] },
  { id: 'admin-infra', fullName: 'م. خالد حسن', phoneNumber: '0222', password: '222', role: 'ADMIN', isActive: true, permittedCategories: ['البنية التحتية'] },
  { id: 'admin-util', fullName: 'م. عصام شاكر', phoneNumber: '0555', password: '555', role: 'ADMIN', isActive: true, permittedCategories: ['المرافق العامة'] }
];

// Fix: Change from default export to named export
export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(INITIAL_USERS);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE' | 'DETAILS' | 'REPORTS' | 'ADMINS' | 'TEAM_CHAT' | 'SETTINGS'>('LIST');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [activeTeamChannel, setActiveTeamChannel] = useState<string>('GLOBAL');
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [isAiRefining, setIsAiRefining] = useState(false);
  
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [selectedArea, setSelectedArea] = useState(AREAS[0]);
  const [address, setAddress] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [adminForm, setAdminForm] = useState({ fullName: '', phoneNumber: '', password: '', role: 'ADMIN' as Role, permittedCategory: 'ALL' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string | 'ALL'>('ALL');
  const [reportPeriod, setReportPeriod] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'>('ALL');

  useEffect(() => {
    const mockComplaints: Complaint[] = Array.from({ length: 25 }).map((_, i) => ({
      id: `c-${i}`,
      citizenId: `u-${i % 5}`,
      citizenName: ['محمد فوزي', 'أحمد كمال', 'سلوى أحمد', 'إبراهيم حسن', 'منى علي'][i % 5],
      citizenPhone: `0102030405${i % 9}`,
      title: `طلب عاجل: ${t[CATEGORIES[i % 6] as keyof typeof t]} في ${t[AREAS[i % 7] as keyof typeof t]}`,
      category: t[CATEGORIES[i % 6] as keyof typeof t],
      description: `نعاني في منطقة ${t[AREAS[i % 7] as keyof typeof t]} من مشكلة كبيرة ونرجو تدخل النائب عزت كريم لحل هذا الملف العاجل.`,
      status: [ComplaintStatus.PENDING, ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED][i % 3],
      createdAt: new Date(Date.now() - (i * 86400000 * 2.5)),
      messages: [
        { id: `m-init-${i}`, senderId: `u-${i % 5}`, senderName: ['محمد فوزي', 'أحمد كمال', 'سلوى أحمد', 'إبراهيم حسن', 'منى علي'][i % 5], text: "بدأت الشكوى من هنا...", timestamp: new Date(Date.now() - (i * 86400000 * 2.4)) }
      ],
      location: { province: 'القليوبية', city: 'القناطر الخيرية', area: t[AREAS[i % 7] as keyof typeof t], address: 'شارع المحطة الرئيسي' }
    }));
    setComplaints(mockComplaints);
  }, []);

  const showToast = (title: string) => {
    const id = `toast-${Date.now()}`;
    setNotifications(prev => [{ id, title, body: '', timestamp: new Date(), read: false, type: 'STATUS', targetId: '' }, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const stats = useMemo(() => {
    if (!user) return null;
    const now = new Date();
    const periodStart = new Date();
    if (reportPeriod === 'DAY') periodStart.setHours(0, 0, 0, 0);
    else if (reportPeriod === 'WEEK') periodStart.setDate(now.getDate() - 7);
    else if (reportPeriod === 'MONTH') periodStart.setMonth(now.getMonth() - 1);
    else if (reportPeriod === 'YEAR') periodStart.setFullYear(now.getFullYear() - 1);
    else periodStart.setTime(0);

    let filtered = complaints.filter(c => c.createdAt >= periodStart);
    if (user.role === 'ADMIN' && !user.permittedCategories.includes('ALL')) {
      filtered = filtered.filter(c => user.permittedCategories.includes(c.category));
    }

    const catCounts = CATEGORIES.map(k => {
      const label = t[k as keyof typeof t];
      const count = filtered.filter(c => c.category === label).length;
      return { label, count, percentage: filtered.length ? (count / filtered.length) * 100 : 0 };
    });

    const areaCounts = AREAS.map(k => {
      const label = t[k as keyof typeof t];
      const count = filtered.filter(c => c.location.area === label).length;
      return { label, count, percentage: filtered.length ? (count / filtered.length) * 100 : 0 };
    });

    return { total: filtered.length, resolved: filtered.filter(c => c.status === ComplaintStatus.RESOLVED).length, catCounts, areaCounts };
  }, [complaints, reportPeriod, user]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone === '0100' && pass === 'admin') {
      setUser({ id: 'super', fullName: 'النائب عزت كريم', phoneNumber: '0100', role: 'SUPER_ADMIN', isActive: true, permittedCategories: ['ALL'] });
      setActiveTab('LIST');
      showToast("مرحباً بك يا سيادة النائب");
      return;
    }
    const found = registeredUsers.find(u => u.phoneNumber === phone && u.password === pass);
    if (found) {
      setUser(found);
      setActiveTab('LIST');
      showToast(`مرحباً بك، ${found.fullName}`);
    } else if (!isLoginView) {
      const newUser: User = { 
        id: `u-${Date.now()}`, fullName: name, phoneNumber: phone, password: pass, 
        role: 'CITIZEN', isActive: true, permittedCategories: [],
        location: { province: 'القليوبية', city: 'القناطر الخيرية', area: t[selectedArea as keyof typeof t], address }
      };
      setRegisteredUsers([...registeredUsers, newUser]);
      setUser(newUser);
      setActiveTab('LIST');
      showToast("تم إنشاء الحساب بنجاح");
    } else {
      showToast("خطأ: بيانات الدخول غير صحيحة");
    }
  };

  useEffect(() => {
    if (selectedComplaint && user?.role !== 'CITIZEN' && !selectedComplaint.aiSummary) {
      summarizeComplaint(selectedComplaint.description).then(res => {
        setComplaints(prev => prev.map(c => c.id === selectedComplaint.id ? { ...c, aiSummary: res } : c));
        setSelectedComplaint(prev => prev ? { ...prev, aiSummary: res } : null);
      });
    }
  }, [selectedComplaint, user]);

  const handleStatusChange = (newStatus: ComplaintStatus) => {
    if (!selectedComplaint) return;
    const updated = { ...selectedComplaint, status: newStatus };
    setComplaints(prev => prev.map(c => c.id === selectedComplaint.id ? updated : c));
    setSelectedComplaint(updated);
    showToast(`تم تغيير الحالة إلى: ${t[newStatus.toLowerCase().replace('_', '') as keyof typeof t] || newStatus}`);
  };

  const filteredComplaints = useMemo(() => {
    if (!user) return [];
    let list = user.role === 'CITIZEN' ? complaints.filter(c => c.citizenId === user.id) : complaints;
    if (user.role === 'ADMIN' && !user.permittedCategories.includes('ALL')) {
      list = list.filter(c => user.permittedCategories.includes(c.category));
    }
    return list.filter(c => {
      const matchesSearch = c.title.includes(searchTerm) || c.citizenName.includes(searchTerm);
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || c.category === (t[categoryFilter as keyof typeof t] || categoryFilter);
      return matchesSearch && matchesStatus && matchesCategory;
    }).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [complaints, user, searchTerm, statusFilter, categoryFilter]);

  const getStatusLabel = (status: string) => {
    const key = status.toLowerCase().replace('_', '');
    if (key === 'inprogress') return t.inProgress;
    return (t as any)[key] || status;
  };

  // Fix: Helper function to get tab titles, addressing the type narrowing error on line 381.
  const getTabTitle = (tab: typeof activeTab) => {
    switch (tab) {
      case 'LIST': return 'القائمة الرئيسية';
      case 'REPORTS': return 'التقارير والإحصائيات';
      case 'ADMINS': return 'إدارة فريق العمل';
      case 'TEAM_CHAT': return 'المحادثات الداخلية';
      case 'SETTINGS': return 'إعدادات الحساب';
      case 'CREATE': return 'تقديم طلب جديد'; 
      case 'DETAILS': return 'تفاصيل الطلب';
      default: return ''; // Should not happen with exhaustive check
    }
  };

  // Fix: Helper function for button classes, addressing type narrowing errors on lines 398, 401.
  const getButtonClasses = (currentTab: typeof activeTab, targetTab: typeof activeTab, activeColor: string) => {
    return `px-6 py-3 rounded-2xl text-sm font-black transition-all shadow-md ${
      currentTab === targetTab ? `${activeColor} text-white` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Cairo'] pb-20 text-slate-900" dir="rtl">
      {/* التنبيهات */}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3">
        {notifications.map(n => (
          <div key={n.id} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right font-bold flex items-center gap-3">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            {n.title}
          </div>
        ))}
      </div>

      {/* شريط التنقل العلوي */}
      <nav className="bg-emerald-800 text-white p-5 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setActiveTab('LIST')}>
            <div className="w-12 h-12 bg-white text-emerald-800 rounded-full flex items-center justify-center font-black text-2xl group-hover:rotate-12 transition-transform shadow-lg">ع</div>
            <div>
              <span className="text-2xl font-black block tracking-tight">النائب عزت كريم</span>
              <span className="text-[10px] font-bold opacity-75 uppercase">النظام الذكي للتواصل مع المواطنين</span>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end mr-4">
                <span className="text-sm font-black">{user.fullName}</span>
                <span className="text-[10px] opacity-75">{user.role === 'SUPER_ADMIN' ? 'النائب' : user.role === 'ADMIN' ? 'عضو المكتب' : 'مواطن'}</span>
              </div>
              <button onClick={() => setActiveTab('SETTINGS')} className="p-2.5 bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-all shadow-inner">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              <button onClick={() => setUser(null)} className="px-5 py-2.5 bg-emerald-900 hover:bg-red-900 rounded-xl text-sm font-black transition-all shadow-lg">خروج</button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {!user ? (
          <div className="max-w-xl mx-auto bg-white rounded-[2.5rem] shadow-2xl p-10 mt-10 border border-slate-100">
            <h2 className="text-3xl font-black text-emerald-900 text-center mb-8">{isLoginView ? 'تسجيل دخول' : 'إنشاء حساب مواطن'}</h2>
            <form onSubmit={handleAuth} className="space-y-5">
              {!isLoginView && (
                <>
                  <input placeholder="الاسم الكامل" required className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-emerald-500 outline-none" value={name} onChange={e => setName(e.target.value)} />
                  <select className="p-4 border-2 border-slate-100 rounded-2xl bg-white w-full font-bold focus:border-emerald-500 outline-none" value={selectedArea} onChange={e => setSelectedArea(e.target.value)}>
                    {AREAS.map(a => <option key={a} value={a}>{t[a as keyof typeof t]}</option>)}
                  </select>
                  <input placeholder="العنوان التفصيلي" className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-emerald-500 outline-none" value={address} onChange={e => setAddress(e.target.value)} />
                </>
              )}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 px-2 uppercase">رقم الهاتف</label>
                <input placeholder="01XXXXXXXXX" required className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-emerald-500 outline-none" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 px-2 uppercase">كلمة المرور</label>
                <input placeholder="********" type="password" required className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold focus:border-emerald-500 outline-none" value={pass} onChange={e => setPass(e.target.value)} />
              </div>
              <button className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-emerald-700 active:scale-95 transition-all">
                {isLoginView ? 'دخول للمنصة' : 'تسجيل حساب جديد'}
              </button>
            </form>
            <button onClick={() => setIsLoginView(!isLoginView)} className="w-full text-center mt-8 text-sm text-emerald-600 font-black hover:underline underline-offset-4">
              {isLoginView ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخول'}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* شريط الأدوات */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-6 rounded-3xl shadow-xl border border-slate-50">
              <div className="flex items-center gap-4">
                {activeTab !== 'LIST' && (
                  <button onClick={() => setActiveTab('LIST')} className="p-3 hover:bg-slate-100 rounded-2xl text-emerald-700 transition-colors">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 12H5m7 7l-7-7 7-7" /></svg>
                  </button>
                )}
                {/* Fix: Use helper function for tab title, addressing the error on original line 381 */}
                <h1 className="text-2xl font-black text-slate-800">
                  {getTabTitle(activeTab)}
                </h1>
              </div>
              <div className="flex flex-wrap gap-3">
                {user.role !== 'CITIZEN' && (
                  <>
                    {/* Fix: Use helper function for button classes, addressing potential error with 'REPORTS' */}
                    <button onClick={() => setActiveTab('REPORTS')} className={getButtonClasses(activeTab, 'REPORTS', 'bg-emerald-600')}>التقارير</button>
                    {/* Fix: Use helper function for button classes, addressing the error on original line 463 */}
                    <button onClick={() => setActiveTab('TEAM_CHAT')} className={getButtonClasses(activeTab, 'TEAM_CHAT', 'bg-blue-600')}>محادثات الفريق</button>
                  </>
                )}
                {user.role === 'SUPER_ADMIN' && (
                  // Fix: Removed extra curly braces around button to fix "button is not defined" error
                  <button onClick={() => setActiveTab('ADMINS')} className={getButtonClasses(activeTab, 'ADMINS', 'bg-orange-600')}>إدارة الفريق</button>
                )}
                {user.role === 'CITIZEN' && (
                  <button onClick={() => setActiveTab('CREATE')} className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all">+ تقديم طلب جديد</button>
                )}
              </div>
            </div>

            {/* القائمة الرئيسية للطلبات */}
            {activeTab === 'LIST' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border shadow-sm">
                  <input placeholder="ابحث بالاسم أو الموضوع..." className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl text-sm font-bold md:col-span-2 outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl text-sm font-bold outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                    <option value="ALL">كل الحالات</option>
                    {Object.values(ComplaintStatus).map(s => (
                      <option key={s} value={s}>{getStatusLabel(s)}</option>
                    ))}
                  </select>
                  <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl text-sm font-bold outline-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="ALL">كل التصنيفات</option>
                    {CATEGORIES.map(c => <option key={c} value={t[c as keyof typeof t]}>{t[c as keyof typeof t]}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom duration-700">
                  {filteredComplaints.length > 0 ? filteredComplaints.map(c => (
                    <div key={c.id} onClick={() => { setSelectedComplaint(c); setActiveTab('DETAILS'); }} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-6">
                        <StatusBadge status={c.status} />
                        <span className="text-[11px] text-slate-400 font-black">{c.createdAt.toLocaleDateString('ar-EG')}</span>
                      </div>
                      <h3 className="font-black text-xl text-slate-800 mb-3 leading-tight group-hover:text-emerald-700 transition-colors">{c.title}</h3>
                      <p className="text-sm text-slate-400 mb-6 font-bold">{c.location.area}</p>
                      <div className="pt-6 border-t flex justify-between items-center">
                        <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl">{c.category}</span>
                        <span className="text-[11px] text-slate-400 font-bold">{c.citizenName}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold text-xl">لا توجد طلبات تطابق بحثك حالياً.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* التقارير والإحصائيات */}
            {activeTab === 'REPORTS' && stats && (
              <div className="space-y-8 animate-in slide-in-from-top duration-700">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <h2 className="text-3xl font-black text-emerald-900 underline underline-offset-8">تحليلات قطاع: {user.role === 'SUPER_ADMIN' ? 'كافة القطاعات' : user.permittedCategories[0]}</h2>
                  <select className="p-4 border-2 border-emerald-100 rounded-2xl text-sm bg-white font-black shadow-lg outline-none focus:border-emerald-600" value={reportPeriod} onChange={e => setReportPeriod(e.target.value as any)}>
                    <option value="ALL">كامل الفترة التاريخية</option>
                    <option value="DAY">إحصائيات اليوم</option>
                    <option value="WEEK">آخر 7 أيام</option>
                    <option value="MONTH">آخر 30 يوم</option>
                    <option value="YEAR">آخر سنة كاملة</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-t-8 border-slate-800 text-center">
                    <p className="text-slate-400 text-sm font-black mb-2 uppercase tracking-widest">إجمالي الوارد</p>
                    <p className="text-6xl font-black text-slate-800">{stats.total}</p>
                  </div>
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-t-8 border-emerald-600 text-center">
                    <p className="text-slate-400 text-sm font-black mb-2 uppercase tracking-widest">تم الحل بنجاح</p>
                    <p className="text-6xl font-black text-emerald-600">{stats.resolved}</p>
                  </div>
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-t-8 border-orange-500 text-center">
                    <p className="text-slate-400 text-sm font-black mb-2 uppercase tracking-widest">تحت المراجعة</p>
                    <p className="text-6xl font-black text-orange-500">{stats.total - stats.resolved}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* توزيع القرى */}
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="text-2xl font-black text-slate-800 mb-10 border-r-8 border-emerald-600 pr-4">توزيع الطلبات جغرافياً (القرى)</h3>
                    <div className="space-y-8">
                      {stats.areaCounts.map(item => (
                        <div key={item.label}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-black text-slate-700">{item.label}</span>
                            <span className="font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg">{item.count} طلب</span>
                          </div>
                          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner">
                            <div className="bg-emerald-600 h-full rounded-full transition-all duration-1000" style={{ width: `${item.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* توزيع القطاعات */}
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="text-2xl font-black text-slate-800 mb-10 border-r-8 border-blue-600 pr-4">توزيع الطلبات حسب القطاع</h3>
                    <div className="space-y-8">
                      {stats.catCounts.map(item => (
                        <div key={item.label}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-black text-slate-700">{item.label}</span>
                            <span className="font-black text-blue-800 bg-blue-50 px-3 py-1 rounded-lg">{item.count} طلب</span>
                          </div>
                          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${item.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* إدارة فريق العمل */}
            {activeTab === 'ADMINS' && user.role === 'SUPER_ADMIN' && (
              <div className="space-y-8 animate-in slide-in-from-right duration-700">
                <div className="bg-white p-10 rounded-[2.5rem] border shadow-2xl">
                  <h2 className="text-2xl font-black text-emerald-900 mb-8 border-b pb-4">{editingAdmin ? 'تعديل بيانات عضو' : 'إضافة عضو جديد للمكتب'}</h2>
                  <form className="grid grid-cols-1 md:grid-cols-3 gap-6" onSubmit={e => {
                    e.preventDefault();
                    if (editingAdmin) {
                      setRegisteredUsers(registeredUsers.map(u => u.id === editingAdmin.id ? { 
                        ...u, 
                        fullName: adminForm.fullName, 
                        phoneNumber: adminForm.phoneNumber, 
                        password: adminForm.password || u.password, 
                        permittedCategories: [adminForm.permittedCategory] 
                      } : u));
                      setEditingAdmin(null);
                      showToast("تم تحديث بيانات العضو بنجاح");
                    } else {
                      const nu: User = { 
                        id: `adm-${Date.now()}`, 
                        ...adminForm, 
                        isActive: true, 
                        permittedCategories: [adminForm.permittedCategory] 
                      };
                      setRegisteredUsers([...registeredUsers, nu]);
                      showToast("تمت إضافة العضو الجديد للمكتب");
                    }
                    setAdminForm({ fullName: '', phoneNumber: '', password: '', role: 'ADMIN', permittedCategory: 'ALL' });
                  }}>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 px-2 uppercase">الاسم الكامل</label>
                      <input placeholder="مثال: م. أحمد كمال" required className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-500" value={adminForm.fullName} onChange={e => setAdminForm({...adminForm, fullName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 px-2 uppercase">رقم الهاتف</label>
                      <input placeholder="01XXXXXXXXX" required className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-500" value={adminForm.phoneNumber} onChange={e => setAdminForm({...adminForm, phoneNumber: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 px-2 uppercase">كلمة المرور</label>
                      <input placeholder={editingAdmin ? "اتركها فارغة لعدم التغيير" : "حدد كلمة سر"} required={!editingAdmin} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-500" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black text-slate-400 px-2 uppercase">القطاع المسؤول عنه</label>
                      <select className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-white font-bold outline-none focus:border-emerald-500" value={adminForm.permittedCategory} onChange={e => setAdminForm({...adminForm, permittedCategory: e.target.value})}>
                        <option value="ALL">كامل القطاعات (مدير)</option>
                        {CATEGORIES.map(c => <option key={c} value={t[c as keyof typeof t]}>{t[c as keyof typeof t]}</option>)}
                      </select>
                    </div>
                    <button className="md:col-span-1 bg-emerald-600 text-white font-black rounded-2xl py-4 shadow-xl hover:bg-emerald-700 mt-auto transition-all active:scale-95">
                      {editingAdmin ? 'حفظ التعديلات' : 'إضافة للمكتب'}
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {registeredUsers.filter(u => u.role === 'ADMIN').map(admin => (
                    <div key={admin.id} className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 group hover:border-emerald-500 transition-all">
                      <div className="flex justify-between items-center mb-6">
                        <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">{admin.fullName.charAt(0)}</div>
                        <div className="flex gap-2">
                          <button onClick={() => { 
                            setEditingAdmin(admin); 
                            setAdminForm({ fullName: admin.fullName, phoneNumber: admin.phoneNumber, password: '', role: admin.role, permittedCategory: admin.permittedCategories[0] }); 
                          }} className="text-emerald-600 p-2 hover:bg-emerald-50 rounded-xl transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => setRegisteredUsers(registeredUsers.filter(u => u.id !== admin.id))} className="text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      <p className="font-black text-xl text-slate-800 mb-2">{admin.fullName}</p>
                      <p className="text-sm text-slate-400 mb-4 font-bold">{admin.phoneNumber}</p>
                      <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl uppercase tracking-tighter">
                        {admin.permittedCategories[0] === 'ALL' ? 'مدير قطاعات' : `مسؤول: ${admin.permittedCategories[0]}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* المحادثات الداخلية */}
            {activeTab === 'TEAM_CHAT' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[75vh] animate-in zoom-in duration-500">
                <div className="lg:col-span-1 bg-white rounded-[2rem] border shadow-2xl p-6 overflow-y-auto space-y-3">
                  <h2 className="font-black text-emerald-900 text-xl px-2 mb-6 border-r-4 border-emerald-600 pr-4">غرف المحادثة</h2>
                  <button onClick={() => setActiveTeamChannel('GLOBAL')} className={`w-full p-5 rounded-2xl flex items-center gap-4 transition-all shadow-sm ${activeTeamChannel === 'GLOBAL' ? 'bg-emerald-700 text-white scale-105 shadow-xl' : 'hover:bg-slate-50 border border-slate-100'}`}>
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black">🌍</div>
                    <span className="font-black text-sm">المجموعة العامة للمكتب</span>
                  </button>
                  <div className="pt-8 border-t-2 mt-8">
                    <p className="text-[10px] font-black text-slate-400 px-2 uppercase mb-4 tracking-widest">محادثات خاصة مع النائب</p>
                    {user.role === 'SUPER_ADMIN' ? (
                      registeredUsers.filter(u => u.role === 'ADMIN').map(admin => (
                        <button key={admin.id} onClick={() => setActiveTeamChannel(`PRIVATE_${admin.id}`)} className={`w-full p-4 rounded-xl flex items-center gap-4 mb-2 transition-all ${activeTeamChannel === `PRIVATE_${admin.id}` ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-50 border border-slate-50'}`}>
                          <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center text-xs font-black">{admin.fullName.charAt(0)}</div>
                          <span className="text-xs font-black">{admin.fullName}</span>
                        </button>
                      ))
                    ) : (
                      <button onClick={() => setActiveTeamChannel(`PRIVATE_${user.id}`)} className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${activeTeamChannel === `PRIVATE_${user.id}` ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-50 border border-slate-50'}`}>
                        <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center text-xs font-black">ع</div>
                        <span className="text-xs font-black">مكتب النائب عزت كريم</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-3 bg-white rounded-[2rem] border shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-6 bg-slate-50 border-b flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${activeTeamChannel === 'GLOBAL' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                    <span className="font-black text-slate-700 text-lg">{activeTeamChannel === 'GLOBAL' ? 'الغرفة العامة لمكتب النائب' : 'محادثة خاصة ومؤمنة'}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/50">
                    {teamMessages.filter(m => m.channelId === activeTeamChannel).length > 0 ? (
                      teamMessages.filter(m => m.channelId === activeTeamChannel).map(m => (
                        <div key={m.id} className={`flex flex-col ${m.senderId === user.id ? 'items-end' : 'items-start'}`}>
                          <span className="text-[10px] font-black text-slate-400 mb-2 px-2">{m.senderName}</span>
                          <div className={`p-4 rounded-2xl max-w-[75%] text-sm shadow-md transition-transform hover:scale-[1.02] ${m.senderId === user.id ? 'bg-emerald-700 text-white rounded-tr-none shadow-emerald-100' : 'bg-white border-2 border-slate-100 rounded-tl-none'}`}>
                            <p className="font-bold leading-relaxed">{m.text}</p>
                            <span className="text-[8px] block mt-2 opacity-60 font-black tracking-tighter">{m.timestamp.toLocaleTimeString('ar-EG')}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <svg className="w-20 h-20 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <p className="font-black text-xl">ابدأ المحادثة الآن مع الفريق</p>
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-white border-t">
                    <form className="flex gap-4" onSubmit={e => {
                      e.preventDefault();
                      const input = (e.currentTarget.elements.namedItem('msg') as HTMLInputElement);
                      if (input.value.trim()) {
                        setTeamMessages([...teamMessages, { 
                          id: `tm-${Date.now()}`, 
                          senderId: user.id, 
                          senderName: user.fullName, 
                          channelId: activeTeamChannel, 
                          text: input.value, 
                          timestamp: new Date() 
                        }]);
                        input.value = '';
                      }
                    }}>
                      <input name="msg" placeholder="اكتب رسالة لأعضاء المكتب..." className="flex-1 bg-slate-50 p-5 rounded-[1.5rem] border-2 border-transparent focus:border-emerald-500 outline-none text-sm font-bold shadow-inner transition-all" autoComplete="off" />
                      <button className="bg-emerald-600 text-white p-5 rounded-2xl shadow-xl hover:bg-emerald-700 active:scale-90 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </form>
                  </div>
                </div>
              </div> {/* Closes div.grid.grid-cols-1.lg:grid-cols-4 from line 495 */}
            )} {/* Closes activeTab === 'TEAM_CHAT' && (...) conditional from line 494 */}

            {/* تفاصيل الشكوى */}
            {activeTab === 'DETAILS' && selectedComplaint && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom duration-700">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-10 rounded-[2.5rem] border shadow-xl space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                    <h2 className="text-2xl font-black text-slate-800 leading-tight relative z-10">{selectedComplaint.title}</h2>
                    
                    {/* التحكم في الحالة للمسؤولين */}
                    {user.role !== 'CITIZEN' && (
                      <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border relative z-10">
                        <p className="text-xs font-black text-slate-400">تحديث حالة الطلب:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.values(ComplaintStatus).map(s => (
                            <button 
                              key={s} 
                              onClick={() => handleStatusChange(s)}
                              className={`px-2 py-2 rounded-xl text-[10px] font-black border transition-all ${selectedComplaint.status === s ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                            >
                              {getStatusLabel(s)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-4 border-y text-xs font-black relative z-10">
                      <span className="text-slate-400">الحالة الحالية:</span>
                      <StatusBadge status={selectedComplaint.status} />
                    </div>
                    
                    <div className="text-xs font-black text-slate-600 space-y-4 relative z-10">
                      {/* اسم مقدم الطلب (مرئي للموظفين) */}
                      {user.role !== 'CITIZEN' && (
                        <p className="flex items-center gap-3"><span className="text-lg">👤</span> <span className="text-emerald-700 font-extrabold text-sm">{selectedComplaint.citizenName}</span></p>
                      )}
                      <p className="flex items-center gap-3"><span className="text-lg">📍</span> {selectedComplaint.location.area}</p>
                      <p className="flex items-center gap-3"><span className="text-lg">🏛️</span> {selectedComplaint.category}</p>
                      <p className="flex items-center gap-3"><span className="text-lg">📅</span> {selectedComplaint.createdAt.toLocaleString('ar-EG')}</p>
                    </div>
                  </div>
                  {selectedComplaint.aiSummary && (
                    <div className="bg-amber-50 p-8 rounded-[2rem] border-2 border-amber-200 relative shadow-lg">
                      <span className="absolute -top-4 right-6 bg-amber-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-md">تلخيص ذكي تلقائي (AI)</span>
                      <p className="text-sm italic text-amber-900 leading-relaxed font-black">"{selectedComplaint.aiSummary}"</p>
                    </div>
                  )}
                </div>
                
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border shadow-2xl flex flex-col h-[700px] overflow-hidden">
                  <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                    <span className="font-black text-slate-800 text-lg">سجل المراسلات مع المواطن</span>
                    {isAiRefining && <span className="text-[10px] font-black text-emerald-600 animate-pulse bg-emerald-50 px-3 py-1 rounded-full">جاري تحسين الرد بالذكاء الاصطناعي...</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')]">
                    <div className="bg-white p-8 rounded-[2rem] border-2 border-emerald-100 shadow-xl">
                      <div className="flex justify-between mb-4">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{selectedComplaint.citizenName} (الرسالة الأصلية)</p>
                        <span className="text-[10px] text-slate-300 font-bold">{selectedComplaint.citizenPhone}</span>
                      </div>
                      <p className="text-lg text-slate-800 leading-relaxed font-bold">{selectedComplaint.description}</p>
                    </div>
                    {selectedComplaint.messages.map(m => (
                      <div key={m.id} className={`flex flex-col ${m.senderId === user.id ? 'items-end' : 'items-start'}`}>
                        <div className={`p-6 rounded-3xl max-w-[85%] text-sm shadow-xl transition-all hover:scale-[1.01] ${m.senderId === user.id ? 'bg-emerald-700 text-white rounded-tr-none shadow-emerald-100' : m.isAiGenerated ? 'bg-amber-100 text-amber-900 border-2 border-amber-200' : 'bg-white border-2 border-slate-100 rounded-tl-none'}`}>
                          {m.isAiGenerated && <span className="text-[9px] font-black block mb-2 underline underline-offset-4 decoration-amber-500 text-amber-700">✨ مساعد المكتب الذكي</span>}
                          <p className="leading-relaxed font-bold">{m.text}</p>
                          <span className="text-[8px] block mt-3 opacity-60 font-black tracking-widest">{m.timestamp.toLocaleTimeString('ar-EG')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-6 bg-white border-t space-y-4">
                    {user.role !== 'CITIZEN' && (
                      <div className="flex justify-end">
                        <button 
                          onClick={async () => {
                            const input = document.getElementById('citizen-reply-input') as HTMLTextAreaElement;
                            if (!input.value) return;
                            setIsAiRefining(true);
                            const res = await refineResponseProfessionally(input.value, {
                              citizenName: selectedComplaint.citizenName,
                              complaintTitle: selectedComplaint.title,
                              complaintDesc: selectedComplaint.description
                            });
                            input.value = res;
                            setIsAiRefining(false);
                          }}
                          className="text-[11px] font-black bg-emerald-100 text-emerald-800 px-6 py-2.5 rounded-2xl hover:bg-emerald-200 transition-all shadow-md flex items-center gap-2"
                        >
                          ✨ صياغة رد رسمي متكامل
                        </button>
                      </div>
                    )}
                    <form className="flex gap-4" onSubmit={e => {
                      e.preventDefault();
                      const input = (e.currentTarget.elements.namedItem('msg') as HTMLTextAreaElement);
                      if (input.value.trim()) {
                        const nm: Message = { id: `m-${Date.now()}`, senderId: user.id, senderName: user.fullName, text: input.value, timestamp: new Date() };
                        const updated = { ...selectedComplaint, messages: [...selectedComplaint.messages, nm] };
                        setComplaints(complaints.map(c => c.id === selectedComplaint.id ? updated : c));
                        setSelectedComplaint(updated);
                        input.value = '';
                      }
                    }}>
                      <textarea 
                        id="citizen-reply-input" 
                        name="msg" 
                        placeholder="اكتب ردك الرسمي هنا..." 
                        className="flex-1 bg-slate-50 p-5 rounded-[1.5rem] outline-none text-sm border-2 border-slate-100 focus:border-emerald-500 transition-all resize-y min-h-[60px] max-h-[300px] font-bold shadow-inner" 
                      />
                      <button className="bg-emerald-600 text-white p-5 rounded-2xl shadow-2xl self-end active:scale-90 transition-all hover:bg-emerald-700">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* إعدادات */}
            {activeTab === 'SETTINGS' && (
              <div className="max-w-2xl mx-auto bg-white p-12 rounded-[2.5rem] border shadow-2xl animate-in zoom-in duration-500">
                <h2 className="text-3xl font-black text-slate-800 mb-10 text-center border-b pb-6">إعدادات الحساب الشخصي</h2>
                <div className="space-y-10">
                  <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg">
                      {user.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-800">{user.fullName}</p>
                      <p className="text-slate-400 font-bold">{user.phoneNumber}</p>
                    </div>
                  </div>
                  <form className="space-y-6" onSubmit={e => {
                    e.preventDefault();
                    if (newPassword) {
                      setRegisteredUsers(registeredUsers.map(u => u.id === user.id ? { ...u, password: newPassword } : u));
                      setUser({ ...user, password: newPassword });
                      setNewPassword('');
                      showToast("تم تحديث كلمة المرور بنجاح");
                      setActiveTab('LIST');
                    }
                  }}>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 px-2 uppercase">تغيير كلمة المرور</label>
                      <input type="password" placeholder="أدخل كلمة المرور الجديدة هنا" className="w-full p-5 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-500" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <button className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all active:scale-95">تحديث بيانات الحساب</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'CREATE' && (
              <div className="max-w-3xl mx-auto bg-white p-12 rounded-[2.5rem] shadow-2xl border animate-in slide-in-from-bottom duration-700">
                <h2 className="text-3xl font-black text-emerald-900 mb-10 border-b pb-6">تقديم طلب أو شكوى جديدة للنائب</h2>
                <form className="space-y-8" onSubmit={async e => {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const title = (target.elements.namedItem('title') as HTMLInputElement).value;
                  const cat = (target.elements.namedItem('category') as HTMLSelectElement).value;
                  const desc = (target.elements.namedItem('desc') as HTMLTextAreaElement).value;
                  
                  const nc: Complaint = {
                    id: `c-${Date.now()}`, citizenId: user.id, citizenName: user.fullName, citizenPhone: user.phoneNumber,
                    title, category: cat, description: desc, status: ComplaintStatus.PENDING, createdAt: new Date(),
                    messages: [], location: user.location || { province: 'القليوبية', city: 'القناطر الخيرية', area: 'المركز', address: '' }
                  };
                  
                  const welcome = await generateAutoWelcome(user.fullName, title);
                  nc.messages.push({ id: 'w', senderId: 'ai', senderName: 'نظام الاستقبال الذكي', text: welcome, timestamp: new Date(), isAiGenerated: true });
                  
                  setComplaints([nc, ...complaints]);
                  showToast("تم إرسال طلبك للنائب بنجاح");
                  setActiveTab('LIST');
                }}>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 px-2 uppercase">عنوان الطلب</label>
                    <input name="title" placeholder="مثال: طلب رصف طريق - شكوى من انقطاع المياه" required className="w-full p-5 border-2 border-slate-100 rounded-2xl font-black outline-none focus:border-emerald-500 shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 px-2 uppercase">القطاع المختص</label>
                    <select name="category" className="w-full p-5 border-2 border-slate-100 rounded-2xl bg-white font-black outline-none focus:border-emerald-500 shadow-sm">
                      {CATEGORIES.map(c => <option key={c} value={t[c as keyof typeof t]}>{t[c as keyof typeof t]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 px-2 uppercase">شرح الموضوع بالتفصيل</label>
                    <textarea name="desc" placeholder="اشرح مشكلتك بوضوح هنا ليتسنى للمكتب دراستها..." required rows={7} className="w-full p-5 border-2 border-slate-100 rounded-2xl font-black outline-none focus:border-emerald-500 shadow-sm resize-y" />
                  </div>
                  <button className="w-full py-6 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xl shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all">إرسال الطلب الآن للمكتب</button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
