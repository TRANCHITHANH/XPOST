import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../lib/axios';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import toast from 'react-hot-toast';
import { ArrowLeft, Image as ImageIcon, MessageSquare, Send, Plus, CheckCircle, Paperclip, Trash2, Loader2, Upload, GripVertical, ShoppingBag, Info } from 'lucide-react';

interface Post {
    id: string;
    caption: string;
    media_url: string;
    media_type: string;
    timestamp: string;
}

interface ChatbotConfig {
    id?: string;
    name: string;
    messengerPageId: string;
    messengerPageToken: string;
    knowledgeBase: string;
    iceBreakersJson: string;
    priceListUrl: string;
    maintenanceUrl: string;
    maxTokens: number;
    usedTokens: number;
    isActive: boolean;
}

interface Comment {
    id: string;
    text: string;
    originalText?: string;
    username: string;
    timestamp: string;
    isSensitive: boolean;
    sensitiveType?: string;
    hidden?: boolean;
    from?: { id: string, username: string, name?: string };
    replies?: { data: Comment[] };
}

interface Conversation {
    id: string;
    updated_time: string;
    participants: { data: { id: string, username?: string, name?: string }[] };
    messages?: { data: { from?: { id: string, username?: string, name?: string } }[] };
    // Zalo fields
    zaloUserId?: string;
    userDisplayName?: string;
    userAvatarUrl?: string;
    lastMessagePreview?: string;
    lastMessageAt?: string;
    isRead?: boolean;
    messageCount?: number;
}

interface Message {
    id: string;
    message: string;
    originalMessage?: string;
    isSensitive: boolean;
    sensitiveType?: string;
    created_time: string;
    from: { id: string, username?: string, name?: string };
    attachments?: { data: any[] };
}

const getUnreadCount = (conv: Conversation, pageId: string | null) => {
    // Zalo conversations have isRead flag
    if (conv.isRead !== undefined) return conv.isRead ? 0 : 1;
    if (!pageId || !conv.messages?.data) return 0;
    let count = 0;
    for (const msg of conv.messages.data) {
        if (msg.from?.id !== pageId) { count++; } else { break; }
    }
    return count;
};

interface ChatbotQuestion {
    question: string;
    replyText?: string;
    buttonName?: string;
    buttonUrl?: string;
}

interface ChatbotButton {
    icon: string;
    title: string;
    payload: string;
    type?: string; // 'postback' | 'phone_number' | 'web_url'
}

export default function PageManagement() {
    const { accountId } = useParams<{ accountId: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'posts' | 'conversations' | 'chatbot' | 'orders' | 'complaints'>('posts');
    const [allOrders, setAllOrders] = useState<any[]>([]);
    const [allComplaints, setAllComplaints] = useState<any[]>([]);
    const [isLoadingAllComplaints, setIsLoadingAllComplaints] = useState(false);
    const [conversationComplaints, setConversationComplaints] = useState<any[]>([]);
    const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);
    const [isLoadingAllOrders, setIsLoadingAllOrders] = useState(false);
    const [posts, setPosts] = useState<Post[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [pageId, setPageId] = useState<string | null>(null);

    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);

    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [lastWebhookSignal, setLastWebhookSignal] = useState<number>(0);
    const [accountInfo, setAccountInfo] = useState<any>(null);
    const isZalo = accountInfo?.platform === 9;
    const isTikTok = accountInfo?.platform === 5;
    const apiPrefix = isZalo ? '/zalo-pages' : isTikTok ? '/tiktok-pages' : '/pages';

    // Chatbot configuration states
    const [chatbotConfig, setChatbotConfig] = useState<ChatbotConfig | null>(null);
    const [chatbotQuestions, setChatbotQuestions] = useState<ChatbotQuestion[]>([]);
    const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
    const [chatbotButtons, setChatbotButtons] = useState<ChatbotButton[]>([]);
    const [editingButtonIndex, setEditingButtonIndex] = useState<number | null>(null);
    const [isLoadingChatbot, setIsLoadingChatbot] = useState(false);
    const [isSavingChatbot, setIsSavingChatbot] = useState(false);

    const [conversationOrders, setConversationOrders] = useState<any[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [crmTab, setCrmTab] = useState<'orders' | 'complaints'>('orders');

    const parseSubButtons = (payloadStr: string): { title: string; url: string }[] => {
        if (!payloadStr) return [{ title: '', url: '' }];
        try {
            const parsed = JSON.parse(payloadStr);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (e) {
            // Fallback if it was a single plain text URL
            return [{ title: 'Xem chi tiết', url: payloadStr }];
        }
        return [{ title: '', url: '' }];
    };

    const handleSubButtonChange = (btnIndex: number, subIndex: number, field: 'title' | 'url', value: string) => {
        const updated = [...chatbotButtons];
        const subButtons = parseSubButtons(updated[btnIndex].payload);
        subButtons[subIndex][field] = value;
        updated[btnIndex].payload = JSON.stringify(subButtons);
        setChatbotButtons(updated);
    };

    const handleAddSubButton = (btnIndex: number) => {
        const updated = [...chatbotButtons];
        const subButtons = parseSubButtons(updated[btnIndex].payload);
        if (subButtons.length >= 3) return;
        subButtons.push({ title: '', url: '' });
        updated[btnIndex].payload = JSON.stringify(subButtons);
        setChatbotButtons(updated);
    };

    const handleDeleteSubButton = (btnIndex: number, subIndex: number) => {
        const updated = [...chatbotButtons];
        let subButtons = parseSubButtons(updated[btnIndex].payload);
        subButtons = subButtons.filter((_, i) => i !== subIndex);
        if (subButtons.length === 0) {
            subButtons = [{ title: '', url: '' }];
        }
        updated[btnIndex].payload = JSON.stringify(subButtons);
        setChatbotButtons(updated);
    };

    const parseOrderFormPayload = (payloadStr: string): { name: string; options: string }[] => {
        if (!payloadStr) return [{ name: 'Chọn dịch vụ / thiết bị', options: '' }];
        try {
            const parsed = JSON.parse(payloadStr);
            if (Array.isArray(parsed)) {
                return parsed.map((item: any) => ({
                    name: item.label || item.name || '',
                    options: Array.isArray(item.options) ? item.options.join(', ') : (item.options || '')
                }));
            }
        } catch (e) {
            // Fallback for comma-separated options
            return [{ name: 'Chọn dịch vụ / thiết bị', options: payloadStr }];
        }
        return [{ name: 'Chọn dịch vụ / thiết bị', options: '' }];
    };

    const handleOrderFieldChange = (btnIndex: number, fieldIndex: number, key: 'name' | 'options', value: string) => {
        const updated = [...chatbotButtons];
        const fields = parseOrderFormPayload(updated[btnIndex].payload);
        fields[fieldIndex][key] = value;
        
        updated[btnIndex].payload = JSON.stringify(fields.map(f => ({
            label: f.name.trim(),
            options: f.options.split(',').map(o => o.trim()).filter(Boolean)
        })));
        setChatbotButtons(updated);
    };

    const handleAddOrderField = (btnIndex: number) => {
        const updated = [...chatbotButtons];
        const fields = parseOrderFormPayload(updated[btnIndex].payload);
        fields.push({ name: '', options: '' });
        
        updated[btnIndex].payload = JSON.stringify(fields.map(f => ({
            label: f.name.trim(),
            options: f.options.split(',').map(o => o.trim()).filter(Boolean)
        })));
        setChatbotButtons(updated);
    };

    const handleDeleteOrderField = (btnIndex: number, fieldIndex: number) => {
        const updated = [...chatbotButtons];
        let fields = parseOrderFormPayload(updated[btnIndex].payload);
        fields = fields.filter((_, i) => i !== fieldIndex);
        if (fields.length === 0) {
            fields = [{ name: 'Chọn dịch vụ / thiết bị', options: '' }];
        }
        
        updated[btnIndex].payload = JSON.stringify(fields.map(f => ({
            label: f.name.trim(),
            options: f.options.split(',').map(o => o.trim()).filter(Boolean)
        })));
        setChatbotButtons(updated);
    };

    const parseOrdersFromMessages = (msgs: Message[]) => {
        const orders: any[] = [];
        msgs.forEach(m => {
            if (!m.message) return;
            
            // Format 1: Database log format
            if (m.message.includes('[Đặt hàng thành công]')) {
                const lines = m.message.split('\n');
                let item = '';
                let name = '';
                let phone = '';
                let address = '';
                lines.forEach(line => {
                    if (line.includes('- Dịch vụ/Thiết bị:')) item = line.replace('- Dịch vụ/Thiết bị:', '').trim();
                    else if (line.includes('- Họ tên:')) name = line.replace('- Họ tên:', '').trim();
                    else if (line.includes('- SĐT:')) phone = line.replace('- SĐT:', '').trim();
                    else if (line.includes('- Địa chỉ:')) address = line.replace('- Địa chỉ:', '').trim();
                });
                orders.push({
                    id: m.id,
                    timestamp: m.created_time || (m as any).timestamp || (m as any).sentAtUtc || '',
                    item,
                    name,
                    phone,
                    address
                });
            }
            
            // Format 2: Bot confirmation template reply
            if (m.message.includes('em đã nhận được yêu cầu đặt hàng') && m.message.includes('Họ và tên:')) {
                const lines = m.message.split('\n');
                let item = '';
                let name = '';
                let phone = '';
                let address = '';
                lines.forEach(line => {
                    if (line.includes('- Họ và tên:')) name = line.replace('- Họ và tên:', '').trim();
                    else if (line.includes('- Số điện thoại:')) phone = line.replace('- Số điện thoại:', '').trim();
                    else if (line.includes('- Địa chỉ:')) address = line.replace('- Địa chỉ:', '').trim();
                    else if (line.includes('- Dịch vụ/Thiết bị:')) item = line.replace('- Dịch vụ/Thiết bị:', '').trim();
                });
                orders.push({
                    id: m.id,
                    timestamp: m.created_time || (m as any).timestamp || (m as any).sentAtUtc || '',
                    item,
                    name,
                    phone,
                    address
                });
            }
        });
        return orders;
    };

    const getSelectedConversationPsid = useCallback((conv: Conversation) => {
        if (!conv) return '';
        if (conv.zaloUserId) return conv.zaloUserId;
        if ((conv as any).tikTokUserId) return (conv as any).tikTokUserId;
        return conv.participants?.data?.find(p => p.id !== pageId)?.id || conv.participants?.data?.[0]?.id || '';
    }, [pageId]);

    const fetchConversationOrders = useCallback(async (psidStr: string) => {
        if (!accountId) return;
        setIsLoadingOrders(true);
        try {
            const res = await api.get(`${apiPrefix}/${accountId}/conversations/${psidStr}/orders`);
            if (res.data) {
                const parsed = res.data.map((m: any) => ({
                    id: m.id,
                    timestamp: m.sentAtUtc,
                    item: m.selectedItem || '',
                    name: m.fullName || '',
                    phone: m.phoneNumber || '',
                    email: m.email || '',
                    address: m.address || '',
                    status: m.status || 'Pending'
                }));
                setConversationOrders(parsed);
            }
        } catch (err) {
            console.error('Error fetching conversation orders:', err);
        } finally {
            setIsLoadingOrders(false);
        }
    }, [accountId, apiPrefix]);

    const fetchAllOrders = useCallback(async () => {
        if (!accountId) return;
        setIsLoadingAllOrders(true);
        try {
            const res = await api.get(`${apiPrefix}/${accountId}/orders`);
            if (res.data) {
                const parsed = res.data.map((m: any) => ({
                    id: m.id,
                    timestamp: m.sentAtUtc,
                    item: m.selectedItem || '',
                    name: m.fullName || '',
                    phone: m.phoneNumber || '',
                    email: m.email || '',
                    address: m.address || '',
                    status: m.status || 'Pending'
                }));
                setAllOrders(parsed);
            }
        } catch (err) {
            console.error('Error fetching all page orders:', err);
        } finally {
            setIsLoadingAllOrders(false);
        }
    }, [accountId, apiPrefix]);

    const handleDeleteOrder = async (orderId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa đơn hàng này không? Hành động này sẽ xóa vĩnh viễn đơn hàng khỏi cơ sở dữ liệu.")) {
            return;
        }

        try {
            const toastId = toast.loading('Đang xóa đơn đặt hàng...');
            await api.delete(`${apiPrefix}/${accountId}/orders/${orderId}`);
            toast.success('Xóa đơn hàng thành công!', { id: toastId });
            fetchAllOrders();
            if (selectedConversation) {
                const psid = getSelectedConversationPsid(selectedConversation);
                if (psid) fetchConversationOrders(psid);
            }
        } catch (err: any) {
            console.error('Failed to delete order:', err);
            const errorMsg = err.response?.data?.message || 'Xóa đơn hàng thất bại.';
            toast.error(errorMsg);
        }
    };

    const handleToggleOrderStatus = async (orderId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Confirmed' ? 'Pending' : 'Confirmed';
        const toastId = toast.loading(newStatus === 'Confirmed' ? 'Đang xác nhận đơn hàng...' : 'Đang cập nhật trạng thái...');
        try {
            await api.post(`${apiPrefix}/${accountId}/orders/${orderId}/status`, { status: newStatus });
            // Optimistically update in place
            setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            setConversationOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            if (newStatus === 'Confirmed') {
                toast.success('Xác nhận thành công! Đã gửi tin nhắn xác nhận về Messenger khách hàng. 🎉', { id: toastId });
            } else {
                toast.success('Đã cập nhật trạng thái về Đang xử lý.', { id: toastId });
            }
        } catch (err: any) {
            console.error('Failed to update order status:', err);
            toast.error(err.response?.data?.message || 'Cập nhật trạng thái thất bại.', { id: toastId });
        }
    };

    const fetchConversationComplaints = useCallback(async (psidStr: string) => {
        if (!accountId) return;
        setIsLoadingComplaints(true);
        try {
            const res = await api.get(`${apiPrefix}/${accountId}/conversations/${psidStr}/complaints`);
            if (res.data) {
                const parsed = res.data.map((m: any) => ({
                    id: m.id,
                    timestamp: m.sentAtUtc,
                    name: m.fullName || '',
                    phone: m.phoneNumber || '',
                    email: m.email || '',
                    content: m.content || '',
                    status: m.status || 'Pending'
                }));
                setConversationComplaints(parsed);
            }
        } catch (err) {
            console.error('Error fetching conversation complaints:', err);
        } finally {
            setIsLoadingComplaints(false);
        }
    }, [accountId, apiPrefix]);

    const fetchAllComplaints = useCallback(async () => {
        if (!accountId) return;
        setIsLoadingAllComplaints(true);
        try {
            const res = await api.get(`${apiPrefix}/${accountId}/complaints`);
            if (res.data) {
                const parsed = res.data.map((m: any) => ({
                    id: m.id,
                    timestamp: m.sentAtUtc,
                    name: m.fullName || '',
                    phone: m.phoneNumber || '',
                    email: m.email || '',
                    content: m.content || '',
                    status: m.status || 'Pending'
                }));
                setAllComplaints(parsed);
            }
        } catch (err) {
            console.error('Error fetching all page complaints:', err);
        } finally {
            setIsLoadingAllComplaints(false);
        }
    }, [accountId, apiPrefix]);

    const handleDeleteComplaint = async (complaintId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa khiếu nại này không? Hành động này sẽ xóa vĩnh viễn khiếu nại khỏi cơ sở dữ liệu.")) {
            return;
        }

        try {
            const toastId = toast.loading('Đang xóa khiếu nại...');
            await api.delete(`${apiPrefix}/${accountId}/complaints/${complaintId}`);
            toast.success('Xóa khiếu nại thành công!', { id: toastId });
            fetchAllComplaints();
            if (selectedConversation) {
                const psid = getSelectedConversationPsid(selectedConversation);
                if (psid) fetchConversationComplaints(psid);
            }
        } catch (err: any) {
            console.error('Failed to delete complaint:', err);
            const errorMsg = err.response?.data?.message || 'Xóa khiếu nại thất bại.';
            toast.error(errorMsg);
        }
    };

    const handleToggleComplaintStatus = async (complaintId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Processed' ? 'Pending' : 'Processed';
        const toastId = toast.loading(newStatus === 'Processed' ? 'Đang xác nhận đã xử lý...' : 'Đang cập nhật trạng thái...');
        try {
            await api.post(`${apiPrefix}/${accountId}/complaints/${complaintId}/status`, { status: newStatus });
            // Optimistically update in place
            setAllComplaints(prev => prev.map(o => o.id === complaintId ? { ...o, status: newStatus } : o));
            setConversationComplaints(prev => prev.map(o => o.id === complaintId ? { ...o, status: newStatus } : o));
            if (newStatus === 'Processed') {
                toast.success('Xác nhận đã xử lý! Đã gửi tin nhắn thông báo về Messenger khách hàng. 🎉', { id: toastId });
            } else {
                toast.success('Đã cập nhật trạng thái về Đang chờ xử lý.', { id: toastId });
            }
        } catch (err: any) {
            console.error('Failed to update complaint status:', err);
            toast.error(err.response?.data?.message || 'Cập nhật trạng thái thất bại.', { id: toastId });
        }
    };

    // Setup SignalR
    useEffect(() => {
        if (!accountInfo) return;
        const isZalo = accountInfo.platform === 9;
        const isFacebook = accountInfo.platform === 1;
        const isTikTok = accountInfo.platform === 5;

        let hubPath = '/hubs/instagram';
        let eventName = 'ReceiveInstagramEvent';
        let friendlyName = 'Instagram';

        if (isZalo) {
            hubPath = '/hubs/zalo';
            eventName = 'ReceiveZaloEvent';
            friendlyName = 'Zalo';
        } else if (isFacebook) {
            hubPath = '/hubs/messenger';
            eventName = 'ReceiveMessengerEvent';
            friendlyName = 'Messenger';
        } else if (isTikTok) {
            hubPath = '/hubs/tiktok';
            eventName = 'ReceiveTikTokEvent';
            friendlyName = 'TikTok';
        }

        const connection = new HubConnectionBuilder()
            .withUrl(`${API_BASE_URL}${hubPath}`)
            .configureLogging(LogLevel.Warning)
            .withAutomaticReconnect()
            .build();

        connection.on(eventName, (payload) => {
            console.log(`${friendlyName} Webhook Event:`, payload);
            setLastWebhookSignal(Date.now());
        });

        connection.start()
            .then(() => console.log(`Connected to ${friendlyName} SignalR Hub!`))
            .catch(err => console.error('SignalR Connection Error:', err));

        return () => { connection.stop(); };
    }, [accountInfo]);

    // Respond to SignalR events by refreshing current view
    useEffect(() => {
        if (lastWebhookSignal === 0) return;
        if (activeTab === 'posts') {
            fetchPosts();
            if (selectedPost) fetchComments(selectedPost.id);
        } else if (activeTab === 'orders') {
            fetchAllOrders();
        } else if (activeTab === 'complaints') {
            fetchAllComplaints();
        } else {
            fetchConversations();
            if (selectedConversation) {
                fetchMessages(selectedConversation.id);
                const psid = getSelectedConversationPsid(selectedConversation);
                if (psid) {
                    fetchConversationOrders(psid);
                    fetchConversationComplaints(psid);
                }
            }
        }
    }, [lastWebhookSignal, selectedConversation, getSelectedConversationPsid, fetchConversationOrders, fetchConversationComplaints, fetchAllOrders, fetchAllComplaints, activeTab]);

    useEffect(() => {
        if (activeTab === 'orders') {
            fetchAllOrders();
        } else if (activeTab === 'complaints') {
            fetchAllComplaints();
        }
    }, [activeTab, fetchAllOrders, fetchAllComplaints]);

    useEffect(() => {
        if (accountId) {
            api.get(`/socialaccounts/${accountId}`).then(res => setAccountInfo(res.data)).catch(console.error);
        }
    }, [accountId]);

    const fetchChatbotConfig = useCallback(async () => {
        if (!accountInfo || accountInfo.platform !== 1) return;
        setIsLoadingChatbot(true);
        try {
            const res = await api.get('/chatbots');
            const pageId = accountInfo.accountIdentifier;
            const existing = res.data.find((c: any) => c.messengerPageId === pageId);

            if (existing) {
                const detailRes = await api.get(`/chatbots/${existing.id}`);
                setChatbotConfig(detailRes.data);

                let qList: ChatbotQuestion[] = [];
                if (detailRes.data.iceBreakersJson) {
                    try {
                        const parsed = JSON.parse(detailRes.data.iceBreakersJson);
                        qList = parsed.map((item: any) => {
                            if (typeof item === 'string') {
                                return { question: item };
                            }
                            return item as ChatbotQuestion;
                        });
                    } catch (e) {
                        console.error('Error parsing ice breakers:', e);
                    }
                }
                setChatbotQuestions(qList);

                let btnList: ChatbotButton[] = [];
                if (detailRes.data.knowledgeBase) {
                    try {
                        const parsed = JSON.parse(detailRes.data.knowledgeBase);
                        if (Array.isArray(parsed)) {
                            btnList = parsed;
                        }
                    } catch (e) {
                        console.error('Error parsing quick buttons:', e);
                    }
                }
                setChatbotButtons(btnList);
            } else {
                setChatbotConfig({
                    name: `Chatbot ${accountInfo.accountName}`,
                    messengerPageId: pageId,
                    messengerPageToken: accountInfo.accessToken || '',
                    knowledgeBase: '',
                    iceBreakersJson: '',
                    priceListUrl: '',
                    maintenanceUrl: '',
                    maxTokens: 100000,
                    usedTokens: 0,
                    isActive: true
                });
                setChatbotQuestions([]);
                setChatbotButtons([]);
            }
        } catch (error) {
            console.error('Error fetching chatbot config:', error);
            toast.error('Không thể tải cấu hình Chatbot.');
        } finally {
            setIsLoadingChatbot(false);
        }
    }, [accountInfo]);

    useEffect(() => {
        if (activeTab === 'chatbot') {
            fetchChatbotConfig();
        }
    }, [activeTab, fetchChatbotConfig]);

    const handleSaveChatbot = async () => {
        if (!chatbotConfig) return;

        // Default name if missing since we removed the input field
        const botName = chatbotConfig.name?.trim() || 'Chatbot Xuyên Việt';

        const filteredQuestions = chatbotQuestions.filter(q => q.question.trim().length > 0);
        for (const q of filteredQuestions) {
            if (q.question.length > 80) {
                return toast.error('Câu hỏi gợi ý không được vượt quá 80 ký tự.');
            }
        }

        const filteredButtons = chatbotButtons.filter(b => b.title.trim().length > 0);
        for (const b of filteredButtons) {
            if (b.title.length > 20) {
                return toast.error('Tiêu đề nút không được vượt quá 20 ký tự.');
            }
            if (b.type === 'web_url' && b.payload) {
                let isJsonArray = false;
                try {
                    const parsed = JSON.parse(b.payload);
                    if (Array.isArray(parsed)) {
                        isJsonArray = true;
                        for (const sub of parsed) {
                            if (!sub.title?.trim()) {
                                return toast.error(`Nút "${b.title}" chứa mục con không có tên nút.`);
                            }
                            if (sub.title.length > 20) {
                                return toast.error(`Tên nút con "${sub.title}" không được vượt quá 20 ký tự.`);
                            }
                            if (!sub.url || !sub.url.startsWith('https://')) {
                                return toast.error(`Nút con "${sub.title}" phải sử dụng liên kết bảo mật bắt đầu bằng https://.`);
                            }
                        }
                    }
                } catch (e) {
                    // Not JSON
                }

                if (!isJsonArray) {
                    const urls = b.payload.split(',').map(u => u.trim()).filter(Boolean);
                    for (const url of urls) {
                        if (!url.startsWith('https://')) {
                            return toast.error(`Nút "${b.title}" chứa liên kết không hợp lệ. Tất cả các liên kết phải bắt đầu bằng https:// (Facebook không chấp nhận http:// hoặc localhost).`);
                        }
                    }
                }
            }
        }

        setIsSavingChatbot(true);
        try {
            const payload = {
                name: botName,
                messengerPageId: chatbotConfig.messengerPageId,
                messengerPageToken: chatbotConfig.messengerPageToken || accountInfo.accessToken || '',
                knowledgeBase: JSON.stringify(filteredButtons),
                iceBreakersJson: JSON.stringify(filteredQuestions),
                priceListUrl: chatbotConfig.priceListUrl?.trim() || '',
                maintenanceUrl: chatbotConfig.maintenanceUrl?.trim() || '',
                maxTokens: chatbotConfig.maxTokens,
                isActive: chatbotConfig.isActive
            };

            if (chatbotConfig.id) {
                await api.put(`/chatbots/${chatbotConfig.id}`, payload);
                toast.success('Cập nhật cấu hình Chatbot thành công!');
            } else {
                const createRes = await api.post('/chatbots', payload);
                toast.success('Kích hoạt Chatbot thành công!');
                setChatbotConfig(prev => prev ? ({ ...prev, id: createRes.data.id }) : null);
            }
            fetchChatbotConfig();
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || 'Lưu cấu hình thất bại.');
        } finally {
            setIsSavingChatbot(false);
        }
    };

    const handleToggleActive = async () => {
        if (!chatbotConfig) return;
        if (!chatbotConfig.id) {
            setChatbotConfig(prev => prev ? { ...prev, isActive: !prev.isActive } : null);
            return;
        }
        try {
            const res = await api.patch(`/chatbots/${chatbotConfig.id}/toggle`);
            setChatbotConfig(prev => prev ? { ...prev, isActive: res.data.isActive } : null);
            toast.success(res.data.isActive ? 'Đã kích hoạt Chatbot!' : 'Đã tắt Chatbot!');
        } catch (error) {
            console.error('Error toggling chatbot status:', error);
            toast.error('Không thể thay đổi trạng thái hoạt động.');
        }
    };

    const handleQuestionDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleQuestionDrop = (e: React.DragEvent, targetIndex: number) => {
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const updated = [...chatbotQuestions];
        const [movedItem] = updated.splice(sourceIndex, 1);
        updated.splice(targetIndex, 0, movedItem);
        setChatbotQuestions(updated);
        setEditingQuestionIndex(null);
    };

    const handleButtonDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleButtonDrop = (e: React.DragEvent, targetIndex: number) => {
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const updated = [...chatbotButtons];
        const [movedItem] = updated.splice(sourceIndex, 1);
        updated.splice(targetIndex, 0, movedItem);
        setChatbotButtons(updated);
        setEditingButtonIndex(null);
    };

    const fetchPosts = useCallback(async () => {
        try {
            const res = await api.get(`${apiPrefix}/${accountId}/posts`);
            if (res.data && res.data.data) {
                setPosts(res.data.data);
            }
        } catch (err) {
            console.error(err);
        }
    }, [accountId, apiPrefix]);

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này trên Facebook không? Hành động này sẽ xóa trực tiếp bài viết khỏi trang Facebook của bạn.")) {
            return;
        }

        try {
            const toastId = toast.loading('Đang xóa bài viết trên Facebook...');
            await api.delete(`${apiPrefix}/${accountId}/posts/${postId}`);
            toast.success('Xóa bài viết thành công!', { id: toastId });
            setSelectedPost(null);
            fetchPosts();
        } catch (err: any) {
            console.error('Failed to delete post:', err);
            const errorMsg = err.response?.data || 'Xóa bài viết thất bại.';
            toast.error(typeof errorMsg === 'string' ? errorMsg : 'Xóa bài viết thất bại.');
        }
    };

    const fetchConversations = useCallback(async () => {
        try {
            const res = await api.get(`${apiPrefix}/${accountId}/conversations`);
            if (res.data) {
                if (res.data.pageId) setPageId(res.data.pageId);
                if (res.data.data) {
                    const currentPageId = res.data.pageId || pageId;
                    let convList = res.data.data;
                    // Map Zalo conversations to common format
                    if (isZalo) {
                        convList = convList.map((c: any) => ({
                            ...c,
                            updated_time: c.lastMessageAt || c.lastMessageAtUtc || c.createdAt,
                            participants: { data: [{ id: c.zaloUserId, username: c.userDisplayName || c.zaloUserId }] },
                        }));
                    }
                    const sorted = [...convList].sort((a: Conversation, b: Conversation) => {
                        const unreadA = getUnreadCount(a, currentPageId);
                        const unreadB = getUnreadCount(b, currentPageId);
                        if (unreadA > 0 && unreadB === 0) return -1;
                        if (unreadB > 0 && unreadA === 0) return 1;
                        return new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime();
                    });
                    setConversations(sorted);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }, [accountId, apiPrefix, isZalo]);

    const fetchComments = useCallback(async (postId: string) => {
        try {
            const res = await api.get(`/pages/${accountId}/posts/${postId}/comments`);
            if (res.data) {
                if (res.data.pageId) setPageId(res.data.pageId);
                if (res.data.data) {
                    setComments(prevComments => {
                        const newCommentsMap = new Map<string, Comment>(res.data.data.map((c: any) => [c.id, c as Comment]));

                        let baseComments = prevComments;
                        if (baseComments.length === 0) {
                            const cached = localStorage.getItem(`post_comments_${postId}`);
                            if (cached) {
                                try { baseComments = JSON.parse(cached); } catch { }
                            }
                        }

                        baseComments.forEach(pc => {
                            if (!newCommentsMap.has(pc.id)) {
                                // Chỉ giữ lại nếu comment này là nhạy cảm (do hệ thống tự động ẩn)
                                // Nếu là comment bình thường mà bị mất khỏi API, nghĩa là chủ shop đã xoá -> cho phép xoá
                                if (pc.isSensitive) {
                                    newCommentsMap.set(pc.id, { ...pc, hidden: true });
                                }
                            } else {
                                const nc = newCommentsMap.get(pc.id);
                                if (nc) {
                                    if (pc.replies?.data && nc.replies?.data) {
                                        const newRepliesMap = new Map<string, any>(nc.replies.data.map((r: any) => [r.id, r]));
                                        pc.replies.data.forEach((pr: any) => {
                                            if (!newRepliesMap.has(pr.id)) {
                                                if (pr.isSensitive) {
                                                    newRepliesMap.set(pr.id, { ...pr, hidden: true });
                                                }
                                            }
                                        });
                                        nc.replies.data = Array.from(newRepliesMap.values())
                                            .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                                    } else if (pc.replies?.data && !nc.replies?.data) {
                                        // Giữ lại các reply nhạy cảm nếu reply array bị mất
                                        const sensitiveReplies = pc.replies.data.filter((r: any) => r.isSensitive).map((r: any) => ({ ...r, hidden: true }));
                                        if (sensitiveReplies.length > 0) {
                                            nc.replies = { data: sensitiveReplies };
                                        }
                                    }
                                }
                            }
                        });

                        const merged = Array.from(newCommentsMap.values());
                        const sorted = merged.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                        localStorage.setItem(`post_comments_${postId}`, JSON.stringify(sorted));
                        return sorted;
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
    }, [accountId]);

    const fetchMessages = useCallback(async (convId: string) => {
        try {
            const res = await api.get(`${apiPrefix}/${accountId}/conversations/${convId}/messages`);
            if (res.data && res.data.messages && res.data.messages.data) {
                const msgs = res.data.messages.data;
                // Zalo messages are already sorted oldest-first; FB/IG need reverse
                if (isZalo) {
                    setMessages(msgs.map((m: any) => ({
                        ...m,
                        created_time: m.timestamp || m.sentAtUtc,
                        from: { id: m.senderId, username: m.isFromOA ? 'OA' : 'User' },
                    })));
                } else {
                    setMessages(msgs.reverse());
                }
            }
        } catch (err) {
            console.error(err);
        }
    }, [accountId, apiPrefix, isZalo]);

    // Polling setup (Fallback)
    useEffect(() => {
        if (activeTab === 'posts') {
            fetchPosts();
            const interval = setInterval(fetchPosts, 60000); // 1 minute fallback
            return () => clearInterval(interval);
        } else {
            fetchConversations();
            const interval = setInterval(fetchConversations, 60000); // 1 minute fallback
            return () => clearInterval(interval);
        }
    }, [activeTab, fetchPosts, fetchConversations]);

    // Polling selected items
    useEffect(() => {
        if (selectedPost) {
            const cached = localStorage.getItem(`post_comments_${selectedPost.id}`);
            if (cached) {
                try { setComments(JSON.parse(cached)); } catch { }
            } else {
                setComments([]);
            }

            fetchComments(selectedPost.id);
            const interval = setInterval(() => fetchComments(selectedPost.id), 10000);
            return () => clearInterval(interval);
        }
    }, [selectedPost, fetchComments]);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
            const psid = getSelectedConversationPsid(selectedConversation);
            if (psid) {
                fetchConversationOrders(psid);
                fetchConversationComplaints(psid);
            }
            const interval = setInterval(() => {
                fetchMessages(selectedConversation.id);
                if (psid) {
                    fetchConversationOrders(psid);
                    fetchConversationComplaints(psid);
                }
            }, 60000); // 1 min fallback
            return () => clearInterval(interval);
        } else {
            setConversationOrders([]);
            setConversationComplaints([]);
        }
    }, [selectedConversation, fetchMessages, fetchConversationOrders, fetchConversationComplaints, getSelectedConversationPsid]);


    const handleReply = async (commentId: string) => {
        if (!replyText.trim() || isZalo) return;
        try {
            await api.post(`/pages/${accountId}/comments/${commentId}/reply`, { message: replyText });
            toast.success('Đã gửi phản hồi');
            setReplyText('');
            setReplyingTo(null);
            if (selectedPost) fetchComments(selectedPost.id);
        } catch (err) {
            toast.error('Lỗi khi gửi phản hồi');
        }
    };

    const handleHideComment = async (commentId: string) => {
        try {
            await api.post(`/pages/${accountId}/comments/${commentId}/hide`);
            toast.success('Đã ẩn bình luận');
        } catch (err) {
            toast.error('Lỗi khi ẩn bình luận');
        }
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() && !selectedFile) return;
        if (!selectedConversation) return;

        const recipient = isZalo
            ? (selectedConversation as any).zaloUserId || selectedConversation.participants.data[0]?.id
            : selectedConversation.participants.data.find(p => p.id !== pageId)?.id || selectedConversation.participants.data[0]?.id;
        if (!recipient) return toast.error('Không tìm thấy người nhận');

        try {
            let mediaUrl = undefined;
            let mediaType = undefined;

            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                const uploadRes = await api.post('/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                mediaUrl = uploadRes.data.url;
                mediaType = uploadRes.data.type;
            }

            if (mediaUrl) {
                await api.post(`${apiPrefix}/${accountId}/messages/send`, {
                    recipientId: recipient, mediaUrl, mediaType
                });
            }
            if (messageText.trim()) {
                await api.post(`${apiPrefix}/${accountId}/messages/send`, {
                    recipientId: recipient, message: messageText
                });
            }

            setMessageText('');
            setSelectedFile(null);
            setPreviewUrl(null);
            fetchMessages(selectedConversation.id);
        } catch (err) {
            toast.error('Lỗi khi gửi tin nhắn');
        }
    };

    const handleDeleteConversation = async (convId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này không?")) return;
        try {
            const toastId = toast.loading('Đang xóa cuộc trò chuyện...');
            await api.delete(`${apiPrefix}/${accountId}/conversations/${convId}`);
            toast.success('Xóa cuộc trò chuyện thành công!', { id: toastId });
            if (selectedConversation?.id === convId) {
                setSelectedConversation(null);
                setMessages([]);
            }
            fetchConversations();
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Xóa cuộc trò chuyện thất bại.');
        }
    };

    const renderComment = (comment: Comment, isReply = false) => {
        let isReplied = false;
        let isMyComment = false;

        // Check if comment is from the page itself
        if (pageId && comment.from?.id === pageId) {
            isMyComment = true;
        }

        // Check if we replied to this comment
        if (comment.replies && comment.replies.data.length > 0 && pageId) {
            isReplied = comment.replies.data.some(reply => reply.from?.id === pageId);
        }

        const needsReply = !isReply && !isMyComment && !isReplied && !comment.isSensitive;

        return (
            <div key={comment.id} className={`p-4 rounded-xl shadow-sm border transition-colors ${comment.isSensitive ? 'border-red-300 bg-red-50' :
                needsReply ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100 bg-white'
                } ${isReply ? 'ml-8 mt-2' : 'mt-4'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <span className="font-bold text-sm flex items-center gap-2">
                            {comment.username || 'Người dùng ẩn danh'}
                            {!isReply && isReplied && <span title="Đã phản hồi"><CheckCircle className="w-4 h-4 text-green-500" /></span>}
                            {needsReply && <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-orange-200">Chưa phản hồi</span>}
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5 block">{new Date(comment.timestamp).toLocaleString()}</span>
                    </div>
                    {!isReply && (
                        <div className="flex gap-2">
                            <button onClick={() => setReplyingTo(comment.id)} className="text-xs text-blue-600 hover:underline">Phản hồi</button>
                            <button onClick={() => handleHideComment(comment.id)} className="text-xs text-red-600 hover:underline">Ẩn</button>
                        </div>
                    )}
                </div>

                <p className="mt-2 text-sm text-gray-800 break-words">
                    {comment.isSensitive && (
                        <span className="text-red-600 mr-1" title={`Nhạy cảm: ${comment.sensitiveType} ${comment.hidden ? '(Đã ẩn với khách)' : ''}`}>⚠️</span>
                    )}
                    {comment.isSensitive && comment.originalText ? comment.originalText : comment.text}
                </p>

                {replyingTo === comment.id && (
                    <div className="mt-3 flex gap-2">
                        <input
                            type="text"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nhập phản hồi..."
                        />
                        <button onClick={() => handleReply(comment.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">Gửi</button>
                        <button onClick={() => setReplyingTo(null)} className="text-gray-500 px-2 py-1.5 text-sm hover:bg-gray-100 rounded-lg">Hủy</button>
                    </div>
                )}

                {/* Render Replies */}
                {comment.replies?.data.map(reply => renderComment(reply, true))}
            </div>
        )
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/platforms')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">
                    Quản lý {accountInfo?.platform === 1 ? 'Facebook' : accountInfo?.platform === 9 ? 'Zalo OA' : 'Instagram'}
                </h1>
            </div>

            <div className="flex gap-4 border-b">
                <button
                    onClick={() => { setActiveTab('posts'); setSelectedPost(null); }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'posts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Bài viết & Bình luận
                </button>
                <button
                    onClick={() => { setActiveTab('conversations'); setSelectedConversation(null); }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'conversations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Tin nhắn
                </button>
                {accountInfo?.platform === 1 && (
                    <button
                        onClick={() => { setActiveTab('chatbot'); }}
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'chatbot' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Chatbot AI
                    </button>
                )}
                <button
                    onClick={() => { setActiveTab('orders'); }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'orders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Đơn đặt hàng
                </button>
                <button
                    onClick={() => { setActiveTab('complaints'); }}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'complaints' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Khiếu nại
                </button>
            </div>

            {activeTab === 'posts' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Post List */}
                    <div className="md:col-span-1 border rounded-2xl bg-white overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between items-center">
                            <span>Danh sách bài viết</span>
                            <button
                                onClick={() => navigate('/posts/create')}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" /> Đăng bài
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {posts.map(post => (
                                <div
                                    key={post.id}
                                    onClick={() => setSelectedPost(post)}
                                    className={`p-3 rounded-xl cursor-pointer transition-colors flex gap-3 items-center ${selectedPost?.id === post.id ? 'bg-blue-50 border-blue-200 border' : 'hover:bg-gray-50 border border-transparent'}`}
                                >
                                    {post.media_url ? (
                                        <img src={post.media_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><ImageIcon className="w-5 h-5 text-gray-400" /></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{post.caption || 'Không có caption'}</p>
                                        <p className="text-xs text-gray-500 mt-1">{new Date(post.timestamp).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Comments Area */}
                    <div className="md:col-span-2 border rounded-2xl bg-gray-50 overflow-hidden flex flex-col h-[600px]">
                        {selectedPost ? (
                            <>
                                <div className="p-3 border-b bg-white flex justify-between items-center shadow-sm z-10 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-sm text-gray-800">Chi tiết bài viết {!isZalo && '& Bình luận'}</span>
                                        {accountInfo?.platform === 1 && (
                                            <button
                                                onClick={() => handleDeletePost(selectedPost.id)}
                                                className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 border border-red-100"
                                                title="Xóa bài viết trên Facebook"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Xóa bài
                                            </button>
                                        )}
                                    </div>
                                    {!isZalo && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md font-medium">Tự động làm mới 10s</span>}
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                                    {/* Post Details */}
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                                        {selectedPost.media_url && (
                                            <div className="w-full bg-gray-50 rounded-lg overflow-hidden flex justify-center border border-gray-100">
                                                <img src={selectedPost.media_url} className="max-h-[400px] object-contain" />
                                            </div>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap text-gray-800 leading-relaxed">
                                            {selectedPost.caption}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Đã đăng vào {new Date(selectedPost.timestamp).toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Zalo: Comment limitation notice */}
                                    {isZalo ? (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                            <h4 className="font-bold text-amber-800 flex items-center gap-2 text-sm">
                                                <MessageSquare className="w-4 h-4" /> Bình luận
                                            </h4>
                                            <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                                                Zalo OA hiện không cung cấp API quản lý bình luận bài viết.
                                                Vui lòng quản lý bình luận trực tiếp tại
                                                <a href="https://oa.zalo.me" target="_blank" rel="noopener noreferrer" className="underline font-semibold ml-1">oa.zalo.me</a>
                                            </p>
                                            <p className="text-xs text-amber-600 mt-2">Bạn có thể quản lý tin nhắn chat ở tab "Tin nhắn" bên cạnh.</p>
                                        </div>
                                    ) : (
                                        /* FB/IG Comments */
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                                    <MessageSquare className="w-4 h-4" />
                                                    Bình luận
                                                </h4>
                                                {(() => {
                                                    const unrepliedCount = comments.filter(c => {
                                                        const isMyComment = pageId && c.from?.id === pageId;
                                                        const hasMyReply = c.replies?.data.some(r => r.from?.id === pageId);
                                                        return !isMyComment && !hasMyReply && !c.isSensitive;
                                                    }).length;
                                                    if (unrepliedCount > 0) {
                                                        return (
                                                            <span className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-bold shadow-sm border border-orange-200">
                                                                {unrepliedCount} bình luận chưa phản hồi
                                                            </span>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            {comments.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                                    <p className="text-sm">Chưa có bình luận nào</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {comments.map(c => renderComment(c))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                                Chọn một bài viết để xem {isZalo ? 'chi tiết' : 'bình luận'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'conversations' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Conversation List */}
                    <div className="lg:col-span-1 border rounded-2xl bg-white overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b bg-gray-50 font-bold text-sm text-gray-700">Hộp thư</div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {conversations.map(conv => {
                                const names = (conv as any).userDisplayName || conv.participants?.data?.filter(p => p.id !== pageId).map(p => p.name || p.username || 'Người dùng Facebook').join(', ') || 'Unknown';
                                const unreadCount = getUnreadCount(conv, pageId);
                                const isSelected = selectedConversation?.id === conv.id;

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() => setSelectedConversation(conv)}
                                        className={`p-3 rounded-xl cursor-pointer transition-colors ${isSelected
                                            ? 'bg-blue-50 border-blue-200 border shadow-sm'
                                            : unreadCount > 0
                                                ? 'bg-orange-50/70 border-orange-200 border shadow-sm'
                                                : 'hover:bg-gray-50 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm font-bold truncate ${unreadCount > 0 && !isSelected ? 'text-orange-900' : 'text-gray-900'}`}>{names}</p>
                                            {unreadCount > 0 ? (
                                                <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow-sm">
                                                    {unreadCount} tin mới
                                                </span>
                                            ) : (
                                                conv.messages?.data && conv.messages.data.length > 0 && <span title="Đã phản hồi"><CheckCircle className="w-4 h-4 text-gray-300" /></span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                                            <span className="truncate max-w-[120px] text-gray-400">
                                                {conv.lastMessagePreview || 'Không có bản xem trước'}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(conv.updated_time).toLocaleDateString() === new Date().toLocaleDateString()
                                                        ? new Date(conv.updated_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : new Date(conv.updated_time).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteConversation(conv.id);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Xóa cuộc trò chuyện"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="lg:col-span-2 border rounded-2xl bg-gray-50 overflow-hidden flex flex-col h-[600px]">
                        {selectedConversation ? (
                            <>
                                <div className="p-4 border-b bg-white font-bold text-sm text-gray-800 flex justify-between items-center shrink-0 shadow-sm z-10">
                                    <span className="truncate max-w-[70%]">
                                        {selectedConversation.userDisplayName || selectedConversation.participants?.data?.filter(p => p.id !== pageId).map(p => p.name || p.username || 'Người dùng Facebook').join(', ')}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteConversation(selectedConversation.id)}
                                        className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 border border-red-100 shadow-sm shrink-0"
                                        title="Xóa cuộc trò chuyện"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Xóa chat
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {messages.map(msg => {
                                        const isMyMessage = isZalo ? (msg as any).isFromOA : msg.from?.id === pageId;

                                        return (
                                            <div key={msg.id} className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMyMessage
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : msg.isSensitive
                                                        ? 'bg-red-100 text-red-900 border border-red-200 rounded-bl-none'
                                                        : 'bg-white border shadow-sm rounded-bl-none text-gray-800'
                                                    }`}>
                                                    <div className="text-sm whitespace-pre-wrap">
                                                        {msg.isSensitive && !isMyMessage && (
                                                            <span className="text-red-600 mr-1" title={`Nhạy cảm: ${msg.sensitiveType}`}>⚠️</span>
                                                        )}
                                                        {msg.isSensitive && msg.originalMessage && !isMyMessage ? msg.originalMessage : msg.message}

                                                        {/* Render Attachments */}
                                                        {msg.attachments?.data.map((att: any, idx: number) => (
                                                            <div key={idx} className={`rounded-xl overflow-hidden bg-black/5 flex justify-center ${msg.message ? 'mt-2' : ''}`}>
                                                                {att.fetch_error ? (
                                                                    <div className="text-xs text-red-500 p-2">Lỗi tải ảnh: {att.fetch_error}</div>
                                                                ) : att.image_data ? (
                                                                    <img src={att.image_data.url} alt="attachment" className="max-w-full max-h-[250px] object-contain" />
                                                                ) : att.video_data ? (
                                                                    <video src={att.video_data.url} controls className="max-w-full max-h-[250px]" />
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-1 mx-1">
                                                    {new Date(msg.created_time).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="p-3 bg-white border-t flex flex-col gap-2">
                                    {previewUrl && (
                                        <div className="relative w-24 h-24 border rounded-xl overflow-hidden bg-gray-100 self-start ml-12">
                                            {selectedFile?.type.startsWith('video/') ? (
                                                <video src={previewUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={previewUrl} className="w-full h-full object-cover" />
                                            )}
                                            <button
                                                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs transition-colors"
                                            >✕</button>
                                        </div>
                                    )}
                                    <div className="flex gap-2 items-end">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*,video/*"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setSelectedFile(e.target.files[0]);
                                                    setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                                            title="Đính kèm Ảnh/Video"
                                        >
                                            <Paperclip className="w-5 h-5" />
                                        </button>
                                        <input
                                            type="text"
                                            value={messageText}
                                            onChange={e => setMessageText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                            className="flex-1 text-sm border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                            placeholder="Nhập tin nhắn..."
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!messageText.trim() && !selectedFile}
                                            className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                                        >
                                            <Send className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                                Chọn một cuộc hội thoại để xem
                            </div>
                        )}
                    </div>

                    {/* CRM Order & Complaint Panel */}
                    <div className="lg:col-span-1 border rounded-2xl bg-white overflow-hidden flex flex-col h-[600px] shadow-sm">
                        <div className="flex border-b bg-gradient-to-r from-blue-50 to-indigo-50/50 shadow-sm shrink-0">
                            <button
                                onClick={() => setCrmTab('orders')}
                                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                                    crmTab === 'orders'
                                        ? 'border-indigo-600 text-indigo-900 bg-white'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 bg-transparent'
                                }`}
                            >
                                <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                                Đơn hàng
                                {selectedConversation && conversationOrders.length > 0 && (
                                    <span className="text-[9px] font-bold text-white bg-indigo-600 px-1.5 py-0.5 rounded-full shrink-0">
                                        {conversationOrders.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setCrmTab('complaints')}
                                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                                    crmTab === 'complaints'
                                        ? 'border-rose-500 text-rose-950 bg-white'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 bg-transparent'
                                }`}
                            >
                                <Info className="w-3.5 h-3.5 text-rose-500" />
                                Khiếu nại
                                {selectedConversation && conversationComplaints.length > 0 && (
                                    <span className="text-[9px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded-full shrink-0">
                                        {conversationComplaints.length}
                                    </span>
                                )}
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-3 space-y-3 bg-slate-50/50">
                            {!selectedConversation ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center space-y-2">
                                    <ShoppingBag className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                                    <p>Chọn cuộc hội thoại để xem thông tin</p>
                                </div>
                            ) : crmTab === 'orders' ? (
                                isLoadingOrders ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center space-y-2">
                                        <Loader2 className="w-8 h-8 text-indigo-500 stroke-[2] animate-spin" />
                                        <p>Đang tải danh sách đơn hàng...</p>
                                    </div>
                                ) : conversationOrders.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center space-y-2">
                                        <ShoppingBag className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                                        <p>Khách hàng chưa có đơn đặt hàng nào</p>
                                    </div>
                                ) : (
                                    conversationOrders.map((order: any) => (
                                        <div key={order.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:border-slate-300 relative space-y-3">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                <div className="flex items-center gap-1.5">
                                                    {order.status === 'Confirmed' ? (
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Thành công ✓</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Đang xử lý…</span>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        className="p-0.5 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
                                                        title="Xóa đơn hàng"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                {/* Toggle switch */}
                                                <button
                                                    onClick={() => handleToggleOrderStatus(order.id, order.status)}
                                                    title={order.status === 'Confirmed' ? 'Đang xác nhận – bấm để huỷ' : 'Bấm để xác nhận đơn thành công'}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                        order.status === 'Confirmed' ? 'bg-emerald-500' : 'bg-slate-300'
                                                    }`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                                        order.status === 'Confirmed' ? 'translate-x-4' : 'translate-x-0.5'
                                                    }`} />
                                                </button>
                                            </div>
                                            <div className="space-y-2 text-xs text-slate-700">
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="font-bold text-slate-500 min-w-[60px] shrink-0">Khách:</span>
                                                    <span className="font-black text-slate-800 text-right">{order.name}</span>
                                                </div>
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="font-bold text-slate-500 min-w-[60px] shrink-0">SĐT:</span>
                                                    <span 
                                                        className="font-bold text-indigo-600 select-all hover:underline cursor-pointer" 
                                                        onClick={() => { 
                                                            navigator.clipboard.writeText(order.phone); 
                                                            toast.success('Đã sao chép SĐT!'); 
                                                        }}
                                                        title="Bấm để sao chép"
                                                    >
                                                        {order.phone}
                                                    </span>
                                                </div>
                                                {order.email && (
                                                    <div className="flex justify-between items-start gap-1">
                                                        <span className="font-bold text-slate-500 min-w-[60px] shrink-0">Email:</span>
                                                        <span className="font-semibold text-slate-700 text-right break-all">{order.email}</span>
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <span className="font-bold text-slate-500 block">Sản phẩm / Dịch vụ:</span>
                                                    <span className="font-black text-slate-900 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/30 block leading-relaxed">{order.item}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="font-bold text-slate-500 block">Địa chỉ:</span>
                                                    <span className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 block leading-relaxed break-words">{order.address}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                isLoadingComplaints ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center space-y-2">
                                        <Loader2 className="w-8 h-8 text-indigo-500 stroke-[2] animate-spin" />
                                        <p>Đang tải danh sách khiếu nại...</p>
                                    </div>
                                ) : conversationComplaints.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center space-y-2">
                                        <Info className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                                        <p>Khách hàng chưa có khiếu nại nào</p>
                                    </div>
                                ) : (
                                    conversationComplaints.map((complaint: any) => (
                                        <div key={complaint.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:border-slate-300 relative space-y-3">
                                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                                <div className="flex items-center gap-1.5">
                                                    {complaint.status === 'Processed' ? (
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Đã xử lý ✓</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Đang chờ…</span>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteComplaint(complaint.id)}
                                                        className="p-0.5 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
                                                        title="Xóa khiếu nại"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                {/* Toggle switch */}
                                                <button
                                                    onClick={() => handleToggleComplaintStatus(complaint.id, complaint.status)}
                                                    title={complaint.status === 'Processed' ? 'Đã xử lý – bấm để huỷ' : 'Bấm để xác nhận xử lý xong'}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                        complaint.status === 'Processed' ? 'bg-emerald-500' : 'bg-slate-300'
                                                    }`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                                        complaint.status === 'Processed' ? 'translate-x-4' : 'translate-x-0.5'
                                                    }`} />
                                                </button>
                                            </div>
                                            <div className="space-y-2 text-xs text-slate-700">
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="font-bold text-slate-500 min-w-[60px] shrink-0">Khách:</span>
                                                    <span className="font-black text-slate-800 text-right">{complaint.name}</span>
                                                </div>
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="font-bold text-slate-500 min-w-[60px] shrink-0">SĐT:</span>
                                                    <span 
                                                        className="font-bold text-indigo-600 select-all hover:underline cursor-pointer" 
                                                        onClick={() => { 
                                                            navigator.clipboard.writeText(complaint.phone); 
                                                            toast.success('Đã sao chép SĐT!'); 
                                                        }}
                                                        title="Bấm để sao chép"
                                                    >
                                                        {complaint.phone}
                                                    </span>
                                                </div>
                                                {complaint.email && (
                                                    <div className="flex justify-between items-start gap-1">
                                                        <span className="font-bold text-slate-500 min-w-[60px] shrink-0">Email:</span>
                                                        <span className="font-semibold text-slate-700 text-right break-all">{complaint.email}</span>
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <span className="font-bold text-slate-500 block">Nội dung khiếu nại:</span>
                                                    <span className="text-slate-700 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 block leading-relaxed break-words whitespace-pre-wrap">{complaint.content}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'chatbot' && (
                <div className="w-full space-y-6">
                    {isLoadingChatbot ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : chatbotConfig && (
                        <div className="relative bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 space-y-8 overflow-hidden">
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50/50 blur-3xl -z-10 pointer-events-none"></div>

                            {/* Header Section */}
                            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-6 gap-6">
                                {/* Token Budget Input */}
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Ngân sách Token tối đa:</label>
                                    <input
                                        type="number"
                                        min="1000"
                                        max="10000000"
                                        step="1000"
                                        value={chatbotConfig?.maxTokens ?? 100000}
                                        onChange={(e) => setChatbotConfig(prev => prev ? { ...prev, maxTokens: parseInt(e.target.value) || 100000 } : null)}
                                        className="w-28 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm font-semibold"
                                        title="Giới hạn ngân sách Token của Chatbot"
                                    />
                                </div>

                                {/* Progress Bar / Slider */}
                                <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
                                    <span className="text-sm font-semibold text-slate-500 whitespace-nowrap">Đã sử dụng:</span>
                                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                                        <div
                                            className={`h-full ${((chatbotConfig.usedTokens / (chatbotConfig.maxTokens || 1)) * 100) > 90 ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse' : 'bg-gradient-to-r from-blue-500 to-indigo-600'} transition-all duration-500 rounded-full`}
                                            style={{ width: `${Math.min((chatbotConfig.usedTokens / (chatbotConfig.maxTokens || 1)) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                                        {(chatbotConfig.usedTokens || 0).toLocaleString()} / {(chatbotConfig.maxTokens || 100000).toLocaleString()} <span className="text-slate-400 font-normal">tokens</span>
                                    </span>
                                </div>

                                {/* Save Button & Toggle Switches */}
                                <div className="flex items-center gap-5 ml-auto">
                                    {/* Save Config Button */}
                                    <button
                                        onClick={handleSaveChatbot}
                                        disabled={isSavingChatbot}
                                        className="relative overflow-hidden group flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-black rounded-xl transition-all shadow-[0_8px_20px_rgb(59,130,246,0.2)] hover:shadow-[0_8px_25px_rgb(59,130,246,0.3)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                    >
                                        {isSavingChatbot ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span className="relative z-10">Đang xử lý...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="relative z-10 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-blue-100 transition-all">Lưu cấu hình</span>
                                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                                            </>
                                        )}
                                    </button>

                                    {/* Vertical Separator */}
                                    <div className="h-8 w-px bg-slate-200"></div>

                                    {/* Active / Inactive Switch */}
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-1.5 shadow-sm">
                                        <button
                                            onClick={handleToggleActive}
                                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ease-in-out shadow-inner ${chatbotConfig.isActive ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-slate-200'}`}
                                        >
                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${chatbotConfig.isActive ? 'translate-x-8' : 'translate-x-1'}`} />
                                        </button>
                                        <span className={`text-xs font-black uppercase tracking-wider ${chatbotConfig.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {chatbotConfig.isActive ? 'Hoạt động' : 'Đã tắt'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Configuration Form */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 mt-6">
                                {/* Left Column: Câu hỏi gợi ý */}
                                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-5">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="space-y-1">
                                            <h4 className="text-base font-black text-slate-800">Câu hỏi gợi ý</h4>
                                            <p className="text-xs text-slate-500 font-medium">
                                                Hiển thị cho khách hàng mới khi mở cuộc trò chuyện.
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                                            ({chatbotQuestions.length}/4)
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {chatbotQuestions.map((qObj, index) => {
                                            const isEditing = editingQuestionIndex === index;
                                            return (
                                                <div 
                                                    key={index} 
                                                    draggable
                                                    onDragStart={(e) => handleQuestionDragStart(e, index)}
                                                    onDragOver={(e) => { e.preventDefault(); }}
                                                    onDrop={(e) => handleQuestionDrop(e, index)}
                                                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300"
                                                >
                                                    <div className="flex items-center gap-3 p-4">
                                                        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100 shadow-sm">
                                                            {index + 1}
                                                        </div>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                value={qObj.question}
                                                                onChange={e => {
                                                                    const updated = [...chatbotQuestions];
                                                                    updated[index].question = e.target.value;
                                                                    setChatbotQuestions(updated);
                                                                }}
                                                                placeholder={`Nhập câu hỏi gợi ý số ${index + 1} (bắt buộc)`}
                                                                maxLength={80}
                                                                className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                            />
                                                        ) : (
                                                            <div className="flex-1 font-semibold text-slate-800 truncate">
                                                                {qObj.question || <span className="text-slate-400 italic">Chưa nhập câu hỏi</span>}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {isEditing ? (
                                                                <button
                                                                    onClick={() => setEditingQuestionIndex(null)}
                                                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    Khóa
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setEditingQuestionIndex(index)}
                                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    Sửa
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setChatbotQuestions(chatbotQuestions.filter((_, i) => i !== index));
                                                                    if (editingQuestionIndex === index) setEditingQuestionIndex(null);
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Xóa câu hỏi"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isEditing && (
                                                        <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/30">
                                                            <div className="space-y-4 pt-4">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Nhập Tên Nút Bấm</label>
                                                                        <input
                                                                            type="text"
                                                                            value={qObj.buttonName || ''}
                                                                            onChange={e => {
                                                                                const updated = [...chatbotQuestions];
                                                                                updated[index].buttonName = e.target.value;
                                                                                setChatbotQuestions(updated);
                                                                            }}
                                                                            placeholder="VD: Xem chi tiết"
                                                                            maxLength={20}
                                                                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Đường dẫn</label>
                                                                        <input
                                                                            type="url"
                                                                            value={qObj.buttonUrl || ''}
                                                                            onChange={e => {
                                                                                const updated = [...chatbotQuestions];
                                                                                updated[index].buttonUrl = e.target.value;
                                                                                setChatbotQuestions(updated);
                                                                            }}
                                                                            placeholder="VD: https://drive.google.com/..."
                                                                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {!(qObj.buttonName || qObj.buttonUrl) && (
                                                                    <div className="space-y-1.5 border-t border-slate-200 pt-4">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                                                                                KỊCH BẢN TRẢ LỜI TỰ ĐỘNG
                                                                            </label>
                                                                            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-bold text-blue-600 transition-all shadow-sm group">
                                                                                <Upload className="w-3.5 h-3.5" />
                                                                                Tải file .txt
                                                                                <input
                                                                                    type="file"
                                                                                    accept=".txt"
                                                                                    className="hidden"
                                                                                    onChange={(e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        if (file) {
                                                                                            const reader = new FileReader();
                                                                                            reader.onload = (event) => {
                                                                                                const text = event.target?.result as string;
                                                                                                if (text) {
                                                                                                    const updated = [...chatbotQuestions];
                                                                                                    updated[index].replyText = text;
                                                                                                    setChatbotQuestions(updated);
                                                                                                }
                                                                                            };
                                                                                            reader.readAsText(file);
                                                                                        }
                                                                                        e.target.value = '';
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                        </div>
                                                                        <textarea
                                                                            value={qObj.replyText || ''}
                                                                            onChange={e => {
                                                                                const updated = [...chatbotQuestions];
                                                                                updated[index].replyText = e.target.value;
                                                                                setChatbotQuestions(updated);
                                                                            }}
                                                                            placeholder="Soạn trực tiếp hoặc upload file .txt để cung cấp ngữ cảnh cho AI trả lời..."
                                                                            rows={6}
                                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {chatbotQuestions.length === 0 && (
                                            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                                                <p className="text-sm font-medium text-slate-500">Chưa có câu hỏi gợi ý nào được thiết lập.</p>
                                            </div>
                                        )}

                                        {chatbotQuestions.length < 4 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newQ = { question: '' };
                                                    setChatbotQuestions([...chatbotQuestions, newQ]);
                                                    setEditingQuestionIndex(chatbotQuestions.length);
                                                }}
                                                className="w-full mt-2 py-3.5 flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 hover:border-blue-500 hover:bg-blue-50 text-blue-600 rounded-xl text-sm font-bold transition-all bg-white"
                                            >
                                                <Plus className="w-5 h-5" />
                                                Thêm câu hỏi mới ({chatbotQuestions.length}/4)
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Nút hành động nhanh */}
                                <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-5">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="space-y-1">
                                            <h4 className="text-base font-black text-slate-800">Nút hành động nhanh</h4>
                                            <p className="text-xs text-slate-500 font-medium">
                                                Hiển thị bên dưới khung chat Messenger.
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                                            ({chatbotButtons.length}/5)
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {chatbotButtons.map((btnObj, index) => {
                                            const isEditing = editingButtonIndex === index;
                                            return (
                                                <div 
                                                    key={index} 
                                                    draggable
                                                    onDragStart={(e) => handleButtonDragStart(e, index)}
                                                    onDragOver={(e) => { e.preventDefault(); }}
                                                    onDrop={(e) => handleButtonDrop(e, index)}
                                                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300"
                                                >
                                                    <div className="flex items-center gap-3 p-4">
                                                        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100 shadow-sm">
                                                            {index + 1}
                                                        </div>
                                                        {isEditing ? (
                                                            <div className="flex-1 flex gap-2">
                                                                <select
                                                                    value={btnObj.icon || '💬'}
                                                                    onChange={e => {
                                                                        const updated = [...chatbotButtons];
                                                                        const val = e.target.value;
                                                                        updated[index].icon = val;
                                                                        // Auto-set type based on icon
                                                                        if (val === '📞') {
                                                                            updated[index].type = 'phone_number';
                                                                        } else if (['🌐', '✉️', '📝', '💰'].includes(val)) {
                                                                            updated[index].type = 'web_url';
                                                                        } else {
                                                                            updated[index].type = 'postback';
                                                                        }
                                                                        setChatbotButtons(updated);
                                                                    }}
                                                                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shrink-0 cursor-pointer"
                                                                >
                                                                    <option value="💬">💬 Chat</option>
                                                                    <option value="📞">📞 Gọi điện</option>
                                                                    <option value="🌐">🌐 Web / Link</option>
                                                                    <option value="🛒">🛒 Đặt hàng</option>
                                                                    <option value="✉️">✉️ Gửi khiếu nại</option>
                                                                    <option value="💰">💰 Báo giá</option>
                                                                    <option value="🛍️">🛍️ Shop</option>
                                                                    <option value="ℹ️">ℹ️ Info</option>
                                                                    <option value="📝">📝 Form</option>
                                                                    <option value="🏠">🏠 Nhà</option>
                                                                </select>
                                                                <input
                                                                    type="text"
                                                                    value={btnObj.title}
                                                                    onChange={e => {
                                                                        const updated = [...chatbotButtons];
                                                                        updated[index].title = e.target.value;
                                                                        setChatbotButtons(updated);
                                                                    }}
                                                                    placeholder="Tên nút (bắt buộc)"
                                                                    maxLength={20}
                                                                    className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex-1 flex items-center gap-2">
                                                                <span className="text-lg shrink-0">{btnObj.icon || '💬'}</span>
                                                                <div className="font-semibold text-slate-800 truncate">
                                                                    {btnObj.title || <span className="text-slate-400 italic">Chưa nhập tên nút</span>}
                                                                </div>
                                                                {btnObj.payload && (
                                                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[120px]" title={btnObj.payload}>
                                                                        {btnObj.payload}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {isEditing ? (
                                                                <button
                                                                    onClick={() => setEditingButtonIndex(null)}
                                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    Khóa
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setEditingButtonIndex(index)}
                                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                                                                >
                                                                    Sửa
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setChatbotButtons(chatbotButtons.filter((_, i) => i !== index));
                                                                    if (editingButtonIndex === index) setEditingButtonIndex(null);
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Xóa nút bấm"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                        {isEditing && (
                                                            <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/30">
                                                                <div className="space-y-4 pt-4">
                                                                    <div className="space-y-1.5">
                                                                        {btnObj.icon === '📞' || btnObj.type === 'phone_number' ? (
                                                                            <>
                                                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Số điện thoại</label>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-2 py-1 font-bold shrink-0">📞 phone_number</span>
                                                                                    <input
                                                                                        type="tel"
                                                                                        value={btnObj.payload || ''}
                                                                                        onChange={e => {
                                                                                            const updated = [...chatbotButtons];
                                                                                            updated[index].payload = e.target.value;
                                                                                            updated[index].type = 'phone_number';
                                                                                            setChatbotButtons(updated);
                                                                                        }}
                                                                                        placeholder="VD: +84901234567"
                                                                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                                                                    />
                                                                                </div>
                                                                                <p className="text-xs text-slate-400">Nhập số điện thoại dạng quốc tế: +84901234567</p>
                                                                            </>
                                                                        ) : btnObj.icon === '💰' ? (
                                                                            <div className="space-y-3">
                                                                                <div className="flex justify-between items-center">
                                                                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Danh sách nút bấm & liên kết báo giá (Tối đa 3)</label>
                                                                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                                                                                        {parseSubButtons(btnObj.payload).length}/3
                                                                                    </span>
                                                                                </div>
                                                                                
                                                                                <div className="space-y-2.5">
                                                                                    {parseSubButtons(btnObj.payload).map((sub, sIdx) => (
                                                                                        <div key={sIdx} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-slate-50 p-3 rounded-xl border border-slate-100 relative w-full">
                                                                                            <input
                                                                                                type="text"
                                                                                                value={sub.title}
                                                                                                onChange={e => handleSubButtonChange(index, sIdx, 'title', e.target.value)}
                                                                                                placeholder="Tên nút (VD: Bảng giá mạng)"
                                                                                                maxLength={20}
                                                                                                className="w-full md:w-1/3 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                                            />
                                                                                            <input
                                                                                                type="text"
                                                                                                value={sub.url}
                                                                                                onChange={e => handleSubButtonChange(index, sIdx, 'url', e.target.value)}
                                                                                                placeholder="Đường dẫn (https://...)"
                                                                                                className="flex-1 w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                                            />
                                                                                            {parseSubButtons(btnObj.payload).length > 1 && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleDeleteSubButton(index, sIdx)}
                                                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                                                                                                    title="Xóa dòng"
                                                                                                >
                                                                                                    <Trash2 className="w-4 h-4" />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>

                                                                                {parseSubButtons(btnObj.payload).length < 3 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleAddSubButton(index)}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-lg transition-all shadow-sm"
                                                                                    >
                                                                                        <Plus className="w-3.5 h-3.5" /> Thêm nút & đường dẫn
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ) : ['🛒', '🛍️'].includes(btnObj.icon || '') ? (
                                                                            <div className="space-y-3">
                                                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Cấu hình form đặt hàng</label>
                                                                                <div className="space-y-2.5">
                                                                                    {parseOrderFormPayload(btnObj.payload).map((field, fIdx, arr) => (
                                                                                        <div key={fIdx} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-slate-50 p-3 rounded-xl border border-slate-100 relative w-full">
                                                                                            <input
                                                                                                type="text"
                                                                                                value={field.name}
                                                                                                onChange={e => handleOrderFieldChange(index, fIdx, 'name', e.target.value)}
                                                                                                placeholder="Tên trường (VD: Thiết bị)"
                                                                                                className="w-full md:w-1/3 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                                            />
                                                                                            <input
                                                                                                type="text"
                                                                                                value={field.options}
                                                                                                onChange={e => handleOrderFieldChange(index, fIdx, 'options', e.target.value)}
                                                                                                placeholder="Các lựa chọn, cách nhau bằng dấu phẩy (VD: Cisco, Aruba)"
                                                                                                className="flex-1 w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                                            />
                                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                                                {arr.length > 1 && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => handleDeleteOrderField(index, fIdx)}
                                                                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                                                        title="Xóa dòng"
                                                                                                    >
                                                                                                        <Trash2 className="w-4 h-4" />
                                                                                                    </button>
                                                                                                )}
                                                                                                {fIdx === arr.length - 1 && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => handleAddOrderField(index)}
                                                                                                        className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                                                                        title="Thêm trường mới"
                                                                                                    >
                                                                                                        <Plus className="w-4 h-4" />
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-400 mt-1">
                                                                                    Nhập danh sách dịch vụ hoặc thiết bị hiển thị trong menu lựa chọn (dropdown) của form đặt hàng. Mỗi dòng là 1 dropdown riêng biệt.
                                                                                </p>
                                                                            </div>
                                                                        ) : btnObj.type === 'web_url' || ['🌐', '✉️', '📝'].includes(btnObj.icon || '') ? (
                                                                            <>
                                                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Đường dẫn (URL / Link Google Forms)</label>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2 py-1 font-bold shrink-0">🌐 web_url</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={btnObj.payload || ''}
                                                                                        onChange={e => {
                                                                                            const updated = [...chatbotButtons];
                                                                                            updated[index].payload = e.target.value;
                                                                                            updated[index].type = 'web_url';
                                                                                            setChatbotButtons(updated);
                                                                                        }}
                                                                                        placeholder="VD: https://forms.gle/... (hoặc các link cách nhau bằng dấu phẩy)"
                                                                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                                                    />
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-400 mt-1">
                                                                                    Có thể nhập một hoặc nhiều đường dẫn, phân tách nhau bằng dấu phẩy (,). Các liên kết phải bắt đầu bằng https://.
                                                                                </p>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Payload / Action</label>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded-lg px-2 py-1 font-bold shrink-0">postback</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={btnObj.payload || ''}
                                                                                        onChange={e => {
                                                                                            const updated = [...chatbotButtons];
                                                                                            updated[index].payload = e.target.value;
                                                                                            updated[index].type = 'postback';
                                                                                            setChatbotButtons(updated);
                                                                                        }}
                                                                                        placeholder="VD: CONTACT_US"
                                                                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                                                    />
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                </div>
                                            );
                                        })}

                                        {chatbotButtons.length === 0 && (
                                            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                                                <p className="text-sm font-medium text-slate-500">Chưa có nút hành động nhanh nào được thiết lập.</p>
                                            </div>
                                        )}

                                        {chatbotButtons.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newBtn = { icon: '💬', title: '', payload: '', type: 'postback' };
                                                    setChatbotButtons([...chatbotButtons, newBtn]);
                                                    setEditingButtonIndex(chatbotButtons.length);
                                                }}
                                                className="w-full mt-2 py-3.5 flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold transition-all bg-white"
                                            >
                                                <Plus className="w-5 h-5" />
                                                Thêm nút bấm mới ({chatbotButtons.length}/5)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>


                        </div>
                    )}
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="space-y-6">
                    {/* Header with Search and count */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                                Danh sách Đơn đặt hàng từ khách hàng
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Quản lý và theo dõi các đơn hàng được khách hàng gửi qua chatbot</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full shadow-sm">
                                Tổng số: {allOrders.length} đơn hàng
                            </span>
                            <button
                                onClick={fetchAllOrders}
                                disabled={isLoadingAllOrders}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border rounded-xl transition-all flex items-center gap-1.5"
                            >
                                {isLoadingAllOrders ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <span>Làm mới</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Orders Content */}
                    {isLoadingAllOrders ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <Loader2 className="w-10 h-10 text-indigo-500 stroke-[2] animate-spin" />
                            <p className="text-sm font-medium text-slate-500">Đang tải danh sách đơn hàng...</p>
                        </div>
                    ) : allOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm text-center p-6 space-y-3">
                            <ShoppingBag className="w-12 h-12 text-slate-300 stroke-[1.5]" />
                            <h3 className="text-base font-bold text-slate-800">Chưa có đơn đặt hàng nào</h3>
                            <p className="text-xs text-slate-500 max-w-sm">Khi khách hàng điền biểu mẫu đặt hàng thành công, thông tin đơn đặt hàng sẽ tự động hiển thị tại đây.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {allOrders.map((order: any) => (
                                <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:border-indigo-200 flex flex-col justify-between space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-2">
                                                {order.status === 'Confirmed' ? (
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 shadow-sm">Đặt hàng thành công ✓</span>
                                                ) : (
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 shadow-sm">Đang xử lý…</span>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                                                    title="Xóa đơn hàng"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-slate-400 font-semibold">{new Date(order.timestamp).toLocaleString('vi-VN')}</span>
                                                {/* Toggle to confirm order */}
                                                <button
                                                    onClick={() => handleToggleOrderStatus(order.id, order.status)}
                                                    title={order.status === 'Confirmed' ? 'Đang xác nhận – bấm để huỷ' : 'Bấm để xác nhận đơn thành công'}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner ${
                                                        order.status === 'Confirmed' ? 'bg-emerald-500' : 'bg-slate-300'
                                                    }`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                                                        order.status === 'Confirmed' ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-3 text-sm text-slate-700">
                                            <div className="flex justify-between items-start gap-1">
                                                <span className="font-bold text-slate-500 min-w-[70px] shrink-0">Họ và tên:</span>
                                                <span className="font-black text-slate-900 text-right">{order.name}</span>
                                            </div>
                                            <div className="flex justify-between items-start gap-1">
                                                <span className="font-bold text-slate-500 min-w-[70px] shrink-0">Số điện thoại:</span>
                                                <span 
                                                    className="font-black text-indigo-600 select-all hover:underline cursor-pointer decoration-2" 
                                                    onClick={() => { 
                                                        navigator.clipboard.writeText(order.phone); 
                                                        toast.success('Đã sao chép SĐT!'); 
                                                    }}
                                                    title="Bấm để sao chép"
                                                >
                                                    {order.phone}
                                                </span>
                                            </div>
                                            {order.email && (
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="font-bold text-slate-500 min-w-[70px] shrink-0">Email:</span>
                                                    <span className="font-semibold text-slate-700 text-right break-all">{order.email}</span>
                                                </div>
                                            )}
                                            <div className="space-y-1.5">
                                                <span className="font-bold text-slate-500 block">Sản phẩm / Dịch vụ chọn mua:</span>
                                                <span className="font-black text-slate-900 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/30 block leading-relaxed">{order.item}</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <span className="font-bold text-slate-500 block">Địa chỉ giao hàng / thi công:</span>
                                                <span className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 block leading-relaxed break-words">{order.address}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'complaints' && (
                <div className="space-y-6">
                    {/* Header with Search and count */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Info className="w-5 h-5 text-rose-500" />
                                Danh sách Khiếu nại từ khách hàng
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Quản lý và theo dõi các khiếu nại được khách hàng gửi qua Google Forms</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1 rounded-full shadow-sm">
                                Tổng số: {allComplaints.length} khiếu nại
                            </span>
                            <button
                                onClick={fetchAllComplaints}
                                disabled={isLoadingAllComplaints}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border rounded-xl transition-all flex items-center gap-1.5"
                            >
                                {isLoadingAllComplaints ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <span>Làm mới</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Complaints Content */}
                    {isLoadingAllComplaints ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <Loader2 className="w-10 h-10 text-indigo-500 stroke-[2] animate-spin" />
                            <p className="text-sm font-medium text-slate-500">Đang tải danh sách khiếu nại...</p>
                        </div>
                    ) : allComplaints.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm text-center p-6 space-y-3">
                            <Info className="w-12 h-12 text-slate-300 stroke-[1.5]" />
                            <h3 className="text-base font-bold text-slate-800">Chưa có khiếu nại nào</h3>
                            <p className="text-xs text-slate-500 max-w-sm">Khi khách hàng điền biểu mẫu khiếu nại thành công, thông tin khiếu nại sẽ tự động hiển thị tại đây.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {allComplaints.map((complaint: any) => (
                                <div key={complaint.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:border-rose-200 flex flex-col justify-between space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-2">
                                                {complaint.status === 'Processed' ? (
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 shadow-sm">Đã xử lý ✓</span>
                                                ) : (
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100 shadow-sm">Đang chờ…</span>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteComplaint(complaint.id)}
                                                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                                                    title="Xóa khiếu nại"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-slate-400 font-semibold">{new Date(complaint.timestamp).toLocaleString('vi-VN')}</span>
                                                {/* Toggle to confirm processed */}
                                                <button
                                                    onClick={() => handleToggleComplaintStatus(complaint.id, complaint.status)}
                                                    title={complaint.status === 'Processed' ? 'Đã xử lý – bấm để huỷ' : 'Bấm để xác nhận đã xử lý'}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner ${
                                                        complaint.status === 'Processed' ? 'bg-emerald-500' : 'bg-slate-300'
                                                    }`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                                                        complaint.status === 'Processed' ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-3 text-sm text-slate-700">
                                            <div className="flex justify-between items-start gap-1">
                                                <span className="font-bold text-slate-500 min-w-[70px] shrink-0">Họ và tên:</span>
                                                <span className="font-black text-slate-900 text-right">{complaint.name}</span>
                                            </div>
                                            <div className="flex justify-between items-start gap-1">
                                                <span className="font-bold text-slate-500 min-w-[70px] shrink-0">Số điện thoại:</span>
                                                <span 
                                                    className="font-black text-indigo-600 select-all hover:underline cursor-pointer decoration-2" 
                                                    onClick={() => { 
                                                        navigator.clipboard.writeText(complaint.phone); 
                                                        toast.success('Đã sao chép SĐT!'); 
                                                    }}
                                                    title="Bấm để sao chép"
                                                >
                                                    {complaint.phone}
                                                </span>
                                            </div>
                                            {complaint.email && (
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="font-bold text-slate-500 min-w-[70px] shrink-0">Email:</span>
                                                    <span className="font-semibold text-slate-700 text-right break-all">{complaint.email}</span>
                                                </div>
                                            )}
                                            <div className="space-y-1.5">
                                                <span className="font-bold text-slate-500 block">Nội dung khiếu nại:</span>
                                                <span className="text-slate-700 bg-rose-50/50 p-3 rounded-xl border border-rose-100 block leading-relaxed break-words whitespace-pre-wrap">{complaint.content}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
