import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  Plus, RefreshCw, BarChart2, ExternalLink, Link, AlertTriangle,
  Eye, Trash2, Pause, Play, ChevronDown, X, Calendar,
  TrendingUp, MousePointerClick, DollarSign, Zap, Settings,
  CheckCircle, Clock, Target
} from 'lucide-react';

interface AdAccount { id: string; adAccountId: string; accountName: string; isActive: boolean; }
interface AdSet { id: string; metaAdSetId: string; name: string; billingEvent: string; dailyBudget: number; targetingAgeMin: number; targetingAgeMax: number; targetingLocations: string; ads: Ad[]; }
interface Ad { id: string; metaAdId: string; name: string; title: string; bodyText: string; mediaUrl: string; status: string; callToAction: string; }
interface Campaign { id: string; metaCampaignId: string; name: string; objective: string; status: string; budget: number; startTimeUtc: string; endTimeUtc?: string; adAccount?: { id: string; adAccountId: string; accountName: string }; adSets?: AdSet[]; }
interface DailyInsight { date: string; impressions: number; clicks: number; reach: number; spend: number; }
interface PerformanceSummary { impressions: number; reach: number; clicks: number; spend: number; ctr: number; cpc: number; }

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Lưu lượng', OUTCOME_AWARENESS: 'Nhận thức', OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Doanh số', OUTCOME_ENGAGEMENT: 'Tương tác',
  TRAFFIC: 'Lưu lượng', BRAND_AWARENESS: 'Nhận thức', LEAD_GENERATION: 'Leads',
  CONVERSIONS: 'Chuyển đổi', REACH: 'Tiếp cận',
};

export default function FacebookAdsDashboard() {
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
      const res = await api.get('/facebookads/accounts');
      setAccounts(res.data);
      if (res.data.length > 0) setSelectedAccountId(res.data[0].id);
      else setIsLoading(false);
    } catch { toast.error('Không thể tải danh sách tài khoản'); setIsLoading(false); }
  };

  const fetchCampaigns = useCallback(async (accId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/facebookads/campaigns?adAccountId=${accId}`);
      setCampaigns(res.data);
      let totalImp = 0, totalClicks = 0, totalReach = 0, totalSpend = 0;
      const dailyMap: Record<string, DailyInsight> = {};
      for (const camp of res.data) {
        try {
          const insRes = await api.get(`/facebookads/campaigns/${camp.id}/insights?startDate=${startDate}&endDate=${endDate}`);
          const s = insRes.data.summary;
          totalImp += s.impressions || 0; totalClicks += s.clicks || 0;
          totalReach += s.reach || 0; totalSpend += Number(s.spend) || 0;
          for (const ins of insRes.data.insights || []) {
            const day = ins.date ? ins.date.substring(0, 10) : 'unknown';
            if (!dailyMap[day]) dailyMap[day] = { date: day, impressions: 0, clicks: 0, reach: 0, spend: 0 };
            dailyMap[day].impressions += ins.impressions || 0;
            dailyMap[day].clicks += ins.clicks || 0;
          }
        } catch { /* skip */ }
      }
      setSummary({ impressions: totalImp, reach: totalReach, clicks: totalClicks, spend: totalSpend, ctr: totalImp > 0 ? (totalClicks / totalImp) * 100 : 0, cpc: totalClicks > 0 ? totalSpend / totalClicks : 0 });
      setChartData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));
    } catch { toast.error('Không thể tải thông tin chiến dịch'); }
    finally { setIsLoading(false); }
  }, [startDate, endDate]);

  const handleSync = async () => {
    if (!selectedAccountId) return;
    try { setIsSyncing(true); toast.loading('Đồng bộ Meta API...', { id: 'sync' }); await api.post(`/facebookads/accounts/${selectedAccountId}/sync`); toast.success('Đồng bộ thành công!', { id: 'sync' }); await fetchCampaigns(selectedAccountId); }
    catch (err: any) { toast.error(err.response?.data?.message || err.message, { id: 'sync' }); }
    finally { setIsSyncing(false); }
  };

  const handleToggleStatus = async (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try { toast.loading('Cập nhật trạng thái...', { id: 'status' }); await api.put(`/facebookads/campaigns/${campaignId}/status`, { status: nextStatus }); toast.success(`Đã chuyển sang ${nextStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}`, { id: 'status' }); setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: nextStatus } : c)); }
    catch (err: any) { toast.error(err.response?.data?.message || err.message, { id: 'status' }); }
  };

  const handleViewDetail = async (campaign: Campaign) => {
    setDetailCampaign(campaign); setShowDetailModal(true);
    if (!campaign.adSets) {
      try { setLoadingDetail(true); const res = await api.get(`/facebookads/campaigns?adAccountId=${selectedAccountId}`); const found = res.data.find((c: Campaign) => c.id === campaign.id); if (found) setDetailCampaign(found); } catch { } finally { setLoadingDetail(false); }
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (deletingId !== campaignId) { setDeletingId(campaignId); toast('Nhấn lại để xác nhận xóa', { icon: '⚠️', duration: 3000 }); setTimeout(() => setDeletingId(null), 3000); return; }
    try { toast.loading('Đang xóa...', { id: 'del' }); await api.delete(`/facebookads/campaigns/${campaignId}`); toast.success('Đã xóa chiến dịch', { id: 'del' }); setCampaigns(prev => prev.filter(c => c.id !== campaignId)); setDeletingId(null); }
    catch (err: any) { toast.error(err.response?.data?.message || err.message, { id: 'del' }); setDeletingId(null); }
  };

  const handleDiscoverAccounts = async () => {
    if (!accessTokenInput.trim()) { toast.error('Vui lòng nhập Access Token'); return; }
    try { setIsDiscovering(true); setDiscoveredAccounts([]); const res = await api.post('/facebookads/accounts/discover', { userAccessToken: accessTokenInput }); setDiscoveredAccounts(res.data); if (!res.data.length) toast.error('Không tìm thấy tài khoản nào'); else toast.success(`Tìm thấy ${res.data.length} tài khoản!`); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Không thể quét tài khoản'); }
    finally { setIsDiscovering(false); }
  };

  const handleConnectAccount = async (acc: any) => {
    try { setIsConnecting(true); await api.post('/facebookads/accounts/connect', { adAccountId: acc.id, accountName: acc.name, userAccessToken: accessTokenInput }); toast.success(`Đã kết nối: ${acc.name}`); setShowConnectModal(false); setAccessTokenInput(''); setDiscoveredAccounts([]); await fetchAccounts(); }
    catch (err: any) { toast.error(err.response?.data?.message || err.message); }
    finally { setIsConnecting(false); }
  };

  const maxImp = Math.max(...chartData.map(d => d.impressions), 1);
  const maxClk = Math.max(...chartData.map(d => d.clicks), 1);
  const formatDay = (dateStr: string) => { try { return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(dateStr).getDay()]; } catch { return dateStr; } };
  const activeCamps = campaigns.filter(c => c.status === 'ACTIVE').length;
  const pausedCamps = campaigns.filter(c => c.status !== 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 -m-6 p-6 space-y-6">

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1877F2] via-[#1565C0] to-[#0D47A1] p-8 shadow-[0_20px_60px_rgba(24,119,242,0.35)]">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-300/10 rounded-full translate-y-1/2 blur-2xl pointer-events-none" />
        <div className="absolute top-4 right-20 grid grid-cols-4 gap-2 opacity-10 pointer-events-none">
          {Array.from({ length: 16 }).map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />)}
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-white/20">
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-200 text-xs font-semibold uppercase tracking-widest">Meta Marketing API</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">Facebook Ads Manager</h1>
              <p className="text-blue-200/80 text-sm mt-1">Quản lý chiến dịch, ngân sách & theo dõi hiệu suất chuyển đổi theo thời gian thực</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Quick stats pills */}
            <div className="flex gap-2">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2 text-center">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Hoạt động</p>
                <p className="text-white text-xl font-black">{activeCamps}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2 text-center">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Tạm dừng</p>
                <p className="text-white text-xl font-black">{pausedCamps}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {accounts.length > 0 && (
                <div className="relative">
                  <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="appearance-none bg-white/15 backdrop-blur-sm border border-white/25 text-white rounded-xl pl-4 pr-9 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/30 min-w-[180px]">
                    {accounts.map(acc => <option key={acc.id} value={acc.id} className="text-gray-900 bg-white">{acc.accountName}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
              {accounts.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/25 text-white rounded-xl px-3 py-2 text-xs font-semibold">
                  <span className="opacity-70">Từ:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none [color-scheme:dark] w-24 cursor-pointer"
                  />
                  <span className="opacity-70">Đến:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none [color-scheme:dark] w-24 cursor-pointer"
                  />
                </div>
              )}

              {accounts.length > 0 && (
                <button onClick={handleSync} disabled={isSyncing} className="p-2.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white rounded-xl transition-all backdrop-blur-sm disabled:opacity-50" title="Đồng bộ Meta">
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}
              {accounts.length > 0 && (
                <button onClick={() => navigate('/facebook-ads/create?accountId=' + selectedAccountId)} className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 text-sm font-bold rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 transition-all">
                  <Plus className="w-4 h-4" /> Tạo chiến dịch
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-blue-600"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-5 font-medium">Đang kết nối Meta Marketing API...</p>
        </div>
      ) : accounts.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-[0_10px_30px_rgba(99,102,241,0.3)]">
            <svg viewBox="0 0 24 24" className="w-12 h-12 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          </div>
          <h3 className="text-2xl font-black text-gray-900">Kết nối tài khoản Facebook Ads</h3>
          <p className="text-gray-500 mt-3 max-w-md leading-relaxed">Liên kết tài khoản Meta Business Suite để quản lý chiến dịch và theo dõi hiệu suất ngay trên XPost.</p>
          <button onClick={() => setShowConnectModal(true)} className="mt-8 flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-[0_8px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(99,102,241,0.5)] transition-all">
            <Link className="w-5 h-5" /> Kết nối ngay
          </button>
        </div>
      ) : (
        <>
          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Lượt Hiển Thị', value: summary.impressions.toLocaleString('vi-VN'), sub: `Tiếp cận: ${summary.reach.toLocaleString('vi-VN')}`, icon: <TrendingUp className="w-5 h-5" />, gradient: 'from-blue-500 to-blue-600', glow: 'rgba(59,130,246,0.3)', bg: 'from-blue-50 to-blue-100/50', border: 'border-blue-100' },
              { label: 'Lượt Click', value: summary.clicks.toLocaleString('vi-VN'), sub: `CPC: ${summary.cpc > 0 ? summary.cpc.toFixed(0) + 'đ' : 'Chưa có'}`, icon: <MousePointerClick className="w-5 h-5" />, gradient: 'from-violet-500 to-purple-600', glow: 'rgba(139,92,246,0.3)', bg: 'from-violet-50 to-purple-50', border: 'border-violet-100' },
              { label: 'Tỷ Lệ Click (CTR)', value: `${summary.ctr.toFixed(2)}%`, sub: summary.impressions === 0 ? 'Chưa có dữ liệu' : `${summary.impressions.toLocaleString()} impressions`, icon: <Target className="w-5 h-5" />, gradient: 'from-emerald-500 to-teal-600', glow: 'rgba(16,185,129,0.3)', bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-100' },
              { label: 'Chi Phí (VND)', value: `${summary.spend.toLocaleString('vi-VN')}đ`, sub: 'Meta Billing', icon: <DollarSign className="w-5 h-5" />, gradient: 'from-rose-500 to-pink-600', glow: 'rgba(244,63,94,0.3)', bg: 'from-rose-50 to-pink-50', border: 'border-rose-100' },
            ].map((card, i) => (
              <div key={i} className={`relative bg-gradient-to-br ${card.bg} rounded-3xl border ${card.border} p-6 overflow-hidden group hover:-translate-y-1 transition-all duration-300 cursor-default`}>
                <div className={`absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br ${card.gradient} rounded-full opacity-10 group-hover:opacity-20 transition-opacity`} />
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-tight">{card.label}</p>
                  <div className={`w-9 h-9 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center text-white shadow-lg`} style={{ boxShadow: `0 4px 15px ${card.glow}` }}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900 leading-none">{card.value}</p>
                <p className="text-xs text-gray-500 mt-2 font-medium">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── CHART ── */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <BarChart2 className="w-4 h-4 text-white" />
                  </div>
                  Hiệu suất theo ngày
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 ml-10">
                  {chartData.length > 0 ? `Dữ liệu thực từ Meta API (${chartData.length} ngày gần nhất)` : 'Chưa có insights — Meta cần 24-48h sau khi chiến dịch chạy'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-blue-600"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm" />Hiển thị</span>
                <span className="flex items-center gap-1.5 text-violet-600"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 shadow-sm" />Click</span>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-center px-6 py-8">
                <div className="flex gap-1 items-end mb-5 opacity-20">
                  {[40, 60, 45, 80, 65, 90, 75].map((h, i) => (
                    <div key={i} className="flex gap-0.5 items-end">
                      <div style={{ height: h }} className="w-3 bg-blue-300 rounded-t" />
                      <div style={{ height: h * 0.4 }} className="w-3 bg-violet-300 rounded-t" />
                    </div>
                  ))}
                </div>
                <p className="text-sm font-semibold text-gray-400">Chưa có dữ liệu insights</p>
                <p className="text-xs text-gray-300 mt-1">Meta thường cần 24–48h để cập nhật số liệu sau khi chiến dịch chạy</p>
              </div>
            ) : (
              <div className="px-6 pb-6 pt-4">
                <div className="relative h-56 flex items-end justify-between gap-1">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                    {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-dashed border-gray-100" />)}
                  </div>
                  {chartData.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group z-10">
                      <div className="flex gap-1 items-end h-44 w-full justify-center">
                        <div style={{ height: `${(item.impressions / maxImp) * 100}%` }} className="w-1/3 max-w-[28px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-xl transition-all duration-700 relative cursor-pointer hover:from-blue-700 hover:to-blue-500">
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-gray-900 text-white text-[10px] py-2 px-3 rounded-xl whitespace-nowrap z-50 shadow-2xl gap-0.5">
                            <span className="font-bold text-blue-300">{formatDay(item.date)} — {item.date}</span>
                            <span>👁 {item.impressions.toLocaleString()}</span>
                            <span>🖱 {item.clicks.toLocaleString()}</span>
                          </div>
                        </div>
                        <div style={{ height: `${(item.clicks / maxClk) * 100}%` }} className="w-1/3 max-w-[28px] bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-xl transition-all duration-700 hover:from-violet-700 hover:to-violet-500 cursor-pointer" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-400">{formatDay(item.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CAMPAIGNS TABLE ── */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-gray-50/80 to-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900">Danh sách chiến dịch</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{campaigns.length} chiến dịch · {activeCamps} hoạt động · {pausedCamps} tạm dừng</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-semibold border border-green-100">
                  <CheckCircle className="w-3.5 h-3.5" />{activeCamps} Hoạt động
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg font-semibold border border-gray-200">
                  <Clock className="w-3.5 h-3.5" />{pausedCamps} Tạm dừng
                </span>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
                  <BarChart2 className="w-8 h-8 text-gray-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500">Chưa có chiến dịch nào</p>
                  <p className="text-xs text-gray-400 mt-1">Nhấn "Tạo chiến dịch" để bắt đầu quảng cáo trên Meta</p>
                </div>
                <button onClick={() => navigate('/facebook-ads/create?accountId=' + selectedAccountId)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all">
                  <Plus className="w-4 h-4" /> Tạo chiến dịch đầu tiên
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="py-3.5 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Chiến dịch</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Mục tiêu</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Trạng thái</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ngân sách</th>
                      <th className="py-3.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Thời gian</th>
                      <th className="py-3.5 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((camp, idx) => (
                      <tr
                        key={camp.id}
                        onClick={() => handleViewDetail(camp)}
                        className={`border-b border-gray-50 hover:bg-gradient-to-r hover:from-blue-50/60 hover:to-indigo-50/30 transition-all cursor-pointer group ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 ${camp.status === 'ACTIVE' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_4px_12px_rgba(99,102,241,0.3)]' : 'bg-gradient-to-br from-gray-300 to-gray-400'}`}>
                              {camp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate max-w-[200px] group-hover:text-blue-700 transition-colors">{camp.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{camp.metaCampaignId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100 whitespace-nowrap">
                            <Target className="w-3 h-3" />
                            {OBJECTIVE_LABELS[camp.objective] ?? camp.objective.replace('OUTCOME_', '')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {camp.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-100">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                              <span className="w-2 h-2 rounded-full bg-gray-400" />Tạm dừng
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-black text-gray-900 text-sm">{camp.budget.toLocaleString('vi-VN')}đ</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">/ngày</p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                            <div>
                              <p className="font-medium">{new Date(camp.startTimeUtc).toLocaleDateString('vi-VN')}</p>
                              {camp.endTimeUtc && <p className="text-gray-400">→ {new Date(camp.endTimeUtc).toLocaleDateString('vi-VN')}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleViewDetail(camp)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Xem chi tiết"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => handleToggleStatus(camp.id, camp.status)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${camp.status === 'ACTIVE' ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`} title={camp.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}>
                              {camp.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button onClick={() => window.open(`https://www.facebook.com/adsmanager/manage/campaigns?act=${accounts.find(a => a.id === selectedAccountId)?.adAccountId?.replace('act_', '')}&selected_campaign_ids=${camp.metaCampaignId}`, '_blank')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Mở Meta Ads Manager"><ExternalLink className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(camp.id)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${deletingId === camp.id ? 'text-white bg-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.4)] animate-pulse' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`} title={deletingId === camp.id ? 'Nhấn lại để xác nhận' : 'Xóa'}><Trash2 className="w-4 h-4" /></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.25)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className={`relative overflow-hidden p-6 ${detailCampaign.status === 'ACTIVE' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-gray-600 to-gray-700'}`}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${detailCampaign.status === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-white/20 text-white'}`}>
                      {detailCampaign.status === 'ACTIVE' ? '🟢 Đang hoạt động' : '⏸ Tạm dừng'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-2 leading-tight">{detailCampaign.name}</h3>
                  <p className="text-white/60 text-xs mt-1 font-mono">Meta ID: {detailCampaign.metaCampaignId}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {loadingDetail ? (
                <div className="py-10 flex justify-center"><div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" /></div>
              ) : (
                <>
                  {/* Info grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Mục tiêu', value: OBJECTIVE_LABELS[detailCampaign.objective] ?? detailCampaign.objective, icon: <Target className="w-3.5 h-3.5" /> },
                      { label: 'Ngân sách/ngày', value: `${detailCampaign.budget.toLocaleString('vi-VN')}đ`, icon: <DollarSign className="w-3.5 h-3.5" /> },
                      { label: 'Bắt đầu', value: new Date(detailCampaign.startTimeUtc).toLocaleDateString('vi-VN'), icon: <Calendar className="w-3.5 h-3.5" /> },
                      { label: 'Kết thúc', value: detailCampaign.endTimeUtc ? new Date(detailCampaign.endTimeUtc).toLocaleDateString('vi-VN') : 'Không giới hạn', icon: <Calendar className="w-3.5 h-3.5" /> },
                      { label: 'Nhóm QC', value: `${detailCampaign.adSets?.length ?? 0} ad sets`, icon: <Settings className="w-3.5 h-3.5" /> },
                      { label: 'Tổng QC', value: `${detailCampaign.adSets?.reduce((s, as) => s + as.ads.length, 0) ?? 0} ads`, icon: <Zap className="w-3.5 h-3.5" /> },
                    ].map((item, i) => (
                      <div key={i} className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
                        <div className="flex items-center gap-1.5 text-gray-400 mb-1.5">{item.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span></div>
                        <p className="text-sm font-bold text-gray-800">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Ad Sets */}
                  {detailCampaign.adSets && detailCampaign.adSets.length > 0 && (
                    <div>
                      <h4 className="text-sm font-black text-gray-800 mb-3">Nhóm quảng cáo ({detailCampaign.adSets.length})</h4>
                      <div className="space-y-3">
                        {detailCampaign.adSets.map(adSet => (
                          <div key={adSet.id} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                            <div className="flex justify-between items-center mb-3">
                              <div>
                                <p className="text-sm font-bold text-gray-800">{adSet.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono">#{adSet.metaAdSetId}</p>
                              </div>
                              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">{adSet.dailyBudget?.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-semibold border border-blue-100">Tuổi {adSet.targetingAgeMin}–{adSet.targetingAgeMax}</span>
                              <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg font-semibold border border-indigo-100">📍 {adSet.targetingLocations}</span>
                              <span className="text-[11px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-semibold border border-gray-200">{adSet.billingEvent}</span>
                            </div>
                            {adSet.ads && adSet.ads.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {adSet.ads.map(ad => (
                                  <div key={ad.id} className="flex gap-3 bg-white rounded-xl p-3 border border-gray-100">
                                    {ad.mediaUrl && (
                                      <img src={ad.mediaUrl.startsWith('/') ? `${(api.defaults.baseURL || '').replace('/api', '')}${ad.mediaUrl}` : ad.mediaUrl} alt="ad" className="w-12 h-12 object-cover rounded-lg shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-gray-800 truncate">{ad.name}</p>
                                      {ad.title && <p className="text-[11px] text-gray-500 truncate mt-0.5">{ad.title}</p>}
                                      <div className="flex gap-1.5 mt-1.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ad.status === 'ACTIVE' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>{ad.status}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">{ad.callToAction}</span>
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

                  {/* Actions */}
                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button onClick={() => { handleToggleStatus(detailCampaign.id, detailCampaign.status); setShowDetailModal(false); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all ${detailCampaign.status === 'ACTIVE' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}>
                      {detailCampaign.status === 'ACTIVE' ? <><Pause className="w-4 h-4" />Tạm dừng</> : <><Play className="w-4 h-4" />Kích hoạt</>}
                    </button>
                    <button onClick={() => window.open(`https://www.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${detailCampaign.metaCampaignId}`, '_blank')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(99,102,241,0.3)] hover:shadow-[0_8px_20px_rgba(99,102,241,0.4)] transition-all">
                      <ExternalLink className="w-4 h-4" /> Mở Meta Manager
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONNECT MODAL ── */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.25)] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-white text-xl">Kết nối Meta Marketing</h3>
                  <p className="text-blue-200/80 text-sm mt-1">Nhập User Access Token để quét tài khoản</p>
                </div>
                <button onClick={() => { setShowConnectModal(false); setAccessTokenInput(''); setDiscoveredAccounts([]); }} className="p-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-all"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Facebook User Access Token</label>
                <div className="flex gap-2">
                  <input type="password" placeholder="EAA..." value={accessTokenInput} onChange={e => setAccessTokenInput(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono" />
                  <button onClick={handleDiscoverAccounts} disabled={isDiscovering} className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-[0_4px_15px_rgba(99,102,241,0.3)] flex items-center gap-2">
                    {isDiscovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Quét
                  </button>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-gray-400 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Token cần quyền <code className="bg-amber-100 px-1 rounded">ads_management</code> và <code className="bg-amber-100 px-1 rounded">ads_read</code> từ <strong>Meta Graph API Explorer</strong>.</span>
                </div>
              </div>
              {discoveredAccounts.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Tài khoản tìm thấy ({discoveredAccounts.length})</label>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                    {discoveredAccounts.map(acc => (
                      <div key={acc.id} className="flex justify-between items-center p-4 hover:bg-blue-50/50 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{acc.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{acc.id} · {acc.currency}</p>
                        </div>
                        <button onClick={() => handleConnectAccount(acc)} disabled={isConnecting} className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-sm disabled:opacity-50">
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
