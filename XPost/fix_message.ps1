
$path = "c:\Users\THANH\Downloads\Source-XPost-demo\XPost\src\XPost.Frontend\src\pages\Keywords.tsx"
$content = Get-Content $path -Raw -Encoding UTF8

$target = "message={Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a {`${selectedIds.size}`} tá»« khÃ³a Ä‘Ã£ chá» n? HÃ nh Ä‘á»™ng nÃ y khÃ´ng thá»ƒ hoÃ n tÃ¡c.}"
$replacement = 'message={`Bạn có chắc chắn muốn xóa ${selectedIds.size} từ khóa đã chọn? Hành động này không thể hoàn tác.`}'

if ($content.Contains("message={Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a")) {
    $newContent = $content -replace 'message=\{Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a.*?\}', $replacement
    Set-Content $path $newContent -Encoding UTF8
    Write-Output "Successfully fixed the broken message line."
} else {
    Write-Error "Could not find the broken message line."
}
