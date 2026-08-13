import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { docToolPaths } from '../pages/docs/cards'
import { codeToolPaths } from '../pages/code/cards'
import { IconCode, IconDocs, IconHome, IconLife } from './icons'
import './Layout.less'

const navItems = [
  { to: '/home', label: '首页', icon: IconHome, kind: 'home' as const },
  { to: '/docs', label: '文档应用', icon: IconDocs, kind: 'docs' as const },
  { to: '/code', label: '编程应用', icon: IconCode, kind: 'code' as const },
  { to: '/life', label: '生活应用', icon: IconLife, kind: 'life' as const },
]

function isNavActive(kind: (typeof navItems)[number]['kind'], pathname: string) {
  if (kind === 'home') return pathname === '/home'
  if (kind === 'docs') return pathname === '/docs' || docToolPaths.includes(pathname)
  if (kind === 'code') return pathname === '/code' || codeToolPaths.includes(pathname)
  return pathname === '/life'
}

export function Layout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className={`studio-root${menuOpen ? ' menu-open' : ''}`}>
      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="关闭目录"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className="app-sidebar" aria-label="应用目录">
        <NavLink to="/" className="brand sidebar-brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-text">PDF Tools</span>
        </NavLink>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Glyph = item.icon
            const active = isNavActive(item.kind, location.pathname)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={active ? 'nav-link active' : 'nav-link'}
              >
                <Glyph className="nav-link-icon" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="app-body">
        <header className="site-header mobile-header">
          <div className="header-inner">
            <button
              type="button"
              className="menu-toggle"
              aria-label="打开目录"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <NavLink to="/" className="brand">
              <span className="brand-mark" aria-hidden />
              <span className="brand-text">PDF Tools</span>
            </NavLink>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
