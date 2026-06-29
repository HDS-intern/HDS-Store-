# Creates the local PostgreSQL role/database used by .env.local.
# Usage: .\scripts\setup-postgres.ps1

param(
  [int]$Port = 5433,
  [string]$SuperUser = 'postgres',
  [string]$SuperUserPassword = 'admin',
  [string]$AppUser = 'hds',
  [string]$AppPassword = 'hds_dev_password',
  [string]$Database = 'hds_store'
)

$ErrorActionPreference = 'Stop'

function Find-Psql {
  foreach ($version in 18, 16) {
    $candidate = "C:\Program Files\PostgreSQL\$version\bin\psql.exe"
    if (Test-Path $candidate) { return $candidate }
  }
  throw 'psql not found. Install PostgreSQL or update the path in this script.'
}

$psql = Find-Psql
$env:PGPASSWORD = $SuperUserPassword

Write-Host "Using $psql on port $Port..."

& $psql -U $SuperUser -h localhost -p $Port -d postgres -v ON_ERROR_STOP=1 -c @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$AppUser') THEN
    CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';
  ELSE
    ALTER ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword';
  END IF;
END `$`$;
"@

$exists = & $psql -U $SuperUser -h localhost -p $Port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$Database'"
if (-not $exists) {
  & $psql -U $SuperUser -h localhost -p $Port -d postgres -c "CREATE DATABASE $Database OWNER $AppUser"
}

& $psql -U $SuperUser -h localhost -p $Port -d $Database -c "GRANT ALL ON SCHEMA public TO $AppUser;"

Write-Host "PostgreSQL ready: postgresql://${AppUser}:${AppPassword}@localhost:${Port}/${Database}"
