// pages/login.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../src/lib/supabaseClient';

type Stage = 'enter-email' | 'enter-code';

export default function Login() {
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('enter-email');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      // Schickt E-Mail mit OTP-Code UND Magic-Link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // erlaubt Signup beim ersten Mal
          // KEIN emailRedirectTo -> wir bleiben in der PWA
        },
      });
      if (error) throw error;
      setStage('enter-code');
      setMsg('Code gesendet – prüfe Posteingang/Spam.');
    } catch (err: any) {
      setMsg(err?.message ?? 'Fehler beim Senden.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'email', // E-Mail-OTP
      });
      if (error) throw error;
      setMsg('Eingeloggt – weiter…');
      // zurück zur App
      router.replace('/');
    } catch (err: any) {
      setMsg(err?.message ?? 'Code ungültig.');
    } finally {
      setLoading(false);
    }
  }

  // Optional: separater Magic-Link (öffnet iOS in Safari – nur als Fallback)
  async function sendMagicLink() {
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          // Wenn du willst, kannst du einen Redirect setzen:
          // emailRedirectTo: 'https://aboapp-starter-full.vercel.app/',
        },
      });
      if (error) throw error;
      setMsg('Magic-Link verschickt.');
    } catch (err: any) {
      setMsg(err?.message ?? 'Fehler beim Senden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '56px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Login</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Am iPhone bitte <b>„Zum Home-Bildschirm“</b> nutzen und hier den <b>Code</b> eingeben.
      </p>

      {stage === 'enter-email' && (
        <form onSubmit={sendCode} className="column" style={{ gap: 12 }}>
          <input
            type="email"
            required
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Sende…' : 'Login-Code senden'}
          </button>

          {/* optionaler Fallback-Button */}
          <button type="button" onClick={sendMagicLink} disabled={loading} style={btnGhost}>
            {loading ? 'Sende…' : 'Stattdessen Magic-Link schicken'}
          </button>
        </form>
      )}

      {stage === 'enter-code' && (
        <form onSubmit={verifyCode} className="column" style={{ gap: 12 }}>
          <label style={{ fontSize: 14 }}>
            Wir haben dir einen 6-stelligen Code geschickt.
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Prüfe…' : 'Einloggen'}
          </button>
          <button type="button" onClick={() => setStage('enter-email')} style={btnGhost}>
            Andere E-Mail
          </button>
        </form>
      )}

      {msg && <p style={{ marginTop: 16 }}>{msg}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  fontSize: 16,
};

const btnStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  background: '#14b8a6', // teal
  color: 'white',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  background: 'transparent',
  border: '1px solid #e5e7eb',
  cursor: 'pointer',
};
