# SunEnergyXT 500 Zero Feed-in Blueprint

This repository contains the Home Assistant blueprint package for SunEnergyXT
500 / 500 Pro external-meter zero feed-in control.

The blueprint is aligned to the currently exposed Home Assistant integration
entities: `System Grid Port Power Setpoint`, `System Max Inverter Power
Setpoint`, `System Load Port Power`, `System Grid Port Power`, `PV Total Input
Power`, and `System Battery Level`.

## Files

- `blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml`:
  Home Assistant automation blueprint.
- `blueprints/automation/sunenergyxt/zero_feed_in_flow.md`:
  Mermaid flowchart for the control path.
- `docs/zero-feed-in-blueprint-setup.zh.md`:
  Chinese setup guide for Home Assistant users.
- `docs/zero-feed-in-operation-modes.zh.md`:
  Detailed Chinese guide for blueprint runtime operating modes.
- `docs/zero-feed-in-blueprint-requirements.zh.md`:
  Chinese requirements document derived from the current blueprint behavior.
- `tools/zero-feed-in-simulator.html`:
  Standalone browser simulator for the zero feed-in strategy.
- `tools/zero-feed-in-selftest.cjs`:
  Node.js self-test harness for simulator/controller consistency checks.
- `hft/`:
  7x24 hardware/firmware test-platform adapter files. These describe how the
  platform should generate HA blueprint automation cases, flows, bench setup
  notes, and reports from this repository.

## Home Assistant Import URL

Use this CDN URL when importing the blueprint:

```text
https://cdn.jsdelivr.net/gh/yanqr213/500-blueprint@main/blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml
```

Raw GitHub URL:

```text
https://raw.githubusercontent.com/yanqr213/500-blueprint/main/blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml
```

The main setup screen asks for the meter type / power formula, the meter
device, the SunEnergyXT device, `System Min Discharge SOC`, `System Max Charge
SOC`, full-battery behavior, and maximum on-grid output power. Shelly Pro 3EM,
EcoTracker, and BitShake / Tasmota normally only need the meter type and meter
device. Shelly 3EM and custom meters require the matching phase or
import/export entities. Use 800 W for SunEnergyXT 500 and 2400 W for
SunEnergyXT 500 Pro unless a stricter local limit is required.

## Local Checks

Run the simulator strategy self-test:

```bash
node tools/zero-feed-in-selftest.cjs
```

The current package passed the full matrix and closed-loop checks before upload.

## 7x24 Test Platform Adapter

For the HFT platform, create a task with:

```text
task_type: HA_BLUEPRINT_AUTOMATION
bench_type: HA 蓝图自动化实验位
source_link: https://github.com/yanqr213/500-blueprint
```

The platform can use `hft/ha_blueprint_test_matrix.json` as case seeds and
`hft/ha_blueprint_automation_flow.yaml` as the first reviewable flow draft.
MVP execution is limited to static blueprint checks, simulator self-test, entity
mapping validation, and imported HA trace review. Real Home Assistant runtime
control remains gated by the platform `local_api` review path.
