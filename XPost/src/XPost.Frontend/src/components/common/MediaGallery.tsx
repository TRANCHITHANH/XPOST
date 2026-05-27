import { useState, useRef, useCallback } from 'react';
import api, { API_BASE_URL } from '../../lib/axios';

function resolveUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${API_BASE_URL}${url}`;
}

export interface MediaItem {
    url: string;
    mediaType: 'image' | 'video';
    title?: string;
    altText?: string;
}

interface MediaGalleryProps {
    value?: string; // JSON string of MediaItem[]
    onChange: (json: string) => void;
}

export default function MediaGallery({ value, onChange }: MediaGalleryProps) {
    const [mediaList, setMediaList] = useState<MediaItem[]>(() => {
        try {
            return value ? JSON.parse(value) : [];
        } catch {
            return [];
        }
    });

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const updateValue = (newList: MediaItem[]) => {
        setMediaList(newList);
        onChange(JSON.stringify(newList));
    };

    const handleFile = useCallback(async (file: File) => {
        setError('');
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
            setError('Định dạng file không được hỗ trợ.');
            return;
        }

        if (isImage && file.size > 5 * 1024 * 1024) {
            setError('Ảnh không được vượt quá 5 MB.');
            return;
        }
        if (isVideo && file.size > 100 * 1024 * 1024) {
            setError('Video không được vượt quá 100 MB.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const url = res.data.url;

            updateValue([...mediaList, {
                url,
                mediaType: isImage ? 'image' : 'video',
                title: file.name
            }]);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Upload thất bại. Vui lòng thử lại.');
        } finally {
            setUploading(false);
        }
    }, [mediaList, onChange]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleRemove = (index: number) => {
        const newList = [...mediaList];
        newList.splice(index, 1);
        updateValue(newList);
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === mediaList.length - 1) return;

        const newList = [...mediaList];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = newList[index];
        newList[index] = newList[swapIndex];
        newList[swapIndex] = temp;
        updateValue(newList);
    };

    return (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">

            {/* Header / Upload Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-gray-700">Thư viện Media</h3>
                    <p className="text-xs text-gray-500">Quản lý nhiều hình ảnh và video cho bài viết.</p>
                </div>

                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                >
                    {uploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    )}
                    Thêm Media
                </button>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            {/* Gallery Grid */}
            {mediaList.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {mediaList.map((item, index) => (
                        <div key={index} className="group relative aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center">

                            {item.mediaType === 'image' ? (
                                <img src={resolveUrl(item.url)} alt={item.altText || item.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center justify-center bg-gray-100 w-full h-full text-gray-400">
                                    <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span className="text-[10px] text-gray-500 max-w-[90%] truncate px-2">{item.title || 'Video'}</span>
                                </div>
                            )}

                            {/* Hover Actions */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => handleMove(index, 'up')} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-white bg-black/40 hover:bg-black/60 rounded disabled:opacity-30">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <button type="button" onClick={() => handleMove(index, 'down')} disabled={index === mediaList.length - 1} className="w-6 h-6 flex items-center justify-center text-white bg-black/40 hover:bg-black/60 rounded disabled:opacity-30">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                                <button type="button" onClick={() => handleRemove(index)} className="w-6 h-6 flex items-center justify-center text-white bg-red-500/80 hover:bg-red-600 rounded">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-500">Chưa có ảnh/video nào. Nhấn "Thêm Media" để tải lên.</p>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                onChange={handleInputChange}
                className="hidden"
            />
        </div>
    );
}
