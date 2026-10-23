output "pg_host" {
  value = aiven_pg.atlas.service_host
}

output "pg_port" {
  value = aiven_pg.atlas.service_port
}

output "admin_uri" {
  value     = aiven_pg.atlas.service_uri
  sensitive = true
}

output "app_database_url" {
  value     = "postgres://${aiven_pg_user.app.username}:${aiven_pg_user.app.password}@${aiven_pg.atlas.service_host}:${aiven_pg.atlas.service_port}/defaultdb?sslmode=require"
  sensitive = true
}
