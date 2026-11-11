import { request } from './transport.js'
export const authBridge = (action, body) => request(`index.php?action=${action}`, body, false)
