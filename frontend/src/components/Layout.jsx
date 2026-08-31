import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <main className="max-w-lg mx-auto pb-20 sm:pb-24 px-0 sm:px-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
