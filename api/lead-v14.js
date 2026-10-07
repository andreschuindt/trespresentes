const crypto = require('crypto');

const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzVVc29S_r0tQxAdJ_tw9sf8joP_ECGL3n1oSxNu6DQTw-j-5oR-mo4_uuntVF_x4F8kQ/exec';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({success:false,error:'method_not_allowed'});
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.empresa) return res.status(200).json({success:true,lead_id:'ignored_bot'});
    const nome = String(body.nome || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const whatsapp = String(body.whatsapp || '').trim();
    const consentimento = String(body.consentimento || '');
    const startedAt = Number(body.started_at || 0);
    if (!nome || !email || consentimento !== 'Sim') return res.status(400).json({success:false,error:'required_fields'});
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({success:false,error:'invalid_email'});
    if (startedAt && Date.now() - startedAt < 700) return res.status(400).json({success:false,error:'submission_too_fast'});
    const leadId = crypto.createHash('sha256').update(email+'|'+Date.now()+'|'+Math.random()).digest('hex').slice(0,20);
    if (String(req.query && req.query.dryRun || '') === '1') {
      return res.status(200).json({success:true,lead_id:leadId,dry_run:true});
    }
    const params = new URLSearchParams();
    const safe = {
      nome,email,whatsapp,
      interesse:'',
      momento:'',
      consentimento:'Sim',
      origem:'landing_tres_presentes_v14',
      utm_source:String(body.utm_source||''),
      utm_medium:String(body.utm_medium||''),
      utm_campaign:String(body.utm_campaign||''),
      utm_content:String(body.utm_content||''),
      utm_term:String(body.utm_term||''),
      fbclid:String(body.fbclid||''),
      lead_id:leadId
    };
    Object.entries(safe).forEach(([k,v])=>params.append(k,v));
    const upstream = await fetch(FORM_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:params.toString(),redirect:'follow'});
    if (!upstream.ok) return res.status(502).json({success:false,error:'upstream_failed',status:upstream.status});
    return res.status(200).json({success:true,lead_id:leadId});
  } catch (err) {
    console.error('lead-v14', err);
    return res.status(500).json({success:false,error:'internal_error'});
  }
};