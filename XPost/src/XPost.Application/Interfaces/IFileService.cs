using System.IO;
using System.Threading.Tasks;

namespace XPost.Application.Interfaces;

public interface IFileService
{
    Task<string> SaveFileAsync(Stream fileStream, string fileName, string folder);
    bool DeleteFile(string fileUrl);
}
