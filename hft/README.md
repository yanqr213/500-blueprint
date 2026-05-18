# 7x24 HFT Adapter for SunEnergyXT 500 Blueprint

This folder describes how the 7x24 hardware/firmware black-box test platform
should consume this Home Assistant blueprint repository.

The blueprint files remain the product truth. The files in this folder are the
test-platform adapter: they help the platform turn a GitHub repository link into
reviewable cases, automation flows, bench setup notes, and report output.

## Platform Task

- `task_type`: `HA_BLUEPRINT_AUTOMATION`
- `bench_type`: `HA 蓝图自动化实验位`
- `report_type`: `HA蓝图自动化测试报告`
- Recommended priority: `P1` before real Home Assistant runtime execution, `P0`
  once the blueprint gates a release.

## Source Files

- `blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml`
- `blueprints/automation/sunenergyxt/zero_feed_in_flow.md`
- `docs/zero-feed-in-blueprint-setup.zh.md`
- `tools/zero-feed-in-simulator.html`
- `tools/zero-feed-in-selftest.cjs`

## Platform Ingestion Contract

1. Read this repository as source material.
2. Load `hft/ha_blueprint_test_matrix.json` as case seeds.
3. Compile editable `case_catalog.json/md`.
4. Compile `automation_flow.yaml` from the generated cases, or use
   `hft/ha_blueprint_automation_flow.yaml` as the first reviewable draft.
5. Save `hft/ha_blueprint_bench_scenario_setup.md` as the default bench setup
   note.
6. Save `hft/ha_blueprint_report_template.md` as the report template.

## Execution Boundary

MVP execution is intentionally limited:

- Allowed local-runner checks:
  - `run_ha_blueprint_static_check`
  - `run_ha_simulator_selftest`
  - `validate_ha_entity_mapping`
  - `collect_ha_trace_placeholder`
- Reserved by default:
  - real Home Assistant runtime connection
  - HA service calls that mutate entities
  - Local API / LAN API control of real devices
  - direct device commands

The platform may collect manually exported HA trace and entity-state snapshots as
evidence. Real runtime automation must pass a separate `local_api` gate.

## Minimum Acceptance

- At least 12 editable cases are generated.
- Every case has source references, preconditions, steps, assertions, evidence,
  and recovery.
- Evidence includes one of:
  - `ha_blueprint_yaml_static_result`
  - `ha_entity_mapping_snapshot`
  - `simulator_selftest_result`
  - `ha_automation_trace`
  - `ha_entity_state_snapshot`
- The final report states whether the blueprint is ready for static/simulator
  validation, HA runtime validation, or blocked.
