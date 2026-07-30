// api/trigger-github-action.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { blobUrl, token } = req.body;

        if (!blobUrl || !token) {
            return res.status(400).json({ error: 'blobUrl and token required' });
        }

        // ✅ Триггерим GitHub Action через API
        const response = await fetch(
            `https://api.github.com/repos/mark98molchanov-a11y/a13y.gko-registry-system/actions/workflows/update-csv.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        blob_url: blobUrl
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`GitHub API error: ${response.status} - ${error}`);
        }

        console.log('✅ GitHub Action запущен!');
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        return res.status(500).json({ error: error.message });
    }
}
