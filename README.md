# SunEnergyXT 500 Zero Feed-in Blueprint

This repository contains the Home Assistant blueprint package for SunEnergyXT
500 / 500 Pro external-meter zero feed-in control.

## Files

- `blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml`:
  Home Assistant automation blueprint.
- `blueprints/automation/sunenergyxt/zero_feed_in_flow.md`:
  Mermaid flowchart for the control path.
- `docs/zero-feed-in-blueprint-setup.zh.md`:
  Chinese setup guide for Home Assistant users.
- `tools/zero-feed-in-simulator.html`:
  Standalone browser simulator for the zero feed-in strategy.
- `tools/zero-feed-in-selftest.cjs`:
  Node.js self-test harness for simulator/controller consistency checks.

## Home Assistant Import URL

Use this raw URL when importing the blueprint:

```text
https://raw.githubusercontent.com/yanqr213/500-blueprint/main/blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml
```

## Local Checks

Run the simulator strategy self-test:

```bash
node tools/zero-feed-in-selftest.cjs
```

The current package passed the full matrix and closed-loop checks before upload.
