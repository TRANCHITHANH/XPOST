import { useState, useRef, useCallback } from 'react';
import api, { API_BASE_URL } from '../../lib/axios';

function resolveUrl(url: string): string {
    if (!url) return '';
    let resolved = url.startsWith('http') || url.startsWith('data:') ? url : `${API_BASE_URL}${url}`;
    if (resolved.includes('ngrok-free.dev') && !import.meta.env.PROD) {
        const localApi = window.location.hostname === 'local.xpost.com' 
            ? 'http://local-api.xpost.com:5243' 
            : 'http://localhost:5243';
        return resolved.replace(/^https:\/\/.*?\.ngrok-free\.dev/i, localApi);
    }
    return resolved;
}

interface FileUploaderProps {
    value?: string;          // Current URL (for edit mode)
    onChange: (url: string) => void;
    accept?: 'image' | 'video' | 'all';
}

export default function FileUploader({ value, onChange, accept = 'all' }: FileUploaderProps) {
    const [preview, setPreview] = useState<string | null>(value ? resolveUrl(value) : null);
    const [fileType, setFileType] = useState<'image' | 'video' | null>(value ? 'image' : null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<'upload' | 'link'>(value?.startsWith('http') && !value?.includes(API_BASE_URL) ? 'link' : 'upload');
    const [urlInput, setUrlInput] = useState(value || '');

    const handleUrlSubmit = () => {
        if (urlInput.trim()) {
            setPreview(resolveUrl(urlInput));
            setFileType('image'); // Assume image for manual URLs
            onChange(urlInput);
        }
    };


    const acceptTypes = accept === 'image'
        ? 'image/jpeg,image/png,image/gif,image/webp'
        : accept === 'video'
            ? 'video/mp4,video/quicktime,video/webm'
            : 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm';

    const handleFile = useCallback(async (file: File) => {
        setError('');
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
            setError('Định dạng file không được hỗ trợ.');
            return;
        }

        // Client-side size check
        if (isImage && file.size > 5 * 1024 * 1024) {
            setError('Ảnh không được vượt quá 5 MB.');
            return;
        }
        if (isVideo && file.size > 100 * 1024 * 1024) {
            setError('Video không được vượt quá 100 MB.');
            return;
        }

        // Show local preview immediately
        setFileType(isImage ? 'image' : 'video');
        setFileName(file.name);
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null); // No inline preview for video, show icon instead
        }

        // Upload to server
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const url = res.data.url;
            // Keep the local base64 preview instead of replacing it with the server URL to prevent ngrok/CORS load failures
            onChange(url);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Upload thất bại. Vui lòng thử lại.');
            setPreview(null);
            setFileType(null);
            setFileName('');
        } finally {
            setUploading(false);
        }
    }, [onChange]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleRemove = () => {
        setPreview(null);
        setFileType(null);
        setFileName('');
        setError('');
        onChange('');
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="space-y-3">
            {/* Mode Switcher */}
            <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
                <button
                    type="button"
                    onClick={() => setMode('upload')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'upload' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Tải lên
                </button>
                <button
                    type="button"
                    onClick={() => setMode('link')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'link' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Link URL
                </button>
            </div>

            {/* Drop Zone or URL Input or Preview */}
            {!preview && !uploading ? (
                mode === 'upload' ? (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        className={`
                            relative flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
                            ${dragOver
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
                            }
                        `}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${dragOver ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            <svg className={`w-6 h-6 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-600 font-medium">
                            Kéo thả file vào đây hoặc <span className="text-blue-600">chọn file</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1 text-center">
                            {accept === 'image' && 'JPG, PNG, GIF, WEBP — tối đa 5 MB'}
                            {accept === 'video' && 'MP4, MOV, WEBM — tối đa 100 MB'}
                            {accept === 'all' && 'Ảnh (5 MB) hoặc Video (100 MB)'}
                        </p>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Dán link URL ảnh vào đây..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlSubmit())}
                            className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                        />
                        <button
                            type="button"
                            onClick={handleUrlSubmit}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Áp dụng
                        </button>
                    </div>
                )
            ) : uploading ? (
                <div className="flex flex-col items-center justify-center px-6 py-8 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3" />
                    <p className="text-sm text-gray-600">Đang upload {fileName}...</p>
                </div>
            ) : (
                <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 group">
                    {/* Remove button */}
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 z-10 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {fileType === 'image' || (preview && !fileType) ? (
                        <div className="p-3 flex justify-center">
                            <img
                                src={preview!}
                                alt="Preview"
                                className="max-h-48 rounded-lg object-contain"
                                onError={() => { setError('Không thể hiển thị ảnh.'); setPreview(null); }}
                            />
                        </div>
                    ) : (
                        <div className="p-4 flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{fileName || 'Video'}</p>
                                <p className="text-xs text-gray-500">Video đã upload thành công</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden File Input */}
            <input
                ref={inputRef}
                type="file"
                accept={acceptTypes}
                onChange={handleInputChange}
                className="hidden"
            />

            {/* Error message */}
            {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {error}
                </p>
            )}
        </div>
    );
}
