import { useState, useMemo, useEffect, useRef } from 'react';
import {
    X, BookOpen, Search, ChevronRight, ChevronLeft,
    Clock, Zap, AlertTriangle, Lightbulb, CheckCircle2, ArrowRight
} from 'lucide-react';
import { platformGuides, type PlatformGuide } from '../../data/platformGuideContent';

// ════════════════════════════════════════════
//  Platform Guide Modal
// ════════════════════════════════════════════

interface PlatformGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPlatformId?: string;
}

const difficultyConfig = {
    easy: { label: 'Dễ', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    medium: { label: 'Trung bình', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    advanced: { label: 'Nâng cao', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export default function PlatformGuideModal({ isOpen, onClose, initialPlatformId }: PlatformGuideModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGuide, setSelectedGuide] = useState<PlatformGuide | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
    const contentRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Filtered guides
    const filteredGuides = useMemo(() => {
        if (!searchQuery.trim()) return platformGuides;
        const q = searchQuery.toLowerCase();
        return platformGuides.filter(g =>
            g.title.toLowerCase().includes(q) ||
            g.description.toLowerCase().includes(q) ||
            g.platformId.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    // Reset when closing or set initial guide when opening
    useEffect(() => {
        if (!isOpen) {
            setSelectedGuide(null);
            setSearchQuery('');
            setCurrentStep(0);
        } else if (initialPlatformId) {
            const guide = platformGuides.find(g => g.platformId === initialPlatformId);
            if (guide) {
                setSelectedGuide(guide);
            }
        }
    }, [isOpen, initialPlatformId]);

    // Scroll to top on step change
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep, selectedGuide]);

    // ESC to close or go back
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                if (selectedGuide) {
                    setSelectedGuide(null);
                    setCurrentStep(0);
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedGuide, onClose]);

    const selectGuide = (guide: PlatformGuide) => {
        setSelectedGuide(guide);
        setCurrentStep(0);
    };

    const goBack = () => {
        setSelectedGuide(null);
        setCurrentStep(0);
    };

    const toggleStepComplete = (stepKey: string) => {
        setCompletedSteps(prev => {
            const next = new Set(prev);
            if (next.has(stepKey)) next.delete(stepKey);
            else next.add(stepKey);
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col"
                style={{ maxHeight: 'min(90vh, 780px)' }}
            >
                {/* ══════════ HEADER ══════════ */}
                <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white px-6 py-5 shrink-0">
                    {/* Decorative dots */}
                    <div className="absolute top-0 right-0 w-64 h-full opacity-10">
                        <div className="absolute top-3 right-12 w-3 h-3 bg-white rounded-full" />
                        <div className="absolute top-8 right-24 w-2 h-2 bg-white rounded-full" />
                        <div className="absolute top-5 right-40 w-4 h-4 bg-white rounded-full" />
                        <div className="absolute bottom-4 right-16 w-2.5 h-2.5 bg-white rounded-full" />
                        <div className="absolute bottom-3 right-36 w-2 h-2 bg-white rounded-full" />
                    </div>

                    <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-3">
                            {selectedGuide && (
                                <button
                                    onClick={goBack}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors mr-1"
                                    title="Quay lại"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold leading-tight">
                                    {selectedGuide ? selectedGuide.title : 'Hướng dẫn thiết lập nền tảng'}
                                </h2>
                                <p className="text-sm text-white/70 mt-0.5">
                                    {selectedGuide
                                        ? `Bước ${currentStep + 1} / ${selectedGuide.steps.length}`
                                        : `${platformGuides.length} nền tảng hỗ trợ`
                                    }
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                            title="Đóng"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ══════════ BODY ══════════ */}
                <div className="flex-1 overflow-hidden flex flex-col" ref={contentRef}>
                    {!selectedGuide ? (
                        /* ──── GUIDE LIST VIEW ──── */
                        <div className="flex-1 overflow-y-auto">
                            {/* Search bar */}
                            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 z-10">
                                <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Tìm kiếm nền tảng..."
                                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded-md"
                                        >
                                            <X className="w-3.5 h-3.5 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Guide cards */}
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {filteredGuides.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                                        <Search className="w-10 h-10 mb-3 opacity-40" />
                                        <p className="text-sm font-medium">Không tìm thấy hướng dẫn phù hợp.</p>
                                        <p className="text-xs mt-1">Thử từ khoá khác hoặc xoá bộ lọc.</p>
                                    </div>
                                ) : (
                                    filteredGuides.map(guide => {
                                        const diff = difficultyConfig[guide.difficulty];
                                        return (
                                            <button
                                                key={guide.id}
                                                onClick={() => selectGuide(guide)}
                                                className="group text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100/50 transition-all duration-200 hover:-translate-y-0.5"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-gray-900 text-sm group-hover:text-violet-700 transition-colors">
                                                            {guide.title}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                                            {guide.description}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 p-2 bg-gray-50 group-hover:bg-violet-50 rounded-lg transition-colors">
                                                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-violet-500 transition-colors" />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${diff.color}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} />
                                                        {diff.label}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {guide.estimatedTime}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full">
                                                        <Zap className="w-2.5 h-2.5" />
                                                        {guide.steps.length} bước
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ──── GUIDE DETAIL VIEW ──── */
                        <div className="flex-1 flex overflow-hidden">
                            {/* Step sidebar */}
                            <div className="w-56 shrink-0 border-r border-gray-100 bg-gray-50/50 overflow-y-auto hidden md:block">
                                <div className="p-4 space-y-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
                                        Các bước
                                    </p>
                                    {selectedGuide.steps.map((step, idx) => {
                                        const stepKey = `${selectedGuide.id}-${idx}`;
                                        const isActive = idx === currentStep;
                                        const isCompleted = completedSteps.has(stepKey);

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentStep(idx)}
                                                className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                                                    isActive
                                                        ? 'bg-violet-100 text-violet-800'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                <span className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                                    isCompleted
                                                        ? 'bg-emerald-500 text-white'
                                                        : isActive
                                                            ? 'bg-violet-600 text-white'
                                                            : 'bg-gray-200 text-gray-500'
                                                }`}>
                                                    {isCompleted ? '✓' : idx + 1}
                                                </span>
                                                <span className="text-xs font-medium leading-snug line-clamp-2">
                                                    {step.title}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Guide meta */}
                                <div className="border-t border-gray-100 p-4 mt-2">
                                    <div className="space-y-2 text-[11px] text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            <span>{selectedGuide.estimatedTime}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                const diff = difficultyConfig[selectedGuide.difficulty];
                                                return (
                                                    <>
                                                        <span className={`w-2 h-2 rounded-full ${diff.dot}`} />
                                                        <span>{diff.label}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <span>Cập nhật: {selectedGuide.lastUpdated}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step content */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="p-6 max-w-2xl">
                                    {/* Mobile step indicator */}
                                    <div className="md:hidden flex items-center gap-1.5 mb-4 overflow-x-auto pb-2">
                                        {selectedGuide.steps.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentStep(idx)}
                                                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                    idx === currentStep
                                                        ? 'bg-violet-600 text-white'
                                                        : completedSteps.has(`${selectedGuide.id}-${idx}`)
                                                            ? 'bg-emerald-500 text-white'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                }`}
                                            >
                                                {completedSteps.has(`${selectedGuide.id}-${idx}`) ? '✓' : idx + 1}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Step header */}
                                    <div className="mb-5">
                                        <div className="flex items-center gap-2 text-violet-600 text-xs font-bold uppercase tracking-wider mb-1.5">
                                            <span className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-[10px]">
                                                {currentStep + 1}
                                            </span>
                                            Bước {currentStep + 1} / {selectedGuide.steps.length}
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">
                                            {selectedGuide.steps[currentStep].title}
                                        </h3>
                                    </div>

                                    {/* Step content - rendered as HTML */}
                                    <div
                                        className="guide-content prose prose-sm max-w-none text-gray-700 leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                            __html: selectedGuide.steps[currentStep].content
                                        }}
                                    />

                                    {/* Tips */}
                                    {selectedGuide.steps[currentStep].tips?.map((tip, i) => (
                                        <div
                                            key={i}
                                            className="mt-4 flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl"
                                        >
                                            <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                            <p
                                                className="text-sm text-blue-800 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: tip }}
                                            />
                                        </div>
                                    ))}

                                    {/* Warnings */}
                                    {selectedGuide.steps[currentStep].warnings?.map((warning, i) => (
                                        <div
                                            key={i}
                                            className="mt-4 flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                                        >
                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <p
                                                className="text-sm text-amber-800 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: warning }}
                                            />
                                        </div>
                                    ))}

                                    {/* Mark as done button */}
                                    <div className="mt-6">
                                        <button
                                            onClick={() => toggleStepComplete(`${selectedGuide.id}-${currentStep}`)}
                                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                                                completedSteps.has(`${selectedGuide.id}-${currentStep}`)
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            {completedSteps.has(`${selectedGuide.id}-${currentStep}`)
                                                ? 'Đã hoàn thành ✓'
                                                : 'Đánh dấu hoàn thành'
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════ FOOTER (for detail view) ══════════ */}
                {selectedGuide && (
                    <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-6 py-3.5 flex items-center justify-between">
                        <button
                            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                            disabled={currentStep === 0}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Trước
                        </button>

                        {/* Progress dots */}
                        <div className="hidden sm:flex items-center gap-1.5">
                            {selectedGuide.steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                        idx === currentStep
                                            ? 'w-6 bg-violet-500'
                                            : completedSteps.has(`${selectedGuide.id}-${idx}`)
                                                ? 'bg-emerald-400'
                                                : 'bg-gray-300'
                                    }`}
                                />
                            ))}
                        </div>

                        {currentStep < selectedGuide.steps.length - 1 ? (
                            <button
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-all shadow-sm"
                            >
                                Tiếp theo
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={onClose}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Hoàn tất
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
