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

function useTema() {
  const [claro, setClaro] = useState(() => {
    try { return localStorage.getItem('tema') === 'claro' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('claro', claro)
    try { localStorage.setItem('tema', claro ? 'claro' : 'oscuro') } catch { /* sin almacenamiento */ }
  }, [claro])
  return [claro, setClaro] as const
}

export default function App() {
  const ruta = useHashRoute()
  const [claro, setClaro] = useTema()
  const editar = ruta.match(/^\/ejercicio\/([^/]+)\/editar$/)
  const detalle = ruta.match(/^\/ejercicio\/([^/]+)$/)

  const enLibreria = ruta === '/tareas' || ruta === '/analizadas' || Boolean(detalle)
  const enDisenador = ruta === '/disenador'
  const enSesiones = ruta === '/sesiones'
  const enPlantillas = ruta === '/plantillas' || ruta === '/'
  const enNuevo = ruta === '/nuevo' || Boolean(editar)
  const navLink = (activo: boolean) =>
    `border-b-[3px] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition ${activo ? 'border-athletic text-white' : 'border-transparent text-neutral-400 hover:text-white'}`

  return (
    <div className="flex min-h-screen flex-col">
      <RegenerarMiniaturas />
      <header className="band sticky top-0 z-20 border-b border-[#3a4046] print:hidden">
        <div className={`relative mx-auto flex items-center justify-between px-4 py-3 md:px-6 ${enDisenador || enSesiones ? 'max-w-none' : ruta === '/nuevo' || editar ? 'max-w-7xl 2xl:max-w-[1700px]' : 'max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1500px]'}`}>
          <div className="flex items-center gap-4">
          <a href="#/" className="flex items-center gap-3" aria-label="Laboratorio de Tareas">
            <img
              src="/brand/logos/acfc-logo-white.svg"
              alt="Athletic Club Football Center"
              className="h-7 w-auto sm:h-9"
            />
          </a>
          <nav className="flex items-center gap-1" aria-label="Principal">
            <a href="#/plantillas" className={`${navLink(enPlantillas)} hidden sm:inline`}>
              Plantillas
            </a>
            <a href="#/tareas" className={`${navLink(enLibreria || enNuevo || enDisenador)} hidden sm:inline`}>
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
                className="no-kit ml-2 hidden bg-[#e0a100] p-2 text-[#15181d] transition hover:bg-[#f0b310] sm:inline-flex"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                </svg>
              </button>
            )}
            <button
              type="button"
              title={claro ? 'Fondo oscuro' : 'Fondo claro'}
              aria-label={claro ? 'Fondo oscuro' : 'Fondo claro'}
              onClick={() => setClaro(!claro)}
              className="no-kit ml-1 inline-flex bg-[#e6e8eb] p-2 text-[#15181d] transition hover:bg-[#ffffff]"
            >
              {claro ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              )}
            </button>
            <CopiaSeguridad />
          </nav>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full flex-1 ${enDisenador ? 'max-w-none p-0' : 'px-4 py-5 md:px-6 md:py-8'} ${enDisenador ? '' : enSesiones ? 'max-w-[2200px]' : ruta === '/nuevo' || editar ? 'max-w-7xl 2xl:max-w-[1700px] min-[2000px]:max-w-[2000px]' : 'max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1500px] min-[2000px]:max-w-[1700px]'}`}
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

      <footer className="band mt-12 border-t border-[#3a4046] print:hidden max-md:mb-14">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 text-[11px] md:px-6">
          <span className="font-bold uppercase tracking-[0.1em]">Laboratorio de tareas <span className="text-athletic">AC|FC</span><span className="ml-3 hidden font-normal normal-case tracking-normal text-neutral-400 sm:inline">Diseña, analiza y exporta tus tareas y sesiones.</span></span>
          <span className="font-bold">acfootballcenter.eus</span>
        </div>
      </footer>

      {/* Navegación inferior (móvil) */}
      <nav className="band fixed inset-x-0 bottom-0 z-20 border-t border-[#3a4046] md:hidden print:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-3 text-center text-xs font-bold">
          {(
            [
              ['#/plantillas', 'Plantillas', enPlantillas, 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM2 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M15 15h3a4 4 0 0 1 4 4v1'],
              ['#/tareas', 'Tareas', enLibreria || enNuevo || enDisenador, 'M4 5h16M4 12h16M4 19h16'],
              ['#/sesiones', 'Sesiones', enSesiones, 'M5 4h14v16H5zM9 9h6M9 13h6'],
            ] as [string, string, boolean, string][]
          ).map(([href, texto, activo, d]) => (
            <a
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 uppercase tracking-[0.1em] ${activo ? 'text-white shadow-[inset_0_3px_0_#d3291e]' : 'text-neutral-400'}`}
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
