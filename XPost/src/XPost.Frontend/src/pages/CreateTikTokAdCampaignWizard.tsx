import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  ChevronRight, ChevronLeft, Settings, Users, Image as ImageIcon,
  Smartphone, ArrowRight, Video, Heart, MessageCircle, Share2, Music
} from 'lucide-react';

interface AdAccount {
  id: string;
  advertiserId: string;
  accountName: string;
}

export default function CreateTikTokAdCampaignWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data lists
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);

  // Wizard State
  const [formData, setFormData] = useState({
    adAccountId: '',
    name: '',
    objectiveType: 'TRAFFIC',
    status: 'ACTIVE',
    budget: 200000,
    budgetMode: 'BUDGET_MODE_DAY',
    startTimeUtc: new Date().toISOString().substring(0, 16),
    endTimeUtc: '',

    // Ad Group
    adGroupName: '',
    targetingAgeMin: 18,
    targetingAgeMax: 50,
    targetingGenders: 'ALL',
    targetingLocations: 'VN',
    targetingInterests: [] as string[],
    placementType: 'PLACEMENT_MODE_DEFAULT',

    // Ad Creative
    adName: '',
    title: '',
    bodyText: '',
    mediaUrl: '',
    destinationUrl: 'https://',
    callToAction: 'LEARN_MORE'
  });

  const [interestInput, setInterestInput] = useState('');
  const [mediaMode, setMediaMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      const accRes = await api.get('/tiktokads/accounts');
      setAdAccounts(accRes.data);

      const queryAccId = searchParams.get('accountId');
      if (queryAccId) {
        setFormData(prev => ({ ...prev, adAccountId: queryAccId }));
      } else if (accRes.data.length > 0) {
        setFormData(prev => ({ ...prev, adAccountId: accRes.data[0].id }));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể tải thông tin liên kết tài khoản quảng cáo TikTok');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-name ad groups and ads when campaign name changes
      if (name === 'name') {
        updated.adGroupName = `${value} - AdGroup`;
        updated.adName = `${value} - Creative`;
      }

      return updated;
    });
  };

  const handleAddInterest = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && interestInput.trim()) {
      e.preventDefault();
      if (!formData.targetingInterests.includes(interestInput.trim())) {
        setFormData(prev => ({
          ...prev,
          targetingInterests: [...prev.targetingInterests, interestInput.trim()]
        }));
      }
      setInterestInput('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      targetingInterests: prev.targetingInterests.filter(x => x !== interest)
    }));
  };

  const doUploadFile = async (file: File) => {
    const uploadData = new FormData();
    uploadData.append('file', file);

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);

    try {
      toast.loading('Đang tải lên tài nguyên quảng cáo TikTok...', { id: 'upload' });
      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data.url.startsWith('/') ? res.data.url : `/${res.data.url}`;
      setFormData(prev => ({ ...prev, mediaUrl: fileUrl }));
      toast.success('Tải lên thành công!', { id: 'upload' });
    } catch (err: any) {
      setLocalPreview('');
      toast.error('Tải lên thất bại: ' + (err.response?.data?.message || err.message), { id: 'upload' });
    }
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await doUploadFile(files[0]);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await doUploadFile(file);
    }
  };

  const handleApplyImageUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập URL hợp lệ');
      return;
    }
    setFormData(prev => ({ ...prev, mediaUrl: trimmed }));
    toast.success('Đã áp dụng link thành công!');
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!formData.adAccountId) return 'Vui lòng chọn Tài khoản Quảng cáo TikTok';
      if (!formData.name.trim()) return 'Vui lòng nhập Tên chiến dịch';
      if (formData.budget < 50000) return 'Ngân sách tối thiểu là 50,000 VND';
    }
    if (step === 2) {
      if (!formData.adGroupName.trim()) return 'Vui lòng nhập Tên nhóm quảng cáo';
    }
    if (step === 3) {
      if (!formData.adName.trim()) return 'Vui lòng nhập Tên mẫu quảng cáo sáng tạo';
      if (!formData.title.trim()) return 'Vui lòng nhập Tiêu đề / Callout';
      if (!formData.bodyText.trim()) return 'Vui lòng nhập Nội dung mô tả (Caption)';
      if (!formData.mediaUrl) return 'Vui lòng tải lên tài nguyên hình ảnh / video quảng cáo';
      if (!formData.destinationUrl.trim() || formData.destinationUrl === 'https://') return 'Vui lòng nhập URL trang đích';
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(currentStep);
    if (error) {
      toast.error(error);
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    const error = validateStep(3);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading('Khởi tạo chiến dịch trên TikTok Business Marketing API...', { id: 'submit' });

      const payload = {
        ...formData,
        targetingInterests: formData.targetingInterests,
        startTimeUtc: new Date(formData.startTimeUtc).toISOString(),
        endTimeUtc: formData.endTimeUtc ? new Date(formData.endTimeUtc).toISOString() : null
      };

      await api.post(`/tiktokads/campaigns?adAccountId=${formData.adAccountId}`, payload);
      toast.success('Khởi tạo chiến dịch thành công trên TikTok Business Sandbox!', { id: 'submit', duration: 5000 });
      navigate('/tiktok-ads');
    } catch (err: any) {
      console.error(err);
      toast.error('Khởi tạo chiến dịch thất bại: ' + (err.response?.data?.message || err.message), { id: 'submit', duration: 6000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ctaLabels: Record<string, string> = {
    LEARN_MORE: 'Tìm hiểu thêm',
    SHOP_NOW: 'Mua ngay',
    SIGN_UP: 'Đăng ký',
    CONTACT_US: 'Liên hệ',
    DOWNLOAD: 'Tải về'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start bg-slate-950 text-slate-100 -m-6 p-6">
      {/* Form Wizard Layout (Left 7 Columns) */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header Steps Tracker */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-black text-slate-500">
            <span className={`${currentStep === 1 ? 'text-[#00f2fe]' : ''}`}>1. CHIẾN DỊCH</span>
            <ChevronRight className="w-4 h-4 text-slate-700" />
            <span className={`${currentStep === 2 ? 'text-[#00f2fe]' : ''}`}>2. NHÓM QUẢNG CÁO</span>
            <ChevronRight className="w-4 h-4 text-slate-700" />
            <span className={`${currentStep === 3 ? 'text-[#00f2fe]' : ''}`}>3. SÁNG TẠO QC</span>
          </div>
          <span className="text-xs font-black bg-slate-900 border border-slate-800 text-[#00f2fe] px-2.5 py-1 rounded">Bước {currentStep}/3</span>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Campaign */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#00f2fe]" />
                Thiết lập Chiến dịch chính (TikTok Campaign)
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tài khoản quảng cáo TikTok</label>
                <select
                  name="adAccountId"
                  value={formData.adAccountId}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100 cursor-pointer"
                >
                  <option value="">Chọn tài khoản quảng cáo...</option>
                  {adAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.accountName} ({acc.advertiserId})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tên chiến dịch</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ví dụ: Chiến Dịch Sen Đá Bán Chạy T6 - TikTok"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mục tiêu chiến dịch</label>
                  <select
                    name="objectiveType"
                    value={formData.objectiveType}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  >
                    <option value="TRAFFIC">Lưu lượng truy cập (Traffic)</option>
                    <option value="LEAD_GENERATION">Tìm kiếm khách hàng (Leads)</option>
                    <option value="CONVERSIONS">Thúc đẩy chuyển đổi (Conversions)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ngân sách ngày (VND)</label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ngày bắt đầu</label>
                  <input
                    type="datetime-local"
                    name="startTimeUtc"
                    value={formData.startTimeUtc}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ngày kết thúc (Tùy chọn)</label>
                  <input
                    type="datetime-local"
                    name="endTimeUtc"
                    value={formData.endTimeUtc}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Trạng thái khởi tạo</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  >
                    <option value="ACTIVE">Hoạt động ngay (Active)</option>
                    <option value="PAUSED">Tạo bản nháp (Paused)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Ad Group */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00f2fe]" />
                Nhóm quảng cáo & Đối tượng mục tiêu (Ad Group)
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tên nhóm quảng cáo</label>
                <input
                  type="text"
                  name="adGroupName"
                  placeholder="Ví dụ: Nhóm giới trẻ thích decor phòng học 18-30"
                  value={formData.adGroupName}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vị trí hiển thị (Placement)</label>
                  <select
                    name="placementType"
                    value={formData.placementType}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  >
                    <option value="PLACEMENT_MODE_DEFAULT">Toàn bộ mạng lưới TikTok (Khuyên dùng)</option>
                    <option value="PLACEMENT_TIKTOK">Chỉ hiển thị trên Bảng tin TikTok Video</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Khu vực mục tiêu</label>
                  <select
                    name="targetingLocations"
                    value={formData.targetingLocations}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  >
                    <option value="VN">Việt Nam (VN)</option>
                    <option value="SG">Singapore (SG)</option>
                    <option value="TH">Thái Lan (TH)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tuổi tối thiểu</label>
                  <input
                    type="number"
                    name="targetingAgeMin"
                    min="13"
                    max="65"
                    value={formData.targetingAgeMin}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tuổi tối đa</label>
                  <input
                    type="number"
                    name="targetingAgeMax"
                    min="13"
                    max="65"
                    value={formData.targetingAgeMax}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Giới tính</label>
                  <select
                    name="targetingGenders"
                    value={formData.targetingGenders}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                  >
                    <option value="ALL">Tất cả (ALL)</option>
                    <option value="MALE">Nam (MALE)</option>
                    <option value="FEMALE">Nữ (FEMALE)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Từ khóa sở thích liên quan</label>
                <input
                  type="text"
                  placeholder="Nhập sở thích (Ví dụ: Decor nhà, Cây cảnh) rồi nhấn Enter..."
                  value={interestInput}
                  onChange={e => setInterestInput(e.target.value)}
                  onKeyDown={handleAddInterest}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                />

                {formData.targetingInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.targetingInterests.map((interest, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#00f2fe]/10 text-[#00f2fe] rounded-lg border border-[#00f2fe]/20">
                        {interest}
                        <button type="button" onClick={() => handleRemoveInterest(interest)} className="hover:text-cyan-400 font-bold ml-1">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Creative */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#00f2fe]" />
                Thiết kế Sáng tạo Quảng cáo (TikTok Creative Ad)
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tên mẫu quảng cáo sáng tạo</label>
                <input
                  type="text"
                  name="adName"
                  placeholder="Ví dụ: Thiết kế mẫu quảng cáo sen đá đại diện"
                  value={formData.adName}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                />
              </div>

              {/* Upload Creative Mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tài nguyên hình ảnh / video</label>

                <div className="flex gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setMediaMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mediaMode === 'upload'
                        ? 'bg-slate-900 text-[#00f2fe] border border-slate-800 shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    📁 Tải lên từ máy
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode('url')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mediaMode === 'url'
                        ? 'bg-slate-900 text-[#00f2fe] border border-slate-800 shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    🔗 Dán URL liên kết
                  </button>
                </div>

                {mediaMode === 'upload' && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative cursor-pointer border-2 border-dashed rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-2 py-6 px-4 text-center select-none ${isDragOver
                        ? 'border-[#00f2fe] bg-[#00f2fe]/5 scale-[1.01]'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-900/50'
                      }`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl">
                      {isDragOver ? '🎯' : '🎬'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-350">
                        {isDragOver ? 'Thả tệp tin vào đây!' : 'Kéo & thả tệp tin hoặc nhấn để chọn'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">MP4, PNG, JPG, WEBP — Tối đa 20MB</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleUploadMedia}
                      className="hidden"
                    />
                  </div>
                )}

                {mediaMode === 'url' && (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Dán link ảnh hoặc video quảng cáo vào đây... (https://...)"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleApplyImageUrl()}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none font-mono text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleApplyImageUrl}
                      className="px-4 py-3 bg-gradient-to-r from-[#fe0979] to-[#00f2fe] text-white text-sm font-black rounded-xl transition-all shadow-md"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}

                {(formData.mediaUrl || localPreview) && (
                  <div className="flex items-center gap-3 mt-2 p-3.5 bg-slate-950 border border-slate-850 rounded-2xl">
                    <img
                      src={localPreview || (formData.mediaUrl.startsWith('/') ? `${(api.defaults.baseURL || '').replace('/api', '')}${formData.mediaUrl}` : formData.mediaUrl)}
                      alt="preview"
                      className="w-14 h-14 object-cover rounded-xl border border-slate-800 shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#00f2fe]">✅ Tài nguyên đã chọn</p>
                      <p className="text-[10px] text-slate-500 truncate font-mono mt-1">
                        {formData.mediaUrl || 'Đang tải lên...'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, mediaUrl: '' }));
                        setUrlInput('');
                        setLocalPreview('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-500 rounded-lg text-sm font-bold shrink-0 transition-all"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nút kêu gọi hành động (CTA)</label>
                <select
                  name="callToAction"
                  value={formData.callToAction}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100 cursor-pointer"
                >
                  <option value="LEARN_MORE">Tìm hiểu thêm (Learn More)</option>
                  <option value="SHOP_NOW">Mua ngay (Shop Now)</option>
                  <option value="SIGN_UP">Đăng ký (Sign Up)</option>
                  <option value="CONTACT_US">Liên hệ ngay (Contact Us)</option>
                  <option value="DOWNLOAD">Tải về (Download)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tiêu đề chính / Thương hiệu</label>
                <input
                  type="text"
                  name="title"
                  placeholder="Ví dụ: Cửa Hàng Sen Đá Mini"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nội dung văn bản (TikTok Video Caption)</label>
                <textarea
                  name="bodyText"
                  rows={3}
                  placeholder="Ví dụ: Siêu sale 50% trọn bộ sen đá tiểu cảnh mini xinh lung linh trang trí bàn học bàn làm việc. Chỉ duy nhất hôm nay, free ship toàn quốc! #senda #decor #sendamini"
                  value={formData.bodyText}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100 resize-none font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Liên kết trang đích (TikTok Landing Page Link)</label>
                <input
                  type="text"
                  name="destinationUrl"
                  placeholder="Ví dụ: https://www.cuahangsenda.vn/khuyenmai"
                  value={formData.destinationUrl}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-[#00f2fe] outline-none text-slate-100 font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Control Footer */}
        <div className="bg-slate-950 border-t border-slate-800 px-6 py-5 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Quay lại
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-black bg-gradient-to-r from-[#fe0979] to-[#00f2fe] text-white rounded-xl shadow-lg transition-all"
            >
              Tiếp tục <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-650 text-white rounded-xl shadow-lg disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Đang khởi tạo trên TikTok...
                </>
              ) : (
                <>
                  Kích hoạt Quảng cáo TikTok <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Interactive TikTok Live Smartphone Mockup Preview (Right 5 Columns) */}
      <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2 text-slate-400 px-1">
          <Smartphone className="w-5 h-5 text-slate-500" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Xem trước quảng cáo TikTok Feed (Live)</span>
        </div>

        {/* Premium iPhone mockup with dark/glass layout */}
        <div className="w-full max-w-[320px] mx-auto bg-black p-3.5 rounded-[48px] border-4 border-slate-800 shadow-2xl relative overflow-hidden aspect-[9/18]">
          {/* Dynamic Island Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-50 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
          </div>

          {/* Portrait Screen Area */}
          <div className="w-full h-full bg-[#121212] rounded-[38px] overflow-hidden flex flex-col font-sans text-xs select-none relative">

            {/* Top Navigation */}
            <div className="absolute top-6 left-0 right-0 p-3 flex justify-center items-center gap-4 text-white/60 font-bold text-[11px] z-30">
              <span className="hover:text-white cursor-pointer">Bạn bè</span>
              <span className="text-white border-b-2 border-white pb-0.5 relative">Dành cho bạn</span>
            </div>

            {/* Creative Media Area (fills screen) */}
            <div className="absolute inset-0 z-10 bg-slate-950 flex items-center justify-center">
              {(formData.mediaUrl || localPreview) ? (
                <img
                  src={localPreview || (formData.mediaUrl.startsWith('/') ? `${(api.defaults.baseURL || '').replace('/api', '')}${formData.mediaUrl}` : formData.mediaUrl)}
                  alt="TikTok Ad Media"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=800'; }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
                  <Video className="w-12 h-12 stroke-1 animate-pulse" />
                  <p className="text-[10px] font-semibold text-center max-w-[150px] px-2 text-slate-500">Dữ liệu mô phỏng quảng cáo sẽ hiển thị tại đây</p>
                </div>
              )}
            </div>

            {/* Bottom & Sidebar Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 z-20 pointer-events-none" />

            {/* TikTok Sidebar Action Buttons */}
            <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-35 text-white">
              {/* Profile image with plus icon */}
              <div className="relative mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#fe0979] to-[#00f2fe] p-0.5">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center font-bold text-white uppercase text-[10px]">
                    {formData.title ? formData.title.charAt(0) : 'T'}
                  </div>
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-[#fe0979] rounded-full flex items-center justify-center font-black text-white text-[10px] shadow border border-slate-950 cursor-pointer">+</div>
              </div>

              {/* Heart (Likes) */}
              <div className="flex flex-col items-center cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  <Heart className="w-5 h-5 fill-white text-white" />
                </div>
                <span className="text-[9px] font-bold mt-1 text-slate-200">124K</span>
              </div>

              {/* Comment */}
              <div className="flex flex-col items-center cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 fill-white text-white" />
                </div>
                <span className="text-[9px] font-bold mt-1 text-slate-200">2.1K</span>
              </div>

              {/* Share */}
              <div className="flex flex-col items-center cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  <Share2 className="w-5 h-5 fill-white text-white" />
                </div>
                <span className="text-[9px] font-bold mt-1 text-slate-200">890</span>
              </div>

              {/* Spinning Vinyl Record Disc */}
              <div className="w-9 h-9 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center animate-spin duration-3000 mt-2">
                <div className="w-4 h-4 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center">
                  <Music className="w-2.5 h-2.5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Bottom Caption and CTA Block */}
            <div className="absolute bottom-6 left-0 right-0 p-4 z-30 text-white flex flex-col gap-2.5">
              {/* Dynamic Bottom CTA Bar */}
              <div className="w-full bg-[#00f2fe] hover:bg-[#00d8e4] active:scale-[0.98] transition-all py-2.5 px-4 rounded-xl flex items-center justify-between text-slate-950 font-black cursor-pointer shadow-lg">
                <span className="text-[11px] uppercase tracking-wider">{ctaLabels[formData.callToAction] || 'Tìm hiểu thêm'}</span>
                <ChevronRight className="w-4 h-4 stroke-[3px]" />
              </div>

              {/* Caption details */}
              <div className="space-y-1.5 max-w-[80%]">
                <h4 className="font-black text-sm flex items-center gap-1.5">
                  @{formData.title || 'TikTokAdvertiser'}
                  <span className="bg-[#fe0979] text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider scale-90">Quảng cáo</span>
                </h4>
                <p className="text-[11px] leading-relaxed text-slate-100 line-clamp-3">
                  {formData.bodyText || 'Nội dung mô tả chiến dịch quảng cáo TikTok của bạn sẽ hiển thị tại đây... #Sponsored'}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1.5">
                  <Music className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate font-semibold">Nhạc nền tài trợ - XPost Audio</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
