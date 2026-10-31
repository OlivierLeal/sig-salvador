provider "aiven" {
  api_token = var.aiven_api_token
}

import {
  to = aiven_pg.atlas
  id = "${var.aiven_project}/${var.pg_service_name}"
}

resource "aiven_pg" "atlas" {
  project      = var.aiven_project
  service_name = var.pg_service_name
  plan         = var.pg_plan
  cloud_name   = var.pg_cloud

  pg_user_config {
    pg_version = var.pg_version
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "random_password" "app" {
  length  = 32
  special = false
}

resource "aiven_pg_user" "app" {
  project      = aiven_pg.atlas.project
  service_name = aiven_pg.atlas.service_name
  username     = var.app_username
  password     = random_password.app.result
}
