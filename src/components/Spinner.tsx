export default function Spinner({ texto }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-neutral-600" role="status">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-neutral-200 border-t-athletic" />
      {texto && <p className="text-center text-sm font-medium">{texto}</p>}
    </div>
  )
}
