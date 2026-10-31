variable "aiven_api_token" {
  type      = string
  sensitive = true
}

variable "aiven_project" {
  type = string
}

variable "pg_service_name" {
  type = string
}

variable "pg_plan" {
  type    = string
  default = "free-1-1gb"
}

variable "pg_cloud" {
  type        = string
  description = "cloud da Aiven"
}

variable "pg_version" {
  type    = string
  default = "18"
}

variable "app_username" {
  type    = string
  default = "atlas_app"
}
