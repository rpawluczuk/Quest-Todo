$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-DockerChecked {
    param([string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker/PostgreSQL failed (exit code $LASTEXITCODE). Import stopped."
    }
}

$projectDirectory = Split-Path -Parent $PSScriptRoot
$backupDirectory = Join-Path $projectDirectory '.local-backups'
$backupId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$localArchive = "/tmp/quest-todo-local-$backupId.dump"
$neonArchive = "/tmp/quest-todo-neon-before-$backupId.dump"
$neonConnection = 'host=ep-muddy-fog-b2412vo8.c-6.eu-central-1.aws.neon.tech port=5432 dbname=neondb sslmode=require connect_timeout=15'
$previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
$previousUser = [Environment]::GetEnvironmentVariable('PGUSER', 'Process')
$password = $null

Push-Location $projectDirectory
try {
    Write-Host 'Stop both local and Neon backends before running this task.'
    $runningBackend = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue
    if ($runningBackend) {
        throw 'Port 8080 is in use. Stop the backend, then run this task again.'
    }

    Invoke-DockerChecked -DockerArguments @('compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'quest_todo', '-d', 'quest_todo')
    $env:PGUSER = (Read-Host 'Neon database username').Trim()
    if ([string]::IsNullOrWhiteSpace($env:PGUSER)) { throw 'Username is required.' }
    $password = Read-Host 'Neon database password (hidden)' -AsSecureString
    if ($password.Length -eq 0) { throw 'Password is required.' }
    $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $password).Password

    # Only environment variable names are passed on the command line, never the password.
    $remotePrefix = @('compose', 'exec', '-T', '-e', 'PGUSER', '-e', 'PGPASSWORD', 'postgres')
    New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null

    Write-Host 'Backing up local database...'
    Invoke-DockerChecked -DockerArguments @('compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'quest_todo', '-d', 'quest_todo', '-Fc', '-f', $localArchive)
    Invoke-DockerChecked -DockerArguments @('compose', 'exec', '-T', 'postgres', 'pg_restore', '--list', $localArchive) | Out-Null
    Invoke-DockerChecked -DockerArguments @('compose', 'cp', "postgres:$localArchive", (Join-Path $backupDirectory "local-$backupId.dump"))

    Write-Host 'Backing up Neon before replacing application tables...'
    Invoke-DockerChecked -DockerArguments ($remotePrefix + @('pg_dump', '-d', $neonConnection, '-Fc', '-f', $neonArchive))
    Invoke-DockerChecked -DockerArguments @('compose', 'exec', '-T', 'postgres', 'pg_restore', '--list', $neonArchive) | Out-Null
    Invoke-DockerChecked -DockerArguments @('compose', 'cp', "postgres:$neonArchive", (Join-Path $backupDirectory "neon-before-$backupId.dump"))

    Write-Host 'Restoring application tables, sequences and Flyway history to Neon...'
    # All restore changes roll back if any restore statement fails.
    Invoke-DockerChecked -DockerArguments ($remotePrefix + @('pg_restore', '-d', $neonConnection, '--clean', '--if-exists', '--no-owner', '--no-privileges', '--single-transaction', $localArchive))

    $checkSql = "SELECT 'tasks', COUNT(*) FROM tasks UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'rewards', COUNT(*) FROM rewards UNION ALL SELECT 'purchases', COUNT(*) FROM purchases UNION ALL SELECT 'points', COALESCE(SUM(points), 0) FROM users UNION ALL SELECT 'flyway', COUNT(*) FROM flyway_schema_history ORDER BY 1;"
    $localSummary = @(Invoke-DockerChecked -DockerArguments @('compose', 'exec', '-T', 'postgres', 'psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'quest_todo', '-d', 'quest_todo', '-c', $checkSql))
    $neonSummary = @(Invoke-DockerChecked -DockerArguments ($remotePrefix + @('psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', $neonConnection, '-c', $checkSql)))
    if (($localSummary -join "`n") -ne ($neonSummary -join "`n")) {
        throw "Restore completed, but verification differs. Keep backends stopped and inspect backups in $backupDirectory."
    }
    Write-Host 'Import completed. Row counts, total points and migration counts match:'
    $neonSummary | ForEach-Object { Write-Host $_ }
    Write-Host "Backups: $backupDirectory"
    Write-Host 'You can now start Quest Todo: backend (Neon).'
}
finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $previousPassword, 'Process')
    [Environment]::SetEnvironmentVariable('PGUSER', $previousUser, 'Process')
    if ($null -ne $password) { $password.Dispose() }
    Pop-Location
}
