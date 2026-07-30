// api/index.js - CORS Proxy сервер для GitHub Releases (Vercel Serverless)

export default async function handler(req, res) {
    // ✅ РАЗРЕШАЕМ CORS ДЛЯ ВСЕХ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // ✅ ОТВЕТ НА PREFLIGHT (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { method } = req;
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('token ', '');
    
    // ============================================================
    // 1. ПРОВЕРКА ТОКЕНА
    // ============================================================
    if (method === 'GET' && req.url === '/api/check-token') {
        if (!token) {
            return res.status(401).json({ valid: false, error: 'Token required' });
        }
        
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            
            if (response.ok) {
                const user = await response.json();
                return res.json({ valid: true, user: user.login });
            } else {
                return res.json({ valid: false, error: 'Invalid token' });
            }
        } catch (error) {
            return res.json({ valid: false, error: error.message });
        }
    }
    
    // ============================================================
    // 2. ПОЛУЧЕНИЕ ИНФОРМАЦИИ О РЕЛИЗЕ
    // ============================================================
    if (method === 'GET' && req.url?.startsWith('/api/release/')) {
        const parts = req.url.replace('/api/release/', '').split('/');
        const [owner, repo, tag] = parts;
        
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
            const response = await fetch(url, {
                headers: token ? { 'Authorization': `token ${token}` } : {}
            });
            
            const data = await response.json();
            return res.json(data);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    
    // ============================================================
    // 3. УДАЛЕНИЕ ASSET
    // ============================================================
    if (method === 'DELETE' && req.url?.startsWith('/api/asset/')) {
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        
        const parts = req.url.replace('/api/asset/', '').split('/');
        const [owner, repo, assetId] = parts;
        
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `token ${token}` }
            });
            
            return res.status(response.status).json({ success: response.ok });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    
    // ============================================================
    // 4. ЗАГРУЗКА ASSET (ГЛАВНАЯ ФУНКЦИЯ)
    // ============================================================
    if (method === 'POST' && req.url?.startsWith('/api/upload/')) {
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        
        const parts = req.url.replace('/api/upload/', '').split('/');
        const [owner, repo, releaseId] = parts;
        
        const fileName = req.query?.name || 'deals_clean.csv';
        const content = req.body;
        
        try {
            const url = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${fileName}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': Buffer.byteLength(content)
                },
                body: content
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                return res.status(response.status).json({ 
                    error: `GitHub API error: ${response.status}`,
                    details: errorText
                });
            }
            
            const data = await response.json();
            return res.json(data);
            
        } catch (error) {
            console.error('Upload error:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    // ============================================================
    // 5. НЕИЗВЕСТНЫЙ ЭНДПОИНТ
    // ============================================================
    return res.status(404).json({ error: 'Endpoint not found' });
}
