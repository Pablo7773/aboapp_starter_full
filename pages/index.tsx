import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../src/lib/supabaseClient';

type Sub = {
  id: string;
  name: string;
  provider: string | null;
  icon_key: string | null;
  price_cents: number;
  currency: string;
  cycle: 'monthly' | 'yearly' | 'custom_days';
  custom_days: number | null;
  start_date: string | null;
  next_renewal_date: string | null;
  status: 'active' | 'paused' | 'canceled';
  is_trial?: boolean;
  notes: string | null;
};

const ICONS_EMOJI: Record<string, string> = {
  netflix: '🎬',
  spotify: '🎵',
  prime: '🛒',
  disney: '🐭',
  adobe: '🖌️',
  psplus: '🎮',
  xbox: '🎮',
  icloud: '☁️',
  onedrive: '☁️',
  youtube: '▶️',
  apple: '',
  google: '🟢',
  uber: '🚗',
  wolt: '🥡',
  generic: '🔔',
};

function inferIconKey(providerRaw: string | undefined) {
  const p = (providerRaw || '').trim().toLowerCase();
  if (!p) return 'generic';
  if (p.includes('spotify')) return 'spotify';
  if (p.includes('netflix')) return 'netflix';
  if (p.includes('prime') || p.includes('amazon')) return 'prime';
  if (p.includes('disney')) return 'disney';
  if (p.includes('adobe')) return 'adobe';
  if (p.includes('icloud') || p.includes('apple')) return 'icloud';
  if (p.includes('onedrive') || p.includes('microsoft')) return 'onedrive';
  if (p.includes('xbox') || p.includes('game pass')) return 'xbox';
  if (p.includes('ps') || p.includes('playstation')) return 'psplus';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('google')) return 'google';
  if (p.includes('uber')) return 'uber';
  if (p.includes('wolt')) return 'wolt';
  return ICONS_EMOJI[p] ? p : 'generic';
}

/* Datum hübsch: 09.09.25 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
/* Monatsnamen z. B. „September 2025“ aus 2025-09-01 */
function monthLabel(monthISO: string) {
  const d = new Date(monthISO + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}
function startOfMonthISO(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-01`; }
function addMonths(d: Date, delta: number) { return new Date(d.getFullYear(), d.getMonth() + delta, 1); }

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    provider: '',
    price: '0.00',
    currency: 'EUR',
    cycle: 'monthly',
    next_renewal_date: '',
    isActive: true,
    isTrial: false,
  });

  const today = new Date();
  const thisMonthStart = startOfMonthISO(today);
  const [selectedMonth, setSelectedMonth] = useState<string>(thisMonthStart);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => authListener.subscription.unsubscribe();
  }, []);

  async function refresh() {
    const { data } = await supabaseBrowser
      .from('subscriptions')
      .select('*')
      .order('next_renewal_date', { ascending: true });
    setSubs((data as any) || []);
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [session]);

  // Listen aufsplitten
  const subsActiveAll = useMemo(() => subs.filter(s => s.status === 'active'), [subs]);
  const subsActive = useMemo(() => subsActiveAll.filter(s => !s.is_trial), [subsActiveAll]);
  const subsTrial  = useMemo(() => subsActiveAll.filter(s =>  s.is_trial), [subsActiveAll]);
  const subsPaused = useMemo(() => subs.filter(s => s.status === 'paused'), [subs]);
  const subsCanceled = useMemo(() => subs.filter(s => s.status === 'canceled'), [subs]);

  // Summe nur aktive (ohne Probe)
  const totalActive = useMemo(
    () => subsActive.reduce((sum, s) => sum + s.price_cents, 0) / 100,
    [subsActive]
  );

  // Monatskosten (aktive ohne Probe, Verlängerung in diesem Monat)
  function computeMonthCost(monthISO: string) {
    const d = new Date(monthISO);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    let cents = 0;
    subsActive.forEach(s => { // <- Trials raus
      if (!s.next_renewal_date) return;
      const dt = new Date(s.next_renewal_date + 'T00:00:00');
      if (dt >= monthStart && dt < monthEnd) cents += s.price_cents;
    });
    return cents / 100;
  }

  const monthOptions = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 12; i++) arr.push(startOfMonthISO(addMonths(new Date(thisMonthStart), -i)));
    return arr;
  }, [thisMonthStart]);

  const selectedCost = useMemo(() => computeMonthCost(selectedMonth), [selectedMonth, subsActive]);

  const chartMonths = useMemo(() => {
    const arr: string[] = [];
    for (let i = 5; i >= 0; i--) arr.push(startOfMonthISO(addMonths(new Date(thisMonthStart), -i)));
    return arr;
  }, [thisMonthStart]);

  const chartData = useMemo(
    () => chartMonths.map(m => ({ month: m.slice(0,7), value: computeMonthCost(m) })),
    [chartMonths, subsActive]
  );
  const maxVal = Math.max(1, ...chartData.map(d => d.value));

  async function addSub() {
    if (!session) return;
    const status: 'active' | 'paused' = form.isActive ? 'active' : 'paused';
    const mustHaveDate = status === 'active';
    const parsedPrice = parseFloat(form.price || '0');
    const price_cents = Math.round((isNaN(parsedPrice) ? 0 : parsedPrice) * 100);

    if (mustHaveDate && !form.next_renewal_date) {
      alert('Bitte „Nächste Verlängerung“ angeben (bei aktiven Abos).');
      return;
    }

    const icon_key = inferIconKey(form.provider);
    const { error } = await supabaseBrowser.from('subscriptions').insert({
      user_id: session.user.id,
      name: form.name,
      provider: form.provider || null,
      icon_key,
      price_cents,
      currency: form.currency || 'EUR',
      cycle: form.cycle as 'monthly' | 'yearly',
      custom_days: null,
      next_renewal_date: mustHaveDate ? (form.next_renewal_date || null) : null,
      status,
      is_trial: !!form.isTrial,
    });
    if (error) { alert(error.message); return; }

    setForm({ name:'', provider:'', price:'0.00', currency:'EUR', cycle:'monthly', next_renewal_date:'', isActive:true, isTrial:false });
    await refresh();
  }

  async function removeSub(id: string) {
    if (!confirm('Wirklich löschen?')) return;
    const { error } = await supabaseBrowser.from('subscriptions').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    await refresh(); // sicher entfernen (kein „wandern“ in pausiert)
  }

  // Reaktivieren: Status -> active; Datum abfragen, falls leer
  async function reactivateSub(s: Sub) {
    let dateToUse = s.next_renewal_date;
    if (!dateToUse) {
      const input = prompt('Nächste Verlängerung (JJJJ-MM-TT) angeben:', '');
      if (!input) return; // abgebrochen
      dateToUse = input;
    }
    const { error } = await supabaseBrowser
      .from('subscriptions')
      .update({ status: 'active', next_renewal_date: dateToUse })
      .eq('id', s.id);
    if (error) { alert(error.message); return; }
    await refresh();
  }

  async function logout() { await supabaseBrowser.auth.signOut(); }

  function Icon({ iconKey }: { iconKey: string | null }) {
    const key = iconKey ?? 'generic';
    const src = `/icons/${key}.svg`;
    return (
      <span className="icon" style={{ width: 24, height: 24, display:'inline-flex', alignItems:'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src} alt={key} width={20} height={20}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            const sib = img.nextElementSibling as HTMLElement | null;
            if (sib) sib.style.display = 'inline-block';
          }}
          style={{ display:'inline-block' }}
        />
        <span style={{ display:'none' }}>{ICONS_EMOJI[key] || ICONS_EMOJI.generic}</span>
      </span>
    );
  }

  return (
    <div className="container">
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <h1>AboApp</h1>
        <div className="row" style={{ gap: 12 }}>
          {session ? (
            <>
              <span className="badge">{session.user.email}</span>
              <button className="btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <Link href="/login"><button className="btn">Login</button></Link>
          )}
        </div>
      </header>

      {!session ? (
        <div className="card">
          <p>Bitte <Link href="/login">einloggen</Link>, um deine Abos zu sehen.</p>
        </div>
      ) : (
        <>
          {/* Formular */}
          <div className="card card-compact">
            <h2 style={{marginBottom:8}}>Neues Abo anlegen</h2>
            <div className="row">
              <div style={{flex:2}}>
                <label className="small-label">Name</label>
                <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Netflix"/>
              </div>
              <div style={{flex:1}}>
                <label className="small-label">Provider</label>
                <input value={form.provider} onChange={e=>setForm({...form, provider:e.target.value})} placeholder="netflix"/>
              </div>
              <div style={{flex:1}}>
                <label className="small-label">Preis</label>
                <input value={form.price} onChange={e=>setForm({...form, price:e.target.value})} placeholder="9.99"/>
              </div>
              <div style={{flex:1}}>
                <label className="small-label">Währung</label>
                <input value={form.currency} onChange={e=>setForm({...form, currency:e.target.value})} placeholder="EUR"/>
              </div>
            </div>

            <div className="row" style={{marginTop:8}}>
              <div style={{flex:1}}>
                <label className="small-label">Zyklus</label>
                <select value={form.cycle} onChange={e=>setForm({...form, cycle:e.target.value})}>
                  <option value="monthly">monatlich</option>
                  <option value="yearly">jährlich</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <label className="small-label">Nächste Verlängerung</label>
                <input
                  type="date"
                  value={form.next_renewal_date}
                  onChange={e=>setForm({...form, next_renewal_date:e.target.value})}
                  disabled={!form.isActive}
                />
              </div>
              <div className="row" style={{alignItems:'center', gap:12, flex:1}}>
                <label className="small-label" style={{display:'flex', alignItems:'center', gap:6}}>
                  <input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form, isActive:e.target.checked})}/>
                  Aktiv
                </label>
                <label className="small-label" style={{display:'flex', alignItems:'center', gap:6}}>
                  <input type="checkbox" checked={form.isTrial} onChange={e=>setForm({...form, isTrial:e.target.checked})}/>
                  Probe (kostenlos)
                </label>
              </div>
              <div className="actions" style={{alignItems:'flex-end'}}>
                <button className="btn" onClick={addSub}>Speichern</button>
              </div>
            </div>
          </div>

          {/* Monatsübersicht + Mini-Chart */}
          <div className="card">
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div className="row" style={{gap:8, alignItems:'center'}}>
                <label className="small-label">Monat</label>
                <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}>
                  {monthOptions.map(m => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
                <div className="cost-pill">Kosten: {selectedCost.toFixed(2)} EUR</div>
              </div>
              {/* Mini-Bar-Chart */}
              <div style={{display:'flex', gap:8, alignItems:'flex-end'}}>
                {chartData.map(d => {
                  const h = Math.max(4, (d.value / maxVal) * 48);
                  return (
                    <div key={d.month} title={`${d.month}: ${d.value.toFixed(2)} €`} style={{textAlign:'center'}}>
                      <div style={{width:18, height:h, background:'#94a3b8', borderRadius:4, marginBottom:4}}/>
                      <div className="small" style={{fontSize:10}}>{d.month.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Aktive (ohne Probe) */}
          <div className="card bg-active" style={{borderColor:'#b2f5ea'}}>
            <h2>Aktive Abos</h2>
            {loading ? <p>Lade...</p> : subsActive.length === 0 ? <p>Keine aktiven Abos.</p> : (
              <>
                {subsActive.map(s => (
                  <div key={s.id} className="row" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                    <div className="row" style={{gap:12}}>
                      <Icon iconKey={s.icon_key ?? 'generic'} />
                      <div>
                        <div><strong>{s.name}</strong> <span className="small">({s.provider || '—'})</span></div>
                        <div className="small">
                          {(s.price_cents/100).toFixed(2)} {s.currency} • nächste Verlängerung: {formatDate(s.next_renewal_date)}
                        </div>
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn btn-xs" onClick={()=>removeSub(s.id)}>Löschen</button>
                    </div>
                  </div>
                ))}
                <div style={{marginTop:12}}>
                  <strong>Summe (aktive):</strong> {totalActive.toFixed(2)} EUR
                </div>
              </>
            )}
          </div>

          {/* Aktive (Probe) */}
          <div className="card bg-active" style={{borderColor:'#b2f5ea'}}>
            <h2>Aktive Abos (ProbeAbo)</h2>
            {loading ? <p>Lade...</p> : subsTrial.length === 0 ? <p>Keine Probe-Abos.</p> : (
              <>
                {subsTrial.map(s => (
                  <div key={s.id} className="row" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                    <div className="row" style={{gap:12}}>
                      <Icon iconKey={s.icon_key ?? 'generic'} />
                      <div>
                        <div><strong>{s.name}</strong> <span className="badge">Probe</span></div>
                        <div className="small">
                          {(s.price_cents/100).toFixed(2)} {s.currency} • nächste Verlängerung: {formatDate(s.next_renewal_date)}
                        </div>
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn btn-xs" onClick={()=>removeSub(s.id)}>Löschen</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pausiert (mit Reaktivieren) */}
          <div className="card bg-paused" style={{borderColor:'#fecdd3'}}>
            <h2>Pausierte Abos</h2>
            {loading ? <p>Lade...</p> : subsPaused.length === 0 ? <p>Keine pausierten Abos.</p> : (
              <>
                {subsPaused.map(s => (
                  <div key={s.id} className="row" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                    <div className="row" style={{gap:12}}>
                      <Icon iconKey={s.icon_key ?? 'generic'} />
                      <div>
                        <div><strong>{s.name}</strong> <span className="badge">paused</span></div>
                        <div className="small">
                          {(s.price_cents/100).toFixed(2)} {s.currency} • nächste Verlängerung: {formatDate(s.next_renewal_date)}
                        </div>
                      </div>
                    </div>
                    <div className="actions" style={{gap:8}}>
                      <button className="btn btn-xs" onClick={()=>reactivateSub(s)}>Reaktivieren</button>
                      <button className="btn btn-xs" onClick={()=>removeSub(s.id)}>Löschen</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Optional: Gekündigt */}
          {subsCanceled.length > 0 && (
            <div className="card">
              <h2>Gekündigte Abos</h2>
              {subsCanceled.map(s => (
                <div key={s.id} className="row" style={{justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                  <div className="row" style={{gap:12}}>
                    <Icon iconKey={s.icon_key ?? 'generic'} />
                    <div>
                      <div><strong>{s.name}</strong> <span className="badge">canceled</span></div>
                      <div className="small">
                        {(s.price_cents/100).toFixed(2)} {s.currency} • letzte Verlängerung: {formatDate(s.next_renewal_date)}
                      </div>
                    </div>
                  </div>
                  <div className="actions">
                    <button className="btn btn-xs" onClick={()=>removeSub(s.id)}>Löschen</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <footer>© {new Date().getFullYear()} AboApp Starter</footer>
    </div>
  );
}
