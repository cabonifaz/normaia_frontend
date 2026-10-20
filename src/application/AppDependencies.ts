import type { MaestrosUseCases } from './maestros/maestrosUseCases';
import type { RegistroUseCases } from './registro/registroUseCases';

/** Lo que la UI puede usar. La UI nunca ve adaptadores, solo casos de uso. */
export interface AppDependencies {
  registro: RegistroUseCases;
  maestros: MaestrosUseCases;
}
