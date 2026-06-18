$connString = "Server=PC-THANH;Database=XPost;Integrated Security=true;TrustServerCertificate=True;MultipleActiveResultSets=true"
$connection = New-Object System.Data.SqlClient.SqlConnection($connString)
$connection.Open()
$command = $connection.CreateCommand()
$command.CommandText = "SELECT MessengerPageToken FROM Chatbots WHERE MessengerPageId = '1167203033134753'"
$token = $command.ExecuteScalar()
$connection.Close()

if ($token) {
    Write-Host "Token found. Testing Meta Graph API..."
    $body = @{
        ice_breakers = @(
            @{
                locale = "default"
                call_to_actions = @(
                    @{
                        question = "Xin chào, tôi muốn hỏi giá sản phẩm"
                        payload = "Xin chào, tôi muốn hỏi giá sản phẩm"
                    },
                    @{
                        question = "Shop có những dịch vụ nào?"
                        payload = "Shop có những dịch vụ nào?"
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 5

    $url = "https://graph.facebook.com/v21.0/me/messenger_profile?access_token=$token"
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
        Write-Host "Success Response:"
        $response | Format-List | Out-String | Write-Host
    } catch {
        Write-Host "Error Response:"
        $_ | Format-List | Out-String | Write-Host
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
            Write-Host "Error Body: $errBody"
        }
    }
} else {
    Write-Host "No chatbot found for Page ID 1167203033134753"
}
