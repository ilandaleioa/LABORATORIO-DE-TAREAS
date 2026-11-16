import NuevoEjercicio from './NuevoEjercicio'

// La vista de un ejercicio usa exactamente el mismo diseño que la edición, con los campos bloqueados.
export default function DetalleEjercicio({ id }: { id: string }) {
  return <NuevoEjercicio editarId={id} soloLectura />
}
