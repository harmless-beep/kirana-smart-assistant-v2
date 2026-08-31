import Button from './Button'
import Modal from './Modal'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'Confirm'}>
      <p className="text-base text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} fullWidth onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
