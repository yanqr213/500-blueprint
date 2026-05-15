# SunEnergyXT External Meter Zero Feed-in Flow

```mermaid
flowchart TD
  A["每 1 秒触发"] --> B["按电表预设读取外部电表：Shelly 总功率、Shelly 三相求和、Shelly 三相进出功率、BitShake/Tasmota、EcoTracker、或自定义"]
  B --> C{"所有必需数据有效且未超时"}
  C -- "否" --> Z["停止本轮，不写入"]
  C -- "是" --> D["按预设/手动符号统一电表：正=馈电，负=购电；必要时 kW 乘 1000 转 W"]
  D --> E["读取系统并网口功率设定、系统最大逆变功率设定、负载口功率、并网口功率、PV、系统电池电量与两个 hold helper；更新自动化侧 hold"]
  E --> F["按 SOC 上下限与内部固定 5% 回差更新满电保持和下限保持"]
  F --> G["解析负载口功率：正=负载消耗，负=微逆回灌"]
  G --> H["按 HTML simulatePorts 口径估算输出上限：满电跟随 PV 且自动化满电保持时按 2400W，否则 min(系统最大逆变功率设定,2400W)"]
  H --> I["计算负载口市电补足：loadPortGridSupply=max(positiveLP-loadPortFromInverter,0)"]
  I --> J["由并网口功率、外部电表、loadPortGridSupply 反推 homeLoad"]
  J --> K["loadGridSupplyTarget=clamp(targetGrid-homeLoad,0,positiveLP)"]
  K --> L["rawTargetGridPortSetpoint：负载口回灌时 targetGrid+homeLoad，否则 targetGrid+homeLoad+loadGridSupplyTarget"]
  L --> M["rawTargetMaxInverterSetpoint=(positiveLP-loadGridSupplyTarget)+max(rawTargetGridPortSetpoint,0)"]
  M --> N{"满电跟随 PV 且 max(rawTargetGridPortSetpoint,0) <= bypass 可到并网口能力，并且实测并网口功率/电表未显示 bypass 缺失"}
  N -- "是" --> O["纯 bypass：系统并网口功率设定=0，系统最大逆变功率设定=2400W，避免 PV 被限发"]
  N -- "否" --> P["普通/混合：使用 rawTargetGridPortSetpoint 与 rawTargetMaxInverterSetpoint"]
  O --> Q["应用并网口功率设定限制：纯 bypass 固定 0"]
  P --> R["应用并网口功率设定限制：满电保持禁负值，下限保持禁正值，负载口回灌且无需吸收时禁止负值"]
  Q --> S["钳制功率设定：并网口功率设定在有效上下限内，最大逆变功率设定在 0..2400W"]
  R --> T["若下限保持禁放：最大逆变功率设定目标不超过 PV，再钳制 0..2400W"]
  T --> S
  S --> U["先同步 helper 状态，再按 max(电表误差、最大逆变功率设定修正量、并网口功率设定修正量) 选择写入周期和单次最大步长"]
  U --> V{"达到写入间隔且变化超过分辨率"}
  V -- "写最大逆变功率设定" --> W["number.set_value System Max Inverter Power Setpoint"]
  V -- "写并网口功率设定" --> X["number.set_value System Grid Port Power Setpoint"]
  V -- "都不写" --> Y["保持本轮"]
  W --> AA["等待下一秒"]
  X --> AA
  Y --> AA
  Z --> AA
```
