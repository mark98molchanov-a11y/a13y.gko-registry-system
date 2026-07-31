// api/get-upload-url.js
import { handleUpload } from '@vercel/blob/client';

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
        // ✅ ГЕНЕРИРУЕМ ТОКЕН ДЛЯ КЛИЕНТСКОЙ ЗАГРУЗКИ
        const result = await handleUpload({
            body: req.body,
            request: req,
            onBeforeGenerateToken: async (pathname) => ({
                allowedContentTypes: ['text/csv'],
                maximumSizeInBytes: 100 * 1024 * 1024, // 100 МБ
            }),
        });

        return res.status(200).json(result);

    } catch (error) {
        console.error('❌ Ошибка генерации токена для загрузки:', error);
        return res.status(500).json({ error: error.message });
    }
}
