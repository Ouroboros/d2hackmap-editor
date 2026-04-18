import { ref, type Ref } from 'vue'
import { generateConfig } from '../generator'
import {
  saveEditorOutput,
  validateConfigDirectoryPath,
  type ConfigDirectory
} from '../services/tauriApi'
import type { Config } from '../types'

// Constants
export const EDITOR_OUTPUT_FILENAME = 'd2hackmap.gen.cfg'
export const REQUIRED_FILE = 'd2hackmap.default.cfg'

// Validation result type
export type ValidateResult =
  | { ok: true }
  | { ok: false, error: 'no_permission' | 'no_required_file' | string }

// State
const dirHandle: Ref<ConfigDirectory | null> = ref(null)

export function useEditorOutput() {
  // Validate directory: check required file and read permission.
  async function validateConfigDirectory(handle: ConfigDirectory): Promise<ValidateResult> {
    const result = await validateConfigDirectoryPath(handle.path)
    if (result.ok) {
      return { ok: true }
    }

    return {
      ok: false,
      error: result.error === 'no_required_file' ? 'no_required_file' : 'no_permission'
    }
  }

  // Set the directory handle
  function setDirHandle(handle: ConfigDirectory | null): void {
    dirHandle.value = handle
  }

  // Save config to editor output file
  async function saveToEditorFile(config: Config): Promise<void> {
    if (!dirHandle.value) {
      throw new Error('No directory handle')
    }

    // Find the editable file's data
    const editableFile = config.files.find(f => f.isEditable)
    if (!editableFile) {
      throw new Error('No editable file found')
    }

    // Generate config content and let the Tauri backend handle encoding/import updates.
    const content = generateConfig(editableFile.data)
    await saveEditorOutput(dirHandle.value.path, content)
  }

  return {
    dirHandle,
    validateConfigDirectory,
    setDirHandle,
    saveToEditorFile,
    EDITOR_OUTPUT_FILENAME,
    REQUIRED_FILE
  }
}
