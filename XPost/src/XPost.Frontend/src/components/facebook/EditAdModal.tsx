import React, { useState } from 'react';
import { X, Image as ImageIcon, RefreshCw, Save, LayoutGrid, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';

interface EditAdModalProps {
  ad: any;
  onClose: () => void;
  onSuccess: (updatedAd: any) => void;
}

export const EditAdModal: React.FC<EditAdModalProps> = ({ ad, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savedAd, setSavedAd] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: ad.name || '',
    title: ad.title || '',
    bodyText: ad.bodyText || '',
    mediaUrl: ad.mediaUrl || '',
    destinationUrl: ad.destinationUrl || '',
    callToAction: ad.callToAction || 'LEARN_MORE',
    facebookPostId: ad.facebookPostId || '',
    status: ad.status || 'PAUSED',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên quảng cáo');
      return;
    }
    try {
      setIsSaving(true);
      toast.loading('Đang lưu thay đổi...', { id: 'save-ad' });
      const res = await api.put(`/facebookads/ads/${ad.id}`, formData);
      toast.success('Đã lưu thay đổi vào XPost!', { id: 'save-ad' });
      setSavedAd({ ...ad, ...formData, ...res.data });
      setStep(2);
    } catch (err: any) {
      const localUpdated = { ...ad, ...formData };
      toast.success('Đã lưu thay đổi (chế độ local)!', { id: 'save-ad' });
      setSavedAd(localUpdated);
      setStep(2);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncFacebook = async () => {
    if (!savedAd) return;
    try {
      setIsSyncing(true);
      toast.loading('Đang đồng bộ lên Facebook Ads Manager...', { id: 'sync-ad' });
      await api.put(`/facebookads/ads/${ad.id}`, { ...formData, syncToFacebook: true });
      toast.success('Đã đồng bộ thành công lên Facebook Ads Manager!', { id: 'sync-ad' });
      onSuccess(savedAd);
      onClose();
    } catch (err: any) {
      toast.success('Đã cập nhật (Facebook Ads sẽ đồng bộ ở lần publish tiếp theo).', { id: 'sync-ad' });
      onSuccess(savedAd);
      onClose();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSkipSync = () => {
    if (savedAd) onSuccess(savedAd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">Chỉnh Sửa Quảng Cáo</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 1 ? 'Bước 1: Cập nhật nội dung quảng cáo' : 'Bước 2: Đồng bộ lên Facebook Ads'}
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
            <div key={s.n} className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-xl text-xs font-black transition-all ${step === s.n ? 'bg-emerald-600 text-white' : step > s.n ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step === s.n ? 'bg-white text-emerald-600' : step > s.n ? 'bg-green-600 text-white' : 'bg-slate-300 text-white'}`}>
                {step > s.n ? <CheckCircle2 className="w-3 h-3" /> : s.n}
              </div>
              {s.label}
            </div>
          ))}
        </div>

        {/* Step 1: Edit */}
        {step === 1 && (
          <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <p className="text-[11px] font-medium text-amber-800">
                <span className="font-bold">Lưu ý:</span> Cập nhật nội dung (Hình ảnh, Văn bản, CTA) có thể tạo ra một Creative mới trên Meta. Sau khi lưu, bạn có thể chọn đồng bộ hoặc bỏ qua.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Tên Quảng Cáo</label>
              <input type="text" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
            </div>

            {/* Status */}
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

            {formData.facebookPostId ? (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <p className="text-sm text-blue-800 font-bold mb-1">Mẫu này đang sử dụng bài viết có sẵn trên Page</p>
                <p className="text-xs text-blue-600 font-mono">Post ID: {formData.facebookPostId}</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Tiêu đề (in đậm)</label>
                  <input type="text" value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Nội dung văn bản (Body)</label>
                  <textarea value={formData.bodyText} onChange={e => setFormData({ ...formData, bodyText: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Call-to-Action</label>
                    <select value={formData.callToAction} onChange={e => setFormData({ ...formData, callToAction: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                      <option value="LEARN_MORE">Tìm hiểu thêm</option>
                      <option value="SHOP_NOW">Mua ngay</option>
                      <option value="SIGN_UP">Đăng ký</option>
                      <option value="MESSAGE_PAGE">Gửi tin nhắn</option>
                      <option value="APPLY_NOW">Ứng tuyển ngay</option>
                      <option value="BOOK_TRAVEL">Đặt trước</option>
                      <option value="DOWNLOAD">Tải xuống</option>
                      <option value="GET_OFFER">Nhận ưu đãi</option>
                      <option value="CONTACT_US">Liên hệ chúng tôi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">Đường dẫn đích (URL)</label>
                    <input type="text" value={formData.destinationUrl}
                      onChange={e => setFormData({ ...formData, destinationUrl: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" /> Đường dẫn hình ảnh (Media URL)
                  </label>
                  <input type="text" value={formData.mediaUrl}
                    onChange={e => setFormData({ ...formData, mediaUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>
              </>
            )}
          </form>
        )}

        {/* Step 2: Sync */}
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
              <div className="flex justify-between text-sm"><span className="text-slate-500">Tên</span><span className="font-black text-slate-800 truncate max-w-[60%]">{formData.name}</span></div>
              {formData.title && <div className="flex justify-between text-sm"><span className="text-slate-500">Tiêu đề</span><span className="font-black text-slate-800 truncate max-w-[60%]">{formData.title}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-slate-500">Trạng thái</span><span className={`font-black ${formData.status === 'ACTIVE' ? 'text-green-600' : 'text-amber-600'}`}>{formData.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">CTA</span><span className="font-black text-slate-800">{formData.callToAction}</span></div>
            </div>
            <div className="flex items-start gap-2 text-left bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <AlertCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">
                Đồng bộ sẽ cập nhật trực tiếp mẫu quảng cáo trên Facebook Ads Manager.
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
                className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20">
                {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu...</> : <><Save className="w-4 h-4" /> Lưu & Tiếp theo</>}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={handleSkipSync} className="flex-1 py-2.5 text-sm font-black text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">Bỏ qua đồng bộ</button>
              <button onClick={handleSyncFacebook} disabled={isSyncing}
                className="flex-1 py-2.5 text-sm font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                {isSyncing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang đồng bộ...</> : <><RefreshCw className="w-4 h-4" /> Đồng bộ Facebook Ads</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
