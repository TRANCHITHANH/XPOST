import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../lib/axios';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import toast from 'react-hot-toast';
import { ArrowLeft, Image as ImageIcon, MessageSquare, Send, Plus, CheckCircle, Paperclip } from 'lucide-react';

interface Post {
    id: string;
    caption: string;
    media_url: string;
    media_type: string;
    timestamp: string;
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
    from?: { id: string, username: string };
    replies?: { data: Comment[] };
}

interface Conversation {
    id: string;
    updated_time: string;
    participants: { data: { id: string, username: string }[] };
    messages?: { data: { from?: { id: string, username: string } }[] };
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
    from: { id: string, username: string };
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

export default function PageManagement() {
    const { accountId } = useParams<{ accountId: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'posts' | 'conversations'>('posts');
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
    const apiPrefix = isZalo ? '/zalo-pages' : '/pages';

    // Setup SignalR
    useEffect(() => {
        const hubPath = isZalo ? '/hubs/zalo' : '/hubs/instagram';
        const eventName = isZalo ? 'ReceiveZaloEvent' : 'ReceiveInstagramEvent';
        const connection = new HubConnectionBuilder()
            .withUrl(`${API_BASE_URL}${hubPath}`)
            .configureLogging(LogLevel.Warning)
            .withAutomaticReconnect()
            .build();

        connection.on(eventName, (payload) => {
            console.log(`${isZalo ? 'Zalo' : 'Instagram'} Webhook Event:`, payload);
            setLastWebhookSignal(Date.now());
        });

        connection.start()
            .then(() => console.log(`Connected to ${isZalo ? 'Zalo' : 'Instagram'} SignalR Hub!`))
            .catch(err => console.error('SignalR Connection Error:', err));

        return () => { connection.stop(); };
    }, [isZalo]);

    // Respond to SignalR events by refreshing current view
    useEffect(() => {
        if (lastWebhookSignal === 0) return;
        if (activeTab === 'posts') {
            fetchPosts();
            if (selectedPost) fetchComments(selectedPost.id);
        } else {
            fetchConversations();
            if (selectedConversation) fetchMessages(selectedConversation.id);
        }
    }, [lastWebhookSignal]);

    useEffect(() => {
        if (accountId) {
            api.get(`/socialaccounts/${accountId}`).then(res => setAccountInfo(res.data)).catch(console.error);
        }
    }, [accountId]);

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
                                try { baseComments = JSON.parse(cached); } catch {}
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
                try { setComments(JSON.parse(cached)); } catch {}
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
            const interval = setInterval(() => fetchMessages(selectedConversation.id), 60000); // 1 min fallback
            return () => clearInterval(interval);
        }
    }, [selectedConversation, fetchMessages]);


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
        <div key={comment.id} className={`p-4 rounded-xl shadow-sm border transition-colors ${
            comment.isSensitive ? 'border-red-300 bg-red-50' : 
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
    )};

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
                                    <span className="font-bold text-sm text-gray-800">Chi tiết bài viết {!isZalo && '& Bình luận'}</span>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Conversation List */}
                    <div className="md:col-span-1 border rounded-2xl bg-white overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b bg-gray-50 font-bold text-sm text-gray-700">Hộp thư</div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {conversations.map(conv => {
                                const names = (conv as any).userDisplayName || conv.participants?.data?.filter(p => p.id !== pageId).map(p => p.username).join(', ') || 'Unknown';
                                const unreadCount = getUnreadCount(conv, pageId);
                                const isSelected = selectedConversation?.id === conv.id;

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() => setSelectedConversation(conv)}
                                        className={`p-3 rounded-xl cursor-pointer transition-colors ${
                                            isSelected 
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
                                        <p className="text-xs text-gray-500 mt-1">{conv.lastMessagePreview && <span className="text-gray-400 mr-1 truncate inline-block max-w-[150px] align-bottom">{conv.lastMessagePreview}</span>}{new Date(conv.updated_time).toLocaleString()}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="md:col-span-2 border rounded-2xl bg-gray-50 overflow-hidden flex flex-col h-[600px]">
                        {selectedConversation ? (
                            <>
                                <div className="p-4 border-b bg-white font-bold text-sm text-gray-800">
                                    {selectedConversation.participants?.data?.filter(p => p.id !== pageId).map(p => p.username).join(', ')}
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
                </div>
            )}
        </div>
    );
}
