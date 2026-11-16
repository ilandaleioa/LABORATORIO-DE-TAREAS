import { useEffect, useState } from 'react'
import Biblioteca from './pages/Biblioteca'
import NuevoEjercicio from './pages/NuevoEjercicio'
import DetalleEjercicio from './pages/DetalleEjercicio'
import Disenador from './pages/Disenador'
import Sesiones from './pages/Sesiones'
import Plantillas from './pages/Plantillas'
import RegenerarMiniaturas from './components/RegenerarMiniaturas'
import CopiaSeguridad from './components/CopiaSeguridad'

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || '#/')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash.replace(/^#/, '').split('?')[0] || '/'
}

export default function App() {
  const ruta = useHashRoute()
  const editar = ruta.match(/^\/ejercicio\/([^/]+)\/editar$/)
  const detalle = ruta.match(/^\/ejercicio\/([^/]+)$/)

  const enLibreria = ruta === '/tareas' || ruta === '/analizadas' || Boolean(detalle)
  const enDisenador = ruta === '/disenador'
  const enSesiones = ruta === '/sesiones'
  const enPlantillas = ruta === '/plantillas' || ruta === '/'
  const enNuevo = ruta === '/nuevo' || Boolean(editar)
  const navLink = (activo: boolean) =>
    `rounded-full px-4 py-2 text-sm font-bold transition ${activo ? 'bg-athletic text-white shadow-sm shadow-athletic/30' : 'text-ink hover:bg-neutral-100 hover:text-athletic'}`

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <RegenerarMiniaturas />
      <header className="sticky top-0 z-20 border-b border-line bg-white print:hidden text-ink shadow-sm">
        <div className={`relative mx-auto flex items-center justify-between px-4 py-3 md:px-6 ${enDisenador || enSesiones ? 'max-w-none' : ruta === '/nuevo' || editar ? 'max-w-7xl 2xl:max-w-[1700px]' : 'max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1500px]'}`}>
          <div className="flex items-center gap-4">
          <a href="#/" className="flex items-center gap-3" aria-label="Laboratorio de Tareas">
            <img
              src="/brand/logos/logo-acfc-black-transparency.png"
              alt="Athletic Club Football Center"
              className="h-7 w-auto sm:h-9"
            />
          </a>
          <nav className="flex items-center gap-1" aria-label="Principal">
            <a href="#/plantillas" className={`${navLink(enPlantillas)} hidden sm:inline`}>
              Plantillas
            </a>
            <a href="#/disenador" className={`${navLink(enDisenador)} hidden sm:inline`}>
              Diseñador
            </a>
            <a href="#/tareas" className={`${navLink(enLibreria || enNuevo)} hidden sm:inline`}>
              Tareas
            </a>
            <a href="#/sesiones" className={`${navLink(enSesiones)} hidden sm:inline`}>
              Sesiones
            </a>
            {(
              <button
                type="button"
                title="Pantalla completa"
                aria-label="Pantalla completa"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen()
                  else void document.documentElement.requestFullscreen()
                }}
                className="ml-2 hidden rounded-full bg-[#f5c542] p-2.5 text-[#0b0d10] shadow-[0_0_0_3px_rgba(245,197,66,0.3)] transition hover:bg-[#ffd75e] sm:inline-flex"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </button>
            )}
            <CopiaSeguridad />
          </nav>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto ${enDisenador ? 'max-w-none p-0' : 'px-4 py-5 md:px-6 md:py-8'} ${enDisenador ? '' : enSesiones ? 'max-w-[2200px]' : ruta === '/nuevo' || editar ? 'max-w-7xl 2xl:max-w-[1700px] min-[2000px]:max-w-[2000px]' : 'max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1500px] min-[2000px]:max-w-[1700px]'}`}
      >
        {ruta === '/nuevo' ? (
          <NuevoEjercicio />
        ) : editar ? (
          <NuevoEjercicio editarId={editar[1]} key={editar[1]} />
        ) : ruta === '/disenador' ? (
          <Disenador />
        ) : enSesiones ? (
          <Sesiones />
        ) : enPlantillas ? (
          <Plantillas />
        ) : detalle ? (
          <DetalleEjercicio id={detalle[1]} key={detalle[1]} />
        ) : (
          <Biblioteca />
        )}
      </main>

      {/* Navegación inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur md:hidden print:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-4 text-center text-xs font-bold">
          {(
            [
              ['#/plantillas', 'Plantillas', enPlantillas, 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM2 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M15 15h3a4 4 0 0 1 4 4v1'],
              ['#/disenador', 'Diseñador', enDisenador, 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3'],
              ['#/tareas', 'Tareas', enLibreria || enNuevo, 'M4 5h16M4 12h16M4 19h16'],
              ['#/sesiones', 'Sesiones', enSesiones, 'M5 4h14v16H5zM9 9h6M9 13h6'],
            ] as [string, string, boolean, string][]
          ).map(([href, texto, activo, d]) => (
            <a
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 ${activo ? 'text-athletic' : 'text-neutral-500'}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
              {texto}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
