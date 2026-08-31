export default function ChatBubble({ message, isUser, timestamp }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'
        }`}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap">{message}</p>
        {timestamp && (
          <p className={`text-xs mt-1 ${isUser ? 'text-green-100' : 'text-gray-400'}`}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}
