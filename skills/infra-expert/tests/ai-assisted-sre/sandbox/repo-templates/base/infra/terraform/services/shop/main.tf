provider "aws" {
  region                      = var.region
  skip_credentials_validation = true
  skip_metadata_api_check      = true
  skip_requesting_account_id   = true
  endpoints {
    ec2 = var.ministack_endpoint
    ssm = var.ministack_endpoint
    sts = var.ministack_endpoint
  }
}

module "ec2" {
  source = "../../modules/ec2"

  name    = "ACME Shop"
  product = "SHOP"
  group   = "shop"
  owner   = "sre"
  ami_id  = var.ami_id

  extra_tags = {
    Service = "shop"
  }
}
