import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/axios';

interface ChatbotConfig {
  id?: string;
  name: string;
  messengerPageId: string;
  messengerPageToken: string;
  knowledgeBase: string;
  iceBreakersJson?: string;
  isActive: boolean;
}

const maskToken = (token: string): string => {
  if (!token || token.length < 8) return token;
  return `${token.slice(0, 8)}${'*'.repeat(Math.min(token.length - 8, 20))}`;
};

export default function ChatbotConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [config, setConfig] = useState<ChatbotConfig>({
    name: '',
    messengerPageId: '',
    messengerPageToken: '',
    knowledgeBase: '',
    isActive: true,
  });

  const [questions, setQuestions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [showFullToken, setShowFullToken] = useState(false);
  const [tokenEditing, setTokenEditing] = useState(isNew);
  const [originalToken, setOriginalToken] = useState('');
  const [activeTab, setActiveTab] = useState<'connection' | 'knowledge' | 'icebreakers'>('connection');

  useEffect(() => {
    if (!isNew) {
      setIsLoading(true);
      api.get(`/chatbots/${id}`)
        .then(res => {
          const data = res.data;
          setConfig({
            ...data,
            messengerPageToken: '', // never display the real token from server
          });
          setOriginalToken(data.messengerPageTokenMasked ?? '');
          
          let parsedQuestions: string[] = [];
          if (data.iceBreakersJson) {
            try {
              parsedQuestions = JSON.parse(data.iceBreakersJson);
            } catch (e) {
              console.error('Lỗi parse iceBreakersJson:', e);
            }
          }
          setQuestions(parsedQuestions);
        })
        .catch(() => toast.error('Không thể tải cấu hình Chatbot.'))
        .finally(() => setIsLoading(false));
    }
  }, [id, isNew]);

  const handleSave = async () => {
    if (!config.name.trim()) return toast.error('Tên Chatbot không được để trống.');
    if (!config.messengerPageId.trim()) return toast.error('Messenger Page ID không được để trống.');
    if (isNew && !config.messengerPageToken.trim()) return toast.error('Page Access Token không được để trống.');

    const filteredQuestions = questions.map(q => q.trim()).filter(Boolean);
    for (const q of filteredQuestions) {
      if (q.length > 80) {
        return toast.error('Câu hỏi đề xuất không được vượt quá 80 ký tự.');
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        ...config,
        iceBreakersJson: JSON.stringify(filteredQuestions),
        // If the user didn't change the token, send empty string (backend will keep existing)
        messengerPageToken: tokenEditing ? config.messengerPageToken : '',
      };

      if (isNew) {
        await api.post('/chatbots', payload);
        toast.success('Tạo Chatbot thành công! 🎉');
      } else {
        await api.put(`/chatbots/${id}`, payload);
        toast.success('Cập nhật cấu hình thành công! ✅');
      }
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Lưu cấu hình thất bại.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M12 0C5.374 0 0 4.975 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.626 0 12-4.974 12-11.11C24 4.975 18.626 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isNew ? 'Thêm Chatbot Messenger' : 'Cấu hình Chatbot Messenger'}
              </h1>
              <p className="text-sm text-gray-500">Kết nối Facebook Page với AI trả lời khách hàng tự động</p>
            </div>
          </div>
        </div>

        {/* Active toggle */}
        {!isNew && (
          <button
            onClick={() => setConfig(c => ({ ...c, isActive: !c.isActive }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${config.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        )}
      </div>

      {/* Webhook info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Cấu hình Webhook trên Meta Developer</p>
          <p>URL Webhook: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">[API_BASE]/api/messenger/webhook</code></p>
          <p>Verify Token: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">XPostMessengerVerifyToken2026</code></p>
          <p>Subscribe to: <span className="font-medium">messages, messaging_postbacks</span></p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {(['connection', 'knowledge', 'icebreakers'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'connection' ? '🔗 Kết nối' : tab === 'knowledge' ? '🧠 Tri thức AI' : '💬 Câu hỏi đề xuất'}
          </button>
        ))}
      </div>

      {/* Connection Tab */}
      {activeTab === 'connection' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Tên Chatbot <span className="text-red-500">*</span>
            </label>
            <input
              id="chatbot-name"
              type="text"
              value={config.name}
              onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
              placeholder="Ví dụ: Chatbot Công Ty/Cửa hàng Thanh"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Page ID */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Facebook Page ID <span className="text-red-500">*</span>
            </label>
            <input
              id="chatbot-page-id"
              type="text"
              value={config.messengerPageId}
              onChange={e => setConfig(c => ({ ...c, messengerPageId: e.target.value }))}
              placeholder="Ví dụ: 1009017344882308"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
            />
            <p className="text-xs text-gray-400 mt-1">Tìm trong Meta Developer → Your App → App Settings → Basic → Page ID</p>
          </div>

          {/* Page Access Token */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Page Access Token <span className="text-red-500">*</span>
              </label>
              {!isNew && !tokenEditing && (
                <button
                  onClick={() => setTokenEditing(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Thay đổi Token
                </button>
              )}
            </div>

            {tokenEditing ? (
              <div className="relative">
                <input
                  id="chatbot-page-token"
                  type={showFullToken ? 'text' : 'password'}
                  value={config.messengerPageToken}
                  onChange={e => setConfig(c => ({ ...c, messengerPageToken: e.target.value }))}
                  placeholder="EAAxxxx... (Page Access Token từ Meta)"
                  className="w-full border border-amber-300 bg-amber-50 rounded-xl px-4 py-2.5 text-sm font-mono pr-12 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowFullToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showFullToken ? 'Ẩn token' : 'Hiện token'}
                >
                  {showFullToken ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                <code className="text-sm font-mono text-gray-600 flex-1">{maskToken(originalToken)}</code>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Đã cấu hình ✓</span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Lấy từ Meta Developer → Your App → Messenger → Settings → Access Tokens</p>
          </div>
        </div>
      )}

      {/* Knowledge Base Tab */}
      {activeTab === 'knowledge' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Kịch bản & Tri thức của Công ty (System Prompt)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Mô tả chi tiết về Doanh nghiệp của bạn: dịch vụ, bảng giá, giờ mở cửa, địa chỉ, khuyến mãi hiện tại... AI sẽ dựa vào đây để trả lời khách hàng chính xác nhất.
            </p>
            <textarea
              id="chatbot-knowledge-base"
              rows={14}
              value={config.knowledgeBase}
              onChange={e => setConfig(c => ({ ...c, knowledgeBase: e.target.value }))}
              placeholder={`Ví dụ:\nTên Công ty: Xuyên Việt Company\nĐịa chỉ: 123 Nguyễn Huệ, Q1, TP.HCM\nGiờ mở cửa: 8:00 - 21:00 (Thứ 2 - CN)\nSố điện thoại: 0901 234 567\n\nDịch vụ:\n- Tư vấn mạng doanh nghiệp\n- Bảo trì máy chủ server\n\nKhuyến mãi tháng này:\n- Giảm 20% phí lắp đặt mạng cho khách mới`}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none font-mono leading-relaxed"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-400">Càng chi tiết → AI trả lời càng chính xác</p>
              <p className="text-xs text-gray-400">{config.knowledgeBase?.length || 0} ký tự</p>
            </div>
          </div>
        </div>
      )}

      {/* Ice Breakers Tab */}
      {activeTab === 'icebreakers' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Câu hỏi đề xuất (FAQs / Ice Breakers)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Meta giới hạn cấu hình tối đa 4 câu hỏi. Những câu hỏi này xuất hiện trong màn hình chat của người dùng mới để họ bấm nhanh mà không cần gõ phím.
            </p>
          </div>

          <div className="space-y-3">
            {questions.map((question, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={question}
                  onChange={e => {
                    const updated = [...questions];
                    updated[index] = e.target.value;
                    setQuestions(updated);
                  }}
                  placeholder={`Câu hỏi gợi ý ${index + 1}`}
                  maxLength={80}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuestions(questions.filter((_, i) => i !== index));
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  title="Xóa câu hỏi"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}

            {questions.length === 0 && (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
                <p className="text-sm text-gray-500 mb-1">Chưa cấu hình câu hỏi gợi ý nào.</p>
                <p className="text-xs text-gray-400">Hãy nhấn nút bên dưới để thêm câu hỏi mới.</p>
              </div>
            )}

            {questions.length < 4 && (
              <button
                type="button"
                onClick={() => setQuestions([...questions, ''])}
                className="w-full py-2.5 flex items-center justify-center gap-2 border border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Thêm câu hỏi gợi ý ({questions.length}/4)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
        >
          ← Quay lại
        </button>
        <button
          id="chatbot-save-btn"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>💾 Lưu cấu hình</>
          )}
        </button>
      </div>
    </div>
  );
}
