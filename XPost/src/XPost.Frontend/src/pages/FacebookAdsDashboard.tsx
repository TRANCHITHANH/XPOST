import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  Plus, RefreshCw, BarChart2, ExternalLink, Link, AlertTriangle,
  Eye, Trash2, Pause, Play, ChevronDown, X, Calendar, Target,
  DollarSign, Users
} from 'lucide-react';

interface AdAccount {
  id: string;
  adAccountId: string;
  accountName: string;
  isActive: boolean;
}

interface AdSet {
  id: string;
  metaAdSetId: string;
  name: string;
  billingEvent: string;
  dailyBudget: number;
  targetingAgeMin: number;
  targetingAgeMax: number;
  targetingLocations: string;
  ads: Ad[];
}

interface Ad {
  id: string;
  metaAdId: string;
  name: string;
  title: string;
  bodyText: string;
  mediaUrl: string;
  status: string;
  callToAction: string;
}

interface Campaign {
  id: string;
  metaCampaignId: string;
  name: string;
  objective: string;
  status: string;
  budget: number;
  startTimeUtc: string;
  endTimeUtc?: string;
  adAccount?: { id: string; adAccountId: string; accountName: string };
  adSets?: AdSet[];
}

interface DailyInsight {
  date: string;
  impressions: number;
  clicks: number;
  reach: number;
  spend: number;
}

interface PerformanceSummary {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Lưu lượng truy cập',
  OUTCOME_AWARENESS: 'Nhận thức thương hiệu',
  OUTCOME_LEADS: 'Tạo khách hàng tiềm năng',
  OUTCOME_SALES: 'Doanh số bán hàng',
  OUTCOME_ENGAGEMENT: 'Tương tác',
  TRAFFIC: 'Lưu lượng truy cập',
  BRAND_AWARENESS: 'Nhận thức thương hiệu',
  LEAD_GENERATION: 'Tạo leads',
  CONVERSIONS: 'Chuyển đổi',
  REACH: 'Tiếp cận',
};

export default function FacebookAdsDashboard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary>({ impressions: 0, reach: 0, clicks: 0, spend: 0, ctr: 0, cpc: 0 });
  const [chartData, setChartData] = useState<DailyInsight[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Connect modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [discoveredAccounts, setDiscoveredAccounts] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Detail modal
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchAccounts(); }, []);
  useEffect(() => { if (selectedAccountId) fetchCampaigns(selectedAccountId); }, [selectedAccountId]);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/facebookads/accounts');
      setAccounts(res.data);
      if (res.data.length > 0) setSelectedAccountId(res.data[0].id);
      else setIsLoading(false);
    } catch {
      toast.error('Không thể tải danh sách tài khoản quảng cáo');
      setIsLoading(false);
    }
  };

  const fetchCampaigns = useCallback(async (accId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/facebookads/campaigns?adAccountId=${accId}`);
      setCampaigns(res.data);

      // Aggregate real insights from ALL campaigns
      let totalImp = 0, totalClicks = 0, totalReach = 0, totalSpend = 0;
      const dailyMap: Record<string, DailyInsight> = {};

      for (const camp of res.data) {
        try {
          const insRes = await api.get(`/facebookads/campaigns/${camp.id}/insights`);
          const s = insRes.data.summary;
          totalImp += s.impressions || 0;
          totalClicks += s.clicks || 0;
          totalReach += s.reach || 0;
          totalSpend += Number(s.spend) || 0;

          // Build daily chart data
          for (const ins of insRes.data.insights || []) {
            const day = ins.date ? ins.date.substring(0, 10) : 'unknown';
            if (!dailyMap[day]) dailyMap[day] = { date: day, impressions: 0, clicks: 0, reach: 0, spend: 0 };
            dailyMap[day].impressions += ins.impressions || 0;
            dailyMap[day].clicks += ins.clicks || 0;
            dailyMap[day].reach += ins.reach || 0;
            dailyMap[day].spend += Number(ins.spend) || 0;
          }
        } catch { /* skip failed insight fetch */ }
      }

      const ctr = totalImp > 0 ? (totalClicks / totalImp) * 100 : 0;
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      setSummary({ impressions: totalImp, reach: totalReach, clicks: totalClicks, spend: totalSpend, ctr, cpc });

      // Sort daily chart by date, take last 7 days
      const sorted = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
      setChartData(sorted);
    } catch {
      toast.error('Không thể tải thông tin chiến dịch');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSync = async () => {
    if (!selectedAccountId) return;
    try {
      setIsSyncing(true);
      toast.loading('Đang đồng bộ với Meta API...', { id: 'sync' });
      await api.post(`/facebookads/accounts/${selectedAccountId}/sync`);
      toast.success('Đồng bộ thành công!', { id: 'sync' });
      await fetchCampaigns(selectedAccountId);
    } catch (err: any) {
      toast.error('Đồng bộ thất bại: ' + (err.response?.data?.message || err.message), { id: 'sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleStatus = async (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      toast.loading('Đang cập nhật trạng thái...', { id: 'status' });
      await api.put(`/facebookads/campaigns/${campaignId}/status`, { status: nextStatus });
      toast.success(`Đã chuyển sang ${nextStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}`, { id: 'status' });
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: nextStatus } : c));
    } catch (err: any) {
      toast.error('Cập nhật thất bại: ' + (err.response?.data?.message || err.message), { id: 'status' });
    }
  };

  const handleViewDetail = async (campaign: Campaign) => {
    setDetailCampaign(campaign);
    setShowDetailModal(true);
    // Refresh full detail with adSets/ads
    if (!campaign.adSets) {
      try {
        setLoadingDetail(true);
        const res = await api.get(`/facebookads/campaigns?adAccountId=${selectedAccountId}`);
        const found = res.data.find((c: Campaign) => c.id === campaign.id);
        if (found) setDetailCampaign(found);
      } catch { /* use cached */ } finally {
        setLoadingDetail(false);
      }
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (deletingId !== campaignId) {
      setDeletingId(campaignId);
      toast('Nhấn lại để xác nhận xóa chiến dịch', { icon: '⚠️', duration: 3000 });
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    try {
      toast.loading('Đang xóa chiến dịch...', { id: 'delete' });
      await api.delete(`/facebookads/campaigns/${campaignId}`);
      toast.success('Đã xóa chiến dịch thành công', { id: 'delete' });
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      setDeletingId(null);
    } catch (err: any) {
      toast.error('Xóa thất bại: ' + (err.response?.data?.message || err.message), { id: 'delete' });
      setDeletingId(null);
    }
  };

  const handleDiscoverAccounts = async () => {
    if (!accessTokenInput.trim()) { toast.error('Vui lòng nhập User Access Token'); return; }
    try {
      setIsDiscovering(true);
      setDiscoveredAccounts([]);
      const res = await api.post('/facebookads/accounts/discover', { userAccessToken: accessTokenInput });
      setDiscoveredAccounts(res.data);
      if (res.data.length === 0) toast.error('Không tìm thấy tài khoản quảng cáo nào');
      else toast.success(`Tìm thấy ${res.data.length} tài khoản!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể quét tài khoản');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleConnectAccount = async (acc: any) => {
    try {
      setIsConnecting(true);
      await api.post('/facebookads/accounts/connect', { adAccountId: acc.id, accountName: acc.name, userAccessToken: accessTokenInput });
      toast.success(`Đã kết nối: ${acc.name}`);
      setShowConnectModal(false);
      setAccessTokenInput('');
      setDiscoveredAccounts([]);
      await fetchAccounts();
    } catch (err: any) {
      toast.error('Kết nối thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsConnecting(false);
    }
  };

  // Chart helpers
  const maxImp = Math.max(...chartData.map(d => d.impressions), 1);
  const maxClk = Math.max(...chartData.map(d => d.clicks), 1);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      return days[d.getDay()];
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            Chiến dịch Facebook Ads
          </h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý ngân sách, nhóm quảng cáo, thiết kế nội dung và theo dõi hiệu suất.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {accounts.length > 0 ? (
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-9 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full sm:w-56"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.accountName}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="text-sm text-orange-500 font-medium px-4 py-2 bg-orange-50 rounded-xl flex items-center gap-1.5 border border-orange-100">
              <AlertTriangle className="w-4 h-4" /> Chưa kết nối TK Quảng cáo
            </div>
          )}
          <button onClick={() => setShowConnectModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-all whitespace-nowrap">
            <Link className="w-4 h-4" /> Liên kết TK
          </button>
          {accounts.length > 0 && (
            <button onClick={handleSync} disabled={isSyncing} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all flex items-center justify-center disabled:opacity-50" title="Đồng bộ với Meta">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          {accounts.length > 0 && (
            <button onClick={() => navigate('/facebook-ads/create?accountId=' + selectedAccountId)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all whitespace-nowrap">
              <Plus className="w-4 h-4" /> Tạo chiến dịch
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 mt-4 font-medium animate-pulse">Đang tải dữ liệu chiến dịch...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-3xl border border-gray-100 text-center max-w-xl mx-auto mt-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
            <BarChart2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Kết nối tài khoản Facebook Ads</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md">Hãy liên kết tài khoản quảng cáo Facebook hoặc Meta Business Suite để bắt đầu quản lý chiến dịch.</p>
          <button onClick={() => setShowConnectModal(true)} className="flex items-center gap-2 px-6 py-3 font-semibold bg-blue-600 text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:bg-blue-700 transition-all mt-6">
            <Link className="w-4 h-4" /> Bắt đầu kết nối
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Lượt Hiển Thị', value: summary.impressions.toLocaleString('vi-VN'), sub: `Tiếp cận: ${summary.reach.toLocaleString('vi-VN')}`, color: 'bg-blue-600', icon: <Eye className="w-4 h-4" /> },
              { label: 'Lượt Click', value: summary.clicks.toLocaleString('vi-VN'), sub: `CPC: ${summary.cpc.toFixed(0)}đ`, color: 'bg-indigo-600', icon: <Target className="w-4 h-4" /> },
              { label: 'Tỷ lệ Click (CTR)', value: `${summary.ctr.toFixed(2)}%`, sub: summary.impressions === 0 ? 'Chưa có dữ liệu' : `${summary.impressions.toLocaleString()} impressions`, color: 'bg-emerald-600', icon: <Users className="w-4 h-4" /> },
              { label: 'Chi Phí (VND)', value: `${summary.spend.toLocaleString('vi-VN')}đ`, sub: 'Meta Billing', color: 'bg-rose-500', icon: <DollarSign className="w-4 h-4" /> },
            ].map((card, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">{card.label}</span>
                  <span className={`w-7 h-7 ${card.color} bg-opacity-10 rounded-lg flex items-center justify-center text-gray-500`}>{card.icon}</span>
                </div>
                <span className="text-2xl font-bold text-gray-900 leading-none">{card.value}</span>
                <span className="text-xs text-gray-400">{card.sub}</span>
                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                  <div className={`${card.color} h-full rounded-full`} style={{ width: summary.impressions === 0 ? '0%' : '100%', transition: 'width 0.8s ease' }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Biểu đồ hiệu suất chiến dịch</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {chartData.length > 0
                    ? `Dữ liệu thực từ Meta API (${chartData.length} ngày gần nhất)`
                    : 'Chưa có dữ liệu insights từ Meta (chiến dịch Sandbox có thể không có insights)'}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-blue-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>Lượt hiển thị</span>
                <span className="flex items-center gap-1.5 text-indigo-600"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>Lượt click</span>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-3">
                <BarChart2 className="w-12 h-12" />
                <p className="text-sm text-gray-400 text-center">Chưa có dữ liệu insights.<br />Meta thường cần 24-48h sau khi chiến dịch hoạt động để có số liệu.</p>
              </div>
            ) : (
              <div className="relative h-60 w-full flex items-end justify-between px-2 pt-4 gap-1">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40 z-0 py-4">
                  {[0, 1, 2, 3].map(i => <div key={i} className="border-b border-dashed border-gray-200 w-full h-0" />)}
                </div>
                {chartData.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 z-10 flex-1 group relative">
                    <div className="flex gap-1 items-end h-40">
                      <div
                        style={{ height: `${(item.impressions / maxImp) * 100}%` }}
                        className="w-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all duration-500 relative"
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-gray-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg whitespace-nowrap z-50 shadow-xl gap-0.5">
                          <span className="font-bold">{formatDate(item.date)} — {item.date}</span>
                          <span>👁 {item.impressions.toLocaleString()}</span>
                          <span>🖱 {item.clicks.toLocaleString()}</span>
                        </div>
                      </div>
                      <div
                        style={{ height: `${(item.clicks / maxClk) * 100}%` }}
                        className="w-4 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm transition-all duration-500"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400">{formatDate(item.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campaign Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900">Danh sách chiến dịch ({campaigns.length})</h3>
                <p className="text-xs text-gray-400 mt-0.5">Nhấn vào hàng để xem chi tiết. Có thể bật/tắt hoặc xóa chiến dịch.</p>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div className="py-16 text-center">
                <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Không tìm thấy chiến dịch nào. Nhấn <strong>Tạo chiến dịch</strong> để bắt đầu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Tên chiến dịch</th>
                      <th className="py-3.5 px-6">Mục tiêu</th>
                      <th className="py-3.5 px-6">Trạng thái</th>
                      <th className="py-3.5 px-6">Ngân sách</th>
                      <th className="py-3.5 px-6">Thời gian</th>
                      <th className="py-3.5 px-6 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                    {campaigns.map((camp) => (
                      <tr
                        key={camp.id}
                        className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                        onClick={() => handleViewDetail(camp)}
                      >
                        <td className="py-4 px-6 font-semibold text-gray-900 max-w-[220px]">
                          <div className="flex flex-col">
                            <span className="truncate">{camp.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono font-normal mt-0.5">#{camp.metaCampaignId}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-600 whitespace-nowrap">
                            {OBJECTIVE_LABELS[camp.objective] ?? camp.objective.replace('OUTCOME_', '')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {camp.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Tạm dừng
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-semibold text-gray-900">
                          {camp.budget.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-4 px-6 text-xs text-gray-500">
                          <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(camp.startTimeUtc).toLocaleDateString('vi-VN')}</div>
                          {camp.endTimeUtc && <div className="mt-0.5 text-gray-400">→ {new Date(camp.endTimeUtc).toLocaleDateString('vi-VN')}</div>}
                        </td>
                        <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-1">
                            {/* Detail */}
                            <button
                              onClick={() => handleViewDetail(camp)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Toggle */}
                            <button
                              onClick={() => handleToggleStatus(camp.id, camp.status)}
                              className={`p-2 rounded-lg transition-all ${camp.status === 'ACTIVE' ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                              title={camp.status === 'ACTIVE' ? 'Tạm dừng chiến dịch' : 'Kích hoạt lại'}
                            >
                              {camp.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>

                            {/* Open in Meta */}
                            <button
                              onClick={() => window.open(`https://www.facebook.com/adsmanager/manage/campaigns?act=${accounts.find(a => a.id === selectedAccountId)?.adAccountId?.replace('act_', '')}&selected_campaign_ids=${camp.metaCampaignId}`, '_blank')}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Mở trong Meta Ads Manager"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(camp.id)}
                              className={`p-2 rounded-lg transition-all ${deletingId === camp.id ? 'text-white bg-red-500 animate-pulse' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                              title={deletingId === camp.id ? 'Nhấn lại để xác nhận xóa' : 'Xóa chiến dịch'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Detail Modal */}
      {showDetailModal && detailCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{detailCampaign.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">Meta ID: {detailCampaign.metaCampaignId}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-10 flex justify-center"><div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" /></div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Trạng thái', value: detailCampaign.status === 'ACTIVE' ? '🟢 Hoạt động' : '⏸ Tạm dừng' },
                    { label: 'Mục tiêu', value: OBJECTIVE_LABELS[detailCampaign.objective] ?? detailCampaign.objective },
                    { label: 'Ngân sách ngày', value: `${detailCampaign.budget.toLocaleString('vi-VN')}đ` },
                    { label: 'Ngày bắt đầu', value: new Date(detailCampaign.startTimeUtc).toLocaleString('vi-VN') },
                    { label: 'Ngày kết thúc', value: detailCampaign.endTimeUtc ? new Date(detailCampaign.endTimeUtc).toLocaleString('vi-VN') : 'Không giới hạn' },
                  ].map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-semibold text-gray-800 mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Ad Sets */}
                {detailCampaign.adSets && detailCampaign.adSets.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      Nhóm quảng cáo ({detailCampaign.adSets.length})
                    </h4>
                    <div className="space-y-3">
                      {detailCampaign.adSets.map(adSet => (
                        <div key={adSet.id} className="border border-gray-100 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{adSet.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">Meta ID: {adSet.metaAdSetId}</p>
                            </div>
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">
                              {adSet.dailyBudget?.toLocaleString('vi-VN')}đ/ngày
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">Tuổi: {adSet.targetingAgeMin}-{adSet.targetingAgeMax}</span>
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">📍 {adSet.targetingLocations}</span>
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{adSet.billingEvent}</span>
                          </div>

                          {adSet.ads && adSet.ads.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quảng cáo ({adSet.ads.length})</p>
                              {adSet.ads.map(ad => (
                                <div key={ad.id} className="flex gap-3 bg-gray-50 rounded-xl p-3">
                                  {ad.mediaUrl && (
                                    <img
                                      src={ad.mediaUrl.startsWith('/') ? `${(api.defaults.baseURL || '').replace('/api', '')}${ad.mediaUrl}` : ad.mediaUrl}
                                      alt="ad"
                                      className="w-14 h-14 object-cover rounded-lg shrink-0"
                                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-800 truncate">{ad.name}</p>
                                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{ad.title}</p>
                                    <div className="flex gap-2 mt-1.5">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${ad.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{ad.status}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 font-bold">{ad.callToAction}</span>
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
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { handleToggleStatus(detailCampaign.id, detailCampaign.status); setShowDetailModal(false); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${detailCampaign.status === 'ACTIVE' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    {detailCampaign.status === 'ACTIVE' ? <><Pause className="w-4 h-4" />Tạm dừng</> : <><Play className="w-4 h-4" />Kích hoạt</>}
                  </button>
                  <button
                    onClick={() => window.open(`https://www.facebook.com/adsmanager/manage/campaigns?act=${accounts.find(a => a.id === selectedAccountId)?.adAccountId?.replace('act_', '')}&selected_campaign_ids=${detailCampaign.metaCampaignId}`, '_blank')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" /> Mở Meta Manager
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Liên kết tài khoản Meta Marketing</h3>
                <p className="text-xs text-gray-500 mt-0.5">Nhập User Access Token để quét tài khoản quảng cáo.</p>
              </div>
              <button onClick={() => { setShowConnectModal(false); setAccessTokenInput(''); setDiscoveredAccounts([]); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Facebook User Access Token</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="EAA..."
                    value={accessTokenInput}
                    onChange={(e) => setAccessTokenInput(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
                  />
                  <button onClick={handleDiscoverAccounts} disabled={isDiscovering} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-1.5">
                    {isDiscovering && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Quét
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Token cần quyền <code>ads_management</code> và <code>ads_read</code>. Lấy từ <strong>Meta Graph API Explorer</strong>.</span>
                </div>
              </div>
              {discoveredAccounts.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Tài khoản phát hiện được</label>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {discoveredAccounts.map((acc) => (
                      <div key={acc.id} className="flex justify-between items-center p-3 hover:bg-gray-50/50 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{acc.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{acc.id} · {acc.currency}</p>
                        </div>
                        <button onClick={() => handleConnectAccount(acc)} disabled={isConnecting} className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all disabled:opacity-50">
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
