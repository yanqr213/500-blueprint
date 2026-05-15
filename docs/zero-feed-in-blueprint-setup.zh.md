# SunEnergyXT 零馈电蓝图接入与配置说明

本文档适用于以下前提已经完成的用户：

- 已在 Home Assistant 中接入 SunEnergyXT 500 / 500 Pro 一体机插件。
- 已在 Home Assistant 中接入外部电表插件，例如 Shelly、BitShake / Tasmota、EcoTracker 或其他电表插件。
- 一体机和电表的实体已经能在 Home Assistant 的“实体”页面看到。

本蓝图通过外部电表实时功率闭环控制一体机的 `System Grid Port Power Setpoint` 和 `System Max Inverter Power Setpoint`，实现零馈电或接近零馈电控制。蓝图不修改一体机的运行模式或放电模式。

## 1. 准备工作

### 1.1 确认一体机设备

进入 Home Assistant：

`设置` -> `设备与服务` -> `设备`

确认 SunEnergyXT 一体机设备存在，并且设备下至少有以下实体：

| 实体 | 用途 |
| --- | --- |
| `System Grid Port Power Setpoint` | 并网口功率设定，蓝图主要控制目标 |
| `System Max Inverter Power Setpoint` | 逆变器总输出上限 |
| `System Load Port Power` | 一体机负载口实时功率，正数为负载消耗，负数为负载口回灌 |
| `System Grid Port Power` | 一体机并网口实时功率 |
| `PV Total Input Power` | 光伏实时输入功率 |
| `System Battery Level` | 电池 SOC |

蓝图创建自动化时只需要选择 `SunEnergyXT device`，会自动从该设备下绑定 `System Grid Port Power Setpoint`、`System Max Inverter Power Setpoint`、`System Load Port Power`、`System Grid Port Power`、`PV Total Input Power`、`System Battery Level`。不同 Home Assistant 语言或插件版本下，实体显示名称可能略有差异；如果自动绑定不准确，再展开 `Advanced entity overrides` 手动覆盖。

### 1.2 确认外部电表实体

进入 Home Assistant 的设备页面，确认外部电表作为一个设备存在。蓝图创建自动化时只需要选择 `External meter device`，会自动从该设备下寻找实时功率实体。

电表侧需要的是实时功率，不是累计电量。单位通常是 `W`，如果插件提供的是 `kW`，可在折叠的 `Advanced meter settings` 中把 `External meter power multiplier` 设置为 `1000` 转成 `W`。

本蓝图内部统一使用以下方向：

| 内部方向 | 含义 |
| --- | --- |
| 正数 | 家庭向电网馈电 / 外送 |
| 负数 | 家庭从电网购电 / 市电输入 |

用户不需要自己把所有电表都改成这个方向。符号方向默认自动判断；如果现场方向反了，再展开 `Advanced meter settings` 修改 `Meter sign convention`。

## 2. 导入蓝图

### 2.1 本地文件方式

将蓝图文件放到 Home Assistant 配置目录：

```text
/config/blueprints/automation/sunenergyxt/zero_feed_in_external_meter.yaml
```

如果目录不存在，需要先创建：

```text
/config/blueprints/automation/sunenergyxt/
```

然后在 Home Assistant 中进入：

`设置` -> `自动化与场景` -> `蓝图`

点击右上角菜单，选择重新加载蓝图，或刷新页面后查看蓝图列表。

### 2.2 URL 导入方式

如果蓝图已经发布到 GitHub，可以进入：

`设置` -> `自动化与场景` -> `蓝图` -> `导入蓝图`

填写蓝图文件的 GitHub raw URL，然后导入。

## 3. 可选 Helper

这两个 `input_boolean` 不是必填项，只是可选的状态记忆。

不创建、不配置也可以使用蓝图。此时蓝图会直接根据当前 SOC 判断满电保持和低 SOC 保持，不会要求你先准备 Helper。

如果你希望 Home Assistant 重启或自动化重载后仍保留“满电保持 / 低 SOC 保持”的中间状态，可以再创建两个“开关”类型 Helper：

`设置` -> `设备与服务` -> `辅助元素`

| Helper 名称建议 | 用途 |
| --- | --- |
| `SunEnergyXT Zero Feed-in Full Charge Hold` | 记录自动化侧满电保持状态 |
| `SunEnergyXT Zero Feed-in Low SOC Hold` | 记录自动化侧低 SOC 保持状态 |

创建后，在折叠的 `Advanced control settings` 里填入 `Optional full-charge hold helper` 和 `Optional low-SOC hold helper`。这两个 Helper 平时不需要手动操作，由蓝图自动开关。

## 4. 创建蓝图自动化

进入：

`设置` -> `自动化与场景` -> `蓝图`

找到：

`SunEnergyXT 500 Series - External Meter Zero Feed-in`

点击创建自动化。

## 5. 用户需要配置的项

### 5.1 主界面只需要填写这些

创建蓝图自动化时，主界面只需要填写：

| 蓝图项 | 选择 |
| --- | --- |
| `External meter device` | 选择电表设备 |
| `SunEnergyXT device` | 选择 SunEnergyXT 500 / 500 Pro 一体机设备 |
| `System Min Discharge SOC` / `System Max Charge SOC` | 设置电池 SOC 下限和上限 |
| `Full-battery behavior` | 按满电后策略选择 `Follow load after full` 或 `Follow PV after full` |
| `Maximum on-grid output power` | 500 最大 `800 W`；500 Pro 最大 `2400 W`。如当地法规或现场要求更低，填更低值 |

`Target grid power` 默认就是 `0 W`，普通用户不需要配置。电表类型默认自动识别，普通用户也不需要选择电表预设。

### 5.2 电表自动识别和高级预设

蓝图会按电表设备下的实体自动判断常见形态：

| 电表或插件形态 | 推荐预设 | 自动绑定说明 |
| --- | --- | --- |
| Shelly EM / Pro EM / Pro 3EM 已有总功率实体 | `Shelly EM / Pro EM / Pro 3EM total power` | 自动找电表设备下的总功率实体 |
| Shelly 3EM / Pro 3EM 只有 L1、L2、L3 三相实时功率 | `Shelly 3EM / Pro 3EM L1 + L2 + L3` | 自动找 L1/L2/L3 实时功率实体 |
| Shelly 3EM / Pro 3EM 提供每相 import/export 或 consumption/returned | `Shelly 3EM / Pro 3EM L1-L3 import/export` | 自动找 L1/L2/L3 import 与 export 六个实体 |
| BitShake / Tasmota 提供一个当前功率实体 | `BitShake / Tasmota current power` | 自动找当前功率实体 |
| EcoTracker 提供一个当前功率实体 | `EcoTracker current power entity` | 自动找当前功率实体 |
| EcoTracker 功率在实体属性里 | `EcoTracker raw entity attribute` | 自动找实体，属性名默认 `power` |
| 其他单个有符号总功率实体 | `Custom signed total power` | 自动找总功率实体；不准时用高级覆盖 |
| 其他三相功率实体 | `Custom L1 + L2 + L3 phase sum` | 自动找 L1/L2/L3 功率实体；不准时用高级覆盖 |
| 其他总 import/export 功率对 | `Custom import/export power pair` | 自动找 import/export 功率对；不准时用高级覆盖 |
| 其他三相 import/export 功率对 | `Custom L1-L3 import/export pair` | 自动找三相 import/export；不准时用高级覆盖 |

如果自动识别不准，再展开 `Advanced meter settings`，把 `External meter preset override` 从 `Auto-detect from meter device` 改成对应预设。

### 5.3 配置电表符号方向

`Meter sign convention` 默认选择：

```text
Auto from selected preset
```

通常建议先保持自动。

该设置默认隐藏在 `Advanced meter settings` 中。如果现场发现方向反了，再展开手动改：

| 现场观察 | 应选择 |
| --- | --- |
| 家里正在向电网馈电，电表实体显示正数 | `Export/feed-in is positive` |
| 家里正在从电网购电，电表实体显示正数 | `Import/grid consumption is positive` |

如果使用 import/export pair 预设，蓝图会直接按 `export - import` 计算，符号方向选项不会影响结果。

### 5.4 配置单位倍率

`External meter power multiplier` 用于统一单位：

| 电表实体单位 | 配置值 |
| --- | --- |
| `W` | `1` |
| `kW` | `1000` |

## 6. 高级设置和手动覆盖

正常情况下不需要展开高级设置。蓝图会从 `SunEnergyXT device` 自动绑定一体机实体，从 `External meter device` 自动绑定电表实体。

只有以下情况才建议展开 `Advanced entity overrides`：

- 自动绑定到了错误的电表功率实体。
- 电表实体命名不含 L1/L2/L3、import/export 等常见关键词。
- 同一个电表设备下有多个功率实体，且蓝图无法判断哪个是实时功率。

高级覆盖项留空表示继续自动绑定；只填写需要纠偏的实体即可。

## 7. 配置控制目标和限制

### 7.1 高级：零馈电目标

`Target grid power` 默认隐藏在 `Advanced control settings` 中，默认值就是：

```text
0 W
```

含义是让外部电表读数尽量收敛到 `0W`。普通零馈电场景不用改。

如果希望保留轻微购电，可以设置为负数，例如：

```text
-20 W
```

如果希望保留轻微馈电，可以设置为正数，例如：

```text
20 W
```

### 7.2 最大并网输出功率

`Maximum on-grid output power` 按设备型号配置：

| 设备型号 | 建议值 |
| --- | --- |
| SunEnergyXT 500 | `800 W` |
| SunEnergyXT 500 Pro | `2400 W` |

如果当地法规或现场安装要求更低，应填写更低值。

### 7.3 高级：系统并网口功率设定下限

`System Grid Port Power Setpoint lower limit` 控制允许的最大市电输入 / AC 侧吸收能力。

常用配置：

```text
-2400 W
```

如果不希望设备通过负向系统并网口功率设定吸收外部多余功率，可以设置为：

```text
0 W
```

### 7.4 SOC 上下限

建议初始配置：

| 配置项 | 建议值 |
| --- | --- |
| `System Min Discharge SOC` | `10%` |
| `System Max Charge SOC` | `90%` 或 `100%` |

蓝图内部固定使用 `5%` 回差。满电保持逻辑：SOC 达到上限后进入满电保持；配置可选状态 Helper 时，SOC 低于 `上限 - 5%` 后退出。

低 SOC 保持逻辑：SOC 达到下限后进入低 SOC 保持；配置可选状态 Helper 时，SOC 高于 `下限 + 5%` 后退出。

### 7.5 满电后策略

`Full-battery behavior` 有两个选项：

| 选项 | 含义 |
| --- | --- |
| `Follow load after full` | 满电后继续以零馈电为优先，多余 PV 可被限制或浪费 |
| `Follow PV after full` | 满电后电池不再充电，PV 优先供负载口，剩余 PV 可通过并网口输出 |

如果现场更重视严格零馈电，建议先选择：

```text
Follow load after full
```

如果希望满电后尽量利用 PV，并且允许在最大并网输出限制内输出，选择：

```text
Follow PV after full
```

### 7.6 高级：ACCouple 最大充电功率

`AC-coupled maximum charge power` 用于限制通过 AC 侧吸收外部多余功率的能力。

常用配置：

```text
2400 W
```

如果现场外部微逆或 AC 耦合源较小，可以按实际功率降低。

## 8. 写入频率和调节速度

建议先使用默认值：

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `System Grid Port Power Setpoint write resolution` | `1 W` | 并网口功率设定最小写入变化 |
| `System Max Inverter Power Setpoint write resolution` | `10 W` | 最大逆变功率设定最小写入变化 |
| `Correction gain` | `100%` | 按完整误差修正 |
| `Small-error threshold` | `30 W` | 小误差阈值 |
| `Large-error threshold` | `150 W` | 大误差阈值 |
| `Slow write interval` | `15 s` | 小误差时慢速调节 |
| `Medium write interval` | `5 s` | 中等误差时调节 |
| `Fast write interval` | `1 s` | 大误差时秒级调节 |

这样可以做到小误差慢慢修、大误差快速追，同时避免对设备高频无意义写入。

## 9. 数据超时保护

`Maximum meter age` 默认建议：

```text
30 s
```

如果外部电表或一体机关键功率/SOC 实体超过这个时间没有更新，蓝图会停止本轮写入，避免使用旧数据调节。

Shelly Pro 3EM 这类电表在某些相位为 `0 W` 时可能不会持续刷新该相位实体。蓝图在三相求和或三相 import/export 模式下，只要求至少一相相关功率实体在超时时间内更新，未变化的相位会沿用当前 state。若电表插件上报周期更慢，可以适当加大，例如：

```text
60 s
```

不建议设置过大，否则断网或电表卡死时可能继续按旧数据调节。

## 10. 首次试运行检查

创建自动化后，建议按以下顺序检查。

### 10.1 先禁用自动化，检查实体方向

在 Home Assistant 里观察外部电表实体：

| 现场状态 | 期望蓝图内部含义 |
| --- | --- |
| 家里正在购电 | 应被蓝图识别为负数 |
| 家里正在馈电 | 应被蓝图识别为正数 |

默认自动识别电表形态并保持 `Auto from selected preset` 时，通常不需要调整。

如果方向反了，修改 `Meter sign convention`。

### 10.2 启用自动化，观察功率设定

启用自动化后，观察：

| 实体 | 正常现象 |
| --- | --- |
| 外部电表实时功率 | 逐步接近 `0 W` |
| `System Grid Port Power Setpoint` | 会随外部电表误差上下调整 |
| `System Max Inverter Power Setpoint` | 会根据负载口、并网口、满电策略和 SOC 限制调整 |
| `System Load Port Power` | 正数为负载口消耗，负数为负载口回灌 |

### 10.3 检查满电和低 SOC 状态

如果没有配置可选 Helper，不需要检查任何 Helper 实体，直接观察 SOC、`System Grid Port Power Setpoint`、`System Max Inverter Power Setpoint` 和满电后策略是否符合预期。

如果配置了可选 Helper，可以观察：

| Helper | 正常现象 |
| --- | --- |
| `Full Charge Hold` | SOC 达到上限或设备拒绝继续充电时打开 |
| `Low SOC Hold` | SOC 达到下限或设备拒绝继续放电时打开 |

这两个状态不需要用户手动干预，除非现场调试时需要清状态。

## 11. 常见配置示例

### 11.1 Shelly 3EM 只有三相功率

如果自动识别不准，再展开高级设置这样配置：

| 蓝图项 | 选择 |
| --- | --- |
| `External meter preset override` | `Shelly 3EM / Pro 3EM L1 + L2 + L3` |
| `Override meter L1 power sensor` | Shelly L1 power |
| `Override meter L2 power sensor` | Shelly L2 power |
| `Override meter L3 power sensor` | Shelly L3 power |
| `Meter sign convention` | 先用 `Auto from selected preset` |
| `External meter power multiplier` | `1` |

如果馈电时三相求和显示正数，则保持自动或选择 `Export/feed-in is positive`。如果购电时显示正数，则选择 `Import/grid consumption is positive`。

### 11.2 Shelly 3EM 有三相 import/export

如果自动识别不准，再展开高级设置这样配置：

| 蓝图项 | 选择 |
| --- | --- |
| `External meter preset override` | `Shelly 3EM / Pro 3EM L1-L3 import/export` |
| `Override meter L1/L2/L3 import power sensor` | 每相进口 / consumption 实体 |
| `Override meter L1/L2/L3 export power sensor` | 每相回送 / returned 实体 |
| `External meter power multiplier` | `1` |

该模式内部直接计算：

```text
净功率 = L1_export + L2_export + L3_export - L1_import - L2_import - L3_import
```

### 11.3 BitShake / Tasmota

如果自动识别不准，再展开高级设置这样配置：

| 蓝图项 | 选择 |
| --- | --- |
| `External meter preset override` | `BitShake / Tasmota current power` |
| `Override meter total/current power sensor` | Tasmota / BitShake 当前功率实体 |
| `Meter sign convention` | 先用 `Auto from selected preset` |
| `External meter power multiplier` | `1` 或按实体单位设置 |

如果该实体是 `kW`，倍率填 `1000`。

### 11.4 EcoTracker

如果 EcoTracker 已经有当前功率实体：

| 蓝图项 | 选择 |
| --- | --- |
| `External meter preset override` | `EcoTracker current power entity` |
| `Override meter total/current power sensor` | EcoTracker 当前功率实体 |

如果 EcoTracker 功率在某个实体属性里：

| 蓝图项 | 选择 |
| --- | --- |
| `External meter preset override` | `EcoTracker raw entity attribute` |
| `Override meter total/current power sensor` | EcoTracker 原始实体 |
| `External meter power attribute` | 功率属性名，默认 `power` |

## 12. 建议初始参数

SunEnergyXT 500：

| 配置项 | 建议值 |
| --- | --- |
| `Maximum on-grid output power` | `800 W` |
| `System Min Discharge SOC` | `10%` |
| `System Max Charge SOC` | `90%` 或 `100%` |
| `Full-battery behavior` | `Follow load after full` |

SunEnergyXT 500 Pro：

| 配置项 | 建议值 |
| --- | --- |
| `Maximum on-grid output power` | `2400 W` |
| `System Min Discharge SOC` | `10%` |
| `System Max Charge SOC` | `90%` 或 `100%` |
| `Full-battery behavior` | `Follow load after full` |

## 13. 排查方向

| 现象 | 优先检查 |
| --- | --- |
| 越调越偏 | 电表符号方向是否反了 |
| 完全不动作 | 是否已选择电表和一体机，关键实体是否 `unknown` / `unavailable`，蓝图是否因为超时停止 |
| Shelly 3EM 数据不对 | 自动识别是否选错形态；必要时用 `External meter preset override` 指定总功率、三相求和或三相 import/export |
| 频繁跳变 | 写入间隔是否过短，`Small-error threshold` 和 `System Grid Port Power Setpoint write resolution` 是否过小 |
| 满电后行为不符合预期 | `Full-battery behavior` 是否选对，SOC 上限是否合理；如配置了可选 Helper，再看满电 Helper 状态 |
| 低 SOC 仍在放电 | SOC 下限是否合理；如配置了可选 Helper，再看低 SOC Helper 状态 |
| 外部微逆回灌时异常 | 检查 `System Load Port Power` 是否为负数，`AC-coupled maximum charge power` 和 `System Grid Port Power Setpoint lower limit` 是否允许吸收 |

## 14. 重要提醒

- 首次启用建议有人在现场观察设备和电表变化。
- 不要把累计电量实体当成功率实体使用。
- 不要混用不同一体机的实体。
- 如果外部电表上报周期较慢，应适当增大 `Maximum meter age`，但不建议过大。
- 如果现场法规限制并网输出，应把 `Maximum on-grid output power` 设置为法规允许值，而不是设备最大值。
