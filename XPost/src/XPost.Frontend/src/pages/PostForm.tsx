import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, ChevronDown, ArrowLeft, Save, Eye, FileText, Globe, Settings, Share2 } from 'lucide-react';
import FileUploader from '../components/common/FileUploader';
import MediaGallery from '../components/common/MediaGallery';
import TargetSelector from '../components/common/TargetSelector';
import RichTextEditor from '../components/common/RichTextEditor';

interface PostFormData {
    title: string;
    content: string;
    slug: string;
    description: string;
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
    featuredImageAlt: string;
    tags: string;
    featuredImageUrl: string;
    mediaJson: string;
    displayStartUtc: string;
    displayEndUtc: string;
    categoryId: string;
    postType: number;
    status: number;
    ref_ID: number | null;
}

import { toLocalDatetimeString, toUtcDatetimeString } from '../lib/dateUtils';

const emptyForm: PostFormData = {
    title: '',
    content: '',
    slug: '',
    description: '',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    featuredImageAlt: '',
    tags: '',
    featuredImageUrl: '',
    mediaJson: '',
    displayStartUtc: '',
    displayEndUtc: '',
    categoryId: '',
    postType: 0,
    status: 0,
    ref_ID: null,
};

const STATUS_OPTIONS = [
    { value: 0, label: 'Nháp', color: 'bg-yellow-400' },
    { value: 1, label: 'Chờ duyệt', color: 'bg-blue-400' },
    { value: 2, label: 'Đã xuất bản', color: 'bg-green-500' },
    { value: 3, label: 'Ẩn', color: 'bg-gray-400' },
];

interface CollapsibleSectionProps {
    title: string;
    icon: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
    badge?: string;
    accentColor?: string;
}

function CollapsibleSection({ title, icon, defaultOpen = true, children, badge, accentColor = 'blue' }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const colorMap: Record<string, string> = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-emerald-500 to-emerald-600',
        indigo: 'from-indigo-500 to-indigo-600',
        purple: 'from-purple-500 to-purple-600',
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
            >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorMap[accentColor] || colorMap.blue} flex items-center justify-center text-white shadow-sm`}>
                    {icon}
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-1">{title}</span>
                {badge && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-gray-100 text-gray-500">
                        {badge}
                    </span>
                )}
                <div className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                    <ChevronDown className="w-4 h-4" />
                </div>
            </button>
            <div
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                    }`}
            >
                <div className="px-5 pb-5 pt-1 space-y-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function PostForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const location = useLocation();
    const initialState = location.state as Partial<PostFormData> | null;

    // Auto-generate slug from title (Vietnamese-aware)
    const removeVietnamese = (str: string) => {
        str = str.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a');
        str = str.replace(/[èéẹẻẽêềếệểễ]/g, 'e');
        str = str.replace(/[ìíịỉĩ]/g, 'i');
        str = str.replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o');
        str = str.replace(/[ùúụủũưừứựửữ]/g, 'u');
        str = str.replace(/[ỳýỵỷỹ]/g, 'y');
        str = str.replace(/đ/g, 'd');
        return str;
    };

    const generateSlug = (title: string) => {
        return removeVietnamese(title.toLowerCase())
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    };

    const [form, setForm] = useState<PostFormData>(() => {
        if (!isEdit && initialState) {
            return {
                ...emptyForm,
                title: initialState.title || '',
                slug: initialState.title ? generateSlug(initialState.title) : '',
                content: initialState.content || '',
                featuredImageUrl: initialState.featuredImageUrl || '',
                tags: initialState.tags || '',
                metaKeywords: initialState.tags || ''
            };
        }
        return emptyForm;
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [targets, setTargets] = useState<{ socialAccountId: string; scheduledTimeUtc: string }[]>([]);

    // Fetch categories
    useEffect(() => {
        api.get('/categories')
            .then(res => setCategories(res.data))
            .catch(err => console.error('Error fetching categories:', err));
    }, []);

    // Load post data when editing
    useEffect(() => {
        if (isEdit) {
            setLoading(true);
            api.get(`/posts/${id}`)
                .then(res => {
                    const p = res.data;
                    setForm({
                        title: p.title || '',
                        content: p.content || '',
                        slug: p.slug && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.slug) ? p.slug : '',
                        description: p.description || '',
                        metaTitle: p.metaTitle || '',
                        metaDescription: p.metaDescription || '',
                        metaKeywords: p.metaKeywords || '',
                        featuredImageAlt: p.featuredImageAlt || '',
                        tags: p.tags || '',
                        featuredImageUrl: p.featuredImageUrl || '',
                        mediaJson: p.mediaJson || '',
                        displayStartUtc: toLocalDatetimeString(p.displayStartUtc || ''),
                        displayEndUtc: toLocalDatetimeString(p.displayEndUtc || ''),
                        categoryId: p.categoryId || '',
                        postType: p.postType || 0,
                        status: p.status || 0,
                        ref_ID: p.ref_ID ?? null,
                    });
                    if (p.targets) {
                        setTargets(p.targets.map((t: any) => ({
                            socialAccountId: t.socialAccountId,
                            scheduledTimeUtc: toLocalDatetimeString(t.scheduledTimeUtc || ''),
                        })));
                    }
                })
                .catch(() => toast.error('Không thể tải thông tin bài viết.'))
                .finally(() => setLoading(false));
        }
    }, [id, isEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value;
        setForm(prev => {
            const isCurrentSlugGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prev.slug);
            const shouldUpdateSlug = !prev.slug || prev.slug === generateSlug(prev.title) || isCurrentSlugGuid;

            return {
                ...prev,
                title,
                slug: shouldUpdateSlug ? generateSlug(title) : prev.slug,
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const payload = {
                ...form,
                categoryId: form.categoryId || null,
                displayStartUtc: toUtcDatetimeString(form.displayStartUtc),
                displayEndUtc: toUtcDatetimeString(form.displayEndUtc),
                targets: targets.map(t => ({
                    socialAccountId: t.socialAccountId,
                    scheduledTimeUtc: t.scheduledTimeUtc
                        ? toUtcDatetimeString(t.scheduledTimeUtc)
                        : new Date().toISOString(),
                })),
            };

            if (isEdit) {
                await api.put(`/posts/${id}`, { id, ...payload });
                toast.success('Cập nhật bài viết thành công!');
            } else {
                await api.post('/posts', payload);
                toast.success('Tạo bài viết thành công!');
            }

            setTimeout(() => navigate('/posts'), 1200);
        } catch (err: any) {
            console.error('Save error:', err.response?.data);
            if (err.response?.data?.errors) {
                const firstKey = Object.keys(err.response.data.errors)[0];
                toast.error(err.response.data.errors[firstKey][0]);
            } else {
                toast.error(err.response?.data?.message || err.response?.data?.title || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
            }
        } finally {
            setSaving(false);
        }
    };

    const currentStatus = STATUS_OPTIONS.find(s => s.value === Number(form.status));
    // Strip HTML tags for accurate plain-text character count
    const charCount = form.content.replace(/<[^>]*>/g, '').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
                    <p className="text-sm text-gray-500">Đang tải bài viết...</p>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="animate-in fade-in zoom-in-95 duration-300">
            {/* Sticky Top Bar */}
            <div className="sticky top-16 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-[#FAFAFA]/80 backdrop-blur-xl border-b border-gray-100 mb-6">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate('/posts')}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Quay lại</span>
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-900 truncate">
                                {isEdit ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Status indicator */}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs">
                            <div className={`w-2 h-2 rounded-full ${currentStatus?.color || 'bg-gray-400'}`} />
                            <span className="text-gray-600 font-medium">{currentStatus?.label || 'Nháp'}</span>
                        </div>

                        {/* Character count */}
                        {charCount > 0 && (
                            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-500">
                                <FileText className="w-3 h-3" />
                                {charCount.toLocaleString()} ký tự
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo bài viết')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content: Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN — Main Content (2/3 width) */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Title & Content Section */}
                    <CollapsibleSection
                        title="Nội dung bài viết"
                        icon={<FileText className="w-4 h-4" />}
                        defaultOpen={true}
                        accentColor="blue"
                    >
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Tiêu đề <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="title"
                                name="title"
                                type="text"
                                required
                                value={form.title}
                                onChange={handleTitleChange}
                                placeholder="Nhập tiêu đề bài viết..."
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-base font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Slug (URL)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-gray-400 text-sm">/</span>
                                </div>
                                <input
                                    id="slug"
                                    name="slug"
                                    type="text"
                                    value={form.slug}
                                    onChange={handleChange}
                                    placeholder="tu-dong-tao-tu-tieu-de"
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-blue-700 placeholder:text-gray-400"
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Được tạo tự động từ tiêu đề. Bạn có thể chỉnh sửa thủ công.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Mô tả ngắn
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                rows={3}
                                value={form.description}
                                onChange={handleChange}
                                placeholder="Mô tả ngắn gọn nội dung bài viết..."
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none placeholder:text-gray-400"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-gray-700">
                                    Nội dung <span className="text-red-500">*</span>
                                </label>
                                <span className="text-xs text-gray-400">{charCount.toLocaleString()} ký tự</span>
                            </div>
                            <RichTextEditor
                                value={form.content}
                                onChange={(html) => setForm(prev => ({ ...prev, content: html }))}
                                placeholder="Nhập nội dung bài viết..."
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Media Section */}
                    <CollapsibleSection
                        title="Hình ảnh & Media"
                        icon={<Eye className="w-4 h-4" />}
                        defaultOpen={true}
                        accentColor="indigo"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ảnh đại diện</label>
                                <FileUploader
                                    value={form.featuredImageUrl}
                                    onChange={(url) => setForm(prev => ({ ...prev, featuredImageUrl: url }))}
                                    accept="image"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="featuredImageAlt" className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Alt Text (Ảnh đại diện)
                                </label>
                                <input
                                    id="featuredImageAlt"
                                    name="featuredImageAlt"
                                    type="text"
                                    value={form.featuredImageAlt}
                                    onChange={handleChange}
                                    placeholder="Văn bản thay thế cho ảnh (SEO)"
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                />
                                <p className="mt-1.5 text-xs text-gray-400">Mô tả nội dung ảnh, giúp cải thiện SEO và khả năng truy cập.</p>
                            </div>
                        </div>

                        <MediaGallery
                            value={form.mediaJson}
                            onChange={(json) => setForm(prev => ({ ...prev, mediaJson: json }))}
                        />
                    </CollapsibleSection>

                    {/* SEO Section - collapsed by default */}
                    <CollapsibleSection
                        title="SEO & Website"
                        icon={<Globe className="w-4 h-4" />}
                        defaultOpen={false}
                        badge="Tùy chọn"
                        accentColor="green"
                    >
                        <div>
                            <label htmlFor="metaTitle" className="block text-sm font-medium text-gray-700 mb-1.5">Meta Title</label>
                            <input
                                id="metaTitle"
                                name="metaTitle"
                                type="text"
                                value={form.metaTitle}
                                onChange={handleChange}
                                placeholder="Tiêu đề hiển thị trên Google (để trống sẽ dùng tiêu đề bài viết)"
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="metaDescription" className="block text-sm font-medium text-gray-700">Meta Description</label>
                                <span className={`text-xs font-medium ${form.metaDescription.length > 160 ? 'text-red-500' : form.metaDescription.length > 140 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                    {form.metaDescription.length}/160
                                </span>
                            </div>
                            <textarea
                                id="metaDescription"
                                name="metaDescription"
                                rows={2}
                                value={form.metaDescription}
                                onChange={handleChange}
                                placeholder="Mô tả hiển thị trên Google (150-160 ký tự tối ưu)"
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none placeholder:text-gray-400"
                            />
                            {/* SEO Preview */}
                            {(form.metaTitle || form.title) && (
                                <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Xem trước trên Google</p>
                                    <p className="text-blue-800 text-sm font-medium truncate hover:underline cursor-default">
                                        {form.metaTitle || form.title}
                                    </p>
                                    <p className="text-green-700 text-xs truncate mt-0.5 font-mono">
                                        example.com/{form.slug || 'bai-viet'}
                                    </p>
                                    <p className="text-gray-600 text-xs mt-1 line-clamp-2 leading-relaxed">
                                        {form.metaDescription || form.description || 'Mô tả bài viết sẽ hiển thị ở đây...'}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="metaKeywords" className="block text-sm font-medium text-gray-700 mb-1.5">Meta Keywords</label>
                            <input
                                id="metaKeywords"
                                name="metaKeywords"
                                type="text"
                                value={form.metaKeywords}
                                onChange={handleChange}
                                placeholder="Từ khóa 1, Từ khóa 2 (Ngăn cách bằng dấu phẩy)"
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </CollapsibleSection>
                </div>

                {/* RIGHT COLUMN — Sidebar (1/3 width) */}
                <div className="space-y-5">

                    {/* Publishing Settings */}
                    <CollapsibleSection
                        title="Cài đặt đăng bài"
                        icon={<Settings className="w-4 h-4" />}
                        defaultOpen={true}
                        accentColor="indigo"
                    >
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1.5">Trạng thái</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <div className={`w-2.5 h-2.5 rounded-full ${currentStatus?.color || 'bg-gray-400'}`} />
                                </div>
                                <select
                                    id="status"
                                    name="status"
                                    value={form.status}
                                    onChange={handleChange}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                                >
                                    {STATUS_OPTIONS.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="postType" className="block text-sm font-medium text-gray-700 mb-1.5">Loại bài viết</label>
                            <div className="relative">
                                <select
                                    id="postType"
                                    name="postType"
                                    value={form.postType}
                                    onChange={handleChange}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                                >
                                    <option value={0}>Bài viết thường</option>
                                    <option value={1}>Tin tức</option>
                                    <option value={2}>Sản phẩm</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1.5">Danh mục</label>
                            <div className="relative">
                                <select
                                    id="categoryId"
                                    name="categoryId"
                                    value={form.categoryId}
                                    onChange={handleChange}
                                    className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                                >
                                    <option value="">-- Chọn danh mục --</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                            <input
                                id="tags"
                                name="tags"
                                type="text"
                                value={form.tags}
                                onChange={handleChange}
                                placeholder="tag1, tag2, tag3"
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                            />
                            <p className="mt-1.5 text-xs text-gray-400">Phân tách bằng dấu phẩy</p>
                        </div>

                        <hr className="border-gray-100" />

                        <div>
                            <label htmlFor="displayStartUtc" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Ngày hiển thị từ
                            </label>
                            <input
                                id="displayStartUtc"
                                name="displayStartUtc"
                                type="datetime-local"
                                value={form.displayStartUtc}
                                onChange={handleChange}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="displayEndUtc" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Ngày hiển thị đến
                                <span className="text-xs text-gray-400 font-normal ml-1">(Tùy chọn)</span>
                            </label>
                            <input
                                id="displayEndUtc"
                                name="displayEndUtc"
                                type="datetime-local"
                                value={form.displayEndUtc}
                                onChange={handleChange}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Social Publishing Section */}
                    <CollapsibleSection
                        title="Nền tảng đăng bài"
                        icon={<Share2 className="w-4 h-4" />}
                        defaultOpen={true}
                        accentColor="purple"
                    >
                        <p className="text-xs text-gray-500 -mt-1">
                            Chọn tài khoản mạng xã hội và lên lịch đăng bài.
                        </p>
                        <TargetSelector value={targets} onChange={setTargets} />
                    </CollapsibleSection>
                </div>
            </div>

            {/* Bottom Actions (Mobile) */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-200 z-30">
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/posts')}
                        className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl disabled:opacity-50 transition-all"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo bài viết')}
                    </button>
                </div>
            </div>

            {/* Bottom spacing for mobile fixed bar */}
            <div className="h-20 lg:hidden" />
        </form>
    );
}
