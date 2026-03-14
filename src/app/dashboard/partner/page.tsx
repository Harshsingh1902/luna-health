'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Copy, CheckCircle2, Users, Link2, Shield, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function PartnerPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  useEffect(() => { fetchOrCreateCode(); }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const fetchOrCreateCode = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from('partner_connections')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (existing) {
      setInviteCode(existing.invite_code);
      setConnection(existing);
    } else {
      const code = generateCode();
      const { data } = await supabase
        .from('partner_connections')
        .insert({ owner_id: user.id, invite_code: code })
        .select()
        .single();
      if (data) {
        setInviteCode(data.invite_code);
        setConnection(data);
      }
    }
    setLoading(false);
  };

  const regenerateCode = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const code = generateCode();
    const { data } = await supabase
      .from('partner_connections')
      .update({ invite_code: code, status: 'pending', partner_id: null })
      .eq('owner_id', user.id)
      .select()
      .single();
    if (data) {
      setInviteCode(data.invite_code);
      setConnection(data);
      toast.success('New code generated!');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const joinWithCode = async () => {
    if (!partnerCode.trim()) return toast.error('Enter a code');
    setJoining(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cleanCode = partnerCode.toUpperCase().trim();

    const { data: conn } = await supabase
      .from('partner_connections')
      .select('*')
      .eq('invite_code', cleanCode)
      .eq('status', 'pending')
      .single();

    if (!conn) {
      toast.error('Invalid or expired code');
      setJoining(false);
      return;
    }

    if (conn.owner_id === user.id) {
      toast.error("You can't use your own code!");
      setJoining(false);
      return;
    }

    const { error } = await supabase
      .from('partner_connections')
      .update({ partner_id: user.id, status: 'active' })
      .eq('invite_code', cleanCode);

    if (error) {
      toast.error('Failed to connect');
    } else {
      toast.success('Connected with partner! 💕');
      setPartnerCode('');
      fetchOrCreateCode();
    }
    setJoining(false);
  };

  const disconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('partner_connections')
      .update({ partner_id: null, status: 'pending' })
      .eq('owner_id', user.id);
    toast.success('Partner disconnected');
    fetchOrCreateCode();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-light text-white mb-1">Partner Access</h1>
        <p className="text-white/50 text-sm">Share your cycle insights with someone you trust</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-4xl">
        {/* Your invite code */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Your invite code</h2>
              <p className="text-xs text-white/40">Share this with your partner</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/4 border border-white/8 mb-4 text-center">
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-white mb-1">
              {inviteCode}
            </p>
            <p className="text-xs text-white/30">One-time use code</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyCode}
              className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-sm"
            >
              {copied ? (
                <><CheckCircle2 className="w-4 h-4" /> Copied!</>
              ) : (
                <><Copy className="w-4 h-4" /> Copy code</>
              )}
            </button>
            <button
              onClick={regenerateCode}
              className="btn-ghost p-3"
              title="Generate new code"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {connection?.status === 'active' && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-sm text-emerald-400 font-medium">Partner connected 💕</p>
              </div>
              <button
                onClick={disconnect}
                className="text-xs text-white/30 hover:text-rose-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Join with code */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Join as partner</h2>
              <p className="text-xs text-white/40">Enter the code shared with you</p>
            </div>
          </div>

          <div className="mb-4">
            <input
              value={partnerCode}
              onChange={e => setPartnerCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              maxLength={9}
              className="input-dark w-full px-4 py-4 text-center font-mono text-xl tracking-widest"
            />
          </div>

          <button
            onClick={joinWithCode}
            disabled={joining || !partnerCode.trim()}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            {joining ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Users className="w-4 h-4" /> Connect with partner</>
            )}
          </button>

          <p className="text-xs text-white/30 text-center mt-4">
            Ask your partner to share their invite code from their Partner page
          </p>
        </div>

        {/* What partner can see */}
        <div className="xl:col-span-2 card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-semibold text-white">What your partner can see</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { emoji: '🌙', title: 'Cycle phase', desc: 'Current phase and day', allowed: true },
              { emoji: '😊', title: 'Mood', desc: 'General mood only', allowed: true },
              { emoji: '😴', title: 'Sleep', desc: 'Sleep duration & quality', allowed: true },
              { emoji: '💧', title: 'Hydration', desc: 'Daily water intake', allowed: true },
              { emoji: '🩸', title: 'Flow details', desc: 'Period flow intensity', allowed: false },
              { emoji: '📝', title: 'Personal notes', desc: 'Your private journal', allowed: false },
              { emoji: '⚕️', title: 'Health reports', desc: 'Medical documents', allowed: false },
              { emoji: '💊', title: 'Medications', desc: 'Private health data', allowed: false },
            ].map(item => (
              <div key={item.title} className={`p-4 rounded-2xl border ${item.allowed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/6 bg-white/2'}`}>
                <span className="text-2xl block mb-2">{item.emoji}</span>
                <p className={`text-sm font-medium mb-0.5 ${item.allowed ? 'text-white' : 'text-white/40'}`}>
                  {item.title}
                </p>
                <p className="text-xs text-white/30">{item.desc}</p>
                <p className={`text-xs mt-2 font-medium ${item.allowed ? 'text-emerald-400' : 'text-white/20'}`}>
                  {item.allowed ? '✓ Visible' : '✗ Private'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}