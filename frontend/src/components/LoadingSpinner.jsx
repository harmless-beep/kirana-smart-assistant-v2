import { Loader2 } from 'lucide-react'

const sizes = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

export default function LoadingSpinner({ size = 'md', text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className={`text-primary animate-spin ${sizes[size]}`} />
      {text && <p className="text-gray-500 text-base">{text}</p>}
    </div>
  )
}
