export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { human_img, garm_img, garment_des, apiKey } = req.body;

    if (!apiKey || !human_img || !garm_img) {
      return res.status(400).json({ error: 'Campos obrigatórios: apiKey, human_img, garm_img' });
    }

    // Create prediction
    const createResp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "906425dbca90663ff5427624839572cc56ea7d380343d13e2a4c4b09d3f0c30f",
        input: {
          human_img,
          garm_img,
          garment_des: garment_des || 'clothing item',
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 30,
          seed: 42
        }
      })
    });

    const prediction = await createResp.json();
    if (prediction.error) return res.status(400).json({ error: prediction.error });

    // Poll for result (max 90s)
    const predId = prediction.id;
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { 'Authorization': `Token ${apiKey}` }
      });
      const pollData = await pollResp.json();

      if (pollData.status === 'succeeded') {
        const output = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
        return res.status(200).json({ success: true, output });
      }
      if (pollData.status === 'failed') {
        return res.status(400).json({ error: pollData.error || 'Processamento falhou' });
      }
    }

    return res.status(408).json({ error: 'Timeout — tente novamente' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
