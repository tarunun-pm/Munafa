'use client'

interface BottomNavProps {
  activeTab: 'home' | 'history' | 'catalogue'
  onTabChange: (tab: 'home' | 'history' | 'catalogue') => void
}

/**
 * BottomNav — fixed floating bottom navigation pill.
 * Three tabs: Home, Catalogue, History.
 */
export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto pb-safe"
      style={{ zIndex: 40 }}
    >
      <div
        className="mx-4 mb-3 rounded-2xl flex items-center overflow-hidden"
        style={{
          background: '#0F3D2E',
          boxShadow: '0 -2px 20px rgba(15,61,46,0.15), 0 4px 28px rgba(0,0,0,0.35)',
        }}
      >
        <NavTab
          label="Home"
          active={activeTab === 'home'}
          onClick={() => onTabChange('home')}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={activeTab === 'home' ? 'rgba(242,169,59,0.22)' : 'none'}
              />
              <path
                d="M9 21V12h6v9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          }
        />
        <NavTab
          label="Catalogue"
          active={activeTab === 'catalogue'}
          onClick={() => onTabChange('catalogue')}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect
                x="3" y="3" width="7" height="7" rx="1.5"
                stroke="currentColor" strokeWidth="2"
                fill={activeTab === 'catalogue' ? 'rgba(242,169,59,0.22)' : 'none'}
              />
              <rect
                x="14" y="3" width="7" height="7" rx="1.5"
                stroke="currentColor" strokeWidth="2"
                fill={activeTab === 'catalogue' ? 'rgba(242,169,59,0.22)' : 'none'}
              />
              <rect
                x="3" y="14" width="7" height="7" rx="1.5"
                stroke="currentColor" strokeWidth="2"
                fill={activeTab === 'catalogue' ? 'rgba(242,169,59,0.22)' : 'none'}
              />
              <rect
                x="14" y="14" width="7" height="7" rx="1.5"
                stroke="currentColor" strokeWidth="2"
                fill={activeTab === 'catalogue' ? 'rgba(242,169,59,0.22)' : 'none'}
              />
            </svg>
          }
        />
        <NavTab
          label="History"
          active={activeTab === 'history'}
          onClick={() => onTabChange('history')}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path
                d="M12 7v5l3.5 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </div>
    </nav>
  )
}

function NavTab({
  label, active, onClick, icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center py-3.5 gap-1 transition-opacity"
      style={{ color: active ? '#F2A93B' : 'rgba(255,255,255,0.4)' }}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
    </button>
  )
}
