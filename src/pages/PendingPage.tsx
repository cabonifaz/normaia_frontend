import { Link } from 'react-router';
import { Footer } from '@/features/landing/Footer';
import { Header } from '@/features/landing/Header';

interface PendingPageProps {
  title: string;
  description: string;
}

/** Vistas aún no diseñadas (ingreso, app RAG, legales). Se reemplazan cuando llegue su diseño y contrato. */
export function PendingPage({ title, description }: PendingPageProps) {
  return (
    <div className="pending-page">
      <Header />
      <main>
        <div className="wrap">
          <h1 className="display">{title}</h1>
          <p className="lead">{description}</p>
          <Link className="btn btn--ghost" to="/">Volver al inicio</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
