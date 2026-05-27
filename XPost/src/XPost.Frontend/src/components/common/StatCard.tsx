export interface StatBreakdown {
    pending: number;
    published: number;
    failed: number;
}

export default function StatCard({
    title,
    total,
    breakdown,
    accent,
}: {
    title: string;
    total: number;
    breakdown: StatBreakdown;
    accent: string;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 p-6 flex flex-col gap-2 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:border-gray-200 transition-all duration-300 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-full border-t-[3px] ${accent} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-gray-900">{total}</p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block shadow-sm" />
                    {breakdown.pending} <span className="text-gray-400 font-normal">Chờ</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block shadow-sm" />
                    {breakdown.published} <span className="text-gray-400 font-normal">Xong</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block shadow-sm" />
                    {breakdown.failed} <span className="text-gray-400 font-normal">Lỗi</span>
                </span>
            </div>
        </div>
    );
}
