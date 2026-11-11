// Mirrors script.js: action/hidden values survive; checkboxes restore defaults.
// Controlled forms supply Modal.onReset to reset their React state as well.
export default function clearModalFields(overlay) {
  overlay.querySelectorAll('input, select, textarea').forEach((field) => {
    if (['hidden', 'submit', 'button'].includes(field.type)) return
    if (['checkbox', 'radio'].includes(field.type)) field.checked = field.defaultChecked
    else if (field.tagName === 'SELECT') field.selectedIndex = 0
    else field.value = ''
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
