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
        // ✅ ПРАВИЛЬНО: принимаем access, а не content!
        const { fileName, fileType, access } = req.body;

        if (!fileName) {
            return res.status(400).json({ error: 'fileName required' });
        }

        const TOKEN = 'vercel_blob_rw_vY4BahfMyj9BWxPQ_gbUEC6RbCTBBIyADw4zf1r7IdZ9iKn';
        const STORE_ID = 'store_vY4BahfMyj9BWxPQ';

        // ✅ СОЗДАЁМ ПУСТОЙ ФАЙЛ С ПУБЛИЧНЫМ ДОСТУПОМ
        const blob = await put(fileName, new ArrayBuffer(0), {
            access: access || 'public',  // ← ИСПОЛЬЗУЕМ access ИЗ ЗАПРОСА
            contentType: fileType || 'text/csv',
            addRandomSuffix: false,
            token: TOKEN,
            storeId: STORE_ID,
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
