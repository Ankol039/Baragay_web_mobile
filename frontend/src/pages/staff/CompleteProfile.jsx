import { record } from '../../propTypes.js'
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import useServiceData from '../../hooks/useServiceData.js'
import { getStaffProfile, uploadStaffPhoto, removeStaffPhoto } from '../../services/accountsService.js'
import useAuth from '../../hooks/useAuth.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import PhotoUploader from '../../components/profile/PhotoUploader.jsx'
import StaffRecord from '../../components/staff-profile/StaffRecord.jsx'
import StaffProfileForm from '../../components/staff-profile/StaffProfileForm.jsx'
import ProfileSuccessModal from '../../components/staff-profile/ProfileSuccessModal.jsx'

export default function CompleteProfile() {
  const result = useServiceData(getStaffProfile)
  usePageTitle('My Profile')
  if (result.error) return <Alert type="error" inline>{result.error}</Alert>
  if (!result.data) return <p role="status">Loading…</p>
  return <ProfileContent initial={result.data} />
}
function ProfileContent({ initial }) {
  const [data, setData] = useState(initial), [outcome, setOutcome] = useState(''), [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const { refresh } = useAuth()
  const { setProfileSaved } = useOutletContext() || {}
  useEffect(() => () => setProfileSaved?.(false), [setProfileSaved])
  async function saved(result, kind) {
    setData(result.data); setError('')
    setRevision(old => old + 1)
    setProfileSaved?.(kind !== 'remove')
    await refresh()
    setOutcome(kind === 'remove' ? '' : result.outcome || 'normal')
  }
  return <>
    <PageHead title={data.onboarding ? 'Complete Your Profile' : 'My Profile'} subtitle={data.onboarding ? 'Step 2 of 2. Tell the health center how to reach you.' : data.is_admin ? 'Your account record.' : 'Keep your contact details up to date.'} />
    {error && <Alert key={error} type="error">{error}</Alert>}
    <div className="grid-2"><StaffRecord data={data} /><PhotoUploader photo={data.account.photo_path} upload={uploadStaffPhoto} remove={removeStaffPhoto} alt="Profile photo" onSaved={saved} /></div>
    {!data.is_admin && <StaffProfileForm key={revision} data={data} onSaved={saved} onError={setError} />}
    <ProfileSuccessModal outcome={outcome} onClose={() => setOutcome('')} />
  </>
}

if (import.meta.env.DEV) {
  ProfileContent.propTypes = {
    initial: record.isRequired,
  }
}
