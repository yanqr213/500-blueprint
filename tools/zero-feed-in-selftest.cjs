#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const htmlPath = path.join(__dirname, "zero-feed-in-simulator.html");
const html = fs.readFileSync(htmlPath, "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) {
  throw new Error("No inline simulator script found.");
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);

function createElement(id) {
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    style: {},
    attrs: {},
    listeners: {},
    classList: {
      classes: new Set(),
      add(...names) {
        names.forEach((name) => this.classes.add(name));
      },
      remove(...names) {
        names.forEach((name) => this.classes.delete(name));
      }
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    }
  };
}

function createHarness() {
  const elements = Object.fromEntries(ids.map((id) => [id, createElement(id)]));

  for (const match of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g)) {
    elements[match[1]].value = match[2];
  }

  elements.deviceType.value = "500pro";
  elements.fullBatteryMode.value = "follow_load";

  const intervals = [];
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return elements[id] || null;
      }
    },
    window: {
      setInterval(fn, ms) {
        intervals.push({ fn, ms });
        return intervals.length;
      }
    },
    Date,
    Math,
    Number,
    console,
    Set
  });

  new vm.Script(scriptMatch[1], { filename: "zero-feed-in-simulator.inline.js" }).runInContext(context);
  vm.runInContext(`
    function selfTestStep() {
      if (!state.running) return;
      state.tick += 1;
      let snap = snapshot();
      if (updateSocHolds(snap)) {
        snap = snapshot();
      }
      let ports = simulatePorts(snap);
      if (updateHardwareProtection(snap, ports)) {
        ports = simulatePorts(snap);
      }
      computeController(snap, ports, true);
    }
  `, context);

  function setInputs(values) {
    for (const [key, value] of Object.entries(values)) {
      if (!vm.runInContext(`Object.prototype.hasOwnProperty.call(controls, ${JSON.stringify(key)})`, context)) {
        continue;
      }
      vm.runInContext(`controls.${key}.value = ${JSON.stringify(String(value))}`, context);
    }
  }

  function resetState(values = {}) {
    const defaults = {
      running: true,
      tick: 0,
      gs: 0,
      is: 2400,
      lastGsWriteTick: -999,
      lastIsWriteTick: -999,
      loadPortConnected: true,
      loadPortReconnectTick: 0,
      fullChargeHold: false,
      lowDischargeHold: false,
      logs: []
    };
    for (const [key, value] of Object.entries({ ...defaults, ...values })) {
      vm.runInContext(`state.${key} = ${JSON.stringify(value)}`, context);
    }
  }

  function snapshot() {
    vm.runInContext("updateSocHolds(snapshot())", context);
    return JSON.parse(vm.runInContext("JSON.stringify(snapshot())", context));
  }

  function ports() {
    return JSON.parse(vm.runInContext("JSON.stringify((() => { updateSocHolds(snapshot()); return simulatePorts(snapshot()); })())", context));
  }

  function controller() {
    return JSON.parse(vm.runInContext("JSON.stringify((() => { updateSocHolds(snapshot()); const s = snapshot(); const p = simulatePorts(s); return computeController(s, p, false); })())", context));
  }

  function state() {
    return JSON.parse(vm.runInContext("JSON.stringify(state)", context));
  }

  function step(times = 1) {
    for (let index = 0; index < times; index += 1) {
      vm.runInContext("selfTestStep()", context);
    }
  }

  return {
    elements,
    setInputs,
    resetState,
    snapshot,
    ports,
    controller,
    state,
    step
  };
}

const baseInputs = {
  deviceType: "500pro",
  userGridLimit: 2400,
  homeLoad: 0,
  loadPortPower: 0,
  pvPower: 0,
  soc: 50,
  socLow: 10,
  socHigh: 90,
  socHys: 5,
  targetGrid: 0,
  fullBatteryMode: "follow_load",
  acChargeLimit: 2400
};

const failures = [];
const epsilon = 1e-6;

function fail(name, detail, data) {
  failures.push({ name, detail, data });
}

function nearlyEqual(a, b, tolerance = epsilon) {
  return Math.abs(a - b) <= tolerance;
}

function assertCondition(name, condition, detail, data) {
  if (!condition) {
    fail(name, detail, data);
  }
}

function finiteObject(name, object, data) {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      fail(name, `${key} is not finite`, data);
    }
  }
}

function canAbsorbAllLoadBackfeed(snap, ports) {
  const gridChargeRequest = Math.max(-ports.gridCommand, 0);
  const acChargeCapacity = snap.soc < snap.socHigh ? Math.min(snap.acChargeLimit, 2400) : 0;
  const remainingAcChargeForLoadPort = Math.max(acChargeCapacity - gridChargeRequest, 0);
  const positiveGridAbsorption = Math.max(ports.hardwareGridDemand, 0);
  return positiveGridAbsorption + remainingAcChargeForLoadPort + epsilon >= ports.loadPortBackfeed;
}

function checkInstantCase(name, inputs, stateValues = {}) {
  const harness = createHarness();
  harness.setInputs({ ...baseInputs, ...inputs });
  harness.resetState(stateValues);
  const snap = harness.snapshot();
  const ports = harness.ports();
  const state = harness.state();
  const modelMax = snap.deviceType === "500" ? 800 : 2400;
  const gridOutLimit = Math.min(modelMax, snap.userGridLimit);
  const gridInLimit = Math.min(snap.acChargeLimit, 2400);
  const data = { snap, ports, state };

  finiteObject(name, snap, data);
  finiteObject(name, ports, data);
  finiteObject(name, state, data);

  assertCondition(name, ports.gridPortOutput <= gridOutLimit + epsilon, "GP exceeds effective grid output limit", data);
  assertCondition(name, ports.gridPortOutput >= -gridInLimit - epsilon, "GP exceeds grid input / AC charge limit", data);
  assertCondition(name, ports.inverterOutput <= ports.hardwareOutputLimit + epsilon, "Inverter output exceeds active hardware output limit", data);
  assertCondition(name, ports.hardwareOutputLimit <= 2400 + epsilon, "Hardware output limit exceeds 2400W", data);
  assertCondition(name, ports.mpptInputPower <= snap.pvPower + epsilon, "MPPT input exceeds available PV", data);
  assertCondition(name, ports.pvCurtailed >= -epsilon, "PV limited is negative", data);
  assertCondition(name, nearlyEqual(ports.mpptInputPower + ports.pvCurtailed, snap.pvPower), "PV balance mismatch", data);
  assertCondition(name, nearlyEqual(ports.pvBypassOutput, ports.pvBypassToLoad + ports.pvBypassToGrid), "PV bypass split mismatch", data);
  assertCondition(name, nearlyEqual(ports.mpptInputPower, ports.pvBypassOutput + ports.pvToOutput + ports.pvToBattery), "MPPT split mismatch", data);
  assertCondition(name, nearlyEqual(ports.loadPortBackfeed, ports.loadBackfeedToGrid + ports.loadBackfeedChargeAccepted + ports.rejectedLoadBackfeed), "Load-port backfeed split mismatch", data);
  assertCondition(name, nearlyEqual(ports.acChargeAccepted, ports.gridChargeAccepted + ports.loadBackfeedChargeAccepted), "AC charge split mismatch", data);
  assertCondition(name, nearlyEqual(ports.batteryPower, ports.batteryCharge - ports.batteryDischarge), "Battery power sign balance mismatch", data);
  assertCondition(name, ports.batteryPower <= 2400 + epsilon, "Battery charge exceeds 2400W", data);
  assertCondition(name, ports.batteryPower >= -2400 - epsilon, "Battery discharge exceeds 2400W", data);

  if (snap.soc >= snap.socHigh) {
    assertCondition(name, ports.batteryCharge <= epsilon, "SOC at/above upper limit still charges battery", data);
    assertCondition(name, ports.batteryPower <= epsilon, "SOC at/above upper limit still has positive battery net flow", data);
    assertCondition(name, ports.gridPortOutput >= -epsilon, "SOC at/above upper limit still pulls grid input", data);
  }

  if (snap.soc <= snap.socLow) {
    assertCondition(name, ports.batteryDischarge <= epsilon, "SOC at/below lower limit still discharges battery", data);
    assertCondition(name, ports.batteryPower >= -epsilon, "SOC at/below lower limit still has negative battery net flow", data);
  }

  if (ports.loadPortBackfeed > 0 && snap.soc < snap.socHigh && state.gs <= 0 && !ports.bypassActive && canAbsorbAllLoadBackfeed(snap, ports)) {
    assertCondition(name, ports.rejectedLoadBackfeed <= epsilon, "Load-port microinverter should charge battery without protection", data);
  }

  if (ports.bypassActive) {
    assertCondition(name, ports.gridCommand >= -epsilon, "PV bypass mode should not use negative grid command", data);
    assertCondition(name, ports.batteryCharge <= epsilon, "PV bypass/full mode should not charge battery", data);
  }

  return data;
}

function runFullMatrix() {
  const devices = ["500", "500pro"];
  const userGridLimits = [0, 400, 800, 1600, 2400];
  const homeLoads = [-2400, -800, -200, 0, 800, 2400, 4800];
  const loadPorts = [-2400, -1200, -800, -200, 0, 320, 800, 2400];
  const pvPowers = [0, 200, 800, 1200, 2400, 3200];
  const socs = [5, 10, 12, 50, 88, 90, 95, 100];
  const modes = ["follow_load", "follow_pv"];
  const acLimits = [0, 800, 2400];
  const gsSeeds = [-2400, -200, 0, 800, 2400];
  const isSeeds = [0, 320, 800, 2400];
  let count = 0;

  for (const deviceType of devices) {
    for (const userGridLimit of userGridLimits) {
      for (const homeLoad of homeLoads) {
        for (const loadPortPower of loadPorts) {
          for (const pvPower of pvPowers) {
            for (const soc of socs) {
              for (const fullBatteryMode of modes) {
                for (const acChargeLimit of acLimits) {
                  const seedIndex = count % gsSeeds.length;
                  const inputs = {
                    deviceType,
                    userGridLimit,
                    homeLoad,
                    loadPortPower,
                    pvPower,
                    soc,
                    socLow: 10,
                    socHigh: 90,
                    socHys: 5,
                    targetGrid: 0,
                    fullBatteryMode,
                    acChargeLimit
                  };
                  checkInstantCase("full-matrix", inputs, {
                    gs: gsSeeds[seedIndex],
                    is: isSeeds[count % isSeeds.length]
                  });
                  count += 1;
                }
              }
            }
          }
        }
      }
    }
  }

  return count;
}

function runClosedLoopCase(name, inputs, initialState, options = {}) {
  const harness = createHarness();
  harness.setInputs({ ...baseInputs, ...inputs });
  harness.resetState(initialState);
  const seconds = options.seconds ?? 120;
  const gsHistory = [];

  for (let index = 0; index < seconds; index += 1) {
    harness.step(1);
    gsHistory.push(harness.state().gs);
  }

  const snap = harness.snapshot();
  const ports = harness.ports();
  const controller = harness.controller();
  const state = harness.state();
  const data = { snap, ports, controller, state, gsHistory };

  checkInstantCase(name, inputs, {
    gs: state.gs,
    is: state.is,
    loadPortConnected: state.loadPortConnected,
    loadPortReconnectTick: state.loadPortReconnectTick
  });

  assertCondition(name, state.gs >= controller.gsMin - epsilon, "Final GS below controller lower bound", data);
  assertCondition(name, state.gs <= controller.gsMax + epsilon, "Final GS above controller upper bound", data);
  assertCondition(name, state.is >= -epsilon && state.is <= 2400 + epsilon, "Final IS out of range", data);

  if (ports.loadPortBackfeed > 0) {
    assertCondition(name, gsHistory.slice(1).every((value) => value >= -epsilon), "Load-port backfeed scenario let GS go negative after first correction", data);
    const signsAfterCorrection = new Set(gsHistory.slice(1).map((value) => Math.sign(value)));
    assertCondition(name, !(signsAfterCorrection.has(-1) && signsAfterCorrection.has(1)), "Load-port backfeed scenario oscillated across positive/negative GS", data);
  }

  if (ports.bypassOnly) {
    assertCondition(name, state.gs === 0, "Pure PV bypass mode should settle GS to 0", data);
  }

  if (options.expected) {
    for (const [path, expectedValue] of Object.entries(options.expected)) {
      const actualValue = path.split(".").reduce((object, key) => object[key], data);
      assertCondition(name, nearlyEqual(actualValue, expectedValue, options.tolerance ?? 1), `${path} expected ${expectedValue}, got ${actualValue}`, data);
    }
  }

  return data;
}

function runClosedLoopSuite() {
  const cases = [
    [
      "Positive house load and positive load port reserve IS for GP",
      { homeLoad: 1200, loadPortPower: 550, pvPower: 1200, soc: 60, socHigh: 100, fullBatteryMode: "follow_load" },
      { gs: 2400, is: 550 },
      { expected: { "state.is": 1750, "state.gs": 1200, "ports.gridPortOutput": 1200, "ports.loadPortFromInverter": 550, "ports.meterPower": 0, "ports.batteryPower": -550 } }
    ],
    [
      "IS handles positive load while house exports 200W",
      { homeLoad: -200, loadPortPower: 400, pvPower: 1200, soc: 60, fullBatteryMode: "follow_load" },
      { gs: 0, is: 2400 },
      { expected: { "state.is": 200, "ports.meterPower": 0 } }
    ],
    [
      "Full follow PV sends PV to load first then GP",
      { homeLoad: 800, loadPortPower: 320, pvPower: 1200, soc: 95, socHigh: 90, fullBatteryMode: "follow_pv" },
      { gs: -200, is: 320 },
      { expected: { "state.gs": 0, "state.is": 2400, "ports.pvBypassToLoad": 320, "ports.pvBypassToGrid": 880, "ports.gridPortOutput": 880, "ports.batteryPower": 0 } }
    ],
    [
      "Full follow PV opens inverter limit for pure bypass",
      { homeLoad: 40, loadPortPower: 0, pvPower: 799, soc: 95, socHigh: 90, fullBatteryMode: "follow_pv" },
      { gs: 0, is: 1 },
      { expected: { "state.gs": 0, "state.is": 2400, "ports.bypassActive": true, "ports.bypassOnly": true, "ports.pvBypassToGrid": 799, "ports.gridPortOutput": 799, "ports.batteryPower": 0 } }
    ],
    [
      "Full follow PV with large off-grid load consumes PV before GP",
      { homeLoad: 800, loadPortPower: 2400, pvPower: 1430, soc: 95, socHigh: 90, fullBatteryMode: "follow_pv" },
      { gs: 0, is: 2400 },
      { expected: { "ports.pvBypassToLoad": 1430, "ports.pvBypassToGrid": 0, "ports.gridPortOutput": 0, "ports.batteryPower": -970, "ports.bypassActive": true, "ports.bypassOnly": false } }
    ],
    [
      "Full follow PV exits bypass when load is greater than PV plus load-port backfeed",
      { homeLoad: 2200, loadPortPower: -800, pvPower: 1050, soc: 95, socHigh: 90, fullBatteryMode: "follow_pv" },
      { gs: 0, is: 2400 },
      { expected: { "state.gs": 2200, "state.is": 2200, "ports.bypassActive": true, "ports.bypassOnly": false, "ports.pvBypassToGrid": 1050, "ports.loadBackfeedToGrid": 800, "ports.gridPortOutput": 2200, "ports.meterPower": 0, "ports.batteryPower": -350 } }
    ],
    [
      "Microinverter backfeed charges battery and does not pull grid",
      { homeLoad: 800, loadPortPower: -2400, pvPower: 1200, soc: 60, socHigh: 100, fullBatteryMode: "follow_load", acChargeLimit: 2400 },
      { gs: -200, is: 2400 },
      { expected: { "state.gs": 800, "ports.meterPower": 0, "ports.gridPortOutput": 800, "ports.rejectedLoadBackfeed": 0, "ports.batteryPower": 2400 } }
    ],
    [
      "SOC lower limit blocks discharge",
      { homeLoad: 800, loadPortPower: 400, pvPower: 0, soc: 5, socLow: 10, fullBatteryMode: "follow_load" },
      { gs: 1000, is: 2400 },
      { expected: { "ports.batteryDischarge": 0 } }
    ],
    [
      "500 model disconnects overloaded load-port microinverter after GP cap",
      { deviceType: "500", userGridLimit: 2400, homeLoad: 0, loadPortPower: -2400, pvPower: 0, soc: 95, socHigh: 90, fullBatteryMode: "follow_pv" },
      { gs: 0, is: 2400 },
      { expected: { "state.loadPortConnected": false, "ports.effectiveLoadPort": 0, "ports.gridPortOutput": 0, "ports.rejectedLoadBackfeed": 0 } }
    ],
    [
      "Unfilled battery with large load-port microinverter does not oscillate through negative GS",
      { homeLoad: 800, loadPortPower: -2400, pvPower: 1200, soc: 60, socHigh: 100, fullBatteryMode: "follow_load", acChargeLimit: 2400 },
      { gs: -200, is: 2400 },
      { expected: { "state.gs": 800, "ports.gridPortOutput": 800, "ports.rejectedLoadBackfeed": 0, "ports.batteryPower": 2400 } }
    ]
  ];

  for (const [name, inputs, initialState, options] of cases) {
    runClosedLoopCase(name, inputs, initialState, options);
  }

  return cases.length;
}

function runClosedLoopSweep() {
  const devices = ["500", "500pro"];
  const userGridLimits = [800, 2400];
  const homeLoads = [-1200, -200, 0, 800, 1200, 2400];
  const loadPorts = [-2400, -800, 0, 550, 2400];
  const pvPowers = [0, 1200, 2400];
  const socs = [5, 60, 95];
  const modes = ["follow_load", "follow_pv"];
  const acLimits = [800, 2400];
  const gsSeeds = [-500, 0, 1200, 2400];
  const isSeeds = [0, 550, 1200, 2400];
  let count = 0;

  for (const deviceType of devices) {
    for (const userGridLimit of userGridLimits) {
      for (const homeLoad of homeLoads) {
        for (const loadPortPower of loadPorts) {
          for (const pvPower of pvPowers) {
            for (const soc of socs) {
              for (const fullBatteryMode of modes) {
                for (const acChargeLimit of acLimits) {
                  const name = `closed-loop-sweep-${count}`;
                  const inputs = {
                    deviceType,
                    userGridLimit,
                    homeLoad,
                    loadPortPower,
                    pvPower,
                    soc,
                    socLow: 10,
                    socHigh: 90,
                    socHys: 5,
                    targetGrid: 0,
                    fullBatteryMode,
                    acChargeLimit
                  };
                  const harness = createHarness();
                  harness.setInputs({ ...baseInputs, ...inputs });
                  harness.resetState({
                    gs: gsSeeds[count % gsSeeds.length],
                    is: isSeeds[count % isSeeds.length]
                  });
                  harness.step(90);

                  const snap = harness.snapshot();
                  const ports = harness.ports();
                  const controller = harness.controller();
                  const state = harness.state();
                  const data = { snap, ports, controller, state };
                  const acChargeCapacity = snap.soc < snap.socHigh ? Math.min(snap.acChargeLimit, 2400) : 0;
                  const requiredAcAbsorption = Math.max(-controller.rawTargetGs, 0) + Math.max(-snap.loadPortPower, 0);
                  const reachableZeroFeed = state.loadPortConnected
                    && !ports.bypassOnly
                    && ports.outputShortage <= 1
                    && ports.balanceGap <= 1
                    && requiredAcAbsorption <= acChargeCapacity + Math.max(controller.rawTargetGs, 0) + 1
                    && nearlyEqual(controller.rawTargetGs, controller.targetGs, 1)
                    && nearlyEqual(controller.rawTargetIs, controller.targetIs, 10);

                  checkInstantCase(name, inputs, {
                    gs: state.gs,
                    is: state.is,
                    loadPortConnected: state.loadPortConnected,
                    loadPortReconnectTick: state.loadPortReconnectTick
                  });
                  assertCondition(name, state.gs >= controller.gsMin - epsilon, "Final GS below controller lower bound", data);
                  assertCondition(name, state.gs <= controller.gsMax + epsilon, "Final GS above controller upper bound", data);
                  assertCondition(name, state.is >= -epsilon && state.is <= 2400 + epsilon, "Final IS out of range", data);
                  assertCondition(name, nearlyEqual(state.gs, controller.targetGs, 1), "Final GS did not converge to controller target", data);
                  if (!ports.bypassOnly) {
                    assertCondition(name, nearlyEqual(state.is, controller.targetIs, 10), "Final IS did not converge to controller target", data);
                  }
                  if (reachableZeroFeed) {
                    assertCondition(name, nearlyEqual(ports.meterPower, snap.targetGrid, 1), "Reachable case did not settle meter to target", data);
                  }
                  count += 1;
                }
              }
            }
          }
        }
      }
    }
  }

  return count;
}

const matrixCount = runFullMatrix();
const closedLoopCount = runClosedLoopSuite();
const closedLoopSweepCount = runClosedLoopSweep();

if (failures.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    matrixCount,
    closedLoopCount,
    closedLoopSweepCount,
    failureCount: failures.length,
    firstFailures: failures.slice(0, 20)
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  matrixCount,
  closedLoopCount,
  closedLoopSweepCount,
  message: "All zero-feed-in simulator strategy checks passed."
}, null, 2));
