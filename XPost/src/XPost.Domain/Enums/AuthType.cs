namespace XPost.Domain.Enums;

public enum AuthType
{
    None = 0,
    ApiKey = 1,
    BearerToken = 2,
    OAuth2 = 3,
    HmacSignature = 4
}
