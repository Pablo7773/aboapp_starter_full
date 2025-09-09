import { useState } from 'react';
import { supabaseBrowser } from '../src/lib/supabaseClient';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    const { error } = await supabaseBrowser.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="container">
      <h1>AboApp – Login</h1>
      <div className="card">
        {sent ? (
          <p>Magic Link wurde gesendet. Prüfe dein Postfach.</p>
        ) : (
          <>
            <label>E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"/>
            <div className="actions" style={{marginTop:12}}>
              <button onClick={handleSend}>Magic Link senden</button>
              <Link href="/">zurück</Link>
            </div>
            {error && <p className="small" style={{color:'#e00'}}>{error}</p>}
          </>
        )}
      </div>
      <footer>Supabase Auth (E-Mail OTP)</footer>
    </div>
  );
}
