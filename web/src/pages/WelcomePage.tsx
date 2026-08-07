import { Link } from 'react-router-dom'
import { ParticleObject } from '@/components/canvasui/ParticleObject'
import { Bubble } from '@/components/canvasui/Bubble'
import './WelcomePage.css'

export function WelcomePage() {
  return (
    <div className="welcome-root">
      <div className="welcome-atmosphere" aria-hidden>
        <span className="welcome-orb welcome-orb-a" />
        <span className="welcome-orb welcome-orb-b" />
        <span className="welcome-orb welcome-orb-c" />
        <span className="welcome-grid" />
        <span className="welcome-vignette" />
      </div>

      <Bubble
        className="welcome-bubble"
        style={{ width: '100%', minHeight: '100vh' }}
        size={38}
        trail={22}
        follow={0.42}
        blend={16}
        speed={2.4}
        refraction={95}
        dispersion={1.1}
        frost={0.08}
        shine={0.38}
        rim={0.62}
        iridescence={0.9}
        intensity={1}
        tint={[0.9, 0.96, 0.93]}
        tintStrength={0.1}
        colorA={[0.24, 0.56, 0.45]}
        colorB={[0.83, 0.72, 0.51]}
      >
        <div className="welcome-page">
          <header className="welcome-top">
            <div className="welcome-brand">
              <span className="welcome-brand-mark" aria-hidden />
              <span className="welcome-brand-name">PDF Tools</span>
            </div>
            <p className="welcome-top-note">本地处理 · 文件不上传云端</p>
          </header>

          <main className="welcome-stage">
            <ParticleObject
              className="welcome-particles"
              style={{ width: '100%', height: '100%' }}
              src="/welcome-particle.svg"
              count={18000}
              size={2.8}
              sizeVariance={0.55}
              color="#e8f5ef"
              radius={140}
              strength={1.25}
              swirl={0.85}
              spring={1.1}
              damping={0.32}
              drift={0.75}
              scale={3.6}
              yOffset={0.05}
              floatIntensity={1.4}
              rotationIntensity={0.55}
              floatSpeed={1.6}
              orbit={false}
              zoom={false}
              autoRotate
              autoRotateSpeed={0.55}
              fov={58}
              cameraDistance={4}
            />
            <p className="welcome-sub-overlay">精密 PDF 工具集</p>
          </main>

          <footer className="welcome-bottom">
            <p className="welcome-tagline">
              合并、拆分、压缩与水印——划过粒子字形，感受它们散开再归位。
            </p>

            <div className="welcome-actions">
              <Link to="/home" className="welcome-cta welcome-cta-primary">
                <span>进入工作室</span>
                <span className="welcome-cta-arrow" aria-hidden>
                  →
                </span>
              </Link>
              <Link to="/merge" className="welcome-cta welcome-cta-ghost">
                立即合并
              </Link>
            </div>

            <ul className="welcome-rail" aria-label="功能预览">
              <li>Merge</li>
              <li>Split</li>
              <li>Compress</li>
              <li>Watermark</li>
              <li>OCR</li>
            </ul>
          </footer>
        </div>
      </Bubble>
    </div>
  )
}
