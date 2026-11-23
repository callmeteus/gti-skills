# One VM per call. MiniStack makes the `aws_instance` a Docker container; no
# other AWS service is involved, and no networking resource is created here.
resource "aws_instance" "this" {
  count         = var.instance_count
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = var.subnet_id

  tags = merge(local.fleet_tags, var.extra_tags)

  lifecycle {
    # The replacement instance is created before the old one is destroyed.
    create_before_destroy = true
  }
}
