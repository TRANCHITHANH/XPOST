-- Script dọn dẹp PostTargets bị stuck cho Threads
-- Chạy: sqlcmd -S localhost\SQLEXPRESS -d XPost -C -i cleanup.sql

-- 1. Xem các PostTarget đang stuck
PRINT '=== PostTargets đang stuck ==='
SELECT pt.Id, pt.Status, pt.RetryCount, pt.IsProcessing, 
       LEFT(pt.LastError, 150) as LastError, sa.AccountName, sa.Platform
FROM PostTargets pt 
JOIN SocialAccounts sa ON pt.SocialAccountId = sa.Id 
WHERE pt.Status IN (0, 1) -- Pending hoặc Processing
ORDER BY pt.CreatedAtUtc DESC;

-- 2. Đánh dấu tất cả PostTarget stuck là Failed
UPDATE PostTargets 
SET Status = 3, IsProcessing = 0, LastError = 'Cleaned up by admin script'
WHERE Status IN (0, 1) AND RetryCount >= 1;

PRINT '=== Đã dọn dẹp PostTargets stuck ==='

-- 3. Xác nhận
SELECT COUNT(*) as RemainingPending FROM PostTargets WHERE Status IN (0, 1);
