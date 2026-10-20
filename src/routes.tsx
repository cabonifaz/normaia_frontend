import type { RouteObject } from 'react-router';
import { LandingPage } from '@/features/landing/LandingPage';
import { RegisterPage } from '@/features/register/RegisterPage';
import { PendingPage } from '@/pages/PendingPage';

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/registro', element: <RegisterPage /> },
  { path: '/ingresar', element: <PendingPage title="Ingresar" description="Pantalla de inicio de sesión pendiente de diseño y contrato del backend." /> },
  { path: '/app', element: <PendingPage title="Norma IA" description="Consulta RAG pendiente de diseño y contrato del backend." /> },
  { path: '/terminos', element: <PendingPage title="Términos y condiciones" description="Texto legal pendiente." /> },
  { path: '/privacidad', element: <PendingPage title="Política de privacidad" description="Texto legal pendiente." /> },
  { path: '*', element: <PendingPage title="Página no encontrada" description="La dirección que buscas no existe." /> },
];
