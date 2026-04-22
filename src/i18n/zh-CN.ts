const zhCN: Record<string, string> = {
  // Common
  'app.title': 'D2HackMap 配置编辑器',
  'btn.open': '打开文件',
  'btn.save': '保存文件',
  'btn.new': '新建',
  'btn.close': '关闭',
  'btn.export': '导出',
  'btn.add': '添加',
  'btn.delete': '删除',
  'btn.comment': '注释',
  'btn.restore': '恢复',
  'btn.restoring': '恢复中...',
  'btn.restoreLast': '恢复上次',

  // Tabs
  'tab.toggles': '开关设置',
  'tab.itemColors': '物品颜色',
  'tab.importItems': '自动拾取',
  'tab.statLimitGroup': '属性限制',
  'tab.itemDescriptors': '物品描述',
  'tab.autoTransmute': '自动合成',
  'tab.keyBindings': '按键绑定',
  'tab.validation': '验证',
  'tab.help': '使用说明',

  // Sub tabs
  'subTab.toggles': '开关设置',
  'subTab.items': '物品颜色',
  'subTab.runes': '符文颜色',
  'subTab.golds': '金币颜色',
  'subTab.importItems': '拾取规则',
  'subTab.statLimits': '属性限制',
  'subTab.statLimitGroups': '限制组',
  'subTab.cubeFormulas': '合成公式',
  'subTab.preItemTasks': '预处理',
  'subTab.doTasks': '执行任务',

  // Panel titles
  'panel.toggles': '开关设置',
  'panel.itemColors': '物品颜色规则',
  'panel.runeColors': '符文颜色规则',
  'panel.importItems': '自动拾取规则',
  'panel.statLimits': '属性限制',
  'panel.statLimitGroups': '属性限制组',
  'panel.itemDescriptors': '物品描述',
  'panel.cubeFormulas': '合成公式',
  'panel.preItemTasks': '预处理任务',
  'panel.doTasks': '执行任务',
  'panel.keyBindings': '按键绑定',
  'panel.validation': '配置验证',

  // Toggle editor
  'toggle.enabled': '启用',
  'toggle.hotkey': '快捷键',
  'toggle.name': '名称',
  'toggle.comment': '说明',
  'toggle.empty': '没有开关配置',
  'toggle.autoMap': '自动显示地图',
  'toggle.autoPickup': '自动拾取',
  'toggle.lightRadius': '光照半径',
  'toggle.infravision': '红外视觉',
  'toggle.weather': '天气效果',
  'toggle.quickCast': '快速施法',
  'toggle.autoTransmute': '自动合成',
  'toggle.autoTransmuteFast': '自动合成快速取物',

  // Hotkey input
  'hotkey.recording': '正在录入...',
  'hotkey.clickToRecord': '点击录入快捷键',
  'hotkey.record': '录入',
  'hotkey.pressKey': '按下快捷键...',
  'hotkey.none': '无',
  'hotkey.clear': '清除快捷键',

  // Item Colors
  'itemColors.itemId': '物品ID',
  'itemColors.quality': '品质',
  'itemColors.ethereal': '无形',
  'itemColors.sockets': '孔数',
  'itemColors.textColor': '文字',
  'itemColors.mapColor': '地图',
  'itemColors.mapText': '地图文字',
  'itemColors.comment': '注释',
  'itemColors.actions': '操作',
  'itemColors.runeRange': '符文范围',
  'itemColors.runeRangePlaceholder': '符文范围 (如 1-15)',
  'itemColors.empty': '没有物品颜色配置',
  'itemColors.runeEmpty': '没有符文颜色配置',
  'itemColors.goldEmpty': '没有金币颜色配置',
  'itemColors.goldRange': '金币范围',
  'itemColors.filterTextColor': '按文字颜色筛选',
  'itemColors.filterMapColor': '按地图颜色筛选',
  'itemColors.dragHint': '拖动排序',

  // Batch operations
  'batch.selected': '已选 {count} 项',
  'batch.copyAllExtern': '复制全部外部项',

  // Actions
  'action.copy': '复制',

  // Map color picker
  'mapColor.title': '颜色 {value} (索引 {index})',
  'mapColor.none': '无颜色 (-1)',
  'mapColor.selectTitle': '选择地图颜色',
  'mapColor.clear': '清除',

  // Text color picker
  'textColor.selectTitle': '选择文字颜色',
  'textColor.unknown': '未知颜色',

  // Quality options
  'quality.any': '任意',
  'quality.all': '全部',
  'quality.selectTitle': '选择品质',
  'quality.selectAll': '全选',
  'quality.clear': '清空',
  'quality.1': '破碎的',
  'quality.2': '普通的',
  'quality.3': '超强的',
  'quality.4': '魔法的',
  'quality.5': '套装的',
  'quality.6': '稀有的',
  'quality.7': '暗金的',
  'quality.8': '手工的',

  // Text colors
  'color.-2': '隐藏',
  'color.-1': '默认',
  'color.0': '白色',
  'color.1': '红色',
  'color.2': '亮绿色',
  'color.3': '蓝色',
  'color.4': '暗金',
  'color.5': '灰色',
  'color.6': '黑色',
  'color.7': '金色',
  'color.8': '橙色',
  'color.9': '黄色',
  'color.10': '暗绿色',
  'color.11': '紫色',
  'color.12': '暗红色',

  // Import Items
  'import.mode': '拾取方式',
  'import.mode.0': '进魔法口袋',
  'import.mode.1': '捡到身上',
  'import.mode.2': '捡到方块',
  'import.mode.3': '忽略该物品',
  'import.mode.10': '优先腰带→口袋',
  'import.mode.11': '优先腰带→忽略',
  'import.mode.12': '口袋有则口袋→背包',
  'import.mode.13': '口袋有则口袋→方块',
  'import.statGroup': '属性组',
  'import.empty': '没有自动拾取配置',

  // Stat Group Picker
  'statGroup.placeholder': '选择属性组',
  'statGroup.tabLimits': '属性限制',
  'statGroup.tabGroups': '属性限制组',
  'statGroup.clear': '清除',
  'statGroup.confirm': '确定',
  'statGroup.search': '搜索...',
  'statGroup.emptyLimits': '没有定义属性限制',
  'statGroup.emptyGroups': '没有定义属性限制组',
  'statGroup.noMatch': '没有匹配的结果',
  'statGroup.multiSelected': '已选 {count} 项',
  'statGroup.selectedCount': '已选 {count} 项',
  'statGroup.showSelected': '点击筛选已选项',
  'statGroup.noSelection': '未选择',

  // Descriptor list picker
  'descriptorPicker.title': '选择物品描述',
  'descriptorPicker.placeholder': '选择物品描述',
  'descriptorPicker.search': '搜索...',
  'descriptorPicker.available': '可选物品描述',
  'descriptorPicker.addAll': '全部添加',
  'descriptorPicker.selected': '已选',
  'descriptorPicker.selectedList': '当前公式列表',
  'descriptorPicker.count': '{count} 个物品描述',
  'descriptorPicker.empty': '没有定义物品描述',
  'descriptorPicker.noMatch': '没有匹配的物品描述',
  'descriptorPicker.noSelection': '未选择物品描述',
  'descriptorPicker.remove': '移除',
  'descriptorPicker.removeAll': '全部删除',
  'descriptorPicker.moveUp': '上移',
  'descriptorPicker.moveDown': '下移',

  // Auto Transmute
  'transmute.statLimit': '属性限制',
  'transmute.statLimitGroup': '属性限制组',
  'transmute.itemDescriptor': '物品描述',
  'transmute.cubeFormula': '合成公式',
  'transmute.preTask': '预任务',
  'transmute.doTask': '执行任务',
  'transmute.keyBinding': '按键绑定',
  'transmute.name': '名称',
  'transmute.limitName': '限制名',
  'transmute.statId': '属性ID',
  'transmute.param': '参数',
  'transmute.range': '范围',
  'transmute.min': '最小值',
  'transmute.max': '最大值',
  'transmute.minValue': '最小值',
  'transmute.maxValue': '最大值',
  'transmute.relation': '关系',
  'transmute.statLimitList': '属性限制列表',
  'transmute.itemId': '物品ID',
  'transmute.limit': '限制',
  'transmute.count': '数量',
  'transmute.formula': '公式',
  'transmute.formulas': '公式',
  'transmute.action': '动作',
  'transmute.keyCode': '按键',
  'transmute.command': '命令',
  'transmute.empty.statLimits': '没有属性限制配置',
  'transmute.empty.statLimitGroups': '没有属性限制组配置',
  'transmute.empty.itemDescriptors': '没有物品描述配置',
  'transmute.empty.cubeFormulas': '没有合成公式配置',
  'transmute.empty.preItemTasks': '没有预处理任务配置',
  'transmute.empty.doTasks': '没有执行任务配置',
  'transmute.empty.keyBindings': '没有按键绑定配置',
  'transmute.newLimit': '新限制',
  'transmute.newLimitGroup': '新限制组',
  'transmute.newItemDescriptor': '新物品描述',
  'transmute.newCubeFormula': '新合成公式',
  'transmute.newPreItemTask': '新预处理',
  'transmute.newDoTask': '新执行任务',
  'transmute.limitRefCount': '{count} 条限制',
  'transmute.emptyLimitRefs': '没有引用属性限制',

  // Validation
  'validation.title': '配置验证',
  'validation.noErrors': '配置验证通过，没有发现问题',
  'validation.error': '错误',
  'validation.warning': '警告',
  'validation.valid': '配置有效',
  'validation.refresh': '刷新',
  'validation.msg.limitGroupRefMissing': '限制组 "{group}" 引用了不存在的属性限制 "{limit}"',
  'validation.msg.itemDescRefMissing': '物品描述 "{name}" 引用了可能不存在的限制 "{limit}"',
  'validation.msg.preTaskRefMissing': '预处理任务 "{name}" 引用了可能不存在的限制 "{limit}"',
  'validation.msg.formulaDescMissing': '合成公式 "{name}" 引用了不存在的物品描述 "{desc}"',
  'validation.msg.doTaskPreMissing': '执行任务 "{name}" 引用了不存在的预处理任务 "{pre}"',
  'validation.msg.doTaskFormulaMissing': '执行任务 "{name}" 引用了不存在的合成公式 "{formula}"',

  // Relation types
  'relation.0': '满足任意一条',
  'relation.1': '满足全部条件',
  'relation.2': '满足任意一条则排除',
  'relation.3': '满足全部条件才排除',

  // Action types
  'action.1': '放入魔方',
  'action.2': '放入口袋',
  'action.3': '默认',
  'action.7': '跳过',

  // Status
  'status.noFile': '未打开文件',
  'status.unsaved': '(未保存)',
  'status.readOnly': '(只读)',
  'status.pending': '待加载',
  'status.saved': '已保存',
  'status.ready': '就绪',
  'status.outputFile': '输出到: {file}',

  // Errors
  'error.openFailed': '打开文件失败: {message}',
  'error.loadExternFailed': '加载外部文件失败: {message}',
  'error.invalidFormat': '无效的文件格式',
  'error.invalidConfigDir': '无效的配置目录，缺少必需文件: {file}',
  'error.browserNotSupported': '当前浏览器不支持目录选择功能',
  'error.noPermission': '没有读取目录的权限，请重新选择目录并授权',
  'error.readFileFailed': '读取文件失败: {file}，浏览器可能不支持或未授权文件访问',
  'error.saveFailed': '保存失败: {message}',

  // Item Picker
  'itemPicker.title': '选择物品',
  'itemPicker.selectAll': '全选',
  'itemPicker.clear': '清空',
  'itemPicker.idRange': 'ID范围',
  'itemPicker.idRangeHint': '支持: 1,2,3 或 1-3 或 1,2-5,7',
  'itemPicker.inputPlaceholder': '输入物品ID范围，如: 2096,2097-2098',
  'itemPicker.searchPlaceholder': '搜索物品ID或名称...',
  'itemPicker.noMatch': '没有找到匹配的物品',
  'itemPicker.noData': '物品数据未加载，请直接输入ID范围',
  'itemPicker.selected': '已选: {count}',
  'itemPicker.showSelected': '点击筛选已选物品',
  'itemPicker.notSelected': '(未选择)',
  'itemPicker.cancel': '取消',
  'itemPicker.confirm': '确定',
  'itemPicker.moreItems': '...还有 {count} 个',

  // Rune Picker
  'runePicker.title': '选择符文',
  'runePicker.placeholder': '符文范围',
  'runePicker.selectAll': '全选',
  'runePicker.clear': '清空',
  'runePicker.idRange': '符文范围',
  'runePicker.idRangeHint': '支持: 1,2,3 或 1-33 或 1-15,20+',
  'runePicker.inputPlaceholder': '输入符文范围，如: 1-15,20-33',
  'runePicker.searchPlaceholder': '搜索符文...',
  'runePicker.noMatch': '没有找到匹配的符文',
  'runePicker.selected': '已选: {count}',
  'runePicker.showSelected': '点击筛选已选符文',
  'runePicker.cancel': '取消',
  'runePicker.confirm': '确定',
  'runePicker.moreItems': '...还有 {count} 个',

  // Stat Picker
  'statPicker.title': '选择属性',
  'statPicker.placeholder': '属性ID',
  'statPicker.clear': '清空',
  'statPicker.inputHint': '输入属性ID或从列表选择',
  'statPicker.inputPlaceholder': '输入属性ID，如: 39',
  'statPicker.searchPlaceholder': '搜索属性...',
  'statPicker.noMatch': '没有找到匹配的属性',
  'statPicker.noData': '属性数据未加载',
  'statPicker.selected': '已选',
  'statPicker.notSelected': '未选择',
  'statPicker.range': '参考范围',
  'statPicker.cancel': '取消',
  'statPicker.confirm': '确定',

  // Common actions
  'action.restore': '恢复',
  'action.comment': '注释',
  'action.delete': '删除',
  'action.copyToMain': '复制到主配置',
  'action.jumpToMain': '跳转到主配置项',

  // Theme
  'theme.light': '浅色',
  'theme.dark': '深色',
  'theme.system': '跟随系统',

  // Drop overlay
  'drop.hint': '拖放 .cfg 文件到这里',

  // Externs bar
  'externs.select': '加载关联',

  // Search
  'search.placeholder': '搜索...',
  'search.clear': '清除',
  'search.noMatch': '无匹配项',
  'search.pressEnterToUse': '按回车使用 "{value}"',

  // Color Preview
  'colorPreview.hidden': '隐藏',
  'colorPreview.sample': '示例',

  // Welcome
  'welcome.title': 'D2HackMap 配置编辑器',
  'welcome.hint': '打开配置目录开始编辑，目录需包含 d2hackmap.default.cfg',
  'welcome.newConfig': '新建配置',

  // Restore
  'restore.lastOpened': '上次打开:',
  'restore.clear': '清除',
  'restore.clearTitle': '清除记忆',

  // Browser compatibility
  'browser.notSupported': '浏览器不支持',
  'browser.useModern': '请使用现代浏览器:',
  'browser.missingFeatures': '缺少功能:',

  // Config Chain Dialog
  'configChain.title': '配置链',
  'configChain.hint': '部分配置文件位于目录外部，需要手动授权访问',
  'configChain.status.loaded': '已加载',
  'configChain.status.pending': '待授权',
  'configChain.status.skipped': '已跳过',
  'configChain.status.missing': '缺失',
  'configChain.status.circular': '循环引用',
  'configChain.selectDir': '选择目录',
  'configChain.skip': '跳过',
  'configChain.cancel': '取消',
  'configChain.confirm': '继续加载',

  // Directory picker
  'btn.openDir': '打开目录',
  'welcome.openDir': '打开配置目录',

  // Storage
  'storage.clearAll': '清除所有缓存',
  'storage.confirmClear': '确定要清除所有保存的数据吗？（包括目录记忆、标签页状态等）',

  // Generator section headers
  'gen.toggles': '开关设置',
  'gen.itemColors': '物品颜色',
  'gen.runeColors': '符文颜色',
  'gen.goldColors': '金币颜色',
  'gen.importItems': '自动拾取',
  'gen.statLimits': '属性限制',
  'gen.itemDescriptors': '物品描述符',
  'gen.autoTransmute': '自动合成',
  'gen.keyBindings': '快捷键',

  // Help Guide
  'help.title': '使用说明',
  'help.gettingStarted': '快速开始',
  'help.gettingStartedContent': '点击"打开目录"按钮，选择配置文件所在的目录。编辑器会自动加载主配置和所有引用的外部配置。编辑完成后点击"保存文件"即可。',

  'help.configChain': '配置继承',
  'help.configChainContent': '配置文件可以引用其他配置文件，编辑器会自动加载所有引用的配置。当多个配置中存在相同的配置项时，你自己的配置优先生效。',

  'help.itemTypes': '配置项状态',
  'help.mainItem': '可编辑项',
  'help.mainItemDesc': '你自己的配置项，可以自由编辑、注释、删除。',
  'help.externItem': '外部项（灰色背景）',
  'help.externItemDesc': '来自引用文件的配置项，不可直接编辑。如需修改，点击 + 按钮复制一份到你的配置中。',
  'help.commentedItem': '已注释项（半透明）',
  'help.commentedItemDesc': '被注释的配置项，保存后会被禁用但保留在文件中。',
  'help.deletedItem': '已删除项（划线）',
  'help.deletedItemDesc': '标记为删除的配置项，保存后会从文件中移除。',

  'help.actions': '操作说明',
  'help.actionAdd': '添加：在列表末尾新增一个空白配置项。',
  'help.actionCopy': '复制（⧉）：复制当前行创建新配置项。',
  'help.actionComment': '注释（//）：暂时禁用配置项，但保留在文件中。',
  'help.actionDelete': '删除（×）：从配置中移除该项。',
  'help.actionRestore': '恢复（↩）：恢复已注释或已删除的配置项。',
  'help.actionCopyToMain': '复制到我的配置（+）：将外部配置项复制一份，便于修改或覆盖。',
  'help.actionJumpToMain': '跳转（→）：当外部项已被你的配置覆盖时，点击可跳转到你的配置项。',

  'help.batchOps': '批量操作',
  'help.batchOpsContent': '勾选多个配置项后，可以进行批量设置颜色、批量注释、批量删除、批量恢复等操作。外部配置项不可勾选。',
  'help.copyAllExtern': '"复制全部外部项"按钮可一次性复制所有外部配置项。',

  'help.dragDrop': '拖拽排序',
  'help.dragDropContent': '拖动行首的拖拽手柄（⋮⋮）可调整配置项顺序。仅主配置项可拖拽排序。',

  'help.colorConfig': '颜色配置',
  'help.colorConfigContent': '物品颜色、符文颜色、金币颜色支持设置文字颜色和地图颜色。点击颜色方块选择颜色，选择"无"表示不修改默认颜色。',

  'help.filters': '筛选功能',
  'help.filtersContent': '使用搜索框可按关键字筛选配置项。物品颜色页面还支持按文字颜色、地图颜色筛选。',

  'help.validation': '配置验证',
  'help.validationContent': '验证页面会检查配置是否有错误，比如引用了不存在的属性限制、物品ID是否正确等。',

  'help.tips': '使用技巧',
  'help.tip1': '想修改外部配置？先点 + 复制，再编辑复制后的配置项。',
  'help.tip2': '品质留空表示匹配所有品质。',
}

export default zhCN
