$connString = "Server=PC-THANH;Database=XPost;Integrated Security=true;TrustServerCertificate=True"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Chatbots') AND name = 'IceBreakersJson')
    BEGIN
        ALTER TABLE Chatbots ADD IceBreakersJson NVARCHAR(MAX) NULL;
        SELECT 'Added IceBreakersJson to Chatbots';
    END
    ELSE
    BEGIN
        SELECT 'IceBreakersJson already exists in Chatbots';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Keywords') AND name = 'ImageUrl')
    BEGIN
        ALTER TABLE Keywords ADD ImageUrl NVARCHAR(2000) NULL;
        SELECT 'Added ImageUrl to Keywords';
    END
    ELSE
    BEGIN
        SELECT 'ImageUrl already exists in Keywords';
    END
"@
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Output $reader.GetValue(0)
    }
    $reader.Close()
    
    # Let's also check table columns to be absolutely sure
    $cmd.CommandText = "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('Keywords')"
    $reader = $cmd.ExecuteReader()
    $columns = @()
    while ($reader.Read()) {
        $columns += $reader.GetString(0)
    }
    $reader.Close()
    Write-Output "Keywords columns: $($columns -join ', ')"
    
    $conn.Close()
    Write-Output "Schema check completed."
} catch {
    Write-Error $_.Exception.Message
}
