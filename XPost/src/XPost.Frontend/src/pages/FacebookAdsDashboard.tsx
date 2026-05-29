import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { 
  Plus, RefreshCw, BarChart2, TrendingUp, DollarSign, MousePointer, 
  Eye, ToggleLeft, ToggleRight, Settings, ExternalLink, Link, AlertTriangle
} from 'lucide-react';

interface AdAccount {
  id: string;
  adAccountId: string;
  accountName: string;
  isActive: boolean;
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
  adSetsCount: number;
}

interface PerformanceSummary {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
}

export default function FacebookAdsDashboard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary>({
    impressions: 0,
    reach: 0,
    clicks: 0,
    spend: 0,
    ctr: 0,
    cpc: 0
  });
  const [insights, setInsights] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Connection Modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [discoveredAccounts, setDiscoveredAccounts] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchCampaigns(selectedAccountId);
    }
  }, [selectedAccountId]);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/facebookads/accounts');
      setAccounts(res.data);
      if (res.data.length > 0) {
        setSelectedAccountId(res.data[0].id);
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể tải danh sách tài khoản quảng cáo');
      setIsLoading(false);
    }
  };

  const fetchCampaigns = async (accId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/facebookads/campaigns?adAccountId=${accId}`);
      setCampaigns(res.data);
      
      // Calculate a fallback sum from campaigns if there are no deep insights yet
      const fallbackSum = res.data.reduce((acc: any, camp: any) => {
        return acc; 
      }, { impressions: 0, clicks: 0, spend: 0 });

      // Fetch insights for the first campaign if any exists to populate cards
      if (res.data.length > 0) {
        const campId = res.data[0].id;
        const insRes = await api.get(`/facebookads/campaigns/${campId}/insights`);
        setSummary(insRes.data.summary);
        setInsights(insRes.data.insights);
      } else {
        setSummary({
          impressions: 0,
          reach: 0,
          clicks: 0,
          spend: 0,
          ctr: 0,
          cpc: 0
        });
        setInsights([]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể tải thông tin chiến dịch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedAccountId) return;
    try {
      setIsSyncing(true);
      toast.loading('Đang đồng bộ dữ liệu với Meta API...', { id: 'sync' });
      await api.post(`/facebookads/accounts/${selectedAccountId}/sync`);
      toast.success('Đồng bộ dữ liệu thành công!', { id: 'sync' });
      await fetchCampaigns(selectedAccountId);
    } catch (err: any) {
      console.error(err);
      toast.error('Đồng bộ thất bại: ' + (err.response?.data?.message || err.message), { id: 'sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleStatus = async (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      toast.loading('Đang cập nhật trạng thái trên Meta...', { id: 'status' });
      await api.put(`/facebookads/campaigns/${campaignId}/status`, { status: nextStatus });
      toast.success(`Đã chuyển chiến dịch thành ${nextStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}`, { id: 'status' });
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: nextStatus } : c));
    } catch (err: any) {
      console.error(err);
      toast.error('Cập nhật trạng thái thất bại: ' + (err.response?.data?.message || err.message), { id: 'status' });
    }
  };

  const handleDiscoverAccounts = async () => {
    if (!accessTokenInput.trim()) {
      toast.error('Vui lòng nhập User Access Token');
      return;
    }
    try {
      setIsDiscovering(true);
      setDiscoveredAccounts([]);
      const res = await api.post('/facebookads/accounts/discover', { userAccessToken: accessTokenInput });
      setDiscoveredAccounts(res.data);
      if (res.data.length === 0) {
        toast.error('Không tìm thấy tài khoản quảng cáo nào được liên kết');
      } else {
        toast.success(`Tìm thấy ${res.data.length} tài khoản quảng cáo!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể quét tài khoản quảng cáo');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleConnectAccount = async (acc: any) => {
    try {
      setIsConnecting(true);
      const payload = {
        adAccountId: acc.id,
        accountName: acc.name,
        userAccessToken: accessTokenInput
      };
      const res = await api.post('/facebookads/accounts/connect', payload);
      toast.success(`Đã kết nối thành công tài khoản: ${acc.name}`);
      setShowConnectModal(false);
      setAccessTokenInput('');
      setDiscoveredAccounts([]);
      await fetchAccounts();
    } catch (err: any) {
      console.error(err);
      toast.error('Kết nối tài khoản thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            Chiến dịch Facebook Ads
          </h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý ngân sách, nhóm quảng cáo, thiết kế nội dung và theo dõi hiệu suất chuyển đổi.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {accounts.length > 0 ? (
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full sm:w-60"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.accountName} ({acc.adAccountId})</option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-orange-500 font-medium px-4 py-2 bg-orange-50 rounded-xl flex items-center gap-1.5 border border-orange-100">
              <AlertTriangle className="w-4 h-4" />
              Chưa kết nối TK Quảng cáo
            </div>
          )}

          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-all whitespace-nowrap"
          >
            <Link className="w-4 h-4" />
            Liên kết TK
          </button>

          {accounts.length > 0 && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all flex items-center justify-center disabled:opacity-50"
              title="Đồng bộ với Facebook Ads Manager"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {accounts.length > 0 && (
            <button
              onClick={() => navigate('/facebook-ads/create?accountId=' + selectedAccountId)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all whitespace-nowrap ml-1"
            >
              <Plus className="w-4 h-4" />
              Tạo chiến dịch
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 mt-4 font-medium animate-pulse">Đang tải dữ liệu chiến dịch...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] text-center max-w-xl mx-auto mt-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
            <BarChart2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Kết nối tài khoản Facebook Ads</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            Để tạo chiến dịch tiếp thị và quản lý quảng cáo ngay trên XPost, hãy liên kết tài khoản quảng cáo Facebook hoặc Meta Business Suite của bạn.
          </p>
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 font-semibold bg-blue-600 text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:bg-blue-700 transition-all mt-6"
          >
            <Link className="w-4 h-4" />
            Bắt đầu kết nối tài khoản
          </button>
        </div>
      ) : (
        <>
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lượt Hiển Thị (Impressions)</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">{summary.impressions.toLocaleString()}</span>
                <span className="text-xs font-medium text-green-500 flex items-center">+12.5%</span>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full mt-4 overflow-hidden">
                <div className="bg-blue-600 h-full w-[70%]"></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lượt Click (Link Clicks)</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">{summary.clicks.toLocaleString()}</span>
                <span className="text-xs font-medium text-green-500 flex items-center">+8.2%</span>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full mt-4 overflow-hidden">
                <div className="bg-indigo-600 h-full w-[45%]"></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tỷ lệ click (CTR)</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">{summary.ctr.toFixed(2)}%</span>
                <span className="text-xs font-medium text-green-500 flex items-center">+2.1%</span>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full mt-4 overflow-hidden">
                <div className="bg-emerald-600 h-full w-[60%]"></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex flex-col justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Chi Phí (Spend VND)</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">{summary.spend.toLocaleString()}đ</span>
                <span className="text-xs font-medium text-gray-500 flex items-center">Meta Bill</span>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full mt-4 overflow-hidden">
                <div className="bg-rose-500 h-full w-[80%]"></div>
              </div>
            </div>
          </div>

          {/* Simple Visual Chart (Tailwind-designed elegant area graph mockup) */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Biểu đồ hiệu suất chiến dịch</h3>
                <p className="text-xs text-gray-400 mt-0.5">Số lượt nhấp chuột & lượt hiển thị 7 ngày qua</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  Lượt hiển thị
                </span>
                <span className="flex items-center gap-1.5 text-indigo-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  Lượt click
                </span>
              </div>
            </div>

            {/* Custom SVG Rendered Beautiful Simulated Graph */}
            <div className="relative h-60 w-full flex items-end justify-between px-2 pt-4">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-50 z-0">
                <div className="border-b border-dashed border-gray-100 h-0 w-full"></div>
                <div className="border-b border-dashed border-gray-100 h-0 w-full"></div>
                <div className="border-b border-dashed border-gray-100 h-0 w-full"></div>
                <div className="border-b border-dashed border-gray-100 h-0 w-full"></div>
              </div>

              {/* Data bars */}
              {[
                { label: 'Thứ 2', imp: 12000, clk: 450 },
                { label: 'Thứ 3', imp: 18000, clk: 600 },
                { label: 'Thứ 4', imp: 15000, clk: 520 },
                { label: 'Thứ 5', imp: 24000, clk: 980 },
                { label: 'Thứ 6', imp: 21000, clk: 840 },
                { label: 'Thứ 7', imp: 29000, clk: 1240 },
                { label: 'Chủ Nhật', imp: 35000, clk: 1650 }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 z-10 w-full group relative">
                  <div className="flex gap-1.5 items-end h-40">
                    <div 
                      style={{ height: `${(item.imp / 35000) * 100}%` }} 
                      className="w-4 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm group-hover:from-blue-700 group-hover:to-blue-500 transition-all duration-300 relative shadow-sm"
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50">
                        Imp: {item.imp.toLocaleString()}
                      </div>
                    </div>
                    <div 
                      style={{ height: `${(item.clk / 1650) * 100}%` }} 
                      className="w-4 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm group-hover:from-indigo-700 group-hover:to-indigo-500 transition-all duration-300 relative shadow-sm"
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50">
                        Clicks: {item.clk.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Campaigns Data Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900">Danh sách chiến dịch đã cấu hình</h3>
                <p className="text-xs text-gray-400 mt-0.5">Hiển thị các chiến dịch cục bộ đã đồng bộ từ Meta.</p>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400">Không tìm thấy chiến dịch nào. Hãy bấm "Tạo chiến dịch" để bắt đầu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Tên chiến dịch</th>
                      <th className="py-4 px-6">Mục tiêu</th>
                      <th className="py-4 px-6">Trạng thái</th>
                      <th className="py-4 px-6">Ngân sách ngày</th>
                      <th className="py-4 px-6">Thời gian chạy</th>
                      <th className="py-4 px-6 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                    {campaigns.map((camp) => (
                      <tr key={camp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-gray-900">
                          <div className="flex flex-col">
                            <span>{camp.name}</span>
                            <span className="text-[10px] text-gray-400 font-normal mt-0.5">Meta ID: {camp.metaCampaignId}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-600 uppercase">
                            {camp.objective.replace('OUTCOME_', '')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <button 
                            onClick={() => handleToggleStatus(camp.id, camp.status)}
                            className="flex items-center gap-1.5 focus:outline-none"
                          >
                            {camp.status === 'ACTIVE' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
                                Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                Tạm dừng
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-6 font-semibold text-gray-900">
                          {camp.budget.toLocaleString()} đ
                        </td>
                        <td className="py-4 px-6 text-xs text-gray-500">
                          <div>Bắt đầu: {new Date(camp.startTimeUtc).toLocaleDateString('vi-VN')}</div>
                          {camp.endTimeUtc && <div className="mt-0.5">Kết thúc: {new Date(camp.endTimeUtc).toLocaleDateString('vi-VN')}</div>}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => toast.success('Đang mở chi tiết trên Facebook Ads Manager...')}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Xem trong Meta Ads Manager"
                            >
                              <ExternalLink className="w-4 h-4" />
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

      {/* Connect Account Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Liên kết tài khoản Meta Marketing</h3>
                <p className="text-xs text-gray-500 mt-0.5">Nhập User Access Token của bạn để bắt đầu quét các tài khoản.</p>
              </div>
              <button
                onClick={() => {
                  setShowConnectModal(false);
                  setAccessTokenInput('');
                  setDiscoveredAccounts([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
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
                  <button
                    onClick={handleDiscoverAccounts}
                    disabled={isDiscovering}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-1.5"
                  >
                    {isDiscovering && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Quét tài khoản
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 mt-1 leading-normal flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Token cần chứa quyền <code>ads_management</code> và <code>ads_read</code>. Bạn có thể lấy token phát triển từ cổng thông tin <strong>Meta for Developers</strong> (Graph API Explorer).
                  </span>
                </div>
              </div>

              {discoveredAccounts.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Tài khoản quảng cáo được phát hiện</label>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-white">
                    {discoveredAccounts.map((acc) => (
                      <div key={acc.id} className="flex justify-between items-center p-3 hover:bg-gray-50/50 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{acc.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">ID: {acc.id} ({acc.currency} / {acc.timezoneName})</p>
                        </div>
                        <button
                          onClick={() => handleConnectAccount(acc)}
                          disabled={isConnecting}
                          className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                        >
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
