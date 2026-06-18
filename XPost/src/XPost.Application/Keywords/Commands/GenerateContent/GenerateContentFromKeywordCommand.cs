using MediatR;
using Microsoft.Extensions.Logging;
using XPost.Application.Interfaces;
using XPost.Domain.Entities;
using XPost.Domain.Enums;
using XPost.Domain.Interfaces;

namespace XPost.Application.Keywords.Commands.GenerateContent;

public class GenerateContentFromKeywordCommand : IRequest<bool>
{
    public Guid KeywordId { get; set; }
    public ContentGenerationType Type { get; set; } = ContentGenerationType.ShortIntro;
}

public class GenerateContentFromKeywordCommandHandler : IRequestHandler<GenerateContentFromKeywordCommand, bool>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAIService _aiService;
    private readonly Microsoft.Extensions.Logging.ILogger<GenerateContentFromKeywordCommandHandler> _logger;

    public GenerateContentFromKeywordCommandHandler(IUnitOfWork unitOfWork, IAIService aiService, Microsoft.Extensions.Logging.ILogger<GenerateContentFromKeywordCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _logger = logger;
    }

    public async Task<bool> Handle(GenerateContentFromKeywordCommand request, CancellationToken cancellationToken)
    {
        var repo = _unitOfWork.Repository<Keyword>();
        var keyword = await repo.GetByIdAsync(request.KeywordId);

        if (keyword == null) return false;

        try
        {
            keyword.Status = KeywordStatus.Generating;
            await repo.UpdateAsync(keyword);
            await _unitOfWork.CompleteAsync();

            string promptTemplate = "";

            if (request.Type == ContentGenerationType.DetailedArticle)
            {
                promptTemplate = "Hãy đóng vai một chuyên gia Content Strategy của Công ty TNHH Mạng Xuyên Việt. " +
                                 "Hãy viết một bài viết chuyên sâu và lôi cuốn về chủ đề: {keyword}.\n\n" +
                                 "YÊU CẦU QUAN TRỌNG VỀ ĐỊNH DẠNG (BẮT BUỘC):\n" +
                                 "- TUYỆT ĐỐI KHÔNG sử dụng các biểu tượng (Icons), Emojis hay các ký tự đặc biệt trang trí (ví dụ: 🌐, 🚀, 💡, 🔗, v.v.). NGOẠI TRỪ dấu # được phép dùng cho hashtag ở cuối bài.\n" +
                                 "- KHÔNG được ghi các nhãn thành phần như 'Mở bài', 'Thân bài', 'Đoạn 1', 'Đoạn 2', 'Kết luận' vào trong văn bản. Hãy để nội dung tự dẫn dắt mạch lạc.\n" +
                                 "- KHÔNG sử dụng các dấu hoa thị (*) hoặc gạch ngang (-) ở đầu đoạn văn nếu không yêu cầu liệt kê.\n" +
                                 "- Văn bản phải trông như một bài báo chuyên nghiệp, trang trọng.\n\n" +
                                 "YÊU CẦU NỘI DUNG:\n" +
                                 "- Độ dài: Khoảng 400 từ.\n" +
                                 "- Mở đầu: Dẫn dắt từ bối cảnh thị trường công nghệ hiện nay, nêu bật tầm quan trọng của vấn đề.\n" +
                                 "- Nội dung chính (Chia làm 3 đoạn văn tự nhiên):\n" +
                                 "  1. Phân tích chuyên sâu về lợi ích kỹ thuật và giá trị thực tế của dịch vụ/vấn đề.\n" +
                                 "  2. Khẳng định năng lực của Mạng Xuyên Việt (Đội ngũ IT trình độ cao, giải pháp tối ưu, công nghệ hiện đại).\n" +
                                 "  3. Những cam kết về chất lượng và hỗ trợ hậu mãi mà khách hàng nhận được.\n" +
                                 "- Kết bài: Đúc kết giá trị và đưa ra lời kêu gọi hành động (Call to Action) mạnh mẽ.\n" +
                                 "- Hashtags (BẮT BUỘC): Dưới cùng của bài viết, in thêm đúng 3 hashtag liên quan sâu sắc. 1 hashtag là của công ty (ví dụ: #MangXuyenViet), 2 hashtag còn lại liên quan trực tiếp đến nội dung bài viết.\n" +
                                 "- Ngôn ngữ: Tiếng Việt, hành văn chuyên nghiệp, hiện đại, thể hiện vị thế công ty công nghệ uy tín.";
            }
            else
            {
                promptTemplate = "Hãy đóng vai một chuyên gia Content Marketing. " +
                                 "Viết một đoạn giới thiệu ngắn (tối đa 160 ký tự) cho từ khóa: {keyword} của Công ty TNHH Mạng Xuyên Việt.\n\n" +
                                 "YÊU CẦU ĐỊNH DẠNG:\n" +
                                 "- KHÔNG sử dụng Icons, Emojis.\n" +
                                 "- KHÔNG sử dụng các ký tự trang trí (Ngoại trừ dấu # cho hashtag ở cuối).\n\n" +
                                 "YÊU CẦU NỘI DUNG:\n" +
                                 "- Giọng văn: Chuyên nghiệp, tin cậy, cảm hứng.\n" +
                                 "- Cấu trúc: Nêu bật giá trị cốt lõi và kết thúc bằng CTA ngắn gọn.\n" +
                                 "- Hashtags: Thêm đúng 3 hashtag ở cuối (1 hashtag #MangXuyenViet, 2 hashtag liên quan nội dung).\n" +
                                 "- Từ ngữ: 'Giải pháp tối ưu', 'Đột phá', 'Chuyên nghiệp', 'Hàng đầu'.\n" +
                                 "- Ngôn ngữ: Tiếng Việt.";
            }

            var content = await _aiService.GenerateContentAsync(keyword.Name, promptTemplate, cancellationToken);

            keyword.GeneratedContent = content;
            keyword.Status = KeywordStatus.Completed;
            keyword.LastGeneratedAtUtc = DateTime.UtcNow;
            keyword.LastErrorMessage = null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating AI content for keyword {KeywordId}: {Message}", request.KeywordId, ex.Message);
            keyword.Status = KeywordStatus.Failed;
            keyword.LastErrorMessage = ex.Message;
        }

        await repo.UpdateAsync(keyword);
        await _unitOfWork.CompleteAsync();

        return keyword.Status == KeywordStatus.Completed;
    }
}
