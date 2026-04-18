import { ref, computed } from 'vue'
import { useConfig } from './useConfig'
import { useI18n } from '../i18n'
import type {
  StatLimitItem,
  StatLimitGroupItem,
  ItemDescriptorItem,
  CubeFormulaItem,
  PreItemTaskItem,
  DoTaskItem
} from '../types'

// Validation error type
export interface ValidationError {
  type: 'error' | 'warning'
  section: string
  item: string
  message: string
}

// Validation result
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// Validation summary
export interface ValidationSummary {
  errorCount: number
  warningCount: number
  total: number
}

// Local validation version for manual refresh
const validationVersion = ref(0)

export function useValidation() {
  const { config, configVersion } = useConfig()
  const { t } = useI18n()

  // Force refresh validation manually
  function refreshValidation(): void {
    validationVersion.value++
  }

  // Transmute array keys
  type TransmuteArrayKey = 'statLimits' | 'statLimitGroups' | 'itemDescriptors' | 'cubeFormulas' | 'preItemTasks' | 'doTasks' | 'keyBindings'

  // Helper to collect all transmute items from all files
  function getAllTransmuteItems<T>(arrayName: TransmuteArrayKey): T[] {
    if (!config.value) return []
    const result: T[] = []
    for (const fileConfig of config.value.files) {
      const array = fileConfig.data.transmute[arrayName] as unknown as T[]
      result.push(...array)
    }
    return result
  }

  // Validate transmute configuration
  const transmuteValidation = computed<ValidationResult>(() => {
    // Depend on both configVersion (auto) and validationVersion (manual) to force re-computation
    const _configVer = configVersion.value
    const _validationVer = validationVersion.value
    if (!config.value || config.value.files.length === 0) return { valid: true, errors: [] }

    const errors: ValidationError[] = []

    // Collect all transmute items from all files
    const allStatLimits = getAllTransmuteItems<StatLimitItem>('statLimits')
    const allStatLimitGroups = getAllTransmuteItems<StatLimitGroupItem>('statLimitGroups')
    const allItemDescriptors = getAllTransmuteItems<ItemDescriptorItem>('itemDescriptors')
    const allCubeFormulas = getAllTransmuteItems<CubeFormulaItem>('cubeFormulas')
    const allPreItemTasks = getAllTransmuteItems<PreItemTaskItem>('preItemTasks')
    const allDoTasks = getAllTransmuteItems<DoTaskItem>('doTasks')

    // Get all defined names (only from effective items)
    const definedStatLimits = new Set(allStatLimits.filter(i => !i.isCommented && !i.isDeleted).map(i => i.name))
    const definedLimitGroups = new Set(allStatLimitGroups.filter(i => !i.isCommented && !i.isDeleted).map(i => i.name))
    const definedDescriptors = new Set(allItemDescriptors.filter(i => !i.isCommented && !i.isDeleted).map(i => i.name))
    const definedFormulas = new Set(allCubeFormulas.filter(i => !i.isCommented && !i.isDeleted).map(i => i.name))
    const definedPreTasks = new Set(allPreItemTasks.filter(i => !i.isCommented && !i.isDeleted).map(i => i.name))

    // Validate stat limit groups - check if referenced limits exist
    // Limits can reference either stat limits or other stat limit groups
    for (const group of allStatLimitGroups) {
      if (group.isCommented || group.isDeleted) continue
      for (const limitName of group.limits) {
        if (!definedStatLimits.has(limitName) && !definedLimitGroups.has(limitName)) {
          errors.push({
            type: 'error',
            section: 'statLimitGroups',
            item: group.name,
            message: t('validation.msg.limitGroupRefMissing', { group: group.name, limit: limitName })
          })
        }
      }
    }

    // Validate item descriptors - check if referenced limit groups exist
    // Note: "0" is a special value meaning "no limit"
    for (const desc of allItemDescriptors) {
      if (desc.isCommented || desc.isDeleted) continue
      if (desc.limitName && desc.limitName !== '0' && !definedLimitGroups.has(desc.limitName) && !definedStatLimits.has(desc.limitName)) {
        errors.push({
          type: 'warning',
          section: 'itemDescriptors',
          item: desc.name,
          message: t('validation.msg.itemDescRefMissing', { name: desc.name, limit: desc.limitName })
        })
      }
    }

    // Validate pre item tasks - check if referenced limit groups exist
    // Note: "0" is a special value meaning "no limit"
    for (const task of allPreItemTasks) {
      if (task.isCommented || task.isDeleted) continue
      if (task.limitName && task.limitName !== '0' && !definedLimitGroups.has(task.limitName) && !definedStatLimits.has(task.limitName)) {
        errors.push({
          type: 'warning',
          section: 'preItemTasks',
          item: task.name,
          message: t('validation.msg.preTaskRefMissing', { name: task.name, limit: task.limitName })
        })
      }
    }

    // Validate cube formulas - check if referenced descriptors exist
    for (const formula of allCubeFormulas) {
      if (formula.isCommented || formula.isDeleted) continue
      for (const descName of formula.descriptors) {
        if (!definedDescriptors.has(descName)) {
          errors.push({
            type: 'error',
            section: 'cubeFormulas',
            item: formula.name,
            message: t('validation.msg.formulaDescMissing', { name: formula.name, desc: descName })
          })
        }
      }
    }

    // Validate do tasks - check if referenced pre tasks and formulas exist
    for (const task of allDoTasks) {
      if (task.isCommented || task.isDeleted) continue
      if (task.preTask && !definedPreTasks.has(task.preTask)) {
        errors.push({
          type: 'error',
          section: 'doTasks',
          item: task.name,
          message: t('validation.msg.doTaskPreMissing', { name: task.name, pre: task.preTask })
        })
      }
      for (const formulaName of task.formulas) {
        if (!definedFormulas.has(formulaName)) {
          errors.push({
            type: 'error',
            section: 'doTasks',
            item: task.name,
            message: t('validation.msg.doTaskFormulaMissing', { name: task.name, formula: formulaName })
          })
        }
      }
    }

    return {
      valid: errors.filter(e => e.type === 'error').length === 0,
      errors
    }
  })

  // Get validation summary
  const validationSummary = computed<ValidationSummary>(() => {
    const all = transmuteValidation.value.errors
    return {
      errorCount: all.filter(e => e.type === 'error').length,
      warningCount: all.filter(e => e.type === 'warning').length,
      total: all.length
    }
  })

  return {
    transmuteValidation,
    validationSummary,
    refreshValidation
  }
}
