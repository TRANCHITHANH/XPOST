import React, { useEffect, useState, useCallback, useRef } from 'react';
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
    createdAt: string;
}

const STATUS_BADGE: Record<number, React.ReactElement> = {
    0: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm">Chờ xử lý</span>,
    1: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200 animate-pulse shadow-sm">Đang sinh bài...</span>,
    2: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200 shadow-sm">Hoàn tất</span>,
    3: <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200 shadow-sm">Lỗi</span>,
};

export default function Keywords() {
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importing, setImporting] = useState(false);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    // Viewer state
    const [viewerContent, setViewerContent] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // File Import state
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete state
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const filteredKeywords = keywords.filter(k =>
        k.name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
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
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Nhập từ khóa
                </button>
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
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Từ khóa</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Trạng thái AI</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Lần cuối</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredKeywords.map((k) => (
                                    <tr key={k.id} className="group hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{k.name}</div>
                                            {k.generatedContent && (
                                                <div
                                                    onClick={() => { setViewerContent(k.generatedContent!); setIsViewerOpen(true); }}
                                                    className="text-xs text-gray-500 mt-1 line-clamp-2 max-w-md italic cursor-pointer hover:text-blue-500 transition-colors"
                                                >
                                                    "{k.generatedContent}"
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex flex-col gap-1.5">
                                                <div
                                                    className="cursor-help"
                                                    onClick={() => k.generatedContent && (setViewerContent(k.generatedContent), setIsViewerOpen(true))}
                                                >
                                                    {STATUS_BADGE[k.status]}
                                                </div>
                                                {k.lastErrorMessage && (
                                                    <span className="text-[10px] text-red-500 max-w-[150px] truncate" title={k.lastErrorMessage}>
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
                                        <td className="px-6 py-5 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-1.5 items-center">
                                                {k.generatedContent && (
                                                    <button
                                                        onClick={() => { setViewerContent(k.generatedContent!); setIsViewerOpen(true); }}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all group/view"
                                                        title="Xem bài viết"
                                                    >
                                                        <Eye className="w-5 h-5 group-hover/view:scale-110 transition-transform" />
                                                    </button>
                                                )}

                                                <button
                                                    disabled={generatingId === k.id || k.status === 1}
                                                    onClick={() => handleGenerate(k.id, 1)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-30 group/btn"
                                                    title="Sinh bài viết AI (~400 từ)"
                                                >
                                                    {generatingId === k.id || k.status === 1 ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => { setDeletingId(k.id); setIsConfirmOpen(true); }}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Xóa từ khóa"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Content Viewer Modal */}
            {isViewerOpen && viewerContent && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Nội dung đã sinh</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Bởi AI của Mạng Xuyên Việt</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleCopy(viewerContent)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${copied
                                        ? 'bg-green-500 text-white shadow-green-100 shadow-lg'
                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        }`}
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Đã copy' : 'Copy bài viết'}
                                </button>
                                <button
                                    onClick={() => setIsViewerOpen(false)}
                                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-8 flex-1 overflow-y-auto bg-gray-50/30">
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-full">
                                <div className="prose prose-blue max-w-none">
                                    {viewerContent.split('\n').map((line, i) => (
                                        <p key={i} className="mb-4 text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {line}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                                Độ dài: ~{viewerContent.split(' ').length} từ
                            </span>
                            <button
                                onClick={() => setIsViewerOpen(false)}
                                className="px-6 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                Đóng lại
                            </button>
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
                                    Nhập từ khóa hàng loạt
                                </h3>
                                <p className="text-gray-500 mt-2">Dán danh sách từ khóa hoặc tải lên file dữ liệu.</p>
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
