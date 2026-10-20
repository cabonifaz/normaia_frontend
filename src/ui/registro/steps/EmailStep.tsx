import { Link } from '@tanstack/react-router';
import type { Challenge } from '@/domain/registro/registro';
import { useDependencies } from '@/ui/app/DependenciesContext';
import { EmailRequestStep } from '@/ui/components/EmailRequestStep';

interface EmailStepProps {
  initialEmail: string;
  onSent: (email: string, challenge: Challenge) => void;
  selectOnMount: boolean;
}

export function EmailStep({ initialEmail, onSent, selectOnMount }: EmailStepProps) {
  const { registro } = useDependencies();
  return (
    <EmailRequestStep
      title="Crea tu cuenta"
      description="Escribe tu correo. Te enviaremos un código de 4 dígitos para verificarlo."
      submitLabel="Enviar código"
      initialEmail={initialEmail}
      selectOnMount={selectOnMount}
      request={registro.solicitarCodigo}
      onSent={onSent}
      footer={<p className="muted alt-link">¿Ya tienes cuenta? <Link to="/ingresar">Ingresa aquí</Link></p>}
    />
  );
}
