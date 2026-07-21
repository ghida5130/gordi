const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const aiApiBaseUrl =
  import.meta.env.VITE_AI_API_BASE_URL || 'http://localhost:8000'

const services = [
  { name: 'Frontend', endpoint: window.location.origin, state: '실행 중' },
  { name: 'Backend API', endpoint: apiBaseUrl, state: '연결 예정' },
  { name: 'AI API', endpoint: aiApiBaseUrl, state: '연결 예정' },
]

function App() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">GORDI · MVP WORKSPACE</p>
        <h1 id="page-title">개발 환경이 준비되었습니다.</h1>
        <p className="description">
          React, Spring Boot, FastAPI가 하나의 모노레포에서 같은 환경 설정을
          공유합니다.
        </p>
      </section>

      <section className="service-grid" aria-label="서비스 접속 정보">
        {services.map((service) => (
          <article className="service-card" key={service.name}>
            <div className="service-heading">
              <h2>{service.name}</h2>
              <span>{service.state}</span>
            </div>
            <code>{service.endpoint}</code>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App
