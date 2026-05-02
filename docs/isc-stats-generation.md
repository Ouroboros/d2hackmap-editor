# ISC 属性列表生成说明

本文档记录如何从 MOD 的 `ItemStatCost.txt` 重新生成编辑器内置的
`data/stats.json` 属性列表。

## 目标

生成属性选择器使用的内置属性列表。

输出文件：

```text
data/stats.json
```

生成脚本：

```text
scripts/generate_stats_json.py
```

检查但不写文件：

```bash
python3 scripts/generate_stats_json.py --check
```

生成正式 JSON：

```bash
python3 scripts/generate_stats_json.py
```

人工名称覆盖表：

```text
scripts/stat_name_overrides.json
```

该文件用 `code -> name` 覆盖自动生成名称。  
适合处理 TBL 中带颜色码、格式占位符、完整说明句、过长提示文本的属性名。

生成顺序：

```text
ISC + string table -> 自动名称 -> OP 后缀 -> override 覆盖 -> data/stats.json
```

正式运行时 JSON 只保存 UI 和编辑需要的字段：

```json
{
  "id": 39,
  "code": "fireresist",
  "name": "火焰抗性",
  "min": -50,
  "max": 205
}
```

不要把生成过程中的中间字段写进正式 JSON，例如：

```text
descKey
descSource
bits
signed
saveAdd
op
opBase
opParam
opStats
```

这些字段只用于生成和排查，不属于编辑器运行时数据。

## 来源文件

ISC 主数据：

```text
D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\data\global\excel\ItemStatCost.txt
```

字符串表：

```text
D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\DuckModString.txt
D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\DuckPermString.txt
D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\ExpansionString.txt
D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\patchstring.txt
D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\string.txt
```

本地字段文档：

```text
D:\Dev\Source\d2tools\_diabloiidatafileguide.mht
```

## 输入解析

`ItemStatCost.txt` 是 Tab 分隔文本。

必须按表头字段名读取，不要硬编码列下标。

字符串表每行格式类似：

```text
key<TAB>length}text}
```

解析规则：

1. 用第一个 Tab 分割 key 和 value。
2. value 前面的 `length}` 是长度信息，需要去掉。
3. value 后续的 `}` 可以按换行或空格处理。
4. 属性名称用于单行显示时，建议把换行合并为空格。

字符串表查找顺序按本文档列出的顺序执行。  
如果同一个 key 在多个文件中存在，先匹配到的优先。

## 哪些 ISC 行需要加入属性列表

只加入至少有一个显示字符串 key 的 ISC：

1. `descstrpos`
2. `descstrneg`

如果这两个字段都为空，忽略该 ISC。

名称来源：

1. 优先使用 `descstrpos`。
2. `descstrpos` 为空时使用 `descstrneg`。
3. 用该 key 到字符串表中查中文。
4. 如果查不到中文，使用 key 本身作为兜底名称。

基础字段：

```text
id   = ID
code = Stat
name = 翻译后的显示名，可再通过 descfunc/descstr2 或明确的派生语义完善
```

## min/max 范围计算

属性选择器显示的是实际属性值范围，不是存档中的原始值范围。

使用字段：

```text
Save Bits
Signed
Save Add
```

规则：

1. `Save Bits` 是保存该属性值使用的 bit 数。
2. `Signed = 1` 表示原始保存值按有符号整数处理。
3. `Signed` 为空或 `0` 表示原始保存值按无符号整数处理。
4. `Save Add` 是保存偏移量，用来让负数属性也能以正数形式保存。
5. 实际属性值 = `raw - Save Add`。

计算公式：

```text
如果 Signed:
  rawMin = -(2 ^ (Save Bits - 1))
  rawMax =  (2 ^ (Save Bits - 1)) - 1

如果不是 Signed:
  rawMin = 0
  rawMax = (2 ^ Save Bits) - 1

min = rawMin - Save Add
max = rawMax - Save Add
```

例子：

```text
fireresist
Save Bits = 9
Signed = 1
Save Add = 50

raw 范围 = -256 ~ 255
实际范围 = -306 ~ 205
```

如果 `Save Bits` 为空，不要硬猜范围。  
可以不写 `min/max`，或写成 `null`。

## OP 语义

`op` 不写入 `stats.json`。  
它不是通用的“基于某属性”字段，不能只看 OP 名字就往 `name` 里追加
“基于精力/体力/力量”。

当前 ISC 行是来源属性。  
`op stat1/2/3` 是参与该 OP 计算的目标属性。不同 OP 对这些字段的语义不同，
必须按文档逐项处理。

OP 含义：

```text
0 / 空    无 OP，普通属性。
1         Percent Operator。取 op stat#，按当前 stat 的 value 做百分比增加。
2         By Level Operator。取 op stat#，结合 op base 和 op param 做按等级固定值修正。
3         By Level Percent Operator。取 op stat#，结合 op base 和 op param 做按等级百分比修正。
4         By Level Source Operator。和 OP2 类似，但取 item 上的 op stat#。
5         By Level Source Percent Operator。和 OP3 类似，但取 item 上的 op stat#。
6         By Time Operator。取 op stat#，按游戏时间和该 stat 的 min/max 计算 delta。
7         By Time Percent Operator。取 op stat#，按游戏时间和该 stat 的 min/max 计算百分比 delta。
8         Energy Operator。玩家专用；取 op stat#，乘以 charstats.txt 的 ManaPerMagic，再按 MANA_SHIFT 换算。
9         Vitality Operator。玩家专用；取 op stat#，按目标是 maxstamina 还是其他 stat，分别用 StaminaPerVitality 或 LifePerVitality 换算。
10        未使用。
11        Player Percent Operator。单位/player 百分比修正 op stat#。
12        未使用。
13        Item Percent Operator。物品百分比修正 op stat#。
```

名称生成规则：

1. `op` 为空或 `0`：保持基础名称。
2. `op=2/3/4/5`：`op base` 是计算来源。若 `op base = level`，追加
   `(基于等级)`；若 `op base` 是另一个 stat code，解析成该 stat 的显示名，
   追加 `(基于xxx)`。
3. `op=6/7`：计算来源是游戏时间，追加 `(基于时间)`。
4. `op=1`、`op=11`、`op=13`：`op stat#` 是被修正目标，不是来源属性，不追加
   ` / 基于xxx`。
5. `op=8`：来源是 `charstats.txt` 的 `ManaPerMagic`，不是另一个 ISC stat，
   不追加 ` / 基于xxx`。
6. `op=9`：来源是 `charstats.txt` 的 `LifePerVitality` 或
   `StaminaPerVitality`，不是另一个 ISC stat，不追加 ` / 基于xxx`。
7. 其他情况如果不能从文档或字段明确判断来源关系，不要猜，保持基础名称。

重要修正：

```text
energy
op = 8
op stat1 = maxmana
```

这不是“基于精力”。  
文档只说明 `Energy Operator` 会取 `op stat#`，乘以 `ManaPerMagic`，再按
`MANA_SHIFT` 换算。正式名称保持基础名称即可：

```text
精力值
```

```text
vitality
op = 9
op stat1 = maxhp
op stat2 = maxstamina
```

这也不是“基于体力”。  
文档只说明 `Vitality Operator` 会按目标 stat 使用 `LifePerVitality` 或
`StaminaPerVitality` 换算。正式名称保持基础名称即可：

```text
体力值
```

## 排序

保持 `ItemStatCost.txt` 原始行顺序。

不要按 ID、名称或 code 重新排序。  
这样方便和游戏原始数据对照。

## 验证清单

重新生成 `data/stats.json` 后检查：

1. 条目数量明显多于旧的 14 条手写列表。
2. 每条至少有 `id`、`code`、`name`。
3. 没有 `descstrpos` 和 `descstrneg` 的 ISC 没有被加入。
4. 当前 MOD 中 `fireresist` 范围应为 `-306 ~ 205`。
5. `strength` 范围应为 `-32 ~ 223`。
6. 不能把 `op stat#` 误当成“基于xxx”的来源属性；只有 `op base` 或文档明确说明的来源才能用于补充名称。
7. `op=8/9` 不能自动生成“基于精力/基于体力”，因为它们的来源是 `charstats.txt` 换算字段，不是另一个 ISC stat。
8. `data/stats.json` 能被现有 Vue 代码正常 import。
