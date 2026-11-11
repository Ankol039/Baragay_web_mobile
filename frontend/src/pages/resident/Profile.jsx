import { record } from '../../propTypes.js'
import { useState } from 'react'
import useServiceData from '../../hooks/useServiceData.js'
import { getProfile, uploadPhoto, removePhoto } from '../../services/profileService.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import useAuth from '../../hooks/useAuth.js'
import PageHead from '../../components/common/PageHead.jsx'
import Alert from '../../components/common/Alert.jsx'
import Modal from '../../components/common/Modal.jsx'
import ProfileOverview from '../../components/profile/ProfileOverview.jsx'
import ProfileDetails from '../../components/profile/ProfileDetails.jsx'
import FamilyOverview from '../../components/profile/FamilyOverview.jsx'
import PhotoUploader from '../../components/profile/PhotoUploader.jsx'
import ContactForm from '../../components/profile/ContactForm.jsx'
import RequestChangeModal from '../../components/profile/RequestChangeModal.jsx'
import FamilyRequestModal from '../../components/profile/FamilyRequestModal.jsx'

export default function Profile() {
  const result = useServiceData(getProfile)
  usePageTitle('My Profile')
  if (result.error) return <Alert type="error" inline>{result.error}</Alert>
  if (result.loading) return <p role="status">Loading…</p>
  return <ProfileContent initial={result.data} />
}
function ProfileContent({ initial }) {
  const [data, setData] = useState(initial)
  const [modal, setModal] = useState('')
  const [message, setMessage] = useState('')
  const { refresh } = useAuth()
  function saved(result, kind = modal) {
    setData(result.data)
    setMessage(['family', 'remove'].includes(kind) ? '' : result.message)
    setModal(kind === 'photo' ? 'success' : '')
    if (['photo', 'remove'].includes(kind)) refresh()
  }
  const close = () => setModal('')
  return <>
    <PageHead title="My Profile" subtitle="Your personal details on record with the health center." />
    {message && modal !== 'success' && <Alert key={message} type="success" className="alert-spaced">{message}</Alert>}
    <div className="grid-2"><div>
      <ProfileOverview resident={data.resident} display={data.display} onRequest={() => setModal('name')} />
      <ProfileDetails data={data} onContact={() => setModal('contact')} onBirthdate={() => setModal('birthdate')} />
      <FamilyOverview data={data} onRequest={() => setModal('family')} />
    </div><PhotoUploader photo={data.resident.photo_path} onSaved={saved} upload={uploadPhoto} remove={removePhoto} /></div>
    {modal === 'contact' && <ContactForm data={data} onClose={close} onSaved={saved} />}
    {['name', 'birthdate'].includes(modal) && <RequestChangeModal key={modal} type={modal} data={data} onClose={close} onSaved={saved} />}
    {modal === 'family' && <FamilyRequestModal data={data} onClose={close} onSaved={saved} />}
    <Modal id="profile-success-modal" open={modal === 'success'} narrow keepOnClose title="Profile Updated" onClose={() => { close(); setMessage('') }}
      icon={<div className="modal-icon-success">✓</div>}>
      <p className="modal-text">{message}</p><div className="modal-actions"><button type="button" className="btn" data-modal-close="">Done</button></div>
    </Modal>
  </>
}

if (import.meta.env.DEV) {
  ProfileContent.propTypes = {
    initial: record.isRequired,
  }
}
