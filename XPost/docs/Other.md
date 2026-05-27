cd D:\Dropbox\XPost\src\XPost.WorkerService
publish:  dotnet publish -c Release -o "d:\Dropbox\XPost\publish\worker"
dotnet publish -c Release -o "d:\Dropbox\XPost\publish\api"
dotnet publish -c Release -o "d:\Dropbox\XPost\publish\worker"

Nó sẽ làm liền 1 mạch 2 việc:

Dịch Code ra file tĩnh siêu nhỏ (npm run build).
Tự động múc toàn bộ ruột ném thẳng vào thư mục d:\Dropbox\XPost\publish\frontend.
Khi chạy xong báo sucess, bạn lên Server và làm bước lấy Code bình thường thôi! Thử gõ npm run publish ngay để trải nghiệm nhé.

Chạy lệnh này trên xpost
Stop-Process -Name dotnet -Force -ErrorAction SilentlyContinue

Chạy lệnh này trên xpost hoặc webapi
dotnet run --project src/XPost.WebAPI

Dạ, để bắt buộc đóng (Force Kill) một tiến trình đang bị kẹt trên Windows, anh có thể sử dụng các lệnh sau tùy thuộc vào loại Terminal mà anh đang dùng:

### 1. Nếu anh dùng PowerShell (Khuyên dùng)
PowerShell có sẵn lệnh `Stop-Process` rất mạnh mẽ và dễ nhớ.

*   **Đóng theo mã PID cụ thể (như PID 6048 của anh):**
    ```powershell
    Stop-Process -Id 6048 -Force
    ```
*   **Đóng theo tên tiến trình (tiện nhất vì không cần nhớ mã PID):**
    ```powershell
    # Đóng thẳng file .exe của dự án
    Stop-Process -Name XPost.WebAPI -Force
    
    # Hoặc đôi khi WebAPI được chạy dưới tiến trình host chung là dotnet
    Stop-Process -Name dotnet -Force
    ```
    *(**Mẹo:** Lệnh đóng theo tên sẽ tìm và ngắt tất cả các tiến trình có tên tương ứng đang chạy).*

### 2. Nếu anh dùng Command Prompt (CMD)
Sử dụng công cụ `taskkill` mặc định của Windows. Lệnh này cũng chạy được trên cả terminal của VS Code:

*   **Đóng theo mã PID:**
    ```cmd
    taskkill /PID 6048 /F
    ```
*   **Đóng theo tên file thực thi (.exe):**
    ```cmd
    taskkill /IM XPost.WebAPI.exe /F
    
    taskkill /IM dotnet.exe /F
    ```

*(Trong đó tham số `-Force` hoặc `/F` mang ý nghĩa là bắt buộc đóng ngay lập tức mà không chờ chương trình phản hồi).* 

Lần sau nếu anh bị báo lỗi `locked by another process` khi *Build* hoặc *Run*, anh chỉ cần gõ cụm lệnh ngắt theo tên `Stop-Process -Name dotnet -Force` là file bị khoá sẽ được giải phóng ngay lập tức ạ!