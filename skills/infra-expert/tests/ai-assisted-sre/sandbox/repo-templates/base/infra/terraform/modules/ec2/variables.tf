variable "name" {
  description = "Human name recorded in the inventory"
  type        = string
}

variable "product" {
  description = "Short product id"
  type        = string
}

variable "ambient" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "group" {
  description = "Owning group"
  type        = string
  default     = "sre"
}

variable "owner" {
  description = "Owning team"
  type        = string
  default     = "sre"
}

variable "ami_id" {
  description = "Registered MiniStack AMI"
  type        = string
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "instance_count" {
  type    = number
  default = 1
}

variable "subnet_id" {
  description = "MiniStack default subnet"
  type        = string
  default     = "subnet-00000001"
}

variable "extra_tags" {
  type    = map(string)
  default = {}
}
