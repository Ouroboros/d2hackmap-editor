/**
 * Keyboard to VK code mapping utilities
 */

// Map JavaScript KeyboardEvent.code to Windows VK_XXX format
const CODE_TO_VK: Record<string, string> = {
  // Letters
  KeyA: 'VK_A', KeyB: 'VK_B', KeyC: 'VK_C', KeyD: 'VK_D', KeyE: 'VK_E',
  KeyF: 'VK_F', KeyG: 'VK_G', KeyH: 'VK_H', KeyI: 'VK_I', KeyJ: 'VK_J',
  KeyK: 'VK_K', KeyL: 'VK_L', KeyM: 'VK_M', KeyN: 'VK_N', KeyO: 'VK_O',
  KeyP: 'VK_P', KeyQ: 'VK_Q', KeyR: 'VK_R', KeyS: 'VK_S', KeyT: 'VK_T',
  KeyU: 'VK_U', KeyV: 'VK_V', KeyW: 'VK_W', KeyX: 'VK_X', KeyY: 'VK_Y',
  KeyZ: 'VK_Z',

  // Numbers
  Digit0: 'VK_0', Digit1: 'VK_1', Digit2: 'VK_2', Digit3: 'VK_3', Digit4: 'VK_4',
  Digit5: 'VK_5', Digit6: 'VK_6', Digit7: 'VK_7', Digit8: 'VK_8', Digit9: 'VK_9',

  // Function keys
  F1: 'VK_F1', F2: 'VK_F2', F3: 'VK_F3', F4: 'VK_F4', F5: 'VK_F5',
  F6: 'VK_F6', F7: 'VK_F7', F8: 'VK_F8', F9: 'VK_F9', F10: 'VK_F10',
  F11: 'VK_F11', F12: 'VK_F12',

  // Numpad
  Numpad0: 'VK_NUMPAD0', Numpad1: 'VK_NUMPAD1', Numpad2: 'VK_NUMPAD2',
  Numpad3: 'VK_NUMPAD3', Numpad4: 'VK_NUMPAD4', Numpad5: 'VK_NUMPAD5',
  Numpad6: 'VK_NUMPAD6', Numpad7: 'VK_NUMPAD7', Numpad8: 'VK_NUMPAD8',
  Numpad9: 'VK_NUMPAD9',
  NumpadMultiply: 'VK_MULTIPLY', NumpadAdd: 'VK_ADD',
  NumpadSubtract: 'VK_SUBTRACT', NumpadDecimal: 'VK_DECIMAL',
  NumpadDivide: 'VK_DIVIDE', NumpadEnter: 'VK_RETURN',

  // Special keys
  Space: 'VK_SPACE',
  Enter: 'VK_RETURN',
  Tab: 'VK_TAB',
  Backspace: 'VK_BACK',
  Delete: 'VK_DELETE',
  Insert: 'VK_INSERT',
  Home: 'VK_HOME',
  End: 'VK_END',
  PageUp: 'VK_PRIOR',
  PageDown: 'VK_NEXT',
  ArrowUp: 'VK_UP',
  ArrowDown: 'VK_DOWN',
  ArrowLeft: 'VK_LEFT',
  ArrowRight: 'VK_RIGHT',
  CapsLock: 'VK_CAPITAL',
  NumLock: 'VK_NUMLOCK',
  ScrollLock: 'VK_SCROLL',
  Pause: 'VK_PAUSE',
  PrintScreen: 'VK_SNAPSHOT',

  // OEM keys (US keyboard layout)
  Semicolon: 'VK_OEM_1',       // ;:
  Equal: 'VK_OEM_PLUS',        // =+
  Comma: 'VK_OEM_COMMA',       // ,<
  Minus: 'VK_OEM_MINUS',       // -_
  Period: 'VK_OEM_PERIOD',     // .>
  Slash: 'VK_OEM_2',           // /?
  Backquote: 'VK_OEM_3',       // `~
  BracketLeft: 'VK_OEM_4',     // [{
  Backslash: 'VK_OEM_5',       // \|
  BracketRight: 'VK_OEM_6',    // ]}
  Quote: 'VK_OEM_7',           // '"
}

// Modifier key codes (ignored as main key)
const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight'
])

/**
 * Convert a KeyboardEvent to VK format string
 * @param event - KeyboardEvent
 * @returns VK format string or null if key is not mappable
 */
export function formatHotkey(event: KeyboardEvent): string | null {
  // Ignore if only modifier key is pressed
  if (MODIFIER_CODES.has(event.code)) {
    return null
  }

  const vk = CODE_TO_VK[event.code]
  if (vk === undefined) {
    return null
  }

  const parts: string[] = []
  if (event.shiftKey) parts.push('SHIFT')
  if (event.ctrlKey) parts.push('CTRL')
  if (event.altKey) parts.push('ALT')
  parts.push(vk)

  return parts.join('+')
}

/**
 * Check if a KeyboardEvent is the Escape key
 * @param event - KeyboardEvent
 */
export function isEscapeKey(event: KeyboardEvent): boolean {
  return event.code === 'Escape'
}
