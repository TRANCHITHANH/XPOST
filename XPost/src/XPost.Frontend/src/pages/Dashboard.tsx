import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldCheck, FileText, Globe, Search, Plus, ChevronDown,
  X, RefreshCw, AlertTriangle, ArrowUpRight, ShieldAlert
} from 'lucide-react';

interface DomainEntry {
  id: string;
  name: string;
  sslStatus: 'Valid' | 'Expiring Soon' | 'Expired';
  status: 'Online' | 'Maintenance' | 'Offline';
  registrar: string;
  expiryDate: string;
  autoRenew: boolean;
}

const initialDomains: DomainEntry[] = [
  { id: '1', name: 'echopedia.com', sslStatus: 'Valid', status: 'Online', registrar: 'Niagahoster', expiryDate: 'April 30, 2025', autoRenew: true },
  { id: '2', name: 'foodlefoodie.com', sslStatus: 'Expiring Soon', status: 'Maintenance', registrar: 'Dewaweb', expiryDate: 'June 15, 2025', autoRenew: true },
  { id: '3', name: 'crytonus.com', sslStatus: 'Expired', status: 'Offline', registrar: 'Hostinger', expiryDate: 'May 10, 2025', autoRenew: false },
  { id: '4', name: 'blitzfizz.com', sslStatus: 'Valid', status: 'Online', registrar: 'Rumahweb', expiryDate: 'August 24, 2025', autoRenew: true },
  { id: '5', name: 'nomadventures.co', sslStatus: 'Valid', status: 'Online', registrar: 'Namecheap', expiryDate: 'December 12, 2025', autoRenew: true },
  { id: '6', name: 'cryptotrack.net', sslStatus: 'Expired', status: 'Offline', registrar: 'GoDaddy', expiryDate: 'January 05, 2025', autoRenew: false },
  { id: '7', name: 'techflow.io', sslStatus: 'Expiring Soon', status: 'Online', registrar: 'Niagahoster', expiryDate: 'June 20, 2025', autoRenew: true },
];

export default function Dashboard() {
  const [domains, setDomains] = useState<DomainEntry[]>(initialDomains);
  const [selectedDomain, setSelectedDomain] = useState<DomainEntry>(initialDomains[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  const [newDomain, setNewDomain] = useState({
    name: '',
    sslStatus: 'Valid' as 'Valid' | 'Expiring Soon' | 'Expired',
    status: 'Online' as 'Online' | 'Maintenance' | 'Offline',
    registrar: 'Niagahoster',
    expiryDate: 'December 31, 2025',
    autoRenew: true
  });

  // Server restart simulator
  const handleRestart = () => {
    setIsRestarting(true);
    toast.loading('Đang khởi động lại máy chủ (Graceful Restart)...', { id: 'restart' });
    setTimeout(() => {
      setIsRestarting(false);
      toast.success('Máy chủ đã khởi động lại thành công!', { id: 'restart' });
    }, 2000);
  };

  // Add new domain handler
  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.name.trim()) {
      toast.error('Vui lòng nhập tên miền!');
      return;
    }
    const created: DomainEntry = {
      id: (domains.length + 1).toString(),
      name: newDomain.name.trim().toLowerCase(),
      sslStatus: newDomain.sslStatus,
      status: newDomain.status,
      registrar: newDomain.registrar,
      expiryDate: newDomain.expiryDate || 'December 31, 2025',
      autoRenew: newDomain.autoRenew
    };

    setDomains([created, ...domains]);
    setSelectedDomain(created);
    setShowAddModal(false);
    setNewDomain({
      name: '',
      sslStatus: 'Valid',
      status: 'Online',
      registrar: 'Niagahoster',
      expiryDate: 'December 31, 2025',
      autoRenew: true
    });
    toast.success(`Đã thêm miền mới: ${created.name}`);
  };

  // Stats calculation
  const totalDomainsCount = domains.length;
  const expiringSoonCount = domains.filter(d => d.sslStatus === 'Expiring Soon').length;
  const expiredCount = domains.filter(d => d.sslStatus === 'Expired').length;
  const activeSslCount = domains.filter(d => d.sslStatus === 'Valid').length;

  // Filtering domains based on search
  const filteredDomains = domains.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.registrar.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Pagination slicing
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDomains = filteredDomains.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(filteredDomains.length / itemsPerPage);

  const getSslBadge = (status: DomainEntry['sslStatus']) => {
    switch (status) {
      case 'Valid':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">Valid</span>;
      case 'Expiring Soon':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Expiring Soon</span>;
      case 'Expired':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Expired</span>;
    }
  };

  const getStatusBadge = (status: DomainEntry['status']) => {
    switch (status) {
      case 'Online':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Online
          </span>
        );
      case 'Maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Maintenance
          </span>
        );
      case 'Offline':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Offline
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-gray-100 min-h-screen">
      
      {/* ── TOP HEADER BLOCK ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">View live traffic data, visitor stats, and domain status at a glance.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            className="flex items-center gap-2 px-4.5 py-2.5 bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 text-slate-700 hover:text-red-700 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
            <span>Restart Server</span>
          </button>
          <button 
            onClick={() => toast.success('Đang mở chứng chỉ SSL...')} 
            className="flex items-center gap-2 px-4.5 py-2.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Manage SSL</span>
          </button>
          <button 
            onClick={() => toast.success('Đang khởi tạo báo cáo...')} 
            className="flex items-center gap-2 px-4.5 py-2.5 bg-white border border-gray-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
          >
            <FileText className="w-4 h-4 text-indigo-500" />
            <span>Reports</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI STATS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Domains', val: (1028 - 7 + totalDomainsCount).toLocaleString('vi-VN'), sub: 'Including active and inactive domains', color: 'from-blue-500 to-indigo-600', icon: <Globe className="w-4.5 h-4.5" /> },
          { label: 'Expiring Soon', val: (320 - 2 + expiringSoonCount).toString(), sub: 'Expiring within 30 days', color: 'from-amber-500 to-orange-600', icon: <AlertTriangle className="w-4.5 h-4.5" /> },
          { label: 'Expired Domains', val: (140 - 2 + expiredCount).toString(), sub: 'Renew now to avoid service disruption', color: 'from-rose-500 to-red-600', icon: <ShieldAlert className="w-4.5 h-4.5" /> },
          { label: 'Active SSL', val: `${37 - 3 + activeSslCount} / 100`, sub: 'Secure your visitors with HTTPS', color: 'from-emerald-500 to-teal-600', icon: <ShieldCheck className="w-4.5 h-4.5" /> },
        ].map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-bl-3xl -mr-3 -mt-3 flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
              <span className="text-xs font-semibold opacity-60">•••</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-slate-50 text-slate-600 rounded-lg shadow-sm border border-slate-100">
                {card.icon}
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.label}</p>
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none tracking-tight">{card.val}</p>
            <p className="text-xs text-slate-400 mt-2.5 font-medium leading-relaxed">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── EXPANDED DOMAIN DETAIL CONTAINER ── */}
      <div className="bg-white rounded-3xl border border-gray-200/60 shadow-sm p-6 relative">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <span className="font-extrabold text-lg uppercase">{selectedDomain.name.charAt(0)}{selectedDomain.name.charAt(1)}</span>
            </div>
            <div>
              <div className="relative inline-block text-left">
                <select 
                  value={selectedDomain.id} 
                  onChange={e => {
                    const found = domains.find(d => d.id === e.target.value);
                    if (found) setSelectedDomain(found);
                  }}
                  className="appearance-none bg-transparent hover:bg-slate-50 border-0 text-xl font-black text-slate-900 pr-8 pl-1.5 py-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer tracking-tight"
                >
                  {domains.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="flex items-center gap-3.5 flex-wrap mt-1 text-xs text-slate-500 font-semibold pl-1.5">
                <span>Registrar: <strong className="text-slate-800 font-bold">{selectedDomain.registrar}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1.5">Status: {getStatusBadge(selectedDomain.status)}</span>
                <span>•</span>
                <span>Expiry Date: <strong className="text-amber-600 font-bold">{selectedDomain.expiryDate}</strong></span>
                <span>•</span>
                <span>Auto-Renew: <strong className={selectedDomain.autoRenew ? 'text-green-600' : 'text-red-500'}>{selectedDomain.autoRenew ? 'On' : 'Off'}</strong></span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => toast.success(`Đang quản lý cấu hình: ${selectedDomain.name}`)}
              className="flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-all shadow-sm"
            >
              <span>Manage</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button 
              onClick={() => toast.success(`Mở khóa tính năng Premium cho: ${selectedDomain.name}`)}
              className="flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm hover:shadow shadow-indigo-600/10"
            >
              <span>Upgrade</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── CHARTS BLOCK: VISITORS + GEO-TRAFFIC MAP ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart A: Visitors Summary */}
        <div className="bg-white rounded-3xl border border-gray-200/60 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="font-black text-slate-900 text-base">Visitors Summary</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">DNS Queries & Visitors volume steps</p>
            </div>
            <div className="flex items-center gap-1.5">
              <select className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 px-3 py-1.5 rounded-xl focus:outline-none cursor-pointer">
                <option>April 2025</option>
                <option>May 2025</option>
              </select>
              <button className="p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-slate-400">
                <span className="text-sm">•••</span>
              </button>
            </div>
          </div>

          <div className="flex gap-4 text-xs font-semibold mb-4 text-slate-500 pl-1">
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Visitors</span>
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> DNS Queries</span>
          </div>

          {/* Steps Area SVG Chart */}
          <div className="relative h-60 w-full mt-4">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 text-[10px] text-slate-300 font-bold">
              {['100k', '75k', '50k', '25k'].map((label, idx) => (
                <div key={idx} className="w-full flex items-center justify-between border-b border-dashed border-slate-100 pb-1">
                  <span>{label}</span>
                  <span className="h-0" />
                </div>
              ))}
            </div>

            <svg className="w-full h-44 mt-4 overflow-visible z-10 relative" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* DNS Queries area (Dashed grey step path) */}
              <path 
                d="M 0 65 L 10 65 L 10 75 L 25 75 L 25 80 L 40 80 L 40 75 L 55 75 L 55 55 L 75 55 L 75 68 L 100 68" 
                fill="none" 
                stroke="#CBD5E1" 
                strokeWidth="2.5" 
                strokeDasharray="4,3"
              />
              <path 
                d="M 0 65 L 10 65 L 10 75 L 25 75 L 25 80 L 40 80 L 40 75 L 55 75 L 55 55 L 75 55 L 75 68 L 100 68 L 100 100 L 0 100 Z" 
                fill="#F1F5F9" 
                fillOpacity="0.3"
              />

              {/* Visitors step path (Solid blue) */}
              <path 
                d="M 0 50 L 15 50 L 15 35 L 30 35 L 30 45 L 48 45 L 48 30 L 62 30 L 62 58 L 80 58 L 80 40 L 100 40" 
                fill="none" 
                stroke="#3B82F6" 
                strokeWidth="3"
              />
              <path 
                d="M 0 50 L 15 50 L 15 35 L 30 35 L 30 45 L 48 45 L 48 30 L 62 30 L 62 58 L 80 58 L 80 40 L 100 40 L 100 100 L 0 100 Z" 
                fill="url(#blueGradient)" 
                fillOpacity="0.1"
              />

              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#FFFFFF" />
                </linearGradient>
              </defs>
            </svg>

            {/* Custom interactive indicator point */}
            <div className="absolute left-[48%] top-[12%] h-[68%] border-l-2 border-slate-900/60 z-20 pointer-events-none flex flex-col justify-between items-center">
              <div className="w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white shadow-sm -mt-1" />
              <span className="bg-slate-950 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-md -mb-4 shadow shadow-black/10">22nd</span>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] font-extrabold text-slate-400 px-1 pt-1.5">
              <span>&lt;</span>
              {['18th', '19th', '20th', '21st', '22nd', '23rd', '24th', '25th', '26th'].map((day, i) => (
                <span key={i} className={day === '22nd' ? 'text-slate-900 font-black border-b-2 border-blue-500' : ''}>{day}</span>
              ))}
              <span>&gt;</span>
            </div>
          </div>
        </div>

        {/* Chart B: Geo-Traffic Overview */}
        <div className="bg-white rounded-3xl border border-gray-200/60 p-6 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="font-black text-slate-900 text-base">Geo-Traffic Overview</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Top regional traffic origins map</p>
            </div>
            <div className="flex items-center gap-1.5">
              <select className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 px-3 py-1.5 rounded-xl focus:outline-none cursor-pointer">
                <option>April 2025</option>
                <option>May 2025</option>
              </select>
              <button className="p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-slate-400">
                <span className="text-sm">•••</span>
              </button>
            </div>
          </div>

          <div className="relative h-60 w-full flex items-center justify-center">
            
            {/* SVG stylized world outline map */}
            <svg viewBox="0 0 1000 500" className="w-full h-full opacity-35 object-contain">
              <path fill="#E2E8F0" stroke="#FFFFFF" strokeWidth="2" d="M150,150 L180,160 L210,140 Q250,120,290,140 L340,180 L400,200 L450,190 Q500,200,550,230 L580,270 L620,260 L680,310 L720,280 L790,290 L850,330 L900,320 M50,220 L100,260 L140,240 Q180,260,210,290 L240,320 Q280,340,320,380 L350,420 L400,450 L420,400" />
              <circle cx="680" cy="270" r="10" fill="#818CF8" fillOpacity="0.4" className="animate-ping" />
              <circle cx="680" cy="270" r="4" fill="#4F46E5" />
              
              <circle cx="700" cy="310" r="8" fill="#818CF8" fillOpacity="0.4" className="animate-ping" />
              <circle cx="700" cy="310" r="3.5" fill="#4F46E5" />
            </svg>

            {/* Southeast Asia visitors floating card */}
            <div className="absolute top-1/4 left-5 bg-white/95 backdrop-blur shadow-xl border border-gray-100 rounded-2xl p-4.5 w-60 z-20 animate-in fade-in slide-in-from-left-4 duration-300">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">SEA (Southeast Asia) Visitors</p>
              <div className="space-y-2">
                {[
                  { name: 'Singapore', flag: '🇸🇬', stats: '12,300/day' },
                  { name: 'Indonesia', flag: '🇮🇩', stats: '9,800/day' },
                  { name: 'Malaysia', flag: '🇲🇾', stats: '6,200/day' }
                ].map((country, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1.5 last:border-0 last:pb-0 font-medium">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span>{country.flag}</span>
                      <span>{country.name}</span>
                    </span>
                    <strong className="text-slate-900 font-extrabold">{country.stats}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Map zoom controls widget */}
            <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 bg-white/90 border border-gray-200/60 p-1.5 rounded-xl shadow-md z-20">
              <button onClick={() => toast.success('Phóng to bản đồ')} className="w-8 h-8 flex items-center justify-center font-black text-slate-600 hover:bg-slate-100 rounded-lg">+</button>
              <button onClick={() => toast.success('Thu nhỏ bản đồ')} className="w-8 h-8 flex items-center justify-center font-black text-slate-600 hover:bg-slate-100 rounded-lg">-</button>
            </div>

            <div className="absolute right-3 top-1/4 flex flex-col gap-1 bg-white/90 border border-gray-200/60 p-1.5 rounded-xl shadow-md z-20">
              <button onClick={() => toast.success('Thay đổi chế độ xem')} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg">🗺</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── DOMAINS OVERVIEW TABLE ── */}
      <div className="bg-white rounded-3xl border border-gray-200/60 p-6 shadow-sm">
        
        {/* Table controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h3 className="font-black text-slate-900 text-base">Domains Overview</h3>
          <div className="flex items-center gap-3.5 self-stretch md:self-auto flex-wrap">
            <div className="relative flex-1 min-w-[200px] md:flex-none">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Domain..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-colors shadow-sm font-semibold text-slate-700"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Domain</span>
            </button>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-5 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Domain</th>
                <th className="py-3 px-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">SSL Certificate</th>
                <th className="py-3 px-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="py-3 px-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Registrar</th>
                <th className="py-3 px-5 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDomains.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-sm">Chưa có tên miền nào khớp với tìm kiếm</p>
                  </td>
                </tr>
              ) : (
                paginatedDomains.map((domain, idx) => (
                  <tr 
                    key={domain.id}
                    onClick={() => setSelectedDomain(domain)}
                    className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer group ${idx % 2 === 0 ? '' : 'bg-slate-50/10'}`}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl flex items-center justify-center shadow-sm relative group-hover:scale-105 transition-transform">
                          {domain.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">{domain.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getSslBadge(domain.sslStatus)}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(domain.status)}
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-semibold text-xs">
                      {domain.registrar}
                    </td>
                    <td className="py-4 px-5 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setSelectedDomain(domain); toast.success(`Mở bảng cấu hình domain: ${domain.name}`); }}
                        className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 rounded-xl transition-all shadow-sm"
                      >
                        ⚙️ Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer / Pagination controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 font-semibold">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredDomains.length)} of {filteredDomains.length} entries
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                  currentPage === i + 1
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                    : 'text-slate-600 bg-white hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3.5 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
              className="px-3.5 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors ml-1"
            >
              Show All
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: + NEW DOMAIN ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* Modal header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">Add New Domain</h3>
                <p className="text-white/70 text-[11px] font-medium mt-0.5">Register domain for tracking metrics & SSL</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleAddDomain} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Domain Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="VD: mysite.com"
                  value={newDomain.name}
                  onChange={e => setNewDomain(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">SSL Status</label>
                  <select
                    value={newDomain.sslStatus}
                    onChange={e => setNewDomain(prev => ({ ...prev, sslStatus: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-bold text-slate-600"
                  >
                    <option value="Valid">Valid</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Server Status</label>
                  <select
                    value={newDomain.status}
                    onChange={e => setNewDomain(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-bold text-slate-600"
                  >
                    <option value="Online">Online</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Registrar</label>
                  <input
                    type="text"
                    value={newDomain.registrar}
                    onChange={e => setNewDomain(prev => ({ ...prev, registrar: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Expiry Date</label>
                  <input
                    type="text"
                    value={newDomain.expiryDate}
                    onChange={e => setNewDomain(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={newDomain.autoRenew}
                  onChange={e => setNewDomain(prev => ({ ...prev, autoRenew: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="autoRenew" className="text-xs text-slate-500 font-bold cursor-pointer">Auto-Renew this domain subscription</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/10"
                >
                  Add Domain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
