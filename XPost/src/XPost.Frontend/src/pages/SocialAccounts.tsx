import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Unplug, ExternalLink, Plus, Wifi, WifiOff, Settings2, X, Send, Globe, BookOpen, MessageCircle } from 'lucide-react';
import ConfirmModal from '../components/common/ConfirmModal';
import PlatformGuideModal from '../components/common/PlatformGuideModal';

// ════════════════════════════════════════════
//  Types
// ════════════════════════════════════════════
interface SocialAccount {
    id: string;
    platform: number;
    accountName: string;
    accountIdentifier: string | null;
    avatarUrl: string | null;
    apiBaseUrl: string | null;
    apiPostEndpoint: string | null;
    apiMethod: string | null;
    authType: number | null;
    apiKey: string | null;
    apiSecret: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiredAtUtc: string | null;
    customHeadersJson: string | null;
    fieldMappingJson: string | null;
    isActive: boolean;
    createdAtUtc: string;
}

interface FacebookPage {
    pageId: string;
    pageName: string;
    pageToken: string;
    pictureUrl: string;
}

interface ZaloOAInfo {
    oaId: string;
    oaName: string;
    avatarUrl: string;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
}

interface TwitterAccountInfo {
    accountId: string;
    accountName: string;
    avatarUrl: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
}

interface LinkedInAccountInfo {
    accountId: string;
    accountName: string;
    avatarUrl: string | null;
    accessToken: string;
    expiresIn: number;
}

interface TikTokAccountInfo {
    openId: string;
    displayName: string;
    avatarUrl: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
}

// ════════════════════════════════════════════
//  Platform Definitions
// ════════════════════════════════════════════
const platformDefs = [
    {
        id: 'facebook', value: 1, label: 'Facebook',
        desc: 'Kết nối Fanpage qua OAuth — đăng bài, ảnh tự động.',
        color: 'from-blue-500 to-blue-600', textColor: 'text-blue-600',
        bgLight: 'bg-blue-50', borderColor: 'border-blue-200',
        connectType: 'oauth' as const,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
        ),
    },
    {
        id: 'telegram', value: 8, label: 'Telegram',
        desc: 'Gửi bài qua Telegram Bot đến Channel/Group.',
        color: 'from-cyan-500 to-blue-500', textColor: 'text-cyan-600',
        bgLight: 'bg-cyan-50', borderColor: 'border-cyan-200',
        connectType: 'bot_token' as const,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
        ),
    },
    {
        id: 'website', value: 0, label: 'Website/API',
        desc: 'Kết nối thủ công đến bất kỳ API REST nào.',
        color: 'from-gray-600 to-gray-700', textColor: 'text-gray-600',
        bgLight: 'bg-gray-50', borderColor: 'border-gray-200',
        connectType: 'manual' as const,
        icon: <Globe className="w-7 h-7" />,
    },
    {
        id: 'wordpress', value: 7, label: 'WordPress',
        desc: 'Đăng bài lên WordPress qua REST API.',
        color: 'from-indigo-500 to-blue-600', textColor: 'text-indigo-600',
        bgLight: 'bg-indigo-50', borderColor: 'border-indigo-200',
        connectType: 'manual' as const,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.027-.78-.07-1.109zm-7.981.105c.647-.034 1.233-.1 1.233-.1.58-.068.512-.921-.068-.889 0 0-1.744.137-2.866.137-1.055 0-2.865-.137-2.865-.137-.58-.032-.648.856-.068.889 0 0 .552.066 1.133.1l1.682 4.615-2.364 7.088L6.841 6.93c.649-.034 1.233-.1 1.233-.1.581-.068.513-.921-.067-.889 0 0-1.745.137-2.866.137-.201 0-.44-.005-.697-.015C6.273 3.56 8.96 1.907 12 1.907c2.266 0 4.33.867 5.88 2.285-.038-.002-.075-.006-.114-.006-.888 0-1.517.774-1.517 1.604 0 .744.43 1.374.888 2.118.344.587.744 1.341.744 2.43 0 .753-.29 1.626-.674 2.843l-.882 2.95-3.19-9.489.003-.012zM12 22.094c-1.41 0-2.746-.29-3.959-.814l4.208-12.225 4.31 11.81c.028.07.056.092.084.162A10.043 10.043 0 0 1 12 22.094zM1.213 12c0-2.084.607-4.03 1.656-5.666L8.131 20.73C4.128 18.96 1.213 15.79 1.213 12zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" />
            </svg>
        ),
    },
    {
        id: 'medium', value: 10, label: 'Medium',
        desc: 'Đăng trích chéo lên Medium (hỗ trợ Canonical URL).',
        color: 'from-gray-800 to-black', textColor: 'text-gray-900',
        bgLight: 'bg-gray-100', borderColor: 'border-gray-200',
        connectType: 'manual' as const,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42c1.87 0 3.38 2.88 3.38 6.42zm2.81 0c0 3.13-.53 5.68-1.18 5.68-.66 0-1.18-2.55-1.18-5.68s.52-5.68 1.18-5.68c.65 0 1.18 2.55 1.18 5.68z" />
            </svg>
        ),
    },
    {
        id: 'devto', value: 11, label: 'Dev.to',
        desc: 'Đăng bài lên cộng đồng Dev.to qua API Key.',
        color: 'from-gray-900 to-black', textColor: 'text-gray-900',
        bgLight: 'bg-gray-100', borderColor: 'border-gray-300',
        connectType: 'manual' as const,
        icon: (
            <svg viewBox="0 0 448 512" className="w-7 h-7" fill="currentColor">
                <path d="M120.12 208.29c-3.88-2.9-7.77-4.35-11.65-4.35H91.03v104.47h17.45c3.88 0 7.77-1.45 11.65-4.35 3.88-2.9 5.82-7.25 5.82-13.06v-69.65c-.01-5.8-1.96-10.16-5.83-13.06zM448 80v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V80c0-26.51 21.49-48 48-48h352c0 26.51 21.49 48 48 48zm-227.27 102.44c0-3.9-3.17-7.07-7.07-7.07H173.8c-3.9 0-7.07 3.17-7.07 7.07v147.11c0 3.9 3.17 7.07 7.07 7.07h40.41c3.9 0 7.07-3.17 7.07-7.07v-147.11zM158.37 128H48c-8.84 0-16 7.16-16 16v224c0 8.84 7.16 16 16 16h110.37c8.84 0 16-7.16 16-16V144c0-8.84-7.16-16-16-16zm241.63 48.44c0-3.9-3.17-7.07-7.07-7.07h-40.41c-3.9 0-7.07 3.17-7.07 7.07v147.11c0 3.9 3.17 7.07 7.07 7.07h40.41c3.9 0 7.07-3.17 7.07-7.07v-147.11z" />
            </svg>
        ),
    },
    {
        id: 'blogger', value: 12, label: 'Blogger',
        desc: 'Đăng bài lên Google Blogger (Blogspot) qua OAuth2.',
        color: 'from-orange-500 to-orange-600', textColor: 'text-orange-600',
        bgLight: 'bg-orange-50', borderColor: 'border-orange-200',
        connectType: 'oauth_blogger' as const,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M19.78 4H4.22A2.22 2.22 0 002 6.22v11.56A2.22 2.22 0 004.22 20h15.56A2.22 2.22 0 0022 17.78V6.22A2.22 2.22 0 0019.78 4zM16 16h-4a2 2 0 01-2-2v-4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2z" />
            </svg>
        ),
    },
    {
        id: 'zalo', value: 9, label: 'Zalo OA',
        desc: 'Đăng bài viết lên Zalo Official Account.',
        color: 'from-blue-500 to-blue-700', textColor: 'text-blue-600',
        bgLight: 'bg-blue-50', borderColor: 'border-blue-200',
        connectType: 'oauth_zalo' as const,
        icon: (
            <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
                <path fill="#0068FF" d="M24 0C10.745 0 0 10.745 0 24s10.745 24 24 24 24-10.745 24-24S37.255 0 24 0z" />
                <path fill="#FFFFFF" d="M29.09 34.5H18.91c-1.09 0-1.91-.91-1.91-2v-1.09c0-.545.182-1.09.545-1.454L27.273 18.5H19.09c-1.09 0-2-.91-2-2v-.91c0-1.09.91-2 2-2h10c1.09 0 2 .91 2 2v1.09c0 .545-.182 1.09-.545 1.454L20.727 29.5h8.364c1.09 0 2 .91 2 2v.91c0 1.09-.91 2.09-2 2.09z" />
            </svg>
        ),
    },
    {
        id: 'twitter', value: 2, label: 'Twitter/X',
        desc: 'Đăng tweet tự động lên tài khoản cá nhân.',
        color: 'from-gray-800 to-black', textColor: 'text-gray-800',
        bgLight: 'bg-gray-50', borderColor: 'border-gray-200',
        connectType: 'oauth_twitter' as const,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
    },
    {
        id: 'linkedin', value: 4, label: 'LinkedIn',
        desc: 'Đăng bài tự động lên tài khoản cá nhân.',
        color: 'from-blue-600 to-blue-800', textColor: 'text-blue-700',
        bgLight: 'bg-blue-50', borderColor: 'border-blue-200',
        connectType: 'oauth_linkedin' as const,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        ),
    },
    {
        id: 'instagram', value: 3, label: 'Instagram',
        desc: 'Đăng ảnh tự động lên tài khoản Instagram Business.',
        color: 'from-purple-500 via-pink-500 to-orange-400', textColor: 'text-pink-600',
        bgLight: 'bg-pink-50', borderColor: 'border-pink-200',
        connectType: 'oauth_instagram' as any,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 1 1-2.882 0 1.441 1.441 0 0 1 2.882 0z" />
            </svg>
        ),
    },
    {
        id: 'threads', value: 13, label: 'Threads',
        desc: 'Đăng nội dung ngắn và hình ảnh lên Threads.',
        color: 'from-gray-900 via-gray-800 to-black', textColor: 'text-gray-900',
        bgLight: 'bg-gray-50', borderColor: 'border-gray-200',
        connectType: 'oauth_threads' as any,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm0-22c-5.514 0-10 4.486-10 10s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.12 11.23c-.15 0-.3-.06-.41-.17l-1.92-1.92c-.22-.22-.22-.58 0-.8l1.92-1.92c.22-.22.58-.22.8 0 .22.22.22.58 0 .8l-1.52 1.52 1.52 1.52c.22.22.22.58 0 .8-.1.11-.25.17-.39.17zm-8.24 0c-.15 0-.3-.06-.41-.17-.22-.22-.22-.58 0-.8l1.52-1.52-1.52-1.52c-.22-.22-.22-.58 0-.8.22-.22.58-.22.8 0l1.92 1.92c.22.22.22.58 0 .8l-1.92 1.92c-.11.11-.26.17-.41.17z"/>
            </svg>
        )
    },
    {
        id: 'tiktok', value: 5, label: 'TikTok Business',
        desc: 'Đăng video/ảnh, quản lý bình luận và nhắn tin trên TikTok.',
        color: 'from-gray-900 via-pink-600 to-cyan-400', textColor: 'text-pink-600',
        bgLight: 'bg-pink-50', borderColor: 'border-pink-200',
        connectType: 'oauth_tiktok' as any,
        icon: (
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.51a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.96a8.27 8.27 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.37z" />
            </svg>
        ),
    }
];

const authTypeOptions = [
    { value: 0, label: 'Không xác thực' },
    { value: 1, label: 'API Key' },
    { value: 2, label: 'Bearer Token' },
    { value: 3, label: 'OAuth 2.0' },
    { value: 4, label: 'HMAC Signature' },
];

const emptyForm = {
    platform: 0,
    accountName: '',
    accountIdentifier: '',
    apiBaseUrl: '',
    apiPostEndpoint: '',
    apiMethod: 'POST',
    authType: 0,
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    refreshToken: '',
    customHeadersJson: '',
    fieldMappingJson: '',
    isActive: true,
};

// ════════════════════════════════════════════
//  Main Component
// ════════════════════════════════════════════
export default function SocialAccounts() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);
    const [loading, setLoading] = useState(true);

    // Deletion
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Manual config modal
    const [showManualForm, setShowManualForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    // Telegram modal
    const [showTelegramModal, setShowTelegramModal] = useState(false);
    const [telegramForm, setTelegramForm] = useState({ botToken: '', chatId: '', accountName: '' });
    const [savingTelegram, setSavingTelegram] = useState(false);

    // Facebook page selection
    const [showFbPageModal, setShowFbPageModal] = useState(false);
    const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
    const [selectedFbPages, setSelectedFbPages] = useState<Set<string>>(new Set());
    const [savingFbPages, setSavingFbPages] = useState(false);

    // Zalo OA
    const [showZaloModal, setShowZaloModal] = useState(false);
    const [zaloOAInfo, setZaloOAInfo] = useState<ZaloOAInfo | null>(null);
    const [savingZalo, setSavingZalo] = useState(false);

    // Twitter
    const [showTwitterModal, setShowTwitterModal] = useState(false);
    const [twitterInfo, setTwitterInfo] = useState<TwitterAccountInfo | null>(null);
    const [savingTwitter, setSavingTwitter] = useState(false);

    // LinkedIn
    const [showLinkedInModal, setShowLinkedInModal] = useState(false);
    const [linkedInInfo, setLinkedInInfo] = useState<LinkedInAccountInfo | null>(null);
    const [savingLinkedIn, setSavingLinkedIn] = useState(false);

    // Threads manual
    const [showThreadsModal, setShowThreadsModal] = useState(false);
    const [threadsForm, setThreadsForm] = useState({ accessToken: '' });
    const [savingThreads, setSavingThreads] = useState(false);

    // TikTok
    const [showTikTokModal, setShowTikTokModal] = useState(false);
    const [tiktokInfo, setTiktokInfo] = useState<TikTokAccountInfo | null>(null);
    const [savingTikTok, setSavingTikTok] = useState(false);

    // Guide modal
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [guidePlatformId, setGuidePlatformId] = useState<string | undefined>(undefined);

    const openGuide = (platformId?: string) => {
        setGuidePlatformId(platformId);
        setShowGuideModal(true);
    };

    // ── Data fetching ──
    const fetchAccounts = useCallback(() => {
        setLoading(true);
        api.get('/socialaccounts')
            .then(res => {
                setAccounts(res.data || []);
                window.dispatchEvent(new CustomEvent('social_accounts_updated'));
            })
            .catch(() => toast.error('Không thể tải danh sách kết nối.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    // ── Listen for OAuth popup messages ──
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type !== 'SOCIAL_AUTH_CALLBACK') return;

            const platform = event.data.platform || 'facebook';

            if (event.data.success && event.data.data) {
                if (platform === 'facebook') {
                    // Facebook returns a list of pages
                    setFbPages(event.data.data);
                    setShowFbPageModal(true);
                    setSelectedFbPages(new Set());
                } else if (platform === 'zalo') {
                    // Zalo returned OA info
                    const oaList: ZaloOAInfo[] = event.data.data;
                    if (oaList.length > 0) {
                        setZaloOAInfo(oaList[0]);
                        setShowZaloModal(true);
                    }
                } else if (platform === 'twitter') {
                    // Twitter returned user info
                    const twList: TwitterAccountInfo[] = event.data.data;
                    if (twList.length > 0) {
                        setTwitterInfo(twList[0]);
                        setShowTwitterModal(true);
                    }
                } else if (platform === 'instagram') {
                    const data = event.data.data;
                    api.post('/social/connect/instagram', {
                        AccountName: data.name,
                        AccountIdentifier: data.id,
                        AccessToken: data.token,
                        AvatarUrl: data.avatar
                    })
                    .then(() => {
                        toast.success('Kết nối Instagram thành công!');
                        fetchAccounts();
                    })
                    .catch(() => toast.error('Lỗi khi lưu tài khoản Instagram.'));
                } else if (platform === 'threads') {
                    const data = event.data.data;
                    api.post('/social/connect/threads', {
                        AccountName: data.name,
                        AccountIdentifier: data.id,
                        AccessToken: data.token,
                        AvatarUrl: data.avatar
                    })
                    .then(() => {
                        toast.success('Kết nối Threads thành công!');
                        fetchAccounts();
                    })
                    .catch(() => toast.error('Lỗi khi lưu tài khoản Threads.'));
                } else if (platform === 'linkedin') {
                    // LinkedIn returned user info
                    const liList: LinkedInAccountInfo[] = event.data.data;
                    if (liList.length > 0) {
                        setLinkedInInfo(liList[0]);
                        setShowLinkedInModal(true);
                    }
                } else if (platform === 'tiktok') {
                    // TikTok: server đã lưu trực tiếp vào DB, chỉ cần refresh
                    toast.success('Kết nối TikTok thành công!');
                    fetchAccounts();
                } else {
                    // Facebook returned page list — show page picker
                    const pages: FacebookPage[] = event.data.data;
                    setFbPages(pages);
                    setSelectedFbPages(new Set(pages.map(p => p.pageId)));
                    setShowFbPageModal(true);
                }
            } else if (!event.data.success) {
                toast.error(event.data.message || 'Kết nối thất bại.');
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    // ── Connect handlers ──
    const connectFacebook = async () => {
        try {
            const res = await api.get('/social/auth/facebook');
            const { url } = res.data;
            // Open popup
            const w = 600, h = 700;
            const left = window.screenX + (window.outerWidth - w) / 2;
            const top = window.screenY + (window.outerHeight - h) / 2;
            window.open(url, 'fb_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);
        } catch {
            toast.error('Không thể khởi tạo kết nối Facebook.');
        }
    };

    const saveFacebookPages = async () => {
        const pages = fbPages.filter(p => selectedFbPages.has(p.pageId));
        if (!pages.length) { toast.error('Chọn ít nhất 1 trang.'); return; }

        setSavingFbPages(true);
        try {
            await api.post('/social/connect/facebook', { pages });
            toast.success(`Đã kết nối ${pages.length} trang Facebook!`);
            setShowFbPageModal(false);
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi kết nối Facebook.');
        } finally {
            setSavingFbPages(false);
        }
    };

    const connectZalo = async () => {
        try {
            const res = await api.get('/social/auth/zalo');
            const { url } = res.data;
            const w = 600, h = 700;
            const left = window.screenX + (window.outerWidth - w) / 2;
            const top = window.screenY + (window.outerHeight - h) / 2;
            window.open(url, 'zalo_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);
        } catch {
            toast.error('Không thể khởi tạo kết nối Zalo.');
        }
    };

    const saveZaloOA = async () => {
        if (!zaloOAInfo) return;
        setSavingZalo(true);
        try {
            await api.post('/social/connect/zalo', zaloOAInfo);
            toast.success('Kết nối Zalo OA thành công!');
            setShowZaloModal(false);
            setZaloOAInfo(null);
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi kết nối Zalo.');
        } finally {
            setSavingZalo(false);
        }
    };

    const connectTwitter = async () => {
        try {
            const res = await api.get('/social/auth/twitter');
            const { url } = res.data;
            const w = 600, h = 700;
            const left = window.screenX + (window.outerWidth - w) / 2;
            const top = window.screenY + (window.outerHeight - h) / 2;
            window.open(url, 'twitter_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);
        } catch {
            toast.error('Không thể khởi tạo kết nối Twitter.');
        }
    };

    const saveTwitterAccount = async () => {
        if (!twitterInfo) return;
        setSavingTwitter(true);
        try {
            await api.post('/social/connect/twitter', twitterInfo);
            toast.success('Kết nối Twitter thành công!');
            setShowTwitterModal(false);
            setTwitterInfo(null);
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi kết nối Twitter.');
        } finally {
            setSavingTwitter(false);
        }
    };

    const connectBlogger = async () => {
        try {
            const res = await api.get('/social/auth/blogger');
            const { url } = res.data;
            const w = 600, h = 700;
            const left = window.screenX + (window.outerWidth - w) / 2;
            const top = window.screenY + (window.outerHeight - h) / 2;
            window.open(url, 'blogger_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);
        } catch {
            toast.error('Không thể khởi tạo kết nối Blogger.');
        }
    };

    const connectInstagram = async () => {
        try {
            const res = await api.get('/social/auth/instagram');
            const { url } = res.data;
            const w = 600, h = 700;
            const left = window.screenX + (window.outerWidth - w) / 2;
            const top = window.screenY + (window.outerHeight - h) / 2;
            window.open(url, 'instagram_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);
        } catch {
            toast.error('Không thể khởi tạo kết nối Instagram.');
        }
    };

    const connectThreads = async () => {
        setShowThreadsModal(true);
    };

    const submitThreadsToken = async () => {
        if (!threadsForm.accessToken.trim()) {
            toast.error('Vui lòng nhập Access Token.');
            return;
        }
        setSavingThreads(true);
        try {
            const res = await api.post('/social/connect/threads-manual', {
                accessToken: threadsForm.accessToken.trim()
            });
            toast.success(res.data.message || 'Kết nối Threads thành công!');
            setShowThreadsModal(false);
            setThreadsForm({ accessToken: '' });
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi kết nối Threads.');
        } finally {
            setSavingThreads(false);
        }
    };

    const connectTelegram = async () => {
        setSavingTelegram(true);
        try {
            await api.post('/social/connect/telegram', telegramForm);
            toast.success('Kết nối Telegram thành công!');
            setShowTelegramModal(false);
            setTelegramForm({ botToken: '', chatId: '', accountName: '' });
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi kết nối Telegram.');
        } finally {
            setSavingTelegram(false);
        }
    };

    const connectLinkedIn = async () => {
        try {
            const res = await api.get('/social/auth/linkedin');
            const { url } = res.data;
            const w = 600, h = 700;
            const left = window.screenX + (window.outerWidth - w) / 2;
            const top = window.screenY + (window.outerHeight - h) / 2;
            window.open(url, 'linkedin_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);
        } catch {
            toast.error('Không thể khởi tạo kết nối LinkedIn.');
        }
    };

    const saveLinkedInAccount = async () => {
        if (!linkedInInfo) return;
        setSavingLinkedIn(true);
        try {
            await api.post('/social/connect/linkedin', linkedInInfo);
            toast.success('Kết nối LinkedIn thành công!');
            setShowLinkedInModal(false);
            setLinkedInInfo(null);
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi kết nối LinkedIn.');
        } finally {
            setSavingLinkedIn(false);
        }
    };

    const connectTikTok = async () => {
        try {
            const res = await api.get('/social/auth/tiktok');
            const { url } = res.data;
            const w = 600, h = 700;
            const left = window.screenX + (window.outerWidth - w) / 2;
            const top = window.screenY + (window.outerHeight - h) / 2;
            window.open(url, 'tiktok_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);
        } catch {
            toast.error('Không thể khởi tạo kết nối TikTok.');
        }
    };

    const saveTikTokAccount = async () => {
        if (!tiktokInfo) return;
        setSavingTikTok(true);
        try {
            await api.post('/social/connect/tiktok', tiktokInfo);
            toast.success('Kết nối TikTok thành công!');
            setShowTikTokModal(false);
            setTiktokInfo(null);
            fetchAccounts();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi kết nối TikTok.');
        } finally {
            setSavingTikTok(false);
        }
    };

    // ── Manual form (Website/WordPress) ──
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const openManualCreate = (platformValue: number) => {
        setEditingId(null);
        setForm({ ...emptyForm, platform: platformValue });
        setShowManualForm(true);
    };

    const openEdit = (account: SocialAccount) => {
        setEditingId(account.id);
        setForm({
            platform: account.platform,
            accountName: account.accountName || '',
            accountIdentifier: account.accountIdentifier || '',
            apiBaseUrl: account.apiBaseUrl || '',
            apiPostEndpoint: account.apiPostEndpoint || '',
            apiMethod: account.apiMethod || 'POST',
            authType: account.authType || 0,
            apiKey: account.apiKey || '',
            apiSecret: account.apiSecret || '',
            accessToken: account.accessToken || '',
            refreshToken: account.refreshToken || '',
            customHeadersJson: account.customHeadersJson || '',
            fieldMappingJson: account.fieldMappingJson || '',
            isActive: account.isActive,
        });
        setShowManualForm(true);
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, authType: Number(form.authType), platform: Number(form.platform) };
            if (editingId) {
                await api.put(`/socialaccounts/${editingId}`, { id: editingId, ...payload });
                toast.success('Cập nhật tài khoản thành công!');
            } else {
                await api.post('/socialaccounts', payload);
                toast.success('Thêm tài khoản thành công!');
            }
            fetchAccounts();
            setTimeout(() => setShowManualForm(false), 800);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi khi lưu.');
        } finally {
            setSaving(false);
        }
    };

    // ── Disconnect ──
    const openDeleteModal = (id: string) => { setAccountToDelete(id); setDeleteModalOpen(true); };
    const confirmDelete = async () => {
        if (!accountToDelete) return;
        setDeletingId(accountToDelete);
        try {
            await api.delete(`/social/disconnect/${accountToDelete}`);
            toast.success('Đã ngắt kết nối.');
            fetchAccounts();
        } catch {
            toast.error('Không thể ngắt kết nối.');
        } finally {
            setDeletingId(null); setDeleteModalOpen(false); setAccountToDelete(null);
        }
    };

    const getPlatformDef = (value: number) => platformDefs.find(p => p.value === value);

    // Check token expiry
    const isTokenExpired = (account: SocialAccount) => {
        if (!account.tokenExpiredAtUtc) return false;
        return new Date(account.tokenExpiredAtUtc) < new Date();
    };

    // ════════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════════
    
    // Handle hash scrolling
    useEffect(() => {
        if (!loading) {
            const hash = window.location.hash;
            if (hash) {
                setTimeout(() => {
                    const el = document.querySelector(hash);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            }
        }
    }, [loading, window.location.hash]);
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    const connectedAccounts = accounts;
    const connectedPlatformCounts: Record<number, number> = {};
    connectedAccounts.forEach(a => {
        connectedPlatformCounts[a.platform] = (connectedPlatformCounts[a.platform] || 0) + 1;
    });

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300 space-y-8">
            <ConfirmModal
                isOpen={deleteModalOpen}
                title="Ngắt kết nối"
                message="Bạn có chắc muốn ngắt kết nối tài khoản này? Các bài viết đã lên lịch cho tài khoản này sẽ không thể đăng."
                confirmText="Ngắt kết nối"
                isConfirming={deletingId !== null}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModalOpen(false)}
            />

            <PlatformGuideModal
                isOpen={showGuideModal}
                onClose={() => setShowGuideModal(false)}
                initialPlatformId={guidePlatformId}
            />

            {/* ═══════════════ SECTION 1: Kết nối nền tảng ═══════════════ */}
            <section id="connect" className="scroll-mt-24">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-200">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Kết nối nền tảng</h2>
                            <p className="text-sm text-gray-500">Chọn nền tảng bạn muốn tự động đăng bài.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => openGuide()}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 hover:border-violet-300 hover:shadow-md hover:shadow-violet-100/50 transition-all duration-200"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span className="hidden sm:inline">Hướng dẫn thiết lập</span>
                        <span className="sm:hidden">Hướng dẫn</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {platformDefs.map(platform => {
                        const count = connectedPlatformCounts[platform.value] || 0;
                        const isComingSoon = platform.connectType === 'coming_soon';

                        return (
                            <div
                                key={platform.id}
                                className={`relative bg-white rounded-2xl border overflow-hidden transition-all duration-200 ${isComingSoon ? 'opacity-60 border-gray-100' : `hover:shadow-lg hover:-translate-y-0.5 ${platform.borderColor}`
                                    }`}
                            >
                                {/* Gradient header bar */}
                                <div className={`h-1.5 bg-gradient-to-r ${platform.color}`} />

                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl ${platform.bgLight} ${platform.textColor}`}>
                                            {platform.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900">{platform.label}</h3>
                                                {count > 0 && (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                                        {count} kết nối
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{platform.desc}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={() => openGuide(platform.id)}
                                            className="px-3 py-2.5 text-gray-400 hover:text-violet-600 bg-gray-50 hover:bg-violet-50 rounded-xl transition-all border border-gray-100 hover:border-violet-200"
                                            title="Xem hướng dẫn"
                                        >
                                            <BookOpen className="w-4 h-4" />
                                        </button>
                                        <div className="flex-1">
                                            {isComingSoon ? (
                                                <button disabled className="w-full px-4 py-2.5 text-sm font-medium text-gray-400 bg-gray-100 rounded-xl cursor-not-allowed">
                                                    Sắp ra mắt
                                                </button>
                                            ) : platform.connectType === 'oauth' ? (
                                                <button
                                                    onClick={connectFacebook}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'oauth_zalo' ? (
                                                <button
                                                    onClick={connectZalo}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'oauth_twitter' ? (
                                                <button
                                                    onClick={connectTwitter}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'oauth_linkedin' ? (
                                                <button
                                                    onClick={connectLinkedIn}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'oauth_blogger' ? (
                                                <button
                                                    onClick={connectBlogger}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'oauth_threads' ? (
                                                <button
                                                    onClick={connectThreads}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'oauth_instagram' ? (
                                                <button
                                                    onClick={connectInstagram}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'oauth_tiktok' ? (
                                                <button
                                                    onClick={connectTikTok}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Wifi className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : platform.connectType === 'bot_token' ? (
                                                <button
                                                    onClick={() => setShowTelegramModal(true)}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r ${platform.color} rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Send className="w-4 h-4" />
                                                    {count > 0 ? 'Kết nối thêm' : 'Kết nối'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => openManualCreate(platform.value)}
                                                    className={`w-full px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2`}
                                                >
                                                    <Settings2 className="w-4 h-4" />
                                                    Cấu hình thủ công
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {isComingSoon && (
                                    <div className="absolute top-4 right-4">
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                            Soon
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ═══════════════ SECTION 2: Tài khoản đã kết nối ═══════════════ */}
            <section id="accounts" className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                        <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Tài khoản đã kết nối</h2>
                        <p className="text-sm text-gray-500">
                            {connectedAccounts.length > 0
                                ? `${connectedAccounts.length} tài khoản đang hoạt động`
                                : 'Chưa kết nối tài khoản nào'}
                        </p>
                    </div>
                </div>

                {connectedAccounts.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                            <WifiOff className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-1">Chưa có kết nối nào</h3>
                        <p className="text-sm text-gray-500">Kết nối tài khoản mạng xã hội ở phần trên để bắt đầu.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(
                            connectedAccounts.reduce((acc, account) => {
                                if (!acc[account.platform]) acc[account.platform] = [];
                                acc[account.platform].push(account);
                                return acc;
                            }, {} as Record<number, SocialAccount[]>)
                        ).map(([platformIdStr, accountsGroup]) => {
                            const platformId = Number(platformIdStr);
                            const platformDef = getPlatformDef(platformId);

                            return (
                                <div key={platformIdStr} className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                        <div className={`w-5 h-5 ${platformDef?.textColor || 'text-gray-500'}`}>
                                            {platformDef?.icon || <Globe />}
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-700">
                                            {platformDef?.label || 'Nền tảng khác'}
                                        </h3>
                                        <span className="bg-gray-100 text-gray-500 py-0.5 px-2.5 rounded-full text-xs font-semibold ml-2">
                                            {accountsGroup.length}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        {accountsGroup.map(account => {
                                            const expired = isTokenExpired(account);

                                            return (
                                                <div key={account.id}
                                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-4 flex items-center gap-4"
                                                >
                                                    {/* Platform icon / Avatar */}
                                                    {account.avatarUrl ? (
                                                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm relative ring-1 ring-gray-100">
                                                            <img src={account.avatarUrl} alt={account.accountName} className="w-full h-full object-cover" />
                                                            <div className="absolute top-0 right-0 p-0.5 bg-white/90 rounded-bl-lg">
                                                                <div className="w-3.5 h-3.5 text-blue-600">{platformDef?.icon || <Globe />}</div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className={`p-3 rounded-xl ${platformDef?.bgLight || 'bg-gray-100'} ${platformDef?.textColor || 'text-gray-600'} shrink-0`}>
                                                            {platformDef?.icon || <Globe className="w-6 h-6" />}
                                                        </div>
                                                    )}

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-bold text-gray-900 text-sm truncate">{account.accountName}</h4>
                                                            <span className={`shrink-0 px-2 py-[2px] rounded border text-[10px] font-bold uppercase tracking-wider ${account.isActive
                                                                    ? expired
                                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                        : 'bg-green-50 text-green-700 border-green-200'
                                                                    : 'bg-gray-50 text-gray-500 border-gray-200'
                                                                }`}>
                                                                {account.isActive ? (expired ? 'Hết hạn' : 'Đang chạy') : 'Tạm dừng'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                                                            {account.accountIdentifier ? (
                                                                <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={account.accountIdentifier}>
                                                                    {account.accountIdentifier}
                                                                </span>
                                                            ) : null}
                                                            {account.accountIdentifier && <span>•</span>}
                                                            <span title={new Date(account.createdAtUtc).toLocaleString('vi-VN')}>
                                                                {new Date(account.createdAtUtc).toLocaleDateString('vi-VN')}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-gray-100">
                                                        {(account.platform === 0 || account.platform === 7 || account.platform === 10 || account.platform === 11) && (
                                                            <button
                                                                onClick={() => openEdit(account)}
                                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Chỉnh sửa cấu hình"
                                                            >
                                                                <Settings2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {(account.platform === 1 || account.platform === 3 || account.platform === 9) && (
                                                            <button
                                                                onClick={() => navigate(`/platforms/${account.id}/manage`)}
                                                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Quản lý bài viết và tin nhắn"
                                                            >
                                                                <MessageCircle className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openDeleteModal(account.id)}
                                                            disabled={deletingId === account.id}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Ngắt kết nối tài khoản này"
                                                        >
                                                            <Unplug className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ═══════════════ MODAL: Facebook Page Picker ═══════════════ */}
            {showFbPageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFbPageModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg m-4" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-gray-900">Chọn Fanpage</h2>
                                <p className="text-xs text-gray-500">Chọn các trang bạn muốn kết nối</p>
                            </div>
                            <button onClick={() => setShowFbPageModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
                            {fbPages.map(page => (
                                <label key={page.pageId}
                                    className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedFbPages.has(page.pageId)
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-100 hover:border-gray-200'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFbPages.has(page.pageId)}
                                        onChange={() => {
                                            const next = new Set(selectedFbPages);
                                            next.has(page.pageId) ? next.delete(page.pageId) : next.add(page.pageId);
                                            setSelectedFbPages(next);
                                        }}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedFbPages.has(page.pageId) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                        }`}>
                                        {selectedFbPages.has(page.pageId) && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    {page.pictureUrl && (
                                        <img src={page.pictureUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-gray-900 truncate">{page.pageName}</p>
                                        <p className="text-xs text-gray-400 font-mono">{page.pageId}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-sm text-gray-500">{selectedFbPages.size} trang được chọn</span>
                            <div className="flex gap-3">
                                <button onClick={() => setShowFbPageModal(false)}
                                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                                    Hủy
                                </button>
                                <button onClick={saveFacebookPages} disabled={savingFbPages || selectedFbPages.size === 0}
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                    {savingFbPages && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Kết nối {selectedFbPages.size} trang
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ MODAL: Zalo OA ═══════════════ */}
            {showZaloModal && zaloOAInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowZaloModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                <svg viewBox="0 0 48 48" className="w-5 h-5" fill="none">
                                    <path fill="#0068FF" d="M24 0C10.745 0 0 10.745 0 24s10.745 24 24 24 24-10.745 24-24S37.255 0 24 0z" />
                                    <path fill="#FFFFFF" d="M29.09 34.5H18.91c-1.09 0-1.91-.91-1.91-2v-1.09c0-.545.182-1.09.545-1.454L27.273 18.5H19.09c-1.09 0-2-.91-2-2v-.91c0-1.09.91-2 2-2h10c1.09 0 2 .91 2 2v1.09c0 .545-.182 1.09-.545 1.454L20.727 29.5h8.364c1.09 0 2 .91 2 2v.91c0 1.09-.91 2.09-2 2.09z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-gray-900">Kết nối Zalo OA</h2>
                                <p className="text-xs text-gray-500">Xác nhận kết nối Official Account</p>
                            </div>
                            <button onClick={() => setShowZaloModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-500 bg-blue-50">
                                {zaloOAInfo.avatarUrl ? (
                                    <img src={zaloOAInfo.avatarUrl} alt={zaloOAInfo.oaName} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                        <svg viewBox="0 0 48 48" className="w-8 h-8" fill="currentColor">
                                            <path d="M24 0C10.745 0 0 10.745 0 24s10.745 24 24 24 24-10.745 24-24S37.255 0 24 0zm5.09 34.5H18.91c-1.09 0-1.91-.91-1.91-2v-1.09c0-.545.182-1.09.545-1.454L27.273 18.5H19.09c-1.09 0-2-.91-2-2v-.91c0-1.09.91-2 2-2h10c1.09 0 2 .91 2 2v1.09c0 .545-.182 1.09-.545 1.454L20.727 29.5h8.364c1.09 0 2 .91 2 2v.91c0 1.09-.91 2.09-2 2.09z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{zaloOAInfo.oaName}</p>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">OA ID: {zaloOAInfo.oaId}</p>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-green-50 rounded-xl text-xs text-green-700">
                                <strong>✓ Xác thực thành công!</strong> Nhấn "Kết nối" để lưu Official Account này vào hệ thống.
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowZaloModal(false)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                                Hủy
                            </button>
                            <button onClick={saveZaloOA} disabled={savingZalo}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl hover:shadow-md disabled:opacity-50 flex items-center gap-2">
                                {savingZalo && <Loader2 className="w-4 h-4 animate-spin" />}
                                Kết nối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ MODAL: Twitter/X ═══════════════ */}
            {showTwitterModal && twitterInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTwitterModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-gray-900 rounded-xl text-white">
                                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-gray-900">Kết nối Twitter/X</h2>
                                <p className="text-xs text-gray-500">Xác nhận kết nối tài khoản</p>
                            </div>
                            <button onClick={() => setShowTwitterModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-900 bg-gray-50">
                                {twitterInfo.avatarUrl ? (
                                    <img src={twitterInfo.avatarUrl} alt={twitterInfo.accountName} className="w-14 h-14 rounded-full object-cover shadow-sm" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                                        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{twitterInfo.accountName}</p>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {twitterInfo.accountId}</p>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-green-50 rounded-xl text-xs text-green-700">
                                <strong>✓ Xác thực thành công!</strong> Nhấn "Kết nối" để lưu tài khoản Twitter/X này vào hệ thống.
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowTwitterModal(false)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                                Hủy
                            </button>
                            <button onClick={saveTwitterAccount} disabled={savingTwitter}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:shadow-md disabled:opacity-50 flex items-center gap-2">
                                {savingTwitter && <Loader2 className="w-4 h-4 animate-spin" />}
                                Kết nối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ MODAL: LinkedIn ═══════════════ */}
            {showLinkedInModal && linkedInInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLinkedInModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-700">
                                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-gray-900">Kết nối LinkedIn</h2>
                                <p className="text-xs text-gray-500">Xác nhận kết nối tài khoản</p>
                            </div>
                            <button onClick={() => setShowLinkedInModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-600 bg-blue-50">
                                {linkedInInfo.avatarUrl ? (
                                    <img src={linkedInInfo.avatarUrl} alt={linkedInInfo.accountName} className="w-14 h-14 rounded-full object-cover shadow-sm" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                                        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
                                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{linkedInInfo.accountName}</p>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {linkedInInfo.accountId}</p>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-green-50 rounded-xl text-xs text-green-700">
                                <strong>✓ Xác thực thành công!</strong> Nhấn "Kết nối" để lưu tài khoản LinkedIn này vào hệ thống.
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowLinkedInModal(false)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                                Hủy
                            </button>
                            <button onClick={saveLinkedInAccount} disabled={savingLinkedIn}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl hover:shadow-md disabled:opacity-50 flex items-center gap-2">
                                {savingLinkedIn && <Loader2 className="w-4 h-4 animate-spin" />}
                                Kết nối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ MODAL: Telegram Bot ═══════════════ */}
            {showTelegramModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTelegramModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-cyan-50 rounded-xl text-cyan-600">
                                <Send className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-gray-900">Kết nối Telegram</h2>
                                <p className="text-xs text-gray-500">Nhập Bot Token và Chat ID</p>
                            </div>
                            <button onClick={() => setShowTelegramModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="p-3 bg-cyan-50 rounded-xl text-xs text-cyan-700 leading-relaxed">
                                <strong>Hướng dẫn:</strong>
                                <ol className="mt-1.5 ml-4 list-decimal space-y-1">
                                    <li>Tạo Bot mới tại <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="underline">@BotFather</a></li>
                                    <li>Copy Bot Token (dạng: <code className="bg-cyan-100 px-1 rounded">123456:ABC-DEF...</code>)</li>
                                    <li>Thêm Bot vào Channel/Group, lấy Chat ID</li>
                                </ol>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên hiển thị</label>
                                <input
                                    type="text" placeholder="VD: Channel Tin Tức"
                                    value={telegramForm.accountName}
                                    onChange={e => setTelegramForm(prev => ({ ...prev, accountName: e.target.value }))}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bot Token <span className="text-red-500">*</span></label>
                                <input
                                    type="password" placeholder="123456789:ABCdef..."
                                    value={telegramForm.botToken}
                                    onChange={e => setTelegramForm(prev => ({ ...prev, botToken: e.target.value }))}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chat ID <span className="text-red-500">*</span></label>
                                <input
                                    type="text" placeholder="-100123456789 hoặc @channel_name"
                                    value={telegramForm.chatId}
                                    onChange={e => setTelegramForm(prev => ({ ...prev, chatId: e.target.value }))}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowTelegramModal(false)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                                Hủy
                            </button>
                            <button onClick={connectTelegram}
                                disabled={savingTelegram || !telegramForm.botToken || !telegramForm.chatId}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl hover:shadow-md disabled:opacity-50 flex items-center gap-2">
                                {savingTelegram && <Loader2 className="w-4 h-4 animate-spin" />}
                                Kết nối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ MODAL: Manual API Config (Website/WordPress) ═══════════════ */}
            {showManualForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowManualForm(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingId ? 'Chỉnh sửa cấu hình' : 'Cấu hình API thủ công'}
                            </h2>
                            <button onClick={() => setShowManualForm(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleManualSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nền tảng <span className="text-red-500">*</span></label>
                                    <select name="platform" value={form.platform} onChange={handleChange}
                                        className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors">
                                        {platformDefs.filter(p => p.connectType === 'manual').map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên tài khoản <span className="text-red-500">*</span></label>
                                    <input name="accountName" type="text" required value={form.accountName} onChange={handleChange}
                                        placeholder="VD: Blog công ty"
                                        className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">ID/Username</label>
                                <input name="accountIdentifier" type="text" value={form.accountIdentifier} onChange={handleChange}
                                    placeholder="VD: site_id, channel_name..."
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
                            </div>

                            <fieldset className="space-y-4 border border-gray-200 rounded-xl p-4">
                                <legend className="text-sm font-semibold text-gray-700 px-2">⚙️ Cấu hình API</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">API Base URL</label>
                                        <input name="apiBaseUrl" type="text" value={form.apiBaseUrl} onChange={handleChange}
                                            placeholder="https://api.example.com"
                                            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Post Endpoint</label>
                                        <input name="apiPostEndpoint" type="text" value={form.apiPostEndpoint} onChange={handleChange}
                                            placeholder="/wp-json/wp/v2/posts"
                                            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">HTTP Method</label>
                                        <select name="apiMethod" value={form.apiMethod} onChange={handleChange}
                                            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors">
                                            <option value="POST">POST</option>
                                            <option value="PUT">PUT</option>
                                            <option value="PATCH">PATCH</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Loại xác thực</label>
                                        <select name="authType" value={form.authType} onChange={handleChange}
                                            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors">
                                            {authTypeOptions.map(a => (
                                                <option key={a.value} value={a.value}>{a.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset className="space-y-4 border border-gray-200 rounded-xl p-4">
                                <legend className="text-sm font-semibold text-gray-700 px-2">🔑 Xác thực</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                                        <input name="apiKey" type="password" value={form.apiKey} onChange={handleChange}
                                            placeholder="••••••••"
                                            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">API Secret</label>
                                        <input name="apiSecret" type="password" value={form.apiSecret} onChange={handleChange}
                                            placeholder="••••••••"
                                            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Access Token</label>
                                    <input name="accessToken" type="password" value={form.accessToken} onChange={handleChange}
                                        placeholder="••••••••"
                                        className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
                                </div>
                            </fieldset>

                            <fieldset className="space-y-4 border border-gray-200 rounded-xl p-4">
                                <legend className="text-sm font-semibold text-gray-700 px-2">🔧 Nâng cao</legend>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Custom Headers (JSON)</label>
                                    <textarea name="customHeadersJson" rows={2} value={form.customHeadersJson} onChange={handleChange}
                                        placeholder='{"X-Custom-Header": "value"}'
                                        className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Field Mapping (JSON)</label>
                                    <textarea name="fieldMappingJson" rows={2} value={form.fieldMappingJson} onChange={handleChange}
                                        placeholder='{"title": "post_title", "content": "post_content"}'
                                        className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors resize-none" />
                                </div>
                            </fieldset>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
                                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform"></div>
                                </div>
                                <span className="text-sm font-medium text-gray-700">Kích hoạt tài khoản</span>
                            </label>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowManualForm(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                                    Hủy
                                </button>
                                <button type="submit" disabled={saving}
                                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm tài khoản')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ═══════════════ THREADS MANUAL MODAL ═══════════════ */}
            {showThreadsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-gray-900 to-black rounded-xl text-white">
                                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                                    <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Kết nối Threads</h3>
                                <p className="text-xs text-gray-500">Nhập Access Token từ Meta Developer Dashboard</p>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                            <p className="font-semibold">📋 Hướng dẫn lấy Access Token:</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs">
                                <li>Vào <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="underline font-medium">Graph API Explorer</a></li>
                                <li>Chọn App <strong>Xpost</strong> ở dropdown</li>
                                <li>Bấm <strong>Generate Access Token</strong></li>
                                <li>Chọn quyền: <code className="bg-blue-100 px-1 rounded">threads_basic</code>, <code className="bg-blue-100 px-1 rounded">threads_content_publish</code></li>
                                <li>Copy token và dán vào ô bên dưới</li>
                            </ol>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Access Token</label>
                            <textarea
                                value={threadsForm.accessToken}
                                onChange={(e) => setThreadsForm({ accessToken: e.target.value })}
                                placeholder="Dán Access Token từ Meta vào đây..."
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-gray-900 text-sm font-mono transition-all resize-none"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => { setShowThreadsModal(false); setThreadsForm({ accessToken: '' }); }}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={submitThreadsToken}
                                disabled={savingThreads || !threadsForm.accessToken.trim()}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-gray-900 to-black rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {savingThreads && <Loader2 className="w-4 h-4 animate-spin" />}
                                {savingThreads ? 'Đang kết nối...' : 'Kết nối Threads'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
