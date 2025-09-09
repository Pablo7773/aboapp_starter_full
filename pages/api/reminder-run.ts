import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '../../src/lib/supabaseClient';
import { todayInBerlinISO, addDaysISO } from '../../src/lib/date';

type Sub = {
  id: string;
  name: string;
  next_renewal_date: string;
  price_cents: number;
  currency: string;
  user_id: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const svc = supabaseServer();
    const today = todayInBerlinISO();
    const target = addDaysISO(today, 3);

    const { data: subs, error } = await svc
      .from('subscriptions')
      .select('id, name, next_renewal_date, price_cents, currency, user_id')
      .eq('status', 'active')
      .eq('next_renewal_date', target);

    if (error) return res.status(500).json({ error: error.message });

    // Map user_id -> email
    const emails = new Map<string,string>();
    const uniqueUserIds = Array.from(new Set((subs ?? []).map(s => s.user_id)));
    for (const uid of uniqueUserIds) {
      const { data, error } = await svc.auth.admin.getUserById(uid);
      if (!error && data?.user?.email) emails.set(uid, data.user.email);
    }

    // Send emails via Resend
    const sent: any[] = [];
    for (const s of (subs ?? [])) {
      const to = emails.get(s.user_id);
      if (!to) continue;
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || 'reminder@example.com',
          to,
          subject: `Erinnerung: ${s.name} in 3 Tagen`,
          html: `<p>Hallo,</p>
                 <p>dein Abo <b>${s.name}</b> verlängert sich am <b>${s.next_renewal_date}</b>.</p>
                 <p>Betrag: <b>${(s.price_cents/100).toFixed(2)} ${s.currency}</b></p>
                 <p>— Deine AboApp</p>`
        })
      });
      sent.push({ sub_id: s.id, status: resp.status });
    }

    return res.status(200).json({ ok: true, target, count: subs?.length ?? 0, sent });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'unknown error' });
  }
}
