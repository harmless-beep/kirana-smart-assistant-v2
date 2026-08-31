import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, Clock, IndianRupee } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../api/client'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

const TYPE_CONFIG = {
  low_stock: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-600', bg: 'bg-orange-50', label: 'lowStockAlert' },
  expiring: { icon: Clock, color: 'bg-red-100 text-red-600', bg: 'bg-red-50', label: 'expiringAlert' },
  credit_overdue: { icon: IndianRupee, color: 'bg-purple-100 text-purple-600', bg: 'bg-purple-50', label: 'creditOverdue' },
  general: { icon: Bell, color: 'bg-blue-100 text-blue-600', bg: 'bg-blue-50', label: 'notifications' },
}

export default function Notifications() {
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    try {
      const res = await api.notifications.getAll()
      setNotifications(res.data?.notifications || res.data || [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id) {
    try {
      await api.notifications.markRead(id)
      setNotifications(prev =>
        prev.map(n => (n._id === id || n.id === id) ? { ...n, read: true } : n)
      )
    } catch {
      // silent
    }
  }

  return (
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 dark:bg-gray-900 min-h-screen">
      <PageHeader
        icon={Bell}
        title={t('notifications')}
        action={
          notifications.some(n => !n.read) && (
            <button
              onClick={async () => {
                const unread = notifications.filter(notification => !notification.read)
                await Promise.all(unread.map(notification => api.notifications.markRead(notification.id)))
                setNotifications(prev => prev.map(notification => ({ ...notification, read: true })))
              }}
              className="text-white text-sm font-semibold bg-white/15 px-3 py-2 rounded-xl active:bg-white/25 transition-colors"
            >
              {t('markAllRead')}
            </button>
          )
        }
      />

      {loading ? (
        <LoadingSpinner text={t('loading')} />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title={t('noNotifications')} description={t('allCaughtUp')} />
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map(notif => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.general
            const Icon = config.icon
            return (
              <Card
                key={notif.id}
                className={`dark:bg-gray-800 ${!notif.read ? 'border-l-4 border-primary' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-base">{notif.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{notif.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : ''}
                      </span>
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="text-primary text-xs font-medium"
                        >
                          {t('markAsRead')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
