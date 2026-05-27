import { useEffect, useState } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import StatCard from '../components/common/StatCard';
import type { StatBreakdown } from '../components/common/StatCard';

interface PostStats {
    totalAll: number;
    totalToday: number;
    totalThisWeek: number;
    totalThisMonth: number;
    today: StatBreakdown;
    thisWeek: StatBreakdown;
    thisMonth: StatBreakdown;
}

interface Post {
    id: string;
    content: string;
    displayStartUtc?: string;
    status: number;
    createdAtUtc: string;
}

const STATUS_BADGE: Record<number, React.ReactElement> = {
    0: <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">Chờ đăng</span>,
    1: <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">Đã đăng</span>,
    2: <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">Lỗi</span>,
};

export default function Dashboard() {
    const [stats, setStats] = useState<PostStats | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [content, setContent] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            const [statsRes, postsRes] = await Promise.all([
                api.get('/posts/stats'),
                api.get('/posts'),
            ]);
            setStats(statsRes.data);
            setPosts(postsRes.data.items || []);
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/posts', {
                content,
                scheduledTime: new Date(scheduledTime).toISOString(),
                platformAccountId: '00000000-0000-0000-0000-000000000000',
            });
            setContent('');
            setScheduledTime('');
            toast.success('Lên lịch bài đăng thành công!');
            fetchData();
        } catch (error) {
            console.error('Failed to create post', error);
            toast.error('Không thể tạo bài đăng. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full">
            {/* Heading */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
                <p className="text-sm text-gray-400 mt-1">Thống kê bài đăng theo thời gian</p>
            </div>

            {/* Grand total banner */}
            <div className="bg-gray-900 rounded-2xl p-8 text-white flex justify-between items-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-blue-500 opacity-10 blur-3xl"></div>
                <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Tổng tất cả bài đăng</p>
                    <p className="text-6xl font-semibold tracking-tight">{stats?.totalAll ?? 0}</p>
                </div>
                <div className="text-6xl opacity-20 select-none relative z-10">📝</div>
            </div>

            {/* Stat cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <StatCard title="Hôm nay" total={stats.totalToday} breakdown={stats.today} accent="border-blue-500" />
                    <StatCard title="Tuần này" total={stats.totalThisWeek} breakdown={stats.thisWeek} accent="border-purple-500" />
                    <StatCard title="Tháng này" total={stats.totalThisMonth} breakdown={stats.thisMonth} accent="border-green-500" />
                </div>
            )}

            {/* Main grid: form + list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Schedule form */}
                <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h3 className="text-base font-semibold text-gray-900 mb-5">Lên lịch bài mới</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nội dung</label>
                            <textarea required value={content} onChange={e => setContent(e.target.value)} rows={4}
                                className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all resize-none shadow-sm" placeholder="Nhập nội dung bài đăng..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Thời gian đăng</label>
                            <input type="datetime-local" required value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all shadow-sm" />
                        </div>
                        <button type="submit" disabled={isSubmitting}
                            className="w-full bg-gray-900 flex items-center justify-center gap-2 text-white font-medium py-2.5 px-4 rounded-xl hover:bg-black focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all text-sm mt-2 shadow-sm disabled:opacity-70">
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Lên lịch
                        </button>
                    </form>
                </div>

                {/* Post list */}
                <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-base font-semibold text-gray-900">Danh sách bài đăng</h3>
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{posts.length} bài đăng</span>
                    </div>
                    {posts.length === 0 ? (
                        <div className="text-center text-gray-400 py-12 border border-dashed border-gray-200 rounded-xl">
                            <div className="text-4xl mb-3">📝</div>
                            <p className="text-sm">Chưa có bài đăng nào được lên lịch.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {posts.map(post => (
                                <div key={post.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-gray-200 transition-all">
                                    <div className="flex justify-between items-start gap-4">
                                        <p className="text-gray-800 text-sm whitespace-pre-wrap flex-1">{post.content}</p>
                                        <div className="flex-shrink-0">{STATUS_BADGE[post.status]}</div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-400 mt-4">
                                        <span className="flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                            {post.displayStartUtc ? new Date(post.displayStartUtc).toLocaleString('vi-VN') : 'Ngay lập tức'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
