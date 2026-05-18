# HA 蓝图自动化实验位设置说明

## 实验位目标

验证 SunEnergyXT 500 / 500 Pro 外部电表零馈网 Home Assistant 蓝图是否能从源码、文档和模拟器进入可审核测试闭环。

MVP 不要求平台直接连接真实 HA runtime，也不默认控制真实设备。先完成静态检查、模拟器自测、实体映射和人工 trace 证据导入。

## 需要准备的对象

| 对象 | 作用 | 是否必需 |
| --- | --- | --- |
| 蓝图仓库 | 提供 YAML、流程、说明、自测脚本 | 必需 |
| Home Assistant 测试实例 | 导入蓝图、导出 trace/entity snapshot | 推荐 |
| SunEnergyXT HA integration 实体清单 | 验证 AIO 设备实体映射 | 必需 |
| 外部电表实体样例 | 验证 Shelly、BitShake/Tasmota、EcoTracker、custom preset | 必需 |
| Simulator/selftest | 验证控制算法矩阵 | 必需 |
| 真实 AIO / 电表 / 负载 | 真实 runtime 阶段需要，MVP 可不接 | 可选 |

## 证据要求

- `ha_blueprint_yaml_static_result`：YAML metadata、selector、service write target、source reference。
- `ha_entity_mapping_snapshot`：SunEnergyXT 实体、电表实体、helper/number/sensor 映射。
- `simulator_selftest_result`：selftest 输出、失败矩阵、控制边界。
- `ha_automation_trace`：人工导出的 HA trace，用于 runtime 行为审核。
- `ha_entity_state_snapshot`：测试前后关键 entity 状态。
- `recovery_log`：禁用自动化、恢复 helper/number/entity 的记录。

## MVP 执行边界

允许：

- 静态解析 YAML。
- 运行 `node tools/zero-feed-in-selftest.cjs`。
- 比对实体清单与 YAML 自动绑定逻辑。
- 上传人工导出的 HA trace 和 entity snapshot。

不允许默认执行：

- 平台直接调用 HA service。
- 平台写入真实 number/switch/select 实体。
- 平台调用 Local API 或设备直连接口。

如要进入真实 HA runtime 自动化，需要单独通过 `local_api` Gate。

## 推荐任务输入

```text
任务类型：HA_BLUEPRINT_AUTOMATION
实验位：HA 蓝图自动化实验位
来源链接：https://github.com/yanqr213/500-blueprint
补充说明：
- 验证 SunEnergyXT 500 / 500 Pro 外部电表零馈网 HA blueprint。
- 覆盖蓝图导入、实体映射、电表预设、SOC 上下限、满电 follow_load / follow_pv、PV bypass、负载口微逆回灌、写入间隔、stale data、恢复。
- MVP 先执行静态检查和模拟器自测；真实 HA runtime 暂不自动控制。
```
