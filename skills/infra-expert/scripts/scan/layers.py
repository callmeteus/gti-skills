"""Map a Terraform resource type to the layer it belongs to.

The layers are described in references/concepts/layers.md. The first matching
prefix wins, so specific prefixes come before general ones.
"""

LAYER_PREFIXES = [
    ("network", (
        "aws_vpc", "aws_subnet", "aws_route_table", "aws_route", "aws_main_route_table", "aws_internet_gateway",
        "aws_egress_only_internet_gateway", "aws_nat_gateway", "aws_eip", "aws_security_group", "aws_network_acl",
        "aws_network_interface", "aws_default_vpc", "aws_default_subnet", "aws_default_security_group",
        "aws_default_network_acl", "aws_default_route_table", "aws_ec2_transit_gateway", "aws_vpn", "aws_customer_gateway",
        "aws_dx_", "aws_lb", "aws_alb", "aws_elb", "aws_globalaccelerator", "aws_cloudfront", "aws_route53",
        "aws_acm", "aws_api_gateway_domain", "aws_apigatewayv2_domain", "aws_flow_log", "aws_networkfirewall",
        "aws_wafv2", "aws_service_discovery", "cloudflare_", "google_compute_network", "google_compute_subnetwork",
        "google_compute_firewall", "google_compute_router", "google_dns", "azurerm_virtual_network", "azurerm_subnet",
        "azurerm_network_security", "azurerm_dns", "digitalocean_vpc", "digitalocean_firewall", "digitalocean_domain",
    )),
    ("storage", (
        "aws_s3", "aws_efs", "aws_ebs", "aws_volume_attachment", "aws_fsx", "aws_backup", "aws_glacier",
        "aws_ecr", "aws_datasync", "aws_storagegateway", "google_storage", "azurerm_storage", "digitalocean_spaces",
        "digitalocean_volume", "minio_",
    )),
    ("data", (
        "aws_db_", "aws_rds", "aws_dynamodb", "aws_elasticache", "aws_memorydb", "aws_docdb", "aws_neptune",
        "aws_redshift", "aws_opensearch", "aws_elasticsearch", "aws_msk", "aws_kinesis", "aws_sqs", "aws_sns",
        "aws_mq", "aws_cloudwatch_event", "aws_scheduler", "aws_pipes", "aws_glue", "aws_athena",
        "google_sql", "google_redis", "google_pubsub", "azurerm_postgresql", "azurerm_mssql", "azurerm_redis",
        "digitalocean_database", "postgresql_", "mysql_", "rabbitmq_", "kafka_",
    )),
    ("identity", (
        "aws_iam", "aws_kms", "aws_secretsmanager", "aws_ssm_parameter", "aws_cognito", "aws_identitystore",
        "aws_ssoadmin", "aws_organizations", "aws_account", "aws_acmpca", "google_service_account",
        "google_project_iam", "google_kms", "azurerm_role", "azurerm_key_vault", "azuread_", "vault_", "tls_",
        "random_password", "github_actions_secret",
    )),
    ("observability", (
        "aws_cloudwatch", "aws_prometheus", "aws_grafana", "aws_xray", "aws_cloudtrail", "aws_config",
        "aws_guardduty", "aws_securityhub", "grafana_", "datadog_", "newrelic_", "pagerduty_", "opsgenie_",
        "google_monitoring", "google_logging", "azurerm_monitor", "azurerm_log_analytics", "sentry_",
    )),
    ("compute", (
        "aws_instance", "aws_launch_template", "aws_launch_configuration", "aws_autoscaling", "aws_ecs",
        "aws_eks", "aws_lambda", "aws_batch", "aws_lightsail", "aws_apprunner", "aws_elastic_beanstalk",
        "aws_api_gateway", "aws_apigatewayv2", "aws_sfn", "aws_key_pair", "aws_ami", "aws_spot",
        "aws_codebuild", "aws_codepipeline", "aws_codedeploy", "kubernetes_", "helm_", "kubectl_",
        "google_compute_instance", "google_container", "google_cloud_run", "google_cloudfunctions",
        "azurerm_linux_virtual_machine", "azurerm_kubernetes", "azurerm_container", "digitalocean_droplet",
        "digitalocean_kubernetes", "digitalocean_app", "docker_", "null_resource", "terraform_data",
    )),
    ("foundation", (
        "aws_budgets", "aws_ce_", "aws_servicequotas", "aws_resourcegroups", "github_", "gitlab_", "tfe_",
        "google_project", "google_folder", "azurerm_resource_group", "azurerm_management_group", "random_",
        "time_", "local_", "archive_", "external",
    )),
]

LAYERS = [name for name, _ in LAYER_PREFIXES] + ["other"]


def layer_of(resource_type):
    for name, prefixes in LAYER_PREFIXES:
        if resource_type.startswith(prefixes):
            return name
    return "other"
