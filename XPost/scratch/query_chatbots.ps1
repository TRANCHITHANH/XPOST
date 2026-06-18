$connString = "Server=PC-THANH;Database=XPost;Integrated Security=true;TrustServerCertificate=True;MultipleActiveResultSets=true"
$connection = New-Object System.Data.SqlClient.SqlConnection($connString)
$connection.Open()
$command = $connection.CreateCommand()
$command.CommandText = "SELECT Id, Name, MessengerPageId, MessengerPageToken, IsActive FROM Chatbots"
$reader = $command.ExecuteReader()
while ($reader.Read()) {
    $id = $reader["Id"]
    $name = $reader["Name"]
    $pageId = $reader["MessengerPageId"]
    $token = $reader["MessengerPageToken"]
    Write-Host "ID: $id | Name: $name | PageId: $pageId | Token: $token"
}
$connection.Close()
