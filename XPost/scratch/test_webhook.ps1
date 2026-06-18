$guid = [Guid]::NewGuid().ToString("N")
$body = '{"object":"page","entry":[{"id":"1167203033134753","time":1718010000000,"messaging":[{"sender":{"id":"26817232997934067"},"recipient":{"id":"1167203033134753"},"timestamp":1718010000000,"message":{"mid":"mid.test_' + $guid + '","text":"Xin chao chatbot!"}}]}]}'

$secret = '6a6307a008ed0c6efb30ea8d35fb6cf7'
$hmacsha = New-Object System.Security.Cryptography.HMACSHA256
$hmacsha.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$signatureBytes = $hmacsha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body))
$signature = [System.BitConverter]::ToString($signatureBytes).Replace("-", "").ToLower()

$headers = @{
    "X-Hub-Signature-256" = "sha256=$signature"
}

Write-Host "Sending body: $body"
Write-Host "Signature: sha256=$signature"

$response = Invoke-WebRequest -Uri "http://localhost:5243/api/messenger/webhook" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
Write-Host "Response Status: $($response.StatusCode)"
Write-Host "Response Content: $($response.Content)"
