
$path = "c:\Users\THANH\Downloads\Source-XPost-demo\XPost\src\XPost.Frontend\src\pages\Keywords.tsx"
$c = Get-Content $path -Encoding UTF8

$prefix = $c[0..545]
$suffix = $c[555..($c.Length-1)]

$newBlock = @"
            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-300">
                    <div className="bg-gray-900/90 backdrop-blur-md text-white px-6 py-4 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-8">
                        <div className="flex items-center gap-3 border-r border-white/10 pr-8">
                            <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/30">
                                {selectedIds.size}
                            </div>
                            <span className="text-sm font-medium text-gray-300">Đã chọn</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsBulkConfirmOpen(true)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all font-bold text-sm group"
                            >
                                <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Xóa hàng loạt
                            </button>
                            
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmModal 
                isOpen={isConfirmOpen}
                onClose={() => { setIsConfirmOpen(false); setDeletingId(null); }}
                onConfirm={handleDelete}
                title="Xóa từ khóa"
                message="Bạn có chắc chắn muốn xóa từ khóa này? Hành động này không thể hoàn tác và nội dung đã sinh cũng sẽ bị xóa."
            />

            <ConfirmModal 
                isOpen={isBulkConfirmOpen}
                onClose={() => setIsBulkConfirmOpen(false)}
                onConfirm={handleBulkDelete}
                title="Xóa từ khóa hàng loạt"
                message={`Bạn có chắc chắn muốn xóa `{`${selectedIds.size}`} từ khóa đã chọn? Hành động này không thể hoàn tác.`}
            />
"@

$final = $prefix + $newBlock + $suffix
Set-Content $path $final -Encoding UTF8
Write-Output "Successfully updated Keywords.tsx via line slicing"
