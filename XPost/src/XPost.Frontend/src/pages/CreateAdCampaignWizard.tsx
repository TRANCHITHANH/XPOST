import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { 
  ChevronRight, ChevronLeft, Settings, Users, Image as ImageIcon, 
  Globe, Smartphone, ArrowRight
} from 'lucide-react';

interface AdAccount {
  id: string;
  adAccountId: string;
  accountName: string;
}

interface FacebookPage {
  id: string;
  accountName: string;
  accountIdentifier: string; // Meta Page ID
}

export default function CreateAdCampaignWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data lists
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<FacebookPage[]>([]);

  // Wizard State
  const [formData, setFormData] = useState({
    adAccountId: '',
    pageId: '',
    name: '',
    objective: 'OUTCOME_TRAFFIC',
    status: 'ACTIVE',
    budget: 100000,
    startTimeUtc: new Date().toISOString().substring(0, 16),
    endTimeUtc: '',
    
    // Ad Set
    adSetName: '',
    billingEvent: 'IMPRESSIONS',
    targetingAgeMin: 18,
    targetingAgeMax: 50,
    targetingGenders: 'ALL',
    targetingLocations: 'VN',
    targetingInterests: [] as string[],
    placements: 'AUTOMATIC',
    
    // Ad Creative
    adName: '',
    title: '',
    bodyText: '',
    mediaUrl: '',
    destinationUrl: 'https://',
    callToAction: 'LEARN_MORE'
  });

  const [interestInput, setInterestInput] = useState('');

  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      // 1. Fetch Ad Accounts connected to XPost
      const accRes = await api.get('/facebookads/accounts');
      setAdAccounts(accRes.data);
      
      const queryAccId = searchParams.get('accountId');
      if (queryAccId) {
        setFormData(prev => ({ ...prev, adAccountId: queryAccId }));
      } else if (accRes.data.length > 0) {
        setFormData(prev => ({ ...prev, adAccountId: accRes.data[0].id }));
      }

      // 2. Fetch linked Facebook Pages (SocialAccounts with platform = 1 (Facebook))
      const socialRes = await api.get('/socialaccounts');
      const fbPages = socialRes.data
        .filter((x: any) => x.platform === 1)
        .map((x: any) => ({
          id: x.id,
          accountName: x.accountName,
          accountIdentifier: x.accountIdentifier
        }));
      setPages(fbPages);
      if (fbPages.length > 0) {
        setFormData(prev => ({ ...prev, pageId: fbPages[0].accountIdentifier }));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể tải thông tin liên kết tài khoản');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-name ad sets and ads when campaign name changes
      if (name === 'name') {
        updated.adSetName = `${value} - Ad Set`;
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

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      toast.loading('Đang upload ảnh lên thư viện cục bộ...', { id: 'upload' });
      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Resolve path
      const baseUrl = api.defaults.baseURL || 'http://local-api.xpost.com:5243';
      const fileUrl = res.data.url.startsWith('http') ? res.data.url : `${baseUrl.replace('/api', '')}${res.data.url}`;
      
      setFormData(prev => ({ ...prev, mediaUrl: fileUrl }));
      toast.success('Upload ảnh thành công!', { id: 'upload' });
    } catch (err: any) {
      console.error(err);
      toast.error('Upload ảnh thất bại: ' + (err.response?.data?.message || err.message), { id: 'upload' });
    }
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!formData.adAccountId) return 'Vui lòng chọn Tài khoản Quảng cáo';
      if (!formData.pageId) return 'Vui lòng chọn Facebook Page đại diện';
      if (!formData.name.trim()) return 'Vui lòng nhập Tên chiến dịch';
      if (formData.budget < 25000) return 'Ngân sách ngày tối thiểu là 25,000 VND';
    }
    if (step === 2) {
      if (!formData.adSetName.trim()) return 'Vui lòng nhập Tên nhóm quảng cáo';
    }
    if (step === 3) {
      if (!formData.adName.trim()) return 'Vui lòng nhập Tên quảng cáo';
      if (!formData.title.trim()) return 'Vui lòng nhập Tiêu đề chính';
      if (!formData.bodyText.trim()) return 'Vui lòng nhập Văn bản quảng cáo';
      if (!formData.mediaUrl) return 'Vui lòng upload ảnh quảng cáo';
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
      toast.loading('Đang khởi tạo cấu trúc chiến dịch trên Meta Marketing API...', { id: 'submit' });
      
      const payload = {
        ...formData,
        targetingInterests: formData.targetingInterests,
        startTimeUtc: new Date(formData.startTimeUtc).toISOString(),
        endTimeUtc: formData.endTimeUtc ? new Date(formData.endTimeUtc).toISOString() : null
      };
      
      await api.post(`/facebookads/campaigns?adAccountId=${formData.adAccountId}`, payload);
      toast.success('Chúc mừng! Chiến dịch quảng cáo đã được kích hoạt thành công trên Meta Sandbox!', { id: 'submit', duration: 5000 });
      navigate('/facebook-ads');
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message;
      if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.response?.data?.errors) {
        const validationErrors = err.response.data.errors;
        errorMsg = Object.keys(validationErrors)
          .map(key => `${validationErrors[key].join(', ')}`)
          .join(' | ');
      }
      toast.error('Khởi tạo chiến dịch thất bại: ' + errorMsg, { id: 'submit', duration: 6000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Wizard Steps and Forms (Left 7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Step Indicators */}
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
            <span className={`${currentStep === 1 ? 'text-blue-600' : 'text-gray-400'}`}>1. CHIẾN DỊCH</span>
            <ChevronRight className="w-4 h-4" />
            <span className={`${currentStep === 2 ? 'text-blue-600' : 'text-gray-400'}`}>2. NHÓM QUẢNG CÁO</span>
            <ChevronRight className="w-4 h-4" />
            <span className={`${currentStep === 3 ? 'text-blue-600' : 'text-gray-400'}`}>3. NỘI DUNG SÁNG TẠO</span>
          </div>
          <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">Bước {currentStep}/3</span>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Campaign details */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-blue-600" />
                Thiết lập Chiến dịch chính (Campaign)
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tài khoản quảng cáo</label>
                  <select
                    name="adAccountId"
                    value={formData.adAccountId}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {adAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.accountName} ({acc.adAccountId})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Facebook Page đại diện</label>
                  <select
                    name="pageId"
                    value={formData.pageId}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {pages.map(p => (
                      <option key={p.id} value={p.accountIdentifier}>{p.accountName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tên chiến dịch</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ví dụ: Chiến dịch Quảng cáo Sen Đá Tháng 6"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mục tiêu chiến dịch (Objective)</label>
                  <select
                    name="objective"
                    value={formData.objective}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="OUTCOME_TRAFFIC">Thu hút lượt truy cập (Traffic)</option>
                    <option value="OUTCOME_LEADS">Tìm kiếm khách hàng tiềm năng (Leads)</option>
                    <option value="OUTCOME_SALES">Thúc đẩy doanh số (Sales/Conversions)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ngân sách ngày (VND)</label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ngày bắt đầu</label>
                  <input
                    type="datetime-local"
                    name="startTimeUtc"
                    value={formData.startTimeUtc}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái khởi tạo</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="ACTIVE">Hoạt động ngay khi tạo (Active)</option>
                    <option value="PAUSED">Tạm dừng bản nháp (Paused)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Ad Set Targeting */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                <Users className="w-5 h-5 text-blue-600" />
                Cấu hình Nhóm quảng cáo & Mục tiêu (Ad Set)
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tên nhóm quảng cáo</label>
                <input
                  type="text"
                  name="adSetName"
                  placeholder="Ví dụ: Nhóm khách hàng thích cây cảnh vườn 18-35"
                  value={formData.adSetName}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sự kiện tính phí (Billing Event)</label>
                  <select
                    name="billingEvent"
                    value={formData.billingEvent}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="IMPRESSIONS">Lượt hiển thị (CPM)</option>
                    <option value="LINK_CLICKS">Lượt click liên kết (CPC)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Địa điểm mục tiêu</label>
                  <select
                    name="targetingLocations"
                    value={formData.targetingLocations}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="VN">Toàn Việt Nam (VN)</option>
                    <option value="SG">Singapore (SG)</option>
                    <option value="US">Hoa Kỳ (US)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tuổi tối thiểu</label>
                  <input
                    type="number"
                    name="targetingAgeMin"
                    min="13"
                    max="65"
                    value={formData.targetingAgeMin}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tuổi tối đa</label>
                  <input
                    type="number"
                    name="targetingAgeMax"
                    min="13"
                    max="65"
                    value={formData.targetingAgeMax}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Giới tính</label>
                  <select
                    name="targetingGenders"
                    value={formData.targetingGenders}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="ALL">Tất cả (ALL)</option>
                    <option value="MALE">Nam (MALE)</option>
                    <option value="FEMALE">Nữ (FEMALE)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nhắm mục tiêu chi tiết (Sở thích/Hành vi)</label>
                <input
                  type="text"
                  placeholder="Nhập sở thích (Ví dụ: Cây cảnh, Làm vườn) rồi nhấn Enter..."
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={handleAddInterest}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                
                {formData.targetingInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.targetingInterests.map((interest, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg">
                        {interest}
                        <button type="button" onClick={() => handleRemoveInterest(interest)} className="hover:text-blue-800 font-bold">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Vị trí hiển thị (Placements)</label>
                <select
                  name="placements"
                  value={formData.placements}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="AUTOMATIC">Tự động đề xuất của Meta (Khuyên dùng)</option>
                  <option value="MANUAL">Chỉ trên Facebook Feed (Thử nghiệm)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Creative */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                Thiết kế Sáng tạo Quảng cáo (Creative Ad)
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tên mẫu quảng cáo sáng tạo</label>
                <input
                  type="text"
                  name="adName"
                  placeholder="Ví dụ: Thiết kế mẫu quảng cáo sen đá đại diện"
                  value={formData.adName}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hình ảnh quảng cáo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadMedia}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nút kêu gọi hành động (CTA)</label>
                  <select
                    name="callToAction"
                    value={formData.callToAction}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="LEARN_MORE">Tìm hiểu thêm (Learn More)</option>
                    <option value="SHOP_NOW">Mua ngay (Shop Now)</option>
                    <option value="SIGN_UP">Đăng ký (Sign Up)</option>
                    <option value="CONTACT_US">Liên hệ ngay (Contact Us)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tiêu đề chính (Title)</label>
                <input
                  type="text"
                  name="title"
                  placeholder="Ví dụ: Mua Sen Đá Mini Chỉ 15k - Ship Toàn Quốc"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Văn bản quảng cáo chính (Body Copy)</label>
                <textarea
                  name="bodyText"
                  rows={3}
                  placeholder="Ví dụ: Vườn sen đá Khí Nóng xin giới thiệu bộ sưu tập sen đá mini thích hợp để bàn làm việc, văn phòng..."
                  value={formData.bodyText}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">URL Trang đích chính (Destination Link)</label>
                <input
                  type="text"
                  name="destinationUrl"
                  placeholder="Ví dụ: https://www.cuahangsenda.com/khuyen-mai"
                  value={formData.destinationUrl}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Wizard Controls */}
        <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-4 py-2.5 text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all"
            >
              Tiếp tục
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-[0_4px_12px_rgba(22,163,74,0.2)] disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Đang xử lý trên Meta...
                </>
              ) : (
                <>
                  Kích hoạt Quảng cáo
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Premium Real-Time Smartphone Interactive Ad Mockup (Right 5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-500 px-1">
          <Smartphone className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-400">Xem trước quảng cáo di động (Live)</span>
        </div>

        {/* Smartphone Shell with HSL glassmorphism design */}
        <div className="w-full max-w-[340px] mx-auto bg-gray-950 p-3 rounded-[40px] border-4 border-gray-800 shadow-[0_25px_60px_rgba(0,0,0,0.15)] relative overflow-hidden aspect-[9/18]">
          {/* Camera Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-gray-950 rounded-full z-50 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-900 border border-gray-800"></span>
          </div>

          {/* Screen area */}
          <div className="w-full h-full bg-[#F0F2F5] rounded-[30px] overflow-hidden flex flex-col font-sans text-xs pt-4 select-none">
            {/* Simulation Header */}
            <div className="bg-white border-b border-gray-100 p-3 flex items-center justify-between shrink-0">
              <span className="font-bold text-[10px] text-gray-400 tracking-tight">FACEBOOK SPONSORED FEED</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            </div>

            {/* Post mock block */}
            <div className="bg-white p-3 flex flex-col gap-2 shrink-0">
              {/* Header profile row */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center">
                  {pages.find(x => x.accountIdentifier === formData.pageId)?.accountName?.charAt(0) || 'P'}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-[11px] leading-tight">
                    {pages.find(x => x.accountIdentifier === formData.pageId)?.accountName || 'Trang Đại Diện'}
                  </h4>
                  <div className="text-[9px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                    <span>Được tài trợ (Sponsored)</span>
                    <span>•</span>
                    <Globe className="w-2.5 h-2.5" />
                  </div>
                </div>
              </div>

              {/* Feed Body Text */}
              <p className="text-gray-800 text-[11px] leading-relaxed break-words whitespace-pre-wrap max-h-16 overflow-y-auto">
                {formData.bodyText || 'Văn bản mô tả của chiến dịch tiếp thị sẽ xuất hiện ở đây. Hãy nhập nội dung sáng tạo ở Bước 3!'}
              </p>
            </div>

            {/* Media Creative Display */}
            <div className="flex-1 bg-gray-100 relative overflow-hidden flex items-center justify-center min-h-[160px]">
              {formData.mediaUrl ? (
                <img 
                  src={formData.mediaUrl} 
                  alt="Creative" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-gray-400 text-center p-6">
                  <ImageIcon className="w-8 h-8 opacity-40 animate-bounce" />
                  <p className="text-[10px] leading-snug">Chưa có ảnh quảng cáo.<br />Hãy upload ở Bước 3.</p>
                </div>
              )}
            </div>

            {/* Link Description & Call to Action Block */}
            <div className="bg-white px-3 py-2.5 border-t border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-[9px] text-gray-400 uppercase tracking-tight truncate font-mono">
                  {formData.destinationUrl.replace('https://', '').replace('http://', '').split('/')[0] || 'trang-dich.com'}
                </span>
                <span className="font-bold text-gray-800 text-[11px] truncate leading-tight">
                  {formData.title || 'Tiêu đề chính bắt mắt của quảng cáo'}
                </span>
              </div>
              <button 
                type="button"
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-3 py-1.5 rounded text-[10px] transition-all whitespace-nowrap"
              >
                {formData.callToAction === 'LEARN_MORE' && 'Tìm hiểu thêm'}
                {formData.callToAction === 'SHOP_NOW' && 'Mua ngay'}
                {formData.callToAction === 'SIGN_UP' && 'Đăng ký'}
                {formData.callToAction === 'CONTACT_US' && 'Liên hệ ngay'}
              </button>
            </div>
            
            {/* Interaction Row Mock */}
            <div className="bg-white border-t border-gray-100 p-2 flex items-center justify-between text-gray-400 text-[10px] shrink-0 font-semibold px-4">
              <span>Thích</span>
              <span>Bình luận</span>
              <span>Chia sẻ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
