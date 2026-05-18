# HA蓝图自动化测试报告｜{{ task_key }}

## 1. 结论摘要

- Go / No-Go：
- 当前验证层级：静态检查 / 模拟器自测 / 实体映射 / HA trace 审核 / 真实 HA runtime
- 是否允许进入真实 HA runtime：
- 主要风险：
- 下一步建议：

## 2. 测试范围

| 项 | 内容 |
| --- | --- |
| Blueprint | `blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml` |
| Flow | `blueprints/automation/sunenergyxt/zero_feed_in_flow.md` |
| Setup guide | `docs/zero-feed-in-blueprint-setup.zh.md` |
| Simulator | `tools/zero-feed-in-simulator.html` |
| Selftest | `tools/zero-feed-in-selftest.cjs` |

## 3. 用例结果

| Case ID | 结果 | 证据 | 发现 | 恢复 |
| --- | --- | --- | --- | --- |
| HA-BP-001 | 待执行 | ha_blueprint_yaml_static_result | 待填写 | 无运行态写入 |
| HA-BP-002 | 待执行 | ha_entity_mapping_snapshot | 待填写 | 恢复实体清单快照 |
| HA-BP-003 | 待执行 | ha_blueprint_yaml_static_result | 待填写 | 清理电表样例 |
| HA-BP-004 | 待执行 | simulator_selftest_result | 待填写 | 恢复 preset/multiplier |
| HA-BP-005 | 待执行 | simulator_selftest_result, ha_entity_state_snapshot | 待填写 | 恢复 helper |
| HA-BP-006 | 待执行 | simulator_selftest_result | 待填写 | 恢复 full_battery_mode |
| HA-BP-007 | 待执行 | simulator_selftest_result, ha_automation_trace | 待填写 | 恢复负载口输入 |
| HA-BP-008 | 待执行 | ha_blueprint_yaml_static_result, ha_automation_trace | 待填写 | 恢复写入间隔 |
| HA-BP-009 | 待执行 | ha_automation_trace, ha_entity_state_snapshot | 待填写 | 恢复实体状态 |
| HA-BP-010 | 待执行 | ha_blueprint_yaml_static_result | 待填写 | 阻塞越权写入 |
| HA-BP-011 | 待执行 | simulator_selftest_result, ha_blueprint_yaml_static_result | 待填写 | 清理临时输出 |
| HA-BP-012 | 待执行 | recovery_log, ha_entity_state_snapshot | 待填写 | 禁用测试自动化 |

## 4. 证据索引

- `evidence_index.json`：
- `ha_blueprint_yaml_static_result`：
- `simulator_selftest_result`：
- `ha_entity_mapping_snapshot`：
- `ha_automation_trace`：
- `ha_entity_state_snapshot`：
- `recovery_log`：

## 5. Blocker

| Blocker | 影响 | 处理人 | 关闭条件 |
| --- | --- | --- | --- |
| 缺 HA runtime 地址/token | 不能进入真实 runtime 自动化 | 测试/平台 | 通过 `local_api` Gate |
| 缺实体清单 | 不能校验 auto-binding | 测试 | 上传 entity catalog |
| selftest 失败 | 不能进入真实 runtime | 产品/研发 | 修复算法或测试预期 |

## 6. Go / No-Go 判断

- Static + simulator pass：
- Entity mapping pass：
- Runtime trace pass：
- Recovery pass：
- 结论：

## 7. Backlog

- 失败用例：
- 需求补充：
- 蓝图修复：
- 平台能力补充：
