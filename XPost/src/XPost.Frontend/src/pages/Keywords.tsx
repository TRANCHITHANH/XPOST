import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Plus, Search, Sparkles, Languages, Trash2, Send, Eye, FileText, Copy, Check, X, Upload, FileSpreadsheet, FileJson } from 'lucide-react';
import ConfirmModal from '../components/common/ConfirmModal';
import { formatDateTimeVN } from '../lib/dateUtils';
import * as XLSX from 'xlsx';

interface Keyword {
    id: string;
    name: string;
    description?: string;
    status: number;
    generatedContent?: string;
    lastErrorMessage?: string;
    lastGeneratedAtUtc?: string;
    language?: string;
    lastPostId?: string;
    imageUrl?: string;
    createdAt: string;
}

const STATUS_BADGE: Record<number, React.ReactElement> = {
    0: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm">Chờ xử lý</span>,
    1: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200 animate-pulse shadow-sm">Đang sinh bài...</span>,
    2: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200 shadow-sm">Hoàn tất</span>,
    3: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200 shadow-sm">Lỗi</span>,
};

export default function Keywords() {
    const navigate = useNavigate();
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importing, setImporting] = useState(false);
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [activeMenuKeywordId, setActiveMenuKeywordId] = useState<string | null>(null);

    // Viewer state
    const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Editor state
    const [editContent, setEditContent] = useState('');
    const [isSavingContent, setIsSavingContent] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Swipe state
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    // Image Action states
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [customImageUrl, setCustomImageUrl] = useState('');
    const imageFileInputRef = useRef<HTMLInputElement>(null);

    // File Import state
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // AI Rewrite State
    const [selectedText, setSelectedText] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isRewriting, setIsRewriting] = useState(false);
    const [selectionStart, setSelectionStart] = useState(0);
    const [selectionEnd, setSelectionEnd] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Delete state
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Bulk Delete state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const fetchKeywords = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/keywords');
            setKeywords(res.data);
        } catch (error) {
            console.error('Failed to fetch keywords', error);
            toast.error('Không thể tải danh sách từ khóa.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchKeywords();
    }, [fetchKeywords]);

    useEffect(() => {
        const handleOutsideClick = () => {
            setActiveMenuKeywordId(null);
        };
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    useEffect(() => {
        if (selectedKeyword?.generatedContent) {
            setEditContent(selectedKeyword.generatedContent);
        }
    }, [selectedKeyword?.id]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setEditContent(newContent);

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            if (!selectedKeyword) return;
            setIsSavingContent(true);
            try {
                await api.put(`/keywords/${selectedKeyword.id}`, {
                    id: selectedKeyword.id,
                    name: selectedKeyword.name,
                    generatedContent: newContent
                });

                setKeywords(prev => prev.map(k => k.id === selectedKeyword.id ? { ...k, generatedContent: newContent } : k));
                setSelectedKeyword(prev => prev ? { ...prev, generatedContent: newContent } : null);

                toast.success('Đã tự động lưu bài viết.', { icon: '💾' });
            } catch (error) {
                toast.error('Lưu bài viết thất bại.');
            } finally {
                setIsSavingContent(false);
            }
        }, 1500);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: React.TouchEvent, keywordId: string) => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const distance = touchEndX - touchStartX;

        if (Math.abs(distance) > 100) {
            setDeletingId(keywordId);
            setIsConfirmOpen(true);
        }
        setTouchStartX(null);
    };

    const handleImport = useCallback(async () => {
        if (!importText.trim()) return;
        setImporting(true);
        try {
            const res = await api.post('/keywords/import', { keywordsText: importText });
            toast.success(`Đã thêm thành công ${res.data} từ khóa.`);
            setImportText('');
            setIsImportModalOpen(false);
            fetchKeywords();
        } catch (error) {
            toast.error('Nhập từ khóa thất bại.');
        } finally {
            setImporting(false);
        }
    }, [importText, fetchKeywords]);

    const handleGenerate = async (id: string, type: number = 0) => {
        setGeneratingId(id);
        try {
            await api.post(`/keywords/${id}/generate?type=${type}`);
            toast.success('Đã gửi yêu cầu AI sinh nội dung.');
            fetchKeywords();
        } catch (error) {
            toast.error('Yêu cầu AI thất bại.');
        } finally {
            setGeneratingId(null);
        }
    };

    const handleGenerateWithImage = async (id: string) => {
        setGeneratingId(id);
        try {
            // 1. Generate text content (type = 1)
            await api.post(`/keywords/${id}/generate?type=1`);

            // 2. Generate AI image
            await api.post(`/keywords/${id}/generate-image`);

            toast.success('Đã sinh bài viết kèm ảnh AI thành công! 🎉');
            fetchKeywords();
        } catch (error) {
            toast.error('Sinh bài viết kèm ảnh thất bại.');
        } finally {
            setGeneratingId(null);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Đã sao chép nội dung!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            await api.delete(`/keywords/${deletingId}`);
            toast.success('Đã xóa từ khóa thành công.');
            setIsConfirmOpen(false);
            setDeletingId(null);
            fetchKeywords();
        } catch (error) {
            toast.error('Không thể xóa từ khóa.');
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredKeywords.map(k => k.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} từ khóa đã chọn?`)) return;
        setIsBulkDeleting(true);
        try {
            await Promise.all(selectedIds.map(id => api.delete(`/keywords/${id}`)));
            setKeywords(prev => prev.filter(k => !selectedIds.includes(k.id)));
            setSelectedIds([]);
            toast.success(`Đã xóa ${selectedIds.length} từ khóa thành công.`);
        } catch (error) {
            toast.error('Lỗi khi xóa hàng loạt.');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!selectedKeyword) return;
        setIsGeneratingImage(true);
        try {
            const res = await api.post(`/keywords/${selectedKeyword.id}/generate-image`);
            const newUrl = res.data.imageUrl;

            setSelectedKeyword(prev => prev ? { ...prev, imageUrl: newUrl } : null);
            setKeywords(prev => prev.map(k => k.id === selectedKeyword.id ? { ...k, imageUrl: newUrl } : k));

            toast.success('Đã sinh ảnh AI thành công! 🎨');
        } catch (error: any) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'Sinh ảnh AI thất bại.');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleTextSelect = () => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        if (start !== end) {
            setSelectionStart(start);
            setSelectionEnd(end);
            setSelectedText(editContent.substring(start, end));
        } else {
            setSelectedText('');
        }
    };

    const handleCustomRewrite = async () => {
        if (!selectedText || !aiPrompt.trim()) return;
        setIsRewriting(true);
        try {
            const res = await api.post('/keywords/ai/custom', { prompt: aiPrompt, selectedText });
            const newText = res.data.generatedText;

            const newContent = editContent.substring(0, selectionStart) + newText + editContent.substring(selectionEnd);
            setEditContent(newContent);
            setSelectedText('');
            setAiPrompt('');

            if (selectedKeyword) {
                await api.put(`/keywords/${selectedKeyword.id}`, {
                    id: selectedKeyword.id,
                    name: selectedKeyword.name,
                    generatedContent: newContent
                });
                setKeywords(prev => prev.map(k => k.id === selectedKeyword.id ? { ...k, generatedContent: newContent } : k));
                setSelectedKeyword(prev => prev ? { ...prev, generatedContent: newContent } : null);
                toast.success('Đã ghi đè văn bản bằng AI và lưu lại.', { icon: '✨' });
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Lỗi khi yêu cầu AI viết lại.');
        } finally {
            setIsRewriting(false);
        }
    };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedKeyword || !e.target.files?.[0]) return;
        const file = e.target.files[0];

        const formData = new FormData();
        formData.append('file', file);

        setUploadingImage(true);
        try {
            const uploadRes = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const uploadedUrl = uploadRes.data.url;

            await api.put(`/keywords/${selectedKeyword.id}/image`, { imageUrl: uploadedUrl });

            setSelectedKeyword(prev => prev ? { ...prev, imageUrl: uploadedUrl } : null);
            setKeywords(prev => prev.map(k => k.id === selectedKeyword.id ? { ...k, imageUrl: uploadedUrl } : k));

            toast.success('Tải ảnh lên thành công! 📤');
        } catch (error: any) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'Tải ảnh lên thất bại.');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveCustomImageUrl = async () => {
        if (!selectedKeyword || !customImageUrl.trim()) return;
        try {
            await api.put(`/keywords/${selectedKeyword.id}/image`, { imageUrl: customImageUrl.trim() });

            setSelectedKeyword(prev => prev ? { ...prev, imageUrl: customImageUrl.trim() } : null);
            setKeywords(prev => prev.map(k => k.id === selectedKeyword.id ? { ...k, imageUrl: customImageUrl.trim() } : k));

            setCustomImageUrl('');
            setShowUrlInput(false);
            toast.success('Cập nhật link ảnh thành công! 🔗');
        } catch (error) {
            toast.error('Cập nhật link ảnh thất bại.');
        }
    };

    const handleDeleteImage = async () => {
        if (!selectedKeyword) return;
        try {
            await api.put(`/keywords/${selectedKeyword.id}/image`, { imageUrl: '' });

            setSelectedKeyword(prev => prev ? { ...prev, imageUrl: undefined } : null);
            setKeywords(prev => prev.map(k => k.id === selectedKeyword.id ? { ...k, imageUrl: undefined } : k));
            setCustomImageUrl('');

            toast.success('Đã xóa hình ảnh.');
        } catch (error) {
            toast.error('Không thể xóa hình ảnh.');
        }
    };

    const processFiles = async (files: FileList) => {
        const file = files[0];
        if (!file) return;

        const extension = file.name.split('.').pop()?.toLowerCase();
        let extractedKeywords: string[] = [];

        try {
            if (extension === 'txt') {
                const text = await file.text();
                extractedKeywords = text.split('\n').map(s => s.trim()).filter(s => s);
            } else if (extension === 'csv') {
                const text = await file.text();
                extractedKeywords = text.split('\n').map(line => {
                    const columns = line.split(/[;,]/);
                    return columns[0]?.trim();
                }).filter(s => s);
            } else if (extension === 'xlsx' || extension === 'xls') {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

                extractedKeywords = json.map(row => row[0]?.toString().trim()).filter(s => s && s !== 'Keyword' && s !== 'Từ khóa');
            } else {
                toast.error('Định dạng file không hỗ trợ.');
                return;
            }

            if (extractedKeywords.length > 0) {
                const newText = extractedKeywords.join('\n');
                setImportText(prev => prev ? `${prev}\n${newText}` : newText);
                toast.success(`Đã trích xuất ${extractedKeywords.length} từ khóa từ file.`);
            }
        } catch (error) {
            console.error(error);
            toast.error('Lỗi khi đọc file.');
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            processFiles(e.dataTransfer.files);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
        }
    };

    const removeAccents = (str: string) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    const filteredKeywords = keywords.filter(k => {
        const normalizedName = removeAccents(k.name.toLowerCase());
        const normalizedFilter = removeAccents(filter.toLowerCase());
        return normalizedName.includes(normalizedFilter);
    });

    return (
        <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-start items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Nhập từ khóa
                </button>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm từ khóa..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    />
                </div>
                {selectedIds.length > 0 && (
                    <button
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-semibold transition-all"
                    >
                        {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Xóa {selectedIds.length} keyword
                    </button>
                )}
            </div>

            {/* Content List */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {loading && keywords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 py-20 pointer-events-none">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                        <p className="text-gray-400 animate-pulse">Đang tải dữ liệu...</p>
                    </div>
                ) : filteredKeywords.length === 0 ? (
                    <div className="text-center py-24 bg-gray-50/30 rounded-3xl m-4 border-2 border-dashed border-gray-100">
                        <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <Languages className="w-10 h-10 text-gray-200" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800">Chưa có từ khóa nào</h3>
                        <p className="text-gray-500 mt-2 max-w-xs mx-auto">Hãy bắt đầu bằng cách nhập danh sách từ khóa để AI sinh nội dung tự động.</p>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="mt-6 text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            + Nhập ngay
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-4 w-12 text-center border-b border-gray-100">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                            checked={selectedIds.length === filteredKeywords.length && filteredKeywords.length > 0}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Từ khóa</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Trạng thái AI</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Lần cuối</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredKeywords.map((k) => (
                                    <tr
                                        key={k.id}
                                        className={`group transition-colors ${selectedIds.includes(k.id) ? 'bg-blue-50/50' : 'hover:bg-blue-50/30'}`}
                                        onTouchStart={handleTouchStart}
                                        onTouchEnd={(e) => handleTouchEnd(e, k.id)}
                                    >
                                        <td className="px-6 py-5 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (selectedIds.length > 0) {
                                                        handleSelectOne(k.id);
                                                    } else {
                                                        setDeletingId(k.id);
                                                        setIsConfirmOpen(true);
                                                    }
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors ${selectedIds.length > 0
                                                    ? selectedIds.includes(k.id)
                                                        ? 'text-red-500 bg-red-50 hover:bg-red-100'
                                                        : 'text-green-500 bg-green-50 hover:bg-green-100'
                                                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                    }`}
                                                title={selectedIds.length > 0 ? (selectedIds.includes(k.id) ? "Sẽ bị xóa" : "Sẽ không xóa") : "Xóa từ khóa"}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                        <td className="px-6 py-5 group">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    onClick={() => {
                                                        if (k.generatedContent) {
                                                            setSelectedKeyword(k);
                                                            setIsViewerOpen(true);
                                                        }
                                                    }}
                                                    className={`font-bold text-gray-900 transition-colors ${k.generatedContent ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                                >
                                                    {k.name}
                                                </div>

                                                {/* Hover Actions */}
                                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                                    <button
                                                        disabled={generatingId === k.id || k.status === 1}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGenerate(k.id, 1);
                                                        }}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all disabled:opacity-30"
                                                        title="Chỉ sinh bài viết"
                                                    >
                                                        {generatingId === k.id || k.status === 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        disabled={generatingId === k.id || k.status === 1}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGenerateWithImage(k.id);
                                                        }}
                                                        className="p-1.5 text-purple-500 hover:bg-purple-50 hover:text-purple-700 rounded-lg transition-all disabled:opacity-30"
                                                        title="Sinh bài viết + ảnh AI"
                                                    >
                                                        {generatingId === k.id || k.status === 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {k.generatedContent && (
                                                <div
                                                    onClick={() => {
                                                        setSelectedKeyword(k);
                                                        setIsViewerOpen(true);
                                                    }}
                                                    className="text-xs text-gray-500 mt-1 line-clamp-2 max-w-md italic cursor-pointer hover:text-blue-500 transition-colors"
                                                >
                                                    "{k.generatedContent}"
                                                </div>
                                            )}
                                            <div className="md:hidden text-[10px] text-gray-400 mt-1 italic">
                                                * Vuốt trái/phải để xóa
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex flex-col gap-1.5">
                                                <div
                                                    className={k.generatedContent ? "cursor-pointer" : "cursor-help"}
                                                    onClick={() => {
                                                        if (k.generatedContent) {
                                                            setSelectedKeyword(k);
                                                            setIsViewerOpen(true);
                                                        }
                                                    }}
                                                >
                                                    {STATUS_BADGE[k.status]}
                                                </div>
                                                {k.lastErrorMessage && (
                                                    <span
                                                        className="text-[10px] text-red-500 max-w-[150px] truncate cursor-pointer hover:text-red-700 hover:underline"
                                                        title="Nhấn để copy lỗi"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopy(k.lastErrorMessage!);
                                                        }}
                                                    >
                                                        {k.lastErrorMessage}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {k.lastGeneratedAtUtc && formatDateTimeVN(k.lastGeneratedAtUtc) ? (
                                                <div className="text-sm">
                                                    <div className="text-gray-900 font-medium">{formatDateTimeVN(k.lastGeneratedAtUtc)!.date}</div>
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-tighter">{formatDateTimeVN(k.lastGeneratedAtUtc)!.time}</div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300">Chưa sinh</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Content Viewer Modal */}
            {isViewerOpen && selectedKeyword && selectedKeyword.generatedContent && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedKeyword.name}</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Nội dung sinh tự động bởi AI của Mạng Xuyên Việt</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {isSavingContent && <span className="text-sm font-semibold text-blue-500 animate-pulse flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</span>}
                                <button
                                    onClick={() => {
                                        setIsViewerOpen(false);
                                        setSelectedKeyword(null);
                                        setShowUrlInput(false);
                                        setCustomImageUrl('');
                                    }}
                                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Image Manager Panel */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 mb-3">Hình ảnh đại diện bài viết</h4>

                                <div className="flex flex-wrap gap-2.5 items-center">
                                    <button
                                        onClick={handleGenerateImage}
                                        disabled={isGeneratingImage || uploadingImage}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {isGeneratingImage ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5" />
                                        )}
                                        Sinh ảnh AI
                                    </button>

                                    <button
                                        onClick={() => imageFileInputRef.current?.click()}
                                        disabled={isGeneratingImage || uploadingImage}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {uploadingImage ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Upload className="w-3.5 h-3.5" />
                                        )}
                                        Tải ảnh lên
                                    </button>
                                    <input
                                        type="file"
                                        ref={imageFileInputRef}
                                        onChange={handleUploadImage}
                                        accept="image/*"
                                        className="hidden"
                                    />

                                    <button
                                        onClick={() => {
                                            if (!showUrlInput) {
                                                setCustomImageUrl(selectedKeyword.imageUrl || '');
                                            }
                                            setShowUrlInput(!showUrlInput);
                                        }}
                                        disabled={isGeneratingImage || uploadingImage}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        Link ảnh
                                    </button>
                                </div>
                                {showUrlInput && (
                                    <div className="mt-3 flex gap-2 w-full md:w-[400px] animate-in slide-in-from-top-2 duration-200">
                                        <input
                                            type="url"
                                            placeholder="Nhập đường dẫn hình ảnh (https://...)"
                                            value={customImageUrl}
                                            onChange={e => setCustomImageUrl(e.target.value)}
                                            className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={handleSaveCustomImageUrl}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                                        >
                                            Lưu lại
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <button
                                    onClick={() => {
                                        const formattedContent = `<p><strong>${selectedKeyword.name.toUpperCase()}</strong></p><br/>${editContent || selectedKeyword.generatedContent}`;
                                        navigate('/posts/create', { state: { title: selectedKeyword.name, content: formattedContent, featuredImageUrl: selectedKeyword.imageUrl, tags: selectedKeyword.name } });
                                    }}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    Tạo bài đăng
                                </button>
                            </div>
                        </div>

                        <div className="p-8 flex-1 overflow-y-auto bg-gray-50/30 space-y-6">
                            {/* Image display */}
                            {selectedKeyword.imageUrl && (
                                <div className="relative group rounded-3xl overflow-hidden border border-gray-150 shadow-sm max-h-80 flex justify-center bg-gray-150">
                                    <img
                                        src={selectedKeyword.imageUrl.startsWith('/') ? `${api.defaults.baseURL?.replace('/api', '') || ''}${selectedKeyword.imageUrl}` : selectedKeyword.imageUrl}
                                        alt={selectedKeyword.name}
                                        className="object-contain max-h-80 w-full rounded-3xl"
                                    />
                                    <button
                                        onClick={handleDeleteImage}
                                        className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                        title="Xóa hình ảnh"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-full flex flex-col relative">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-gray-800">Nội dung bài viết</h4>
                                    <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full font-medium">
                                        ~{selectedKeyword.generatedContent.split(' ').length} từ
                                    </span>
                                </div>

                                {/* AI Rewrite logic */}
                                {selectedText && (
                                    <div className="absolute top-16 left-8 right-8 z-20 bg-white/95 backdrop-blur shadow-2xl border border-blue-100 p-4 rounded-2xl animate-in slide-in-from-top-4 duration-200">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={aiPrompt}
                                                    onChange={e => setAiPrompt(e.target.value)}
                                                    placeholder="Nhập yêu cầu cho AI (VD: Viết lại cho hấp dẫn hơn, Dịch sang tiếng Anh...)"
                                                    className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCustomRewrite();
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={handleCustomRewrite}
                                                disabled={isRewriting || !aiPrompt.trim()}
                                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                                            >
                                                {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                Sinh ngay
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <textarea
                                    ref={textareaRef}
                                    value={editContent}
                                    onChange={handleContentChange}
                                    onSelect={handleTextSelect}
                                    onClick={handleTextSelect}
                                    onKeyUp={handleTextSelect}
                                    className="flex-1 w-full p-4 border-2 border-transparent hover:border-gray-100 focus:border-blue-500 rounded-2xl outline-none transition-all text-gray-700 leading-relaxed resize-none min-h-[400px]"
                                    placeholder="Nội dung bài viết..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
                        <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                    <Plus className="w-6 h-6 text-blue-600 bg-white p-1 rounded-lg shadow-sm" />
                                    Từ khóa
                                </h3>
                                <p className="text-gray-500 mt-2">Dán từ khoá - danh sách từ khóa hoặc tải lên file dữ liệu .</p>
                            </div>
                            <button
                                onClick={() => { setIsImportModalOpen(false); setImportText(''); }}
                                className="p-2 text-gray-400 hover:bg-white/50 rounded-xl transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8 bg-gray-50/30">
                            {/* Editor Area */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-gray-700">Dán từ khóa</label>
                                    <span className="text-[10px] text-gray-400 italic">Mỗi từ khoá một dòng</span>
                                </div>
                                <textarea
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    className="flex-1 w-full min-h-[350px] p-5 bg-white border-2 border-gray-100 rounded-[2rem] outline-none focus:border-blue-500 transition-all text-gray-700 font-medium resize-none shadow-sm"
                                />
                            </div>

                            {/* Drop Zone Area */}
                            <div className="flex flex-col gap-4">
                                <label className="text-sm font-bold text-gray-700">Tải file lên</label>
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex-1 flex flex-col items-center justify-center p-8 border-3 border-dashed rounded-[2.5rem] transition-all cursor-pointer group ${isDragging
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/30'
                                        }`}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".xlsx,.xls,.csv,.txt"
                                        className="hidden"
                                    />
                                    <div className="relative mb-6">
                                        <div className="absolute inset-0 bg-blue-100 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative p-6 bg-blue-50 text-blue-600 rounded-[2rem] group-hover:scale-110 transition-transform">
                                            <Upload className="w-10 h-10" />
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-900 mb-2">Kéo & Thả file vào đây</h4>
                                    <p className="text-gray-500 text-center text-sm max-w-[200px] mb-6">
                                        Hỗ trợ file Excel, CSV hoặc TXT.
                                    </p>

                                    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                                        <div className="p-3 bg-gray-50 rounded-2xl flex flex-col items-center gap-1 group-hover:bg-white transition-colors">
                                            <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                            <span className="text-[10px] font-bold text-gray-400">XLSX</span>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-2xl flex flex-col items-center gap-1 group-hover:bg-white transition-colors">
                                            <FileJson className="w-5 h-5 text-blue-600" />
                                            <span className="text-[10px] font-bold text-gray-400">CSV</span>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-2xl flex flex-col items-center gap-1 group-hover:bg-white transition-colors">
                                            <FileText className="w-5 h-5 text-gray-600" />
                                            <span className="text-[10px] font-bold text-gray-400">TXT</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-white flex items-center justify-end gap-3 border-t border-gray-100">
                            <div className="flex-1 text-xs text-gray-400 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-blue-400" />
                                Mỗi từ khóa sẽ được AI xử lý riêng biệt để tạo nội dung sáng tạo.
                            </div>
                            <button
                                onClick={() => { setIsImportModalOpen(false); setImportText(''); }}
                                disabled={importing}
                                className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-2xl transition-all"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={importing || !importText.trim()}
                                className="flex items-center gap-2 px-10 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all disabled:opacity-50 shadow-blue-200 shadow-xl"
                            >
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Bắt đầu nhập dữ liệu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={isConfirmOpen}
                onCancel={() => { setIsConfirmOpen(false); setDeletingId(null); }}
                onConfirm={handleDelete}
                title="Xóa từ khóa"
                message="Bạn có chắc chắn muốn xóa từ khóa này? Hành động này không thể hoàn tác và nội dung đã sinh cũng sẽ bị xóa."
            />
        </div>
    );
}
