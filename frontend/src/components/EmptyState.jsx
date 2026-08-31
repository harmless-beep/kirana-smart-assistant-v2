export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon size={36} className="text-gray-400" />
        </div>
      )}
      <h3 className="text-xl font-semibold text-gray-700 mb-2">{title}</h3>
      {description && (
        <p className="text-base text-gray-500 mb-6 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  )
}
