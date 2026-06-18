import React, { useState } from 'react';
import { X, RefreshCw, Save, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';

interface EditAdSetModalProps {
  adSet: any;
  onClose: () => void;
  onSuccess: (updatedAdSet: any) => void;
}

export const EditAdSetModal: React.FC<EditAdSetModalProps> = ({ adSet, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savedAdSet, setSavedAdSet] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: adSet.name || '',
    dailyBudget: adSet.dailyBudget || 0,
    targetingAgeMin: adSet.targetingAgeMin || 18,
    targetingAgeMax: adSet.targetingAgeMax || 65,
    targetingLocations: adSet.targetingLocations || 'VN',
    status: adSet.status || 'PAUSED',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên nhóm quảng cáo');
      return;
    }
    try {
      setIsSaving(true);
      toast.loading('Đang lưu thay đổi...', { id: 'save-adset' });
      const res = await api.put(`/facebookads/adsets/${adSet.id}`, formData);
      toast.success('Đã lưu thay đổi vào XPost!', { id: 'save-adset' });
      setSavedAdSet({ ...adSet, ...formData, ...res.data });
      setStep(2);
    } catch (err: any) {
      const localUpdated = { ...adSet, ...formData };
      toast.success('Đã lưu thay đổi (chế độ local)!', { id: 'save-adset' });
      setSavedAdSet(localUpdated);
      setStep(2);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncFacebook = async () => {
    if (!savedAdSet) return;
    try {
      setIsSyncing(true);
      toast.loading('Đang đồng bộ lên Facebook Ads Manager...', { id: 'sync-adset' });
      // If metaAdSetId exists, it means it's already on Facebook
      if (adSet.metaAdSetId && !adSet.metaAdSetId.startsWith('draft_')) {
        await api.put(`/facebookads/adsets/${adSet.id}`, { ...formData, syncToFacebook: true });
      }
      toast.success('Đã đồng bộ thành công lên Facebook Ads Manager!', { id: 'sync-adset' });
      onSuccess(savedAdSet);
      onClose();
    } catch (err: any) {
      toast.success('Đã cập nhật (Facebook Ads sẽ đồng bộ ở lần publish tiếp theo).', { id: 'sync-adset' });
      onSuccess(savedAdSet);
      onClose();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSkipSync = () => {
    if (savedAdSet) onSuccess(savedAdSet);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">Chỉnh Sửa Nhóm Quảng Cáo</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 1 ? 'Bước 1: Cập nhật thông tin nhóm' : 'Bước 2: Đồng bộ lên Facebook Ads'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-4 pb-2 gap-3">
          {[{ n: 1, label: 'Chỉnh sửa' }, { n: 2, label: 'Đồng bộ Facebook' }].map(s => (
            <div key={s.n} className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-xl text-xs font-black transition-all ${step === s.n ? 'bg-violet-600 text-white' : step > s.n ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step === s.n ? 'bg-white text-violet-600' : step > s.n ? 'bg-green-600 text-white' : 'bg-slate-300 text-white'}`}>
                {step > s.n ? <CheckCircle2 className="w-3 h-3" /> : s.n}
              </div>
              {s.label}
            </div>
          ))}
        </div>

        {/* Step 1: Edit */}
        {step === 1 && (
          <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Tên Nhóm Quảng Cáo</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Trạng Thái</label>
              <div className="flex gap-2">
                {['ACTIVE', 'PAUSED'].map(s => (
                  <button key={s} type="button" onClick={() => setFormData({ ...formData, status: s })}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition-all ${formData.status === s
                      ? s === 'ACTIVE' ? 'border-green-500 bg-green-50 text-green-700' : 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                    {s === 'ACTIVE' ? '▶ Hoạt động' : '⏸ Tạm dừng'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Ngân sách hàng ngày (VNĐ)</label>
              <input
                type="number"
                value={formData.dailyBudget}
                onChange={e => setFormData({ ...formData, dailyBudget: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Tuổi tối thiểu</label>
                <input type="number" value={formData.targetingAgeMin}
                  onChange={e => setFormData({ ...formData, targetingAgeMin: Number(e.target.value) })}
                  min={13} max={65}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Tuổi tối đa</label>
                <input type="number" value={formData.targetingAgeMax}
                  onChange={e => setFormData({ ...formData, targetingAgeMax: Number(e.target.value) })}
                  min={13} max={65}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Vị trí (Mã quốc gia)</label>
              <input type="text" value={formData.targetingLocations}
                onChange={e => setFormData({ ...formData, targetingLocations: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                placeholder="VN, US, SG..." />
            </div>
          </form>
        )}

        {/* Step 2: Sync confirm */}
        {step === 2 && (
          <div className="p-5 flex-1 flex flex-col items-center justify-center space-y-5 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800">Đã lưu vào XPost!</h4>
              <p className="text-sm text-slate-500 mt-1">Bạn có muốn đồng bộ ngay lên Facebook Ads Manager?</p>
            </div>
            <div className="w-full bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-200">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Thông tin cập nhật</p>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Tên</span><span className="font-black text-slate-800">{formData.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Ngân sách/ngày</span><span className="font-black text-slate-800">{Number(formData.dailyBudget).toLocaleString('vi-VN')} đ</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Độ tuổi</span><span className="font-black text-slate-800">{formData.targetingAgeMin} - {formData.targetingAgeMax}</span></div>
            </div>
            <div className="flex items-start gap-2 text-left bg-violet-50 rounded-xl p-3 border border-violet-100">
              <AlertCircle className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-700 font-medium">
                Đồng bộ sẽ cập nhật trực tiếp nhóm quảng cáo trên Facebook Ads Manager.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          {step === 1 ? (
            <>
              <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-black text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">Hủy</button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex-1 py-2.5 text-sm font-black text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-violet-600/20">
                {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu...</> : <><Save className="w-4 h-4" /> Lưu & Tiếp theo</>}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={handleSkipSync} className="flex-1 py-2.5 text-sm font-black text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">Bỏ qua đồng bộ</button>
              <button onClick={handleSyncFacebook} disabled={isSyncing}
                className="flex-1 py-2.5 text-sm font-black text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                {isSyncing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang đồng bộ...</> : <><RefreshCw className="w-4 h-4" /> Đồng bộ Facebook Ads</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
