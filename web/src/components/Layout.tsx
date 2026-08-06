import { NavLink, Outlet } from 'react-router-dom'
import './Layout.css'

const links = [
  { to: '/merge', label: '合并' },
  { to: '/split', label: '拆分' },
  { to: '/compress', label: '压缩' },
  { to: '/watermark', label: '水印' },
  { to: '/replace', label: '替换页' },
  { to: '/textable', label: '可复制' },
  { to: '/toc', label: '目录' },
  { to: '/invoice', label: '发票' },
]

export function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden />
            <span className="brand-text">PDF Tools</span>
          </NavLink>
          <nav className="nav">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>
            文件仅用于本次处理，服务端临时文件会在约 1 小时内自动清理。请勿上传含敏感密钥的文档。
          </p>
        </div>
      </footer>
    </div>
  )
}
