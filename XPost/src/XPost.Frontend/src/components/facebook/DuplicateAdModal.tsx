import React, { useState } from 'react';
import { X, Copy, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';

interface DuplicateAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  type: 'campaign' | 'adset' | 'ad';
  campaigns?: any[];
  onSuccess: () => void;
}

export function DuplicateAdModal({ isOpen, onClose, selectedIds, type, campaigns = [], onSuccess }: DuplicateAdModalProps) {
  const [duplicateCount, setDuplicateCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetCampaignId, setTargetCampaignId] = useState<string>('');
  const [targetAdSetId, setTargetAdSetId] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      if (type === 'adset') {
        const parentCamp = campaigns.find(c => c.adSets?.some((s: any) => s.id === selectedIds[0]));
        setTargetCampaignId(parentCamp?.id || (campaigns[0]?.id || ''));
      } else if (type === 'ad') {
        const parentCamp = campaigns.find(c => c.adSets?.some((s: any) => s.ads?.some((a: any) => a.id === selectedIds[0])));
        const campId = parentCamp?.id || (campaigns[0]?.id || '');
        setTargetCampaignId(campId);

        let foundAdSetId = '';
        for (const c of campaigns) {
          const s = c.adSets?.find((as: any) => as.ads?.some((a: any) => a.id === selectedIds[0]));
          if (s) {
            foundAdSetId = s.id;
            break;
          }
        }
        if (!foundAdSetId && parentCamp) {
          foundAdSetId = parentCamp.adSets?.[0]?.id || '';
        }
        if (!foundAdSetId) {
          const selectedCamp = campaigns.find(c => c.id === campId);
          foundAdSetId = selectedCamp?.adSets?.[0]?.id || '';
        }
        setTargetAdSetId(foundAdSetId);
      }
    }
  }, [isOpen, type, campaigns, selectedIds]);

  if (!isOpen) return null;

  const selectedCampaign = campaigns.find(c => c.id === targetCampaignId);
  const targetAdSets = selectedCampaign?.adSets || [];

  const handleCampaignChange = (campId: string) => {
    setTargetCampaignId(campId);
    const camp = campaigns.find(c => c.id === campId);
    setTargetAdSetId(camp?.adSets?.[0]?.id || '');
  };

  const typeLabel = type === 'campaign' ? 'chiến dịch' : type === 'adset' ? 'nhóm quảng cáo' : 'quảng cáo';
  const typeTitle = type === 'campaign' ? 'Chiến Dịch' : type === 'adset' ? 'Nhóm Quảng Cáo' : 'Quảng Cáo';

  const handleSubmit = async () => {
    if (type === 'adset' && !targetCampaignId) {
      toast.error('Vui lòng chọn chiến dịch đích');
      return;
    }
    if (type === 'ad' && (!targetCampaignId || !targetAdSetId)) {
      toast.error('Vui lòng chọn chiến dịch và nhóm quảng cáo đích');
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading(`Đang nhân bản ${typeLabel}...`, { id: 'duplicate' });
      
      for (const id of selectedIds) {
        if (type === 'campaign') {
          await api.post(`/facebookads/campaigns/${id}/duplicate?count=${duplicateCount}`);
        } else if (type === 'adset') {
          await api.post(`/facebookads/adsets/${id}/duplicate`, {
            targetCampaignId,
            count: duplicateCount
          });
        } else if (type === 'ad') {
          await api.post(`/facebookads/ads/${id}/duplicate`, {
            targetAdSetId,
            count: duplicateCount
          });
        }
      }
      
      toast.success(`Đã nhân bản thành ${duplicateCount} bản sao nháp thành công!`, { id: 'duplicate' });
      onSuccess();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Có lỗi xảy ra khi nhân bản.';
      toast.error(msg, { id: 'duplicate' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/70 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.25)] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white">
          <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-600" />
            Nhân Bản {typeTitle}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Số lượng bản sao cần tạo
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setDuplicateCount(num)}
                  className={`py-2 text-sm font-black rounded-xl border transition-all ${
                    duplicateCount === num
                      ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Target Selection UI */}
          {type === 'adset' && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Chiến dịch đích
              </label>
              <div className="relative">
                <select
                  value={targetCampaignId}
                  onChange={e => setTargetCampaignId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all appearance-none"
                >
                  <option value="">-- Chọn chiến dịch đích --</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.status === 'DRAFT' ? '(Draft)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
          )}

          {type === 'ad' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Chiến dịch đích
                </label>
                <div className="relative">
                  <select
                    value={targetCampaignId}
                    onChange={e => handleCampaignChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all appearance-none"
                  >
                    <option value="">-- Chọn chiến dịch đích --</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.status === 'DRAFT' ? '(Draft)' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Nhóm quảng cáo đích
                </label>
                <div className="relative">
                  <select
                    value={targetAdSetId}
                    onChange={e => setTargetAdSetId(e.target.value)}
                    disabled={!targetCampaignId}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Chọn nhóm quảng cáo --</option>
                    {targetAdSets.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                {targetCampaignId && targetAdSets.length === 0 && (
                  <p className="text-[10px] text-red-500 font-medium mt-1">
                    Chiến dịch được chọn chưa có nhóm quảng cáo nào.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Các bản sao nhân bản sẽ được lưu dưới dạng <strong>Bản nháp (DRAFT)</strong> cục bộ trong hệ thống với hậu tố <strong>- Bản sao</strong>. Bạn có thể tiến hành xem xét và thay đổi nội dung, ngân sách, sau đó nhấn <strong>Đăng/Kích hoạt</strong> để đồng bộ và phân phối lên Facebook Ads.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-xs font-black text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (type === 'adset' && !targetCampaignId) || (type === 'ad' && (!targetCampaignId || !targetAdSetId))}
            className="px-5 py-2.5 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-blue-500/10 flex items-center gap-2"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Nhân bản ngay
          </button>
        </div>
      </div>
    </div>
  );
}
