import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../lib/axios';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/common/ConfirmModal';

import { formatDateTimeVN } from '../lib/dateUtils';

const resolveFileUrl = (url?: string | null) => {
    if (!url) return '';
    let resolved = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    if (resolved.includes('ngrok-free.dev') && !import.meta.env.PROD) {
        const localApi = window.location.hostname === 'local.xpost.com' 
            ? 'http://local-api.xpost.com:5243' 
            : 'http://localhost:5243';
        return resolved.replace(/^https:\/\/.*?\.ngrok-free\.dev/i, localApi);
    }
    return resolved;
};

interface PostTarget {
    socialAccountId: string;
    scheduledTimeUtc: string;
    status: number;
    platform: number;
    lastError?: string;
    publishedUrl?: string;
}

interface Post {
    id: string;
    title?: string;
    content: string;
    featuredImageUrl?: string;
    displayStartUtc?: string;
    displayEndUtc?: string;
    status: number;
    categoryId?: string;
    createdAtUtc: string;
    targets?: PostTarget[];
}

interface PagedResult<T> {
    items: T[];
    totalCount: number;
    totalPages: number;
    pageIndex: number;
    pageSize: number;
}

const STATUS_BADGE: Record<number, React.ReactElement> = {
    0: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Nháp</span>,
    1: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Chờ duyệt</span>,
    2: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">Đã xuất bản</span>,
    3: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">Ẩn</span>,
    4: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">Lỗi</span>,
};

const SOCIAL_PLATFORMS: Record<number, { name: string, icon: React.ReactElement }> = {
    0: {
        name: 'Website',
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
    },
    1: {
        name: 'Facebook',
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    },
    2: {
        name: 'Twitter/X',
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    },
    3: {
        name: 'Instagram',
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
    },
    4: {
        name: 'LinkedIn',
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    },
    7: {
        name: 'WordPress',
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.027-.78-.07-1.109zm-7.981.105c.647-.034 1.233-.1 1.233-.1.58-.068.512-.921-.068-.889 0 0-1.744.137-2.866.137-1.055 0-2.865-.137-2.865-.137-.58-.032-.648.856-.068.889 0 0 .552.066 1.133.1l1.682 4.615-2.364 7.088L6.841 6.93c.649-.034 1.233-.1 1.233-.1.581-.068.513-.921-.067-.889 0 0-1.745.137-2.866.137-.201 0-.44-.005-.697-.015C6.273 3.56 8.96 1.907 12 1.907c2.266 0 4.33.867 5.88 2.285-.038-.002-.075-.006-.114-.006-.888 0-1.517.774-1.517 1.604 0 .744.43 1.374.888 2.118.344.587.744 1.341.744 2.43 0 .753-.29 1.626-.674 2.843l-.882 2.95-3.19-9.489.003-.012zM12 22.094c-1.41 0-2.746-.29-3.959-.814l4.208-12.225 4.31 11.81c.028.07.056.092.084.162A10.043 10.043 0 0 1 12 22.094zM1.213 12c0-2.084.607-4.03 1.656-5.666L8.131 20.73C4.128 18.96 1.213 15.79 1.213 12zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/></svg>
    },
    8: {
        name: 'Telegram',
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.888-.662 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
    },
    9: {
        name: 'Zalo',
        icon: <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none"><path fill="#0068FF" d="M24 0C10.745 0 0 10.745 0 24s10.745 24 24 24 24-10.745 24-24S37.255 0 24 0z" /><path fill="#FFFFFF" d="M29.09 34.5H18.91c-1.09 0-1.91-.91-1.91-2v-1.09c0-.545.182-1.09.545-1.454L27.273 18.5H19.09c-1.09 0-2-.91-2-2v-.91c0-1.09.91-2 2-2h10c1.09 0 2 .91 2 2v1.09c0 .545-.182 1.09-.545 1.454L20.727 29.5h8.364c1.09 0 2 .91 2 2v.91c0 1.09-.91 2.09-2 2.09z" /></svg>
    },
    11: {
        name: 'Dev.to',
        icon: <svg viewBox="0 0 448 512" className="w-4 h-4" fill="currentColor"><path d="M120.12 208.29c-3.88-2.9-7.77-4.35-11.65-4.35H91.03v104.47h17.45c3.88 0 7.77-1.45 11.65-4.35 3.88-2.9 5.82-7.25 5.82-13.06v-69.65c-.01-5.8-1.96-10.16-5.83-13.06zM448 80v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V80c0-26.51 21.49-48 48-48h352c0 26.51 21.49 48 48 48zm-227.27 102.44c0-3.9-3.17-7.07-7.07-7.07H173.8c-3.9 0-7.07 3.17-7.07 7.07v147.11c0 3.9 3.17 7.07 7.07 7.07h40.41c3.9 0 7.07-3.17 7.07-7.07v-147.11zM158.37 128H48c-8.84 0-16 7.16-16 16v224c0 8.84 7.16 16 16 16h110.37c8.84 0 16-7.16 16-16V144c0-8.84-7.16-16-16-16zm241.63 48.44c0-3.9-3.17-7.07-7.07-7.07h-40.41c-3.9 0-7.07 3.17-7.07 7.07v147.11c0 3.9 3.17 7.07 7.07 7.07h40.41c3.9 0 7.07-3.17 7.07-7.07v-147.11z" /></svg>
    },
    12: {
        name: 'Blogger',
        icon: <svg viewBox="0 0 24 24" className="w-4 h-4 text-orange-500" fill="currentColor"><path d="M19.78 4H4.22A2.22 2.22 0 002 6.22v11.56A2.22 2.22 0 004.22 20h15.56A2.22 2.22 0 0022 17.78V6.22A2.22 2.22 0 0019.78 4zM16 16h-4a2 2 0 01-2-2v-4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2z" /></svg>
    },
    13: {
        name: 'Threads',
        icon: (
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-900" fill="currentColor">
                <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm0-22c-5.514 0-10 4.486-10 10s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.12 11.23c-.15 0-.3-.06-.41-.17l-1.92-1.92c-.22-.22-.22-.58 0-.8l1.92-1.92c.22-.22.58-.22.8 0 .22.22.22.58 0 .8l-1.52 1.52 1.52 1.52c.22.22.22.58 0 .8-.1.11-.25.17-.39.17zm-8.24 0c-.15 0-.3-.06-.41-.17-.22-.22-.22-.58 0-.8l1.52-1.52-1.52-1.52c-.22-.22-.22-.58 0-.8.22-.22.58-.22.8 0l1.92 1.92c.22.22.22.58 0 .8l-1.92 1.92c-.11.11-.26.17-.41.17z" />
            </svg>
        )
    }
};

const TARGET_STATUS_COLORS: Record<number, string> = {
    0: "text-gray-400 bg-gray-100", // Pending
    1: "text-blue-500 bg-blue-100", // Processing
    2: "text-green-500 bg-green-100", // Published
    3: "text-red-500 bg-red-100", // Failed
};

export default function PostList() {
    const [data, setData] = useState<PagedResult<Post> | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters & Pagination State
    const [filterKeyword, setFilterKeyword] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [pageIndex, setPageIndex] = useState(1);
    const pageSize = 10;

    // Modal states
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [postToDelete, setPostToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('pageIndex', pageIndex.toString());
            params.append('pageSize', pageSize.toString());
            if (filterKeyword) params.append('keyword', filterKeyword);
            if (filterStatus !== '') params.append('status', filterStatus);

            const res = await api.get(`/posts?${params.toString()}`);
            setData(res.data);
        } catch (error) {
            console.error('Failed to fetch posts', error);
        } finally {
            setLoading(false);
        }
    }, [pageIndex, pageSize, filterKeyword, filterStatus]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPageIndex(1);
        fetchPosts();
    };

    const navigate = useNavigate();

    const openDeleteModal = (postId: string) => {
        setPostToDelete(postId);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!postToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/posts/${postToDelete}`);
            toast.success('Xóa bài viết thành công.');
            fetchPosts();
        } catch (err) {
            console.error('Delete failed', err);
            toast.error('Xóa bài viết thất bại.');
        } finally {
            setIsDeleting(false);
            setDeleteModalOpen(false);
            setPostToDelete(null);
        }
    };

    return (
        <div className="space-y-6 w-full animate-in fade-in zoom-in-95 duration-300">
            <ConfirmModal
                isOpen={deleteModalOpen}
                title="Xác nhận xóa"
                message="Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác."
                confirmText="Xóa"
                isConfirming={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModalOpen(false)}
            />

            {/* Top Toolbar: Search & Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm kiếm tiêu đề hoặc nội dung..."
                            value={filterKeyword}
                            onChange={(e) => setFilterKeyword(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                        />
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl transition-colors border"
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="0">Nháp</option>
                        <option value="1">Chờ duyệt</option>
                        <option value="2">Đã xuất bản</option>
                        <option value="3">Ẩn</option>
                    </select>

                    <button
                        type="submit"
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        Lọc
                    </button>
                </form>

                <button
                    className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    onClick={() => navigate('/posts/create')}
                >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Tạo bài mới
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading && !data ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                    </div>
                ) : data?.items.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="mx-auto h-24 w-24 text-gray-200 mb-4 items-center justify-center flex bg-gray-50 rounded-full">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Không tìm thấy bài viết</h3>
                        <p className="mt-1 text-sm text-gray-500">Hãy thử thay đổi bộ lọc tìm kiếm của bạn.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Ảnh / Nội dung
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Thời gian
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Trạng thái & MXH
                                    </th>
                                    <th scope="col" className="relative px-6 py-4">
                                        <span className="sr-only">Hành động</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {data?.items.map((post) => (
                                    <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-14 w-14 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
                                                    {post.featuredImageUrl ? (
                                                        <img className="h-14 w-14 object-cover" src={resolveFileUrl(post.featuredImageUrl)} alt="" />
                                                    ) : (
                                                        <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="ml-4 max-w-xs md:max-w-md lg:max-w-lg">
                                                    <div className="text-sm font-semibold text-gray-900 truncate">{post.title || 'Không có tiêu đề'}</div>
                                                    <div className="text-sm text-gray-500 truncate mt-0.5">{post.content}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* Show CreatedAtUtc */}
                                            {post.createdAtUtc && (() => {
                                                const created = formatDateTimeVN(post.createdAtUtc);
                                                return created ? (
                                                    <div className={post.displayStartUtc ? "mb-2" : ""}>
                                                        <span className="text-xs font-medium text-gray-500">Ngày tạo:</span>
                                                        <div className="text-sm text-gray-900">{created.date} <span className="text-xs text-gray-500">{created.time}</span></div>
                                                    </div>
                                                ) : null;
                                            })()}

                                            {/* Show DisplayStartUtc (Lịch đăng) if available */}
                                            {post.displayStartUtc && (() => {
                                                const start = formatDateTimeVN(post.displayStartUtc);
                                                const end = post.displayEndUtc ? formatDateTimeVN(post.displayEndUtc) : null;
                                                return start ? (
                                                    <div className="pt-2 border-t border-gray-100">
                                                        <span className="text-xs font-medium text-blue-500">Lịch đăng:</span>
                                                        <div className="text-sm text-gray-900">{start.date} <span className="text-xs text-gray-500">{start.time}</span></div>
                                                        {end && (
                                                            <div className="text-xs text-gray-400 mt-0.5">→ {end.date} {end.time}</div>
                                                        )}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-3">
                                                <div>{STATUS_BADGE[post.status] || STATUS_BADGE[0]}</div>
                                                
                                                {/* Social targets rendering */}
                                                {post.targets && post.targets.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {post.targets.map((t, idx) => {
                                                            const pInfo = SOCIAL_PLATFORMS[t.platform];
                                                            const colorClass = TARGET_STATUS_COLORS[t.status] || "text-gray-400 bg-gray-100";
                                                            const isError = t.status === 3;
                                                            const isSuccess = t.status === 2;
                                                            
                                                            return (
                                                                <div 
                                                                    key={idx} 
                                                                    className={`relative group inline-flex items-center justify-center w-7 h-7 rounded-full cursor-help transition-transform hover:scale-110 ${colorClass}`}
                                                                >
                                                                    {pInfo ? pInfo.icon : <span className="text-xs">?</span>}
                                                                    
                                                                    {/* Tooltip */}
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs text-white bg-gray-900 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                                                                        <div className="font-semibold mb-0.5">{pInfo?.name || 'Mạng xã hội'}</div>
                                                                        {isError && <div className="text-red-300 max-w-[200px] whitespace-normal">Lỗi: {t.lastError}</div>}
                                                                        {isSuccess && <div>Đã đăng thành công</div>}
                                                                        {t.status === 0 && <div>Đang chờ đăng...</div>}
                                                                        {t.status === 1 && <div>Đang xử lý...</div>}
                                                                        {/* Arrow */}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => navigate(`/posts/edit/${post.id}`)} className="text-blue-600 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded-lg transition-colors">
                                                    Sửa
                                                </button>
                                                <button onClick={() => openDeleteModal(post.id)} className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                                    Xóa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-100 sm:px-6">
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Hiển thị trang <span className="font-semibold">{data.pageIndex}</span> / <span className="font-semibold">{data.totalPages}</span> (Tổng số {data.totalCount} bài)
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setPageIndex(p => Math.max(1, p - 1))}
                                        disabled={pageIndex === 1}
                                        className={`relative inline-flex items-center px-2 py-2 rounded-l-lg border ${pageIndex === 1 ? 'border-gray-100 bg-gray-50 text-gray-300' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'} text-sm font-medium`}
                                    >
                                        <span className="sr-only">Previous</span>
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </button>

                                    {[...Array(data.totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPageIndex(i + 1)}
                                            className={`relative inline-flex items-center px-4 py-2 border ${pageIndex === i + 1 ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} text-sm font-medium`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}

                                    <button
                                        onClick={() => setPageIndex(p => Math.min(data.totalPages, p + 1))}
                                        disabled={pageIndex === data.totalPages}
                                        className={`relative inline-flex items-center px-2 py-2 rounded-r-lg border ${pageIndex === data.totalPages ? 'border-gray-100 bg-gray-50 text-gray-300' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'} text-sm font-medium`}
                                    >
                                        <span className="sr-only">Next</span>
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
