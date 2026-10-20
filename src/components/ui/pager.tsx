import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

// Pager sederhana (pola sama dengan pager Finance). page mulai dari 0; tidak tampil kalau cuma 1 halaman.
function Pager({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
        <ChevronLeft className="h-4 w-4" />
        Sebelumnya
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        Hal {page + 1} / {pageCount}
      </span>
      <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page + 1 >= pageCount}>
        Berikutnya
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export { Pager }
