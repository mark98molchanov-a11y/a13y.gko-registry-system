// api/get-upload-url.js
import { put } from '@vercel/blob';

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
        const { fileName, fileType } = req.body;

        if (!fileName) {
            return res.status(400).json({ error: 'fileName required' });
        }

        // ✅ Генерируем URL для загрузки (НО НЕ ЗАГРУЖАЕМ САМ ФАЙЛ!)
        const blob = await put(fileName, {
            access: 'public',
            contentType: fileType || 'text/csv',
            addRandomSuffix: false,
        });

        console.log(`✅ Получен URL для загрузки: ${blob.url}`);

        return res.status(200).json({
            success: true,
            uploadUrl: blob.url,
            downloadUrl: blob.downloadUrl
        });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        return res.status(500).json({ error: error.message });
    }
}
