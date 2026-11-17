# Area: Grafana as code

Dashboards, alert rules, datasources, contact points, notification policies, and the Prometheus config that feeds them, kept in a repository as JSON, YAML, Jsonnet, or Terraform `grafana_*` resources. `grafana_scan.py` finds most leads.

## Datasources

- **Fixed, readable UIDs.** Provision every datasource with a UID chosen by hand (`prom-main`, `loki-main`). Generated UIDs copied into dashboards break on a new Grafana instance and say nothing to a reader.
- **One way to refer to them.** Dashboards use a datasource template variable (`${datasource}`) or the fixed UID, not a mix of generated UIDs, names, import placeholders (`${DS_PROMETHEUS}`, which only works through the import screen), and legacy strings.
- **Unprovisioned UIDs** (`unprovisioned_datasources`): a dashboard refers to a datasource the repository does not define. Either it was created by hand in the UI (provision it) or it is gone (fix the dashboard).
- Changing a datasource UID changes every reference. Do it in one change with a search and replace across the repository, and check alert rules too.

## Bases and copies

- **Alert rules**: concrete rules should only set variables on a base. The scan lists base files and their children; `near_copies` of alert rules that do not extend a base are candidates to become children. Rules that differ only in a threshold or level belong in one base with a repeat over a list.
- **Dashboards copied per tenant or environment** (`near_copies` of dashboards): one template with a tenant or environment variable, or one generated file per tenant from a single source. Before merging, list how the copies drifted; each difference is either a variable or a fix.
- **Bases in the wrong place**: a generic base (an HTTP check) stored under one product's folder and extended from another product is a hidden link. Move it to a shared models folder.
- **Repeated queries** (`repeated_queries`): the same expression in three or more files is a recording rule or a library panel.

## Generated files

- Keep generated output outside the hand-written tree, or mark it and add a CI check that regenerates and compares.
- A "one-off" generator committed next to its output either runs in the pipeline or is deleted once the output becomes the source.
- Two implementations of the same generator in two languages drift; keep one.

## Layout and ownership

- Mirror one taxonomy across alerting and dashboards (product, then tenant), and keep pieces in their product folder.
- Notification policies route on labels the rules actually set; test receivers and temporary routes carry an owner and end date.
- Unreferenced contact points and legacy folders are leftovers.
- The Grafana host, its datasources, and the scrape config often live in different repositories. Name the owner of each in the report; split ownership is a finding even when nothing is broken yet.

## Deployment

- A long imperative deploy script that diffs, creates folders, and deletes orphans by hand reimplements what file provisioning, the Terraform grafana provider, or Grafana's Git sync do. Note it as a candidate; the change is large, so it is rarely the one to start with.
- Whatever applies changes should also validate them: JSON parse, UID uniqueness, link checks, and an expand or render step, all in CI before apply.

## Verification

Run the repository's own expand, render, or validate scripts before and after a change and compare the output. Dashboards and rules that should be unchanged must produce identical output, apart from fields the change targets.
