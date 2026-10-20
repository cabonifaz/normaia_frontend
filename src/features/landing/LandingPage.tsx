import { useNavigate } from 'react-router';
import { COVERAGE, UPDATES } from './content';
import { Footer } from './Footer';
import { Header } from './Header';
import { HeroForm } from './HeroForm';
import { CtaIllustration, StructureIllustration } from './Illustrations';

export function LandingPage() {
  const navigate = useNavigate();
  return (
    <div id="landing">
      <Header />
      <main>
        <section className="hero">
          <div className="wrap">
            <div className="hero-copy">
              <h1 className="display">La norma, a una pregunta de distancia.</h1>
              <p className="lead">Consulta el Reglamento Nacional de Edificaciones con Norma IA y recibe cada respuesta con la norma actualizada y el artículo exacto.</p>
              <HeroForm />
            </div>
            <StructureIllustration />
          </div>
        </section>

        <section className="section" aria-labelledby="t-cobertura">
          <div className="wrap">
            <div className="section-head">
              <h2 className="display" id="t-cobertura">Todo el reglamento, en una sola conversación.</h2>
              <p>Escribe tu consulta con tus propias palabras. Norma IA identifica la norma que aplica y te indica el artículo.</p>
            </div>
            <div className="titles">
              {COVERAGE.map((row) => (
                <div className="title-row" key={row.title}>
                  <div>
                    <h3>{row.title}</h3>
                    <p className="codes">{row.codes}</p>
                  </div>
                  <ul>
                    {row.examples.map((ex) => (
                      <li key={ex.norma}>
                        {ex.q} <span>{ex.norma}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="t-vigente">
          <div className="wrap">
            <div className="section-head">
              <h2 className="display" id="t-vigente">Siempre con la versión vigente.</h2>
              <p>Cada norma del reglamento se actualiza por separado. Norma IA incorpora cada cambio para que siempre consultes la versión en vigor.</p>
            </div>
            <ol className="updates">
              {UPDATES.map((u) => (
                <li key={u.datetime}>
                  <time dateTime={u.datetime}>{u.label}</time>
                  <div>
                    <h3>{u.title}</h3>
                    <p>{u.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="cta-final" aria-labelledby="t-cta">
          <div className="wrap">
            <div className="cta-copy">
              <h2 className="display" id="t-cta">Haz tu primera consulta hoy.</h2>
              <p>Crea tu cuenta con tu correo y empieza a consultar el RNE.</p>
              <button className="btn" type="button" onClick={() => navigate('/registro')}>Crear cuenta</button>
            </div>
            <CtaIllustration />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
