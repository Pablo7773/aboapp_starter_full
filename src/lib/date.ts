export function todayInBerlinISO() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(now); // YYYY-MM-DD
}

export function addDaysISO(isoDate: string, days: number) {
  const [y,m,d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
  const dd = String(dt.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
