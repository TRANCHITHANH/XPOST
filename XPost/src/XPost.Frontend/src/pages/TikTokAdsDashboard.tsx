import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  Plus, RefreshCw, BarChart2, ExternalLink, Link, AlertTriangle,
  Eye, Trash2, Pause, Play, ChevronDown, X, Calendar,
  TrendingUp, MousePointerClick, DollarSign, Zap, Settings,
  Target
} from 'lucide-react';

interface AdAccount { id: string; advertiserId: string; accountName: string; isActive: boolean; }
interface Ad { id: string; tiktokAdId: string; name: string; title: string; bodyText: string; mediaUrl: string; status: string; callToAction: string; }
interface AdGroup { id: string; tiktokAdGroupId: string; name: string; placementType: string; dailyBudget: number; targetingAgeMin: number; targetingAgeMax: number; targetingLocations: string; ads: Ad[]; }
interface Campaign { id: string; tiktokCampaignId: string; name: string; objectiveType: string; status: string; budget: number; budgetMode: string; startTimeUtc: string; endTimeUtc?: string; adAccount?: { id: string; advertiserId: string; accountName: string }; adGroups?: AdGroup[]; }
interface DailyInsight { date: string; impressions: number; clicks: number; reach: number; spend: number; }
interface PerformanceSummary { impressions: number; reach: number; clicks: number; spend: number; ctr: number; cpc: number; }

const OBJECTIVE_LABELS: Record<string, string> = {
  TRAFFIC: 'Lưu lượng (Traffic)',
  LEAD_GENERATION: 'Tìm kiếm khách hàng (Leads)',
  CONVERSIONS: 'Chuyển đổi (Conversions)',
  REACH: 'Tiếp cận (Reach)',
  VIDEO_VIEWS: 'Lượt xem Video'
};

export default function TikTokAdsDashboard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary>({ impressions: 0, reach: 0, clicks: 0, spend: 0, ctr: 0, cpc: 0 });
  const [chartData, setChartData] = useState<DailyInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [discoveredAccounts, setDiscoveredAccounts] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchAccounts(); }, []);
  useEffect(() => { if (selectedAccountId) fetchCampaigns(selectedAccountId); }, [selectedAccountId, startDate, endDate]);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/tiktokads/accounts');
      setAccounts(res.data);
      if (res.data.length > 0) setSelectedAccountId(res.data[0].id);
      else setIsLoading(false);
    } catch { 
      toast.error('Không thể tải danh sách tài khoản quảng cáo TikTok'); 
      setIsLoading(false); 
    }
  };

  const fetchCampaigns = useCallback(async (accId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/tiktokads/campaigns?adAccountId=${accId}`);
      setCampaigns(res.data);
      let totalImp = 0, totalClicks = 0, totalReach = 0, totalSpend = 0;
      const dailyMap: Record<string, DailyInsight> = {};

      for (const camp of res.data) {
        try {
          const insRes = await api.get(`/tiktokads/campaigns/${camp.id}/insights?startDate=${startDate}&endDate=${endDate}`);
          const s = insRes.data.summary;
          totalImp += s.impressions || 0; 
          totalClicks += s.clicks || 0;
          totalReach += s.reach || 0; 
          totalSpend += Number(s.spend) || 0;

          for (const ins of insRes.data.insights || []) {
            const day = ins.date ? ins.date.substring(0, 10) : 'unknown';
            if (!dailyMap[day]) dailyMap[day] = { date: day, impressions: 0, clicks: 0, reach: 0, spend: 0 };
            dailyMap[day].impressions += ins.impressions || 0;
            dailyMap[day].clicks += ins.clicks || 0;
            dailyMap[day].reach += ins.reach || 0;
            dailyMap[day].spend += Number(ins.spend) || 0;
          }
        } catch { /* skip */ }
      }

      setSummary({ 
        impressions: totalImp, 
        reach: totalReach, 
        clicks: totalClicks, 
        spend: totalSpend, 
        ctr: totalImp > 0 ? (totalClicks / totalImp) * 100 : 0, 
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0 
      });
      setChartData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));
    } catch { 
      toast.error('Không thể tải thông tin chiến dịch TikTok'); 
    } finally { 
      setIsLoading(false); 
    }
  }, [startDate, endDate]);

  const handleSync = async () => {
    if (!selectedAccountId) return;
    try { 
      setIsSyncing(true); 
      toast.loading('Đồng bộ TikTok Business API...', { id: 'sync' }); 
      await api.post(`/tiktokads/accounts/${selectedAccountId}/sync`); 
      toast.success('Đồng bộ thành công từ TikTok Sandbox!', { id: 'sync' }); 
      await fetchCampaigns(selectedAccountId); 
    } catch (err: any) { 
      toast.error(err.response?.data?.message || err.message, { id: 'sync' }); 
    } finally { 
      setIsSyncing(false); 
    }
  };

  const handleToggleStatus = async (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ENABLE' ? 'PAUSED' : 'ACTIVE';
    try { 
      toast.loading('Cập nhật trạng thái chiến dịch...', { id: 'status' }); 
      await api.put(`/tiktokads/campaigns/${campaignId}/status`, { status: nextStatus }); 
      toast.success(`Đã chuyển trạng thái chiến dịch thành công`, { id: 'status' }); 
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: nextStatus === 'ACTIVE' ? 'ENABLE' : 'DISABLE' } : c)); 
    } catch (err: any) { 
      toast.error(err.response?.data?.message || err.message, { id: 'status' }); 
    }
  };

  const handleViewDetail = async (campaign: Campaign) => {
    setDetailCampaign(campaign); 
    setShowDetailModal(true);
    if (!campaign.adGroups) {
      try { 
        setLoadingDetail(true); 
        const res = await api.get(`/tiktokads/campaigns?adAccountId=${selectedAccountId}`); 
        const found = res.data.find((c: Campaign) => c.id === campaign.id); 
        if (found) setDetailCampaign(found); 
      } catch { } finally { 
        setLoadingDetail(false); 
      }
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (deletingId !== campaignId) { 
      setDeletingId(campaignId); 
      toast('Nhấn lại để xác nhận xóa chiến dịch này', { icon: '⚠️', duration: 3000 }); 
      setTimeout(() => setDeletingId(null), 3000); 
      return; 
    }
    try { 
      toast.loading('Đang xóa chiến dịch trên TikTok...', { id: 'del' }); 
      await api.delete(`/tiktokads/campaigns/${campaignId}`); 
      toast.success('Đã xóa chiến dịch thành công', { id: 'del' }); 
      setCampaigns(prev => prev.filter(c => c.id !== campaignId)); 
      setDeletingId(null); 
    } catch (err: any) { 
      toast.error(err.response?.data?.message || err.message, { id: 'del' }); 
      setDeletingId(null); 
    }
  };

  const handleDiscoverAccounts = async () => {
    if (!accessTokenInput.trim()) { toast.error('Vui lòng nhập Access Token hoặc Developer Code'); return; }
    try { 
      setIsDiscovering(true); 
      setDiscoveredAccounts([]); 
      const res = await api.post('/tiktokads/accounts/discover', { userAccessToken: accessTokenInput }); 
      setDiscoveredAccounts(res.data); 
      if (!res.data.length) toast.error('Không tìm thấy Advertiser Account nào'); 
      else toast.success(`Tìm thấy ${res.data.length} Advertiser Accounts!`); 
    } catch (err: any) { 
      toast.error(err.response?.data?.message || 'Không thể quét tài khoản TikTok'); 
    } finally { 
      setIsDiscovering(false); 
    }
  };

  const handleConnectAccount = async (acc: any) => {
    try { 
      setIsConnecting(true); 
      await api.post('/tiktokads/accounts/connect', { advertiserId: acc.id, accountName: acc.name, userAccessToken: accessTokenInput }); 
      toast.success(`Đã liên kết tài khoản TikTok: ${acc.name}`); 
      setShowConnectModal(false); 
      setAccessTokenInput(''); 
      setDiscoveredAccounts([]); 
      await fetchAccounts(); 
    } catch (err: any) { 
      toast.error(err.response?.data?.message || err.message); 
    } finally { 
      setIsConnecting(false); 
    }
  };

  const maxImp = Math.max(...chartData.map(d => d.impressions), 1);
  const maxClk = Math.max(...chartData.map(d => d.clicks), 1);
  const formatDay = (dateStr: string) => { try { return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(dateStr).getDay()]; } catch { return dateStr; } };
  const activeCamps = campaigns.filter(c => c.status === 'ENABLE' || c.status === 'ACTIVE').length;
  const pausedCamps = campaigns.filter(c => c.status !== 'ENABLE' && c.status !== 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 -m-6 p-6 space-y-6">

      {/* ── HERO HEADER WITH NEON ACCENTS ── */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00f2fe]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#fe0979]/10 rounded-full translate-y-1/2 blur-3xl pointer-events-none" />
        
        {/* Diagonal stripes decor */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-5">
            {/* TikTok Styled Icon */}
            <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-2xl border border-slate-800 relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#fe0979] to-[#00f2fe] rounded-2xl opacity-20 blur group-hover:opacity-40 transition-opacity" />
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white relative z-10">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23 1.02 1.25 2.5 2.11 4.1 2.45v3.98c-1.84-.04-3.61-.71-5.06-1.85-.29-.23-.55-.49-.8-.77v7.21c0 5.8-5.32 10.15-11.13 8.78-4.21-.99-7.14-5.22-6.28-9.52.7-3.48 3.86-5.91 7.42-5.74.87.04 1.71.27 2.47.66v-4.14c-1.39-.51-2.92-.61-4.38-.28-3.32.75-5.75 3.97-5.34 7.37.38 3.12 2.82 5.56 5.94 5.94 4.09.5 7.74-2.43 8.16-6.48.06-.55.03-3.62.03-8.83v-3.77z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#00f2fe] text-xs font-black uppercase tracking-widest">TikTok Business API</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">TikTok Ads Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">Khởi tạo và đo lường chuyển đổi các chiến dịch video ngắn, hình ảnh lôi cuốn</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 text-center shadow-lg">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Hoạt động</p>
                <p className="text-[#00f2fe] text-xl font-black">{activeCamps}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 text-center shadow-lg">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Tạm dừng</p>
                <p className="text-slate-400 text-xl font-black">{pausedCamps}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {accounts.length > 0 && (
                <div className="relative">
                  <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="appearance-none bg-slate-950 border border-slate-800 text-slate-100 rounded-xl pl-4 pr-9 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#00f2fe] min-w-[180px] shadow-lg cursor-pointer">
                    {accounts.map(acc => <option key={acc.id} value={acc.id} className="text-slate-100 bg-slate-900">{acc.accountName}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
              {accounts.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold shadow-lg">
                  <span className="text-slate-400">Từ:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-slate-100 focus:outline-none [color-scheme:dark] w-24 cursor-pointer focus:text-[#00f2fe]"
                  />
                  <span className="text-slate-400">Đến:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-slate-100 focus:outline-none [color-scheme:dark] w-24 cursor-pointer focus:text-[#00f2fe]"
                  />
                </div>
              )}

              {accounts.length > 0 && (
                <button onClick={handleSync} disabled={isSyncing} className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 rounded-xl transition-all disabled:opacity-50" title="Đồng bộ TikTok">
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#00f2fe]' : ''}`} />
                </button>
              )}
              {accounts.length > 0 && (
                <button onClick={() => navigate('/tiktok-ads/create?accountId=' + selectedAccountId)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#fe0979] to-[#ff4b2b] text-white text-sm font-black rounded-xl shadow-lg hover:shadow-[#fe0979]/20 hover:-translate-y-0.5 transition-all">
                  <Plus className="w-4 h-4" /> Tạo chiến dịch
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-28 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-800 border-t-[#fe0979] rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-3.5 h-3.5 rounded-full bg-[#00f2fe] animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-5 font-bold uppercase tracking-widest">Đang tải dữ liệu TikTok Business Sandbox...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center">
          <div className="w-24 h-24 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center mb-6 relative shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#fe0979] to-[#00f2fe] rounded-3xl opacity-10 blur" />
            <svg viewBox="0 0 24 24" className="w-12 h-12 fill-slate-300">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23 1.02 1.25 2.5 2.11 4.1 2.45v3.98c-1.84-.04-3.61-.71-5.06-1.85-.29-.23-.55-.49-.8-.77v7.21c0 5.8-5.32 10.15-11.13 8.78-4.21-.99-7.14-5.22-6.28-9.52.7-3.48 3.86-5.91 7.42-5.74.87.04 1.71.27 2.47.66v-4.14c-1.39-.51-2.92-.61-4.38-.28-3.32.75-5.75 3.97-5.34 7.37.38 3.12 2.82 5.56 5.94 5.94 4.09.5 7.74-2.43 8.16-6.48.06-.55.03-3.62.03-8.83v-3.77z" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-white">Kết nối tài khoản TikTok Ads</h3>
          <p className="text-slate-400 mt-3 max-w-md leading-relaxed text-sm">Liên kết tài khoản doanh nghiệp TikTok Business Advertiser để quản lý chiến dịch quảng cáo và tối ưu hóa ngân sách tiếp cận.</p>
          <button onClick={() => setShowConnectModal(true)} className="mt-8 flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#fe0979] to-[#00f2fe] text-white font-bold rounded-2xl shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all">
            <Link className="w-5 h-5" /> Liên kết ngay
          </button>
        </div>
      ) : (
        <>
          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Lượt Hiển Thị', value: summary.impressions.toLocaleString('vi-VN'), sub: `Tiếp cận: ${summary.reach.toLocaleString('vi-VN')}`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-[#00f2fe]', bg: 'bg-slate-900 border-slate-800' },
              { label: 'Lượt Click', value: summary.clicks.toLocaleString('vi-VN'), sub: `CPC: ${summary.cpc > 0 ? summary.cpc.toFixed(0) + 'đ' : 'Chưa có'}`, icon: <MousePointerClick className="w-5 h-5" />, color: 'text-[#fe0979]', bg: 'bg-slate-900 border-slate-800' },
              { label: 'Tỷ Lệ Click (CTR)', value: `${summary.ctr.toFixed(2)}%`, sub: `${summary.impressions.toLocaleString()} views`, icon: <Target className="w-5 h-5" />, color: 'text-amber-400', bg: 'bg-slate-900 border-slate-800' },
              { label: 'Tổng Chi Tiêu', value: `${summary.spend.toLocaleString('vi-VN')}đ`, sub: 'TikTok Sandbox Billing', icon: <DollarSign className="w-5 h-5" />, color: 'text-emerald-400', bg: 'bg-slate-900 border-slate-800' },
            ].map((card, i) => (
              <div key={i} className={`relative ${card.bg} rounded-3xl border p-6 overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-xl`}>
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-tight">{card.label}</p>
                  <div className={`w-9 h-9 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center ${card.color} shadow-inner`}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-3xl font-black text-white leading-none">{card.value}</p>
                <p className="text-xs text-slate-400 mt-2 font-semibold">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── PERFORMANCE CHART ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
                    <BarChart2 className="w-4 h-4 text-[#00f2fe]" />
                  </div>
                  Xu hướng tương tác
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 ml-10">Dữ liệu thống kê hiệu suất theo tuần từ TikTok Marketing SDK</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-300"><span className="w-3 h-3 rounded-full bg-[#00f2fe]" />Hiển thị</span>
                <span className="flex items-center gap-1.5 text-slate-300"><span className="w-3 h-3 rounded-full bg-[#fe0979]" />Click</span>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-center px-6 py-8">
                <p className="text-sm font-bold text-slate-500">Chưa có dữ liệu thống kê ngày</p>
              </div>
            ) : (
              <div className="px-6 pb-6 pt-4">
                <div className="relative h-56 flex items-end justify-between gap-1">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                    {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-dashed border-slate-800/60" />)}
                  </div>
                  {chartData.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group z-10">
                      <div className="flex gap-1 items-end h-44 w-full justify-center">
                        <div style={{ height: `${(item.impressions / maxImp) * 100}%` }} className="w-1/3 max-w-[28px] bg-gradient-to-t from-[#00f2fe]/90 to-[#00f2fe]/50 rounded-t-xl transition-all duration-700 relative cursor-pointer hover:from-[#00f2fe]">
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-slate-900 border border-slate-800 text-white text-[10px] py-2 px-3 rounded-xl whitespace-nowrap z-50 shadow-2xl gap-1">
                            <span className="font-black text-[#00f2fe]">{formatDay(item.date)} — {item.date}</span>
                            <span className="font-semibold text-slate-200">👁 {item.impressions.toLocaleString()} views</span>
                            <span className="font-semibold text-slate-200">🖱 {item.clicks.toLocaleString()} clicks</span>
                            <span className="font-semibold text-slate-200">💰 Spend: {item.spend.toLocaleString('vi-VN')}đ</span>
                          </div>
                        </div>
                        <div style={{ height: `${(item.clicks / maxClk) * 100}%` }} className="w-1/3 max-w-[28px] bg-gradient-to-t from-[#fe0979]/90 to-[#fe0979]/50 rounded-t-xl transition-all duration-700 hover:from-[#fe0979]" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">{formatDay(item.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CAMPAIGNS LIST ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#fe0979]" />
                </div>
                <div>
                  <h3 className="font-black text-white">Chiến dịch quảng cáo</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{campaigns.length} chiến dịch · {activeCamps} đang chạy · {pausedCamps} bản nháp</p>
                </div>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center">
                  <BarChart2 className="w-8 h-8 text-slate-700" />
                </div>
                <p className="text-sm font-bold text-slate-400">Chưa có chiến dịch quảng cáo TikTok</p>
                <button onClick={() => navigate('/tiktok-ads/create?accountId=' + selectedAccountId)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#fe0979] to-[#ff4b2b] text-white text-sm font-bold rounded-xl shadow-lg transition-all">
                  <Plus className="w-4 h-4" /> Tạo chiến dịch mới
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tên chiến dịch</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Mục tiêu</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Trạng thái</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Ngân sách</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bắt đầu</th>
                      <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((camp, idx) => (
                      <tr
                        key={camp.id}
                        onClick={() => handleViewDetail(camp)}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer group ${idx % 2 === 0 ? '' : 'bg-slate-900/30'}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 ${camp.status === 'ENABLE' || camp.status === 'ACTIVE' ? 'bg-gradient-to-br from-[#fe0979] to-[#ff4b2b] shadow-lg' : 'bg-slate-800 border border-slate-700'}`}>
                              {camp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-200 text-sm truncate max-w-[200px] group-hover:text-[#00f2fe] transition-colors">{camp.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">#{camp.tiktokCampaignId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-xl bg-slate-950 border border-slate-800 text-[#00f2fe]">
                            <Target className="w-3 h-3" />
                            {OBJECTIVE_LABELS[camp.objectiveType] ?? camp.objectiveType}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {camp.status === 'ENABLE' || camp.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Đang chạy
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              <span className="w-2 h-2 rounded-full bg-slate-500" />Bản nháp
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-black text-slate-200 text-sm">{camp.budget.toLocaleString('vi-VN')}đ</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">/ngày</p>
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-slate-400">
                          {new Date(camp.startTimeUtc).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-4 px-6" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleViewDetail(camp)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#00f2fe] hover:bg-slate-800 rounded-lg transition-all" title="Xem chi tiết"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => handleToggleStatus(camp.id, camp.status)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${camp.status === 'ENABLE' || camp.status === 'ACTIVE' ? 'text-slate-400 hover:text-amber-500 hover:bg-slate-800' : 'text-slate-400 hover:text-green-500 hover:bg-slate-800'}`} title={camp.status === 'ENABLE' || camp.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}>
                              {camp.status === 'ENABLE' || camp.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button onClick={() => handleDelete(camp.id)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${deletingId === camp.id ? 'text-white bg-red-500 animate-pulse' : 'text-slate-400 hover:text-red-500 hover:bg-slate-800'}`} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── DETAIL MODAL ── */}
      {showDetailModal && detailCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowDetailModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="relative overflow-hidden p-6 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-800">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#00f2fe]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${detailCampaign.status === 'ENABLE' || detailCampaign.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {detailCampaign.status === 'ENABLE' || detailCampaign.status === 'ACTIVE' ? '🟢 Đang chạy' : '⏸ Bản nháp'}
                  </span>
                  <h3 className="text-xl font-black text-white mt-3 leading-tight">{detailCampaign.name}</h3>
                  <p className="text-slate-500 text-xs mt-1 font-mono">TikTok ID: {detailCampaign.tiktokCampaignId}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition-all border border-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {loadingDetail ? (
                <div className="py-10 flex justify-center"><div className="w-8 h-8 border-4 border-slate-800 border-t-[#fe0979] rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Mục tiêu', value: OBJECTIVE_LABELS[detailCampaign.objectiveType] ?? detailCampaign.objectiveType, icon: <Target className="w-3.5 h-3.5 text-[#00f2fe]" /> },
                      { label: 'Ngân sách QC', value: `${detailCampaign.budget.toLocaleString('vi-VN')}đ`, icon: <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> },
                      { label: 'Bắt đầu', value: new Date(detailCampaign.startTimeUtc).toLocaleDateString('vi-VN'), icon: <Calendar className="w-3.5 h-3.5 text-[#fe0979]" /> },
                      { label: 'Thời hạn', value: detailCampaign.endTimeUtc ? new Date(detailCampaign.endTimeUtc).toLocaleDateString('vi-VN') : 'Không giới hạn', icon: <Calendar className="w-3.5 h-3.5 text-amber-400" /> },
                      { label: 'Nhóm QC (AdGroup)', value: `${detailCampaign.adGroups?.length ?? 0} adgroups`, icon: <Settings className="w-3.5 h-3.5 text-blue-400" /> },
                      { label: 'Mẫu sáng tạo (Ad)', value: `${detailCampaign.adGroups?.reduce((s, as) => s + as.ads.length, 0) ?? 0} ads`, icon: <Zap className="w-3.5 h-3.5 text-purple-400" /> },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-950 border border-slate-850 rounded-2xl p-3 sm:p-3.5 shadow-inner">
                        <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">{item.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span></div>
                        <p className="text-[13px] sm:text-sm font-black text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis" title={item.value}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {detailCampaign.adGroups && detailCampaign.adGroups.length > 0 && (
                    <div>
                      <h4 className="text-sm font-black text-white mb-3">Nhóm Quảng Cáo TikTok ({detailCampaign.adGroups.length})</h4>
                      <div className="space-y-3">
                        {detailCampaign.adGroups.map(adGroup => (
                          <div key={adGroup.id} className="border border-slate-800 rounded-2xl p-4 bg-slate-950/50">
                            <div className="flex justify-between items-center mb-3">
                              <div>
                                <p className="text-sm font-bold text-slate-200">{adGroup.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">#{adGroup.tiktokAdGroupId}</p>
                              </div>
                              <span className="text-xs font-black text-[#00f2fe] bg-[#00f2fe]/5 px-3 py-1.5 rounded-xl border border-[#00f2fe]/10">{adGroup.dailyBudget?.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[11px] bg-slate-900 text-slate-400 px-2.5 py-1 rounded-lg font-semibold border border-slate-800">Tuổi {adGroup.targetingAgeMin}–{adGroup.targetingAgeMax}</span>
                              <span className="text-[11px] bg-slate-900 text-slate-400 px-2.5 py-1 rounded-lg font-semibold border border-slate-800">📍 {adGroup.targetingLocations}</span>
                              <span className="text-[11px] bg-slate-900 text-slate-400 px-2.5 py-1 rounded-lg font-semibold border border-slate-800">🎬 {adGroup.placementType}</span>
                            </div>

                            {adGroup.ads && adGroup.ads.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {adGroup.ads.map(ad => (
                                  <div key={ad.id} className="flex gap-3 bg-slate-900 rounded-xl p-3 border border-slate-800">
                                    {ad.mediaUrl && (
                                      <img src={ad.mediaUrl.startsWith('/') ? `${(api.defaults.baseURL || '').replace('/api', '')}${ad.mediaUrl}` : ad.mediaUrl} alt="ad" className="w-12 h-12 object-cover rounded-lg shrink-0 border border-slate-850" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-slate-200 truncate">{ad.name}</p>
                                      {ad.title && <p className="text-[11px] text-slate-500 truncate mt-0.5">{ad.title}</p>}
                                      <div className="flex gap-1.5 mt-1.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ad.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>{ad.status}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">{ad.callToAction}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t border-slate-800">
                    <button onClick={() => { handleToggleStatus(detailCampaign.id, detailCampaign.status); setShowDetailModal(false); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all bg-slate-950 border border-slate-850 hover:bg-slate-900 ${detailCampaign.status === 'ENABLE' || detailCampaign.status === 'ACTIVE' ? 'text-amber-500 hover:text-amber-400' : 'text-green-500 hover:text-green-400'}`}>
                      {detailCampaign.status === 'ENABLE' || detailCampaign.status === 'ACTIVE' ? <><Pause className="w-4 h-4" />Tạm dừng chiến dịch</> : <><Play className="w-4 h-4" />Kích hoạt chiến dịch</>}
                    </button>
                    <button onClick={() => window.open(`https://ads.tiktok.com/`, '_blank')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-[#fe0979] to-[#00f2fe] text-white hover:opacity-90 shadow-xl transition-all">
                      <ExternalLink className="w-4 h-4" /> Mở TikTok Ads Manager
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONNECT ACCOUNT MODAL ── */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="relative overflow-hidden bg-slate-950 p-6 border-b border-slate-800">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#fe0979]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-white text-xl">Liên kết TikTok Advertiser</h3>
                  <p className="text-slate-400 text-sm mt-1">Quét Advertiser Accounts được liên kết với Access Token</p>
                </div>
                <button onClick={() => { setShowConnectModal(false); setAccessTokenInput(''); setDiscoveredAccounts([]); }} className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition-all border border-slate-700"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">TikTok User Developer Access Token</label>
                <div className="flex gap-2">
                  <input type="password" placeholder="Dán access token từ TikTok Business..." value={accessTokenInput} onChange={e => setAccessTokenInput(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-sm focus:border-[#fe0979] outline-none font-mono" />
                  <button onClick={handleDiscoverAccounts} disabled={isDiscovering} className="px-5 py-3 bg-gradient-to-r from-[#fe0979] to-[#00f2fe] disabled:opacity-50 text-white font-black text-sm rounded-xl transition-all shadow-lg flex items-center gap-2 whitespace-nowrap">
                    {isDiscovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Tìm kiếm
                  </button>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950 border border-slate-850 rounded-xl p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Sử dụng TikTok Business Developer Access Token có quyền Advertiser Management để quét các tài khoản doanh nghiệp. Bạn có thể sử dụng token giả lập (ví dụ: <code className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[#00f2fe] font-mono">sandbox_token</code>) để kiểm tra các tính năng của hệ thống.</span>
                </div>
              </div>

              {discoveredAccounts.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block"> Advertiser Accounts tìm thấy ({discoveredAccounts.length})</label>
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden">
                    {discoveredAccounts.map(acc => (
                      <div key={acc.id} className="flex justify-between items-center p-4 bg-slate-950/30 hover:bg-slate-950/60 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-slate-200">{acc.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{acc.id} · {acc.currency}</p>
                        </div>
                        <button onClick={() => handleConnectAccount(acc)} disabled={isConnecting} className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-[#fe0979] to-[#00f2fe] text-white rounded-xl transition-all shadow-md disabled:opacity-50">
                          Kết nối
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
