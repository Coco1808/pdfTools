import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './HomePage.css'

export function HomePage() {
  return (
    <div className="container home">
      <section className="hero">
        <div className="hero-copy">
          <motion.p
            className="hero-eyebrow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            轻量 · 本地处理优先 · 无账号
          </motion.p>
          <motion.h1
            className="hero-brand"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            PDF Tools
          </motion.h1>
          <motion.p
            className="hero-lead"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            把多份 PDF 合而为一，也能拆分、压缩、加水印——按需处理，干净利落。
          </motion.p>
          <motion.div
            className="hero-cta"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Link to="/merge" className="btn btn-primary">
              开始合并
            </Link>
            <Link to="/split" className="btn btn-ghost">
              拆分
            </Link>
            <Link to="/compress" className="btn btn-ghost">
              压缩
            </Link>
            <Link to="/watermark" className="btn btn-ghost">
              加水印
            </Link>
          </motion.div>
        </div>

        <motion.div
          className="hero-visual"
          aria-hidden
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <div className="sheet sheet-back" />
          <div className="sheet sheet-mid" />
          <div className="sheet sheet-front">
            <div className="sheet-lines">
              <span />
              <span />
              <span />
              <span className="short" />
            </div>
            <div className="sheet-stamp">¥</div>
          </div>
          <div className="float-chip chip-a">合并</div>
          <div className="float-chip chip-b">汇总</div>
        </motion.div>
      </section>
    </div>
  )
}
