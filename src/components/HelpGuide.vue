<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import EditorPanel from './EditorPanel.vue'

const { t } = useI18n()

interface HelpBlock {
  title: string
  lines?: string[]
  steps?: string[]
  exampleTitle?: string
  exampleLines?: string[]
  mistakesTitle?: string
  mistakes?: string[]
}

interface HelpEntry {
  id: string
  label: string
  intro: string
  blocks: HelpBlock[]
}

const activeHelpTab = ref('common')
const helpContentRef = ref<HTMLElement | null>(null)

const helpEntries = computed<HelpEntry[]>(() => [
  {
    id: 'common',
    label: '通用',
    intro: '先看这一页，再去看具体功能页。你可以把编辑器理解成“把多个 cfg 文件读进来，最后只保存你自己的主配置”。',
    blocks: [
      {
        title: '先理解这 4 个概念',
        lines: [
          '1. 主配置项：你自己生成到 d2hackmap.gen.cfg 里的项目，可以直接改、注释、删除、拖拽排序。',
          '2. 外部项：来自 d2hackmap.default.cfg、d2hackmap.cfg 或其他引用文件。外部项是只读的，不能直接改。',
          '3. 已注释项：保存后仍保留在 cfg 里，但这一条不会生效，适合“先关掉，稍后再开”。',
          '4. 已删除项：保存后会从主配置中移除，适合你确认不再需要时使用。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '你看到一条灰色的外部项，想把它改成自己的规则：先点右侧“+”，复制到主配置，再修改复制出来的那一条。',
          '你只是想临时停用一条规则：点“//”注释，不要直接点“×”删除。'
        ]
      },
      {
        title: '推荐操作顺序',
        steps: [
          '先点“打开目录”，选择 HackMap 配置目录。',
          '找到底部“输出到”显示的主配置文件，确认你改的是它。',
          '先在各页面浏览外部项，决定哪些需要复制到主配置。',
          '改完以后点“保存文件”。如果只是切页面或关闭程序，改动不会自动写回 cfg。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '第一次使用时，可以先进入“自动拾取”页，找到灰色外部规则，复制几条你想保留的规则到主配置，再慢慢改。'
        ]
      },
      {
        title: '顺序与生效逻辑',
        lines: [
          '同一类配置项是否生效，不能只看“有没有这条”，还要看它在列表里的顺序，以及前后有没有更具体或更晚出现的规则覆盖它。',
          '你可以先把编辑器理解成两层：外部配置先提供“基础规则”，主配置再在此基础上做覆盖和补充。',
          '灰色外部项本身不会被你直接改写；当你把它复制到主配置后，真正生效的是你自己的那一条主配置项。',
          '如果同一个目标被多条主配置规则同时命中，通常应该按列表顺序理解和整理，避免自己写出互相打架的规则。',
          '拖拽改变的不只是界面顺序，保存后 CFG 文件里的顺序也会跟着改变，所以拖拽本身就是在改生效顺序。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '例 1：自动拾取里前面一条写“所有珠宝都捡”，后面一条写“只捡高生命珠宝”。这种写法通常容易冲突，新手应尽量避免让宽泛规则挡在精确规则前面。',
          '例 2：物品颜色里前面一条把某类物品设成隐藏，后面又有一条更具体的主配置规则想把其中一部分高亮显示。你需要明确这两条的先后关系，否则结果会和你想的不一样。',
          '例 3：灰色外部项已经定义了一条规则，你点“+”复制到主配置并修改后，后续应该以你复制出来的主配置项为准，而不是再去看灰色那条。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '只看单条规则内容，不看它在列表里的位置。',
          '写了两条都能命中同一目标的主配置规则，却没有整理先后顺序。',
          '已经复制到主配置了，却还以为灰色外部项才是最终生效的那条。',
          '拖拽改了顺序但没有意识到保存后 CFG 里的真实顺序也一起变了。'
        ]
      },
      {
        title: '搜索、批量操作、拖拽',
        lines: [
          '顶部搜索框只过滤当前页面，不会删除任何东西，也不会影响保存结果。',
          '勾选框只对主配置项生效，外部项不能勾选。',
          '拖拽手柄会真实改变 cfg 中的顺序，保存后顺序会写回文件。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '以为搜索结果没显示出来的项就不存在了。不是，搜索只是临时过滤显示。',
          '直接改外部项。外部项是只读的，必须先复制到主配置。',
          '把“注释”和“删除”混用。注释是暂时停用，删除是彻底移除。'
        ]
      }
    ]
  },
  {
    id: 'toggles',
    label: t('subTab.toggles'),
    intro: '这一页用来控制各种开关项，比如自动地图、自动拾取、快速施法、自动合成等开关，以及它们的快捷键。',
    blocks: [
      {
        title: '这一页每一列是什么意思',
        lines: [
          '启用：勾上表示该开关默认开启，不勾表示默认关闭。',
          '名称：开关的内部名字，用来对应 HackMap 的原始配置项，一般不需要改。',
          '快捷键：点击后录入一个热键。录入完成后会显示类似 VK_F8、VK_E 这样的值。',
          '注释：写给你自己看的备注，不影响规则是否生效。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '如果你希望“自动拾取开关”默认是开的，并且用 F8 控制它：把“启用”打勾，再把快捷键录成 VK_F8。'
        ]
      },
      {
        title: '你通常会怎么用',
        steps: [
          '找到你关心的开关行。',
          '如果它是灰色外部项，先点“+”复制到主配置。',
          '再修改启用状态或快捷键。',
          '保存文件。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '把名称当成显示文本去改。名称改错以后，可能就不再对应原来的开关了。',
          '只改了外部项但没有复制到主配置，看起来改了，其实保存时不会写进去。'
        ]
      }
    ]
  },
  {
    id: 'itemColors',
    label: t('subTab.items'),
    intro: '这一页控制普通物品在地面上的显示颜色，以及小地图上的颜色和文字。',
    blocks: [
      {
        title: '该怎么理解这些字段',
        lines: [
          '物品ID：决定这条规则匹配哪些物品。点击后会弹出物品选择器。',
          '品质：限制品质范围；留空或选“任意”表示不限制品质。',
          '文字颜色：地面名称的颜色。',
          '地图颜色：小地图上的颜色。',
          '地图文字：额外显示在地图上的短文字。留空表示不额外显示。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '想让“技能之书”更显眼：物品ID 选 2867-2880，品质留空，文字颜色改成亮色，地图文字填“技能之书”。',
          '想让某类垃圾装备默认隐藏：把文字颜色设成“隐藏”，这样地面文字就不显示了。'
        ]
      },
      {
        title: '推荐做法',
        steps: [
          '先决定你要改的是“普通物品颜色、符文颜色、还是金币颜色”。',
          '在列表里找到接近的外部规则，优先复制再改。',
          '如果没有现成规则，再点“添加”新建。',
          '改完以后，可以用顶部颜色筛选检查自己到底改了哪些颜色。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '把“地图颜色”和“地图文字”混在一起理解。地图颜色是颜色，地图文字是显示的文字内容。',
          '同时建了两条能匹配同一物品的主配置项，导致后面的规则把前面的效果覆盖了。'
        ]
      }
    ]
  },
  {
    id: 'runeColors',
    label: t('subTab.runes'),
    intro: '这一页专门给符文用。它和物品颜色页很像，只是左边第一列变成了“符文范围”。',
    blocks: [
      {
        title: '该怎么填',
        lines: [
          '范围：写要匹配的符文区间。',
          '文字颜色、地图颜色、地图文字：含义和“物品颜色”页一致。',
          '注释：写这一条是给哪类符文准备的，方便以后回头看。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '如果你想把一段低号符文统一标成蓝色，可以新增一条范围规则，再设置文字颜色和地图颜色。',
          '如果你想把高价值符文在小地图上额外打字，可以在“地图文字”里填简短标记。'
        ]
      },
      {
        title: '什么时候该用这一页',
        lines: [
          '只要你的目标是“按符文范围统一设置颜色”，就用这一页。',
          '如果你想按具体物品 ID 精确控制，那通常应该去“物品颜色”。'
        ]
      }
    ]
  },
  {
    id: 'goldColors',
    label: t('subTab.golds'),
    intro: '这一页专门给金币显示规则使用，通常按金币数量范围区分显示方式。',
    blocks: [
      {
        title: '怎么理解金币规则',
        lines: [
          '范围：表示金币数量区间。',
          '你可以给低金额金币一种颜色，给高金额金币另一种颜色。',
          '地图文字也可以用来提醒自己哪些金币值得专门捡。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '可以做两条规则：1-5000 一种普通颜色，5001 以上用更亮的颜色，方便一眼区分。'
        ]
      },
      {
        title: '常见错误',
        mistakes: [
          '以为金币页是按物品 ID 工作。不是，这里主要看数量范围。',
          '把很多互相重叠的范围都设成不同颜色，结果自己也分不清哪条最终生效。'
        ]
      }
    ]
  },
  {
    id: 'importItems',
    label: t('subTab.importItems'),
    intro: '这一页决定“什么物品自动捡、怎么捡、是否还要满足属性条件”。这是最常用，也最容易配乱的一页。',
    blocks: [
      {
        title: '先理解 4 个核心字段',
        lines: [
          '物品ID：决定是哪类物品。',
          '品质：进一步限制物品品质，比如只捡蓝色、只捡黄金。',
          '拾取方式：决定自动拾取时的动作，直接从下拉框里选，不建议死记数字。',
          '属性组：只有当这件物品还满足某个属性限制组时，规则才成立。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '一条简单规则：物品ID=1001-2000，品质=4-7，拾取方式=[1] 捡到身上，属性组留空。意思就是：匹配到这些物品后直接捡到人物身上。',
          '一条带属性限制的规则：先做一个“珠宝高生命”属性组，再把它填到这一页的属性组列里，就能实现“只自动捡满足这个属性组的珠宝”。'
        ]
      },
      {
        title: '推荐新手流程',
        steps: [
          '先用外部已有规则作为模板，不要一开始就从空白写。',
          '优先把“物品范围”配对，再决定拾取方式。',
          '只有在“按物品类型还不够精确”时，再去配属性组。',
          '每做完一类物品，就保存一次，避免一下改太多找不到问题。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '把“物品ID”和“属性组”职责混在一起。物品ID先筛种类，属性组再筛词缀/属性。',
          '一上来就建立很多复杂属性组，结果自己都看不懂。',
          '没有注意规则顺序，前面一条宽泛规则已经把物品处理掉了，后面更精确的规则就没意义了。'
        ]
      }
    ]
  },
  {
    id: 'statLimits',
    label: t('subTab.statLimits'),
    intro: '这一页用来定义“单条属性条件”。它本身不直接自动拾取，而是给拾取规则、物品描述、预处理等其他地方引用。',
    blocks: [
      {
        title: '这页到底是在定义什么',
        lines: [
          '限制名：你给这条条件起的名字，后面其他页面会通过这个名字来引用它。',
          '属性ID：你要检查哪一种属性，建议用选择器点选，不要自己硬记数字。',
          '参数、最小值、最大值：决定条件的具体范围。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '你想要“火抗至少 20”：新增一条限制，名字可以写“fire_res_20”，属性ID 选火抗，最小值填 20，最大值填 99999。',
          '你想要“孔数必须等于 4”：属性ID 选孔数，最小值和最大值都填 4。'
        ]
      },
      {
        title: '新手建议',
        lines: [
          '名字尽量起得一眼能懂，比如 fcr_10、hp_40、socket_4，不要起成 1、2、3 这种以后看不懂的名字。',
          '如果一条条件以后要反复复用，优先放在这里，不要在脑子里记。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '只起了一个短名字，过几天就忘了它是干什么的。',
          '属性ID 乱填数字，导致自己也不知道到底在限制哪项属性。'
        ]
      }
    ]
  },
  {
    id: 'statLimitGroups',
    label: t('subTab.statLimitGroups'),
    intro: '这一页把多条属性限制组合成一组，供自动拾取、物品描述、预处理统一引用。',
    blocks: [
      {
        title: '关系怎么理解',
        lines: [
          '满足任意一条：组里只要有一条成立，整组就成立。',
          '全部满足：组里每一条都要成立。',
          '满足任意一条则排除：只要命中其中一条，就把这件物品排除掉。',
          '全部满足才排除：只有全部命中时才排除。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '你想要“FCR>=10 并且 冰抗>=10”：先建两条单独限制，再在限制组里选“全部满足”，把这两条都加进去。',
          '你想要“命中任一垃圾属性就不要”：可以建一组排除组，关系设成“满足任意一条则排除”。'
        ]
      },
      {
        title: '怎么编辑限制组列表',
        lines: [
          '“N 条限制”按钮点开后，会弹出选择器。',
          '你可以在里面多选已有的属性限制，也可以引用其他限制组。',
          '列表里元素是有顺序的，主要是为了方便你阅读和维护。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '把一大堆条件都塞进一个组里，最后自己完全看不懂。',
          '组名和单条限制名起得太像，后面引用时分不清。'
        ]
      }
    ]
  },
  {
    id: 'itemDescriptors',
    label: t('tab.itemDescriptors'),
    intro: '“物品描述”是自动合成系统里的基础积木。后面的合成公式不是直接写物品 ID，而是按名字引用这里定义的物品描述。',
    blocks: [
      {
        title: '一条物品描述包含什么',
        lines: [
          '名称：给这组描述起名字，后面的合成公式会用这个名字。',
          '物品ID：匹配哪种物品。',
          '品质：进一步限制品质。',
          '属性组：如果这件物品还要满足某个属性限制组，就在这里填。',
          '数量：这一类物品在配方中需要几个。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '“珠宝-蓝*3”：名称写“珠宝-蓝*3”，物品ID=2136,2914，品质=4,6，数量=3。意思就是“配方里需要 3 个符合条件的蓝珠宝”。',
          '“符石3合1-材料”：名称起成材料用途，后面做配方时一眼就知道这条描述是干什么的。'
        ]
      },
      {
        title: '新手建议',
        lines: [
          '名称尽量带用途，比如“升级底材-珠宝”“开珠宝-蓝3”，这样到“合成公式”页时不用再猜。',
          '数量只允许 0 或正整数。大多数情况下这里不该填负数或文字。'
        ]
      }
    ]
  },
  {
    id: 'cubeFormulas',
    label: t('subTab.cubeFormulas'),
    intro: '这一页用来拼装“配方”。它不是直接写物品，而是把“物品描述”按顺序组合起来。',
    blocks: [
      {
        title: '怎么理解“配方物品列表”',
        lines: [
          '一条公式 = 一个名字 + 一串有顺序的物品描述。',
          '顺序是重要的，保存时会按当前顺序写回 cfg。',
          '右侧列表里的上移、下移、拖拽，都是在调整这个顺序。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '公式名“DM-专修珠升级0-1”，配方物品列表依次是“DM-专修珠-0”“药草*3”“PG-骷髅*1”。这三个名字本身都来自“物品描述”页。',
          '如果你把顺序改了，保存后的公式顺序也会跟着变。'
        ]
      },
      {
        title: '选择器怎么用',
        steps: [
          '点“当前公式列表”按钮，打开物品描述选择器。',
          '左边是可选物品描述，点“+”加入当前公式。',
          '右边是当前公式的配方物品列表，点“×”移除，点上下箭头调整顺序。',
          '确认无误后点“确定”。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '以为左边选中以后就自动保存了。要点“确定”才会写回当前公式。',
          '把“物品描述名字”起得太随意，导致配方页根本看不懂每个材料是什么。'
        ]
      }
    ]
  },
  {
    id: 'preItemTasks',
    label: t('subTab.preItemTasks'),
    intro: '预处理是在正式执行合成前，先对某类物品做准备动作，比如跳过、放入口袋、放入魔方等。',
    blocks: [
      {
        title: '一条预处理是怎么组成的',
        lines: [
          '名称：后面的执行任务通过这个名字引用预处理。',
          '物品ID、品质、属性组：决定这条预处理到底作用于哪些物品。',
          '动作：下拉框里选具体动作，比如默认、放入口袋、放入魔方、跳过。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '“DM-自动开珠宝-预处理”：先匹配珠宝类物品，再把动作设成“跳过”，意思是这些珠宝在预处理阶段先不要动。',
          '如果某类材料合成前必须先进背包或先进魔方，就在这里定义。'
        ]
      },
      {
        title: '什么时候需要配预处理',
        lines: [
          '当你只靠公式还不够，需要在正式执行前先整理材料时，就需要这一页。',
          '如果你的流程很简单，没有额外准备动作，可以只建少量预处理，甚至不建复杂规则。'
        ]
      }
    ]
  },
  {
    id: 'doTasks',
    label: t('subTab.doTasks'),
    intro: '执行任务是自动合成系统的最上层。它决定“先用哪个预处理，再按什么公式列表去执行”。',
    blocks: [
      {
        title: '执行任务由哪几部分组成',
        lines: [
          '名称：这条任务自己的名字。',
          '预处理：单选，来源是“预处理”子页。',
          '公式：多选且有序，来源是“合成公式”子页。',
          '注释：写用途说明。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '任务名“skballup”，预处理选“DM-专修珠升级-预处理”，公式里按顺序放“DM-专修珠升级0-1”“DM-专修珠升级1-2”……这就表示执行时先做预处理，再按顺序跑这一串公式。',
          '如果你只想做某一小段流程，就只保留那几个公式，不需要把全部公式都塞进去。'
        ]
      },
      {
        title: '新手建议',
        lines: [
          '把“执行任务”理解成总流程，把“合成公式”理解成步骤列表，把“物品描述”理解成配方材料。',
          '先把下层东西配好，再回到这里组装，不要反过来。'
        ],
        mistakesTitle: '常见错误',
        mistakes: [
          '上层任务先配了，下面的公式和预处理还没起好名，最后引用全乱掉。',
          '在公式选择器里加入了很多公式，但没有检查顺序。'
        ]
      }
    ]
  },
  {
    id: 'keyBindings',
    label: t('tab.keyBindings'),
    intro: '这一页是独立的按键绑定配置。它和“开关设置”不同：开关页主要是控制开关本身，这一页是把按键直接绑定到命令文本。',
    blocks: [
      {
        title: '每一列怎么用',
        lines: [
          '按键：点击录入热键。',
          '命令：真正执行的命令文本。',
          '注释：给自己看的说明。'
        ],
        exampleTitle: '例子',
        exampleLines: [
          '比如一条绑定可以是：按键 VK_E，命令 .71 1 1，注释写“快速执行某功能”。',
          '如果你已经有一条外部按键绑定，最安全的做法仍然是先复制到主配置，再改成自己的版本。'
        ]
      },
      {
        title: '什么时候用开关页，什么时候用按键绑定页',
        lines: [
          '如果你要改的是“某个开关默认开/关、以及它自己的热键”，先看开关页。',
          '如果你要直接把一个热键绑定到一段命令文本，就来按键绑定页。'
        ]
      }
    ]
  }
])

const activeEntry = computed(() => {
  return helpEntries.value.find(entry => entry.id === activeHelpTab.value) ?? helpEntries.value[0]
})

watch(activeHelpTab, () => {
  helpContentRef.value?.scrollTo({ top: 0, behavior: 'auto' })
})
</script>

<template>
  <div class="help-guide">
    <EditorPanel>
      <template #tabs>
        <div class="help-panel-title">{{ t('help.title') }}</div>
      </template>

      <div class="help-layout">
        <aside class="help-directory">
          <div class="help-directory-title">目录</div>
          <div class="help-directory-list">
            <button
              v-for="entry in helpEntries"
              :key="entry.id"
              type="button"
              class="help-directory-item"
              :class="{ active: activeHelpTab === entry.id }"
              @click="activeHelpTab = entry.id"
            >
              {{ entry.label }}
            </button>
          </div>
        </aside>

        <div ref="helpContentRef" class="help-content">
          <section class="help-hero">
            <h2>{{ activeEntry.label }}</h2>
            <p>{{ activeEntry.intro }}</p>
          </section>

          <section
            v-for="block in activeEntry.blocks"
            :key="block.title"
            class="help-section"
          >
            <h3>{{ block.title }}</h3>

            <div v-if="block.lines?.length" class="help-line-list">
              <p v-for="line in block.lines" :key="line">{{ line }}</p>
            </div>

            <ol v-if="block.steps?.length" class="help-step-list">
              <li v-for="step in block.steps" :key="step">{{ step }}</li>
            </ol>

            <div v-if="block.exampleLines?.length" class="help-example">
              <div class="help-example-title">{{ block.exampleTitle || '例子' }}</div>
              <p v-for="line in block.exampleLines" :key="line">{{ line }}</p>
            </div>

            <div v-if="block.mistakes?.length" class="help-mistakes">
              <div class="help-mistakes-title">{{ block.mistakesTitle || '常见错误' }}</div>
              <ul>
                <li v-for="item in block.mistakes" :key="item">{{ item }}</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </EditorPanel>
  </div>
</template>

<style scoped>
.help-guide {
  width: 100%;
}

.help-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.help-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  align-items: stretch;
}

.help-directory {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--border-color);
  padding-right: 16px;
}

.help-directory-title {
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--text-muted);
}

.help-directory-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.help-directory-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.help-directory-item:hover {
  background: var(--bg-secondary);
}

.help-directory-item.active {
  background: var(--accent-bg);
  color: var(--accent-color);
  font-weight: 600;
}

.help-content {
  flex: 1;
  min-height: 0;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding-right: 8px;
}

.help-hero {
  margin-bottom: 20px;
}

.help-hero h2 {
  margin: 0 0 8px;
  font-size: 26px;
  color: var(--text-primary);
}

.help-hero p {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.help-section {
  margin-bottom: 24px;
}

.help-section h3 {
  margin: 0 0 12px;
  padding-left: 12px;
  border-left: 3px solid var(--accent-color);
  font-size: 19px;
  color: var(--text-primary);
}

.help-line-list p,
.help-example p {
  margin: 0 0 10px;
  line-height: 1.9;
  color: var(--text-secondary);
}

.help-step-list {
  margin: 0 0 12px 18px;
  padding: 0;
}

.help-step-list li {
  margin-bottom: 8px;
  line-height: 1.9;
  color: var(--text-secondary);
}

.help-example {
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.help-example-title,
.help-mistakes-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.help-mistakes {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--warning-color);
  border-radius: 4px;
  background: color-mix(in srgb, var(--warning-color) 6%, transparent);
}

.help-mistakes ul {
  margin: 0;
  padding-left: 18px;
}

.help-mistakes li {
  margin-bottom: 8px;
  line-height: 1.8;
  color: var(--text-secondary);
}
</style>
