variable "region" {
  type    = string
  default = "us-east-1"
}

variable "ministack_endpoint" {
  description = "MiniStack API endpoint; override with AWS_ENDPOINT_URL in the environment"
  type        = string
  default     = "http://ministack.acme.test:4566"
}

variable "ami_id" {
  type = string
}
