import { request } from './transport.js'
import { choosePhoto } from './resident/profilePhoto.js'
const call = (action, values = {}) => request('resident-profile.php', { ...values, action })
export const getProfile = () => call('get')
export const saveContact = values => call('contact', values)
export const requestBirthdate = values => call('birthdate', values)
export const requestNameAddress = values => call('nameAddress', values)
export const requestFamily = values => call('family', values)
export const removePhoto = () => call('removePhoto')
export async function uploadPhoto() { const photo = await choosePhoto(); return photo ? call('photo', { photo }) : null }
