// api/upload-to-blob.js
import { put } from '@vercel/blob';

export default async function handler(req, res) {
    // ✅ Разрешаем CORS
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
        const { fileName, content } = req.body;

        if (!fileName || !content) {
            return res.status(400).json({ error: 'fileName and content required' });
        }

        // ✅ Загружаем в Vercel Blob (ОБХОДИТ ЛИМИТ 4.5 МБ)
        const blob = await put(fileName, content, {
            access: 'public',
            contentType: 'text/csv',
            addRandomSuffix: false,
        });

        console.log(`✅ Файл загружен в Blob: ${blob.url}`);
        console.log(`📏 Размер: ${(content.length / 1024 / 1024).toFixed(2)} МБ`);

        return res.status(200).json({
            success: true,
            url: blob.url,
            downloadUrl: blob.downloadUrl
        });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        return res.status(500).json({ error: error.message });
    }
}
