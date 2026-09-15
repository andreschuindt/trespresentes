export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  }

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxRqScZvTWjiLBucTt0amEpf5jGGNuJVrZU6W_Ui9eORhw9cZWKUCHhVXP3ULLt_Zk/exec';

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body || {})
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, message: text || 'Resposta inválida do Apps Script.' };
    }

    return res.status(response.ok ? 200 : 500).json(data);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Falha ao comunicar com o Apps Script.'
    });
  }
}
