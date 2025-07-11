const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

// Servir imágenes estáticas
app.use('/img', express.static('public/img'));

// Scraping del ranking
async function fetchPage(page = 1) {
    const url = `https://gunboundggh.com/rank/EN?page=${page}`;
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Cache-Control': 'no-cache',
        },
    });

    const $ = cheerio.load(data);
    const rows = [];

    $('table.table-hover tbody tr').each((i, el) => {
        const columns = $(el).find('th');
        if (columns.length >= 5) {
            rows.push({
                position: $(columns[0]).text().trim(),
                rankIcon: $(columns[1]).find('img').attr('src'),
                nickname: $(columns[2]).text().trim(),
                gp: $(columns[3]).text().trim(),
                change: $(columns[4]).text().trim(),
            });
        }
    });

    return rows;
}

async function getTotalPages() {
    const { data } = await axios.get('https://gunboundggh.com/rank/EN');
    const $ = cheerio.load(data);

    const pageLinks = $('ul.pagination li a.page-link')
        .map((i, el) => $(el).text().trim())
        .get()
        .filter(text => /^\d+$/.test(text))
        .map(Number);

    return Math.max(...pageLinks);
}

app.get('/api/ranking', async (req, res) => {
    try {
        const totalPages = await getTotalPages();
        console.log(`📄 Total de páginas: ${totalPages}`);

        // Crear todas las promesas de fetchPage en paralelo
        const pagePromises = [];
        for (let page = 1; page <= totalPages; page++) {
            pagePromises.push(fetchPage(page));
        }

        // Esperar a que todas las páginas se scrapen en paralelo
        const allPages = await Promise.all(pagePromises);

        // Aplanar los arrays de cada página en uno solo
        const allData = allPages.flat();

        res.json(allData);
    } catch (err) {
        console.error('❌ Error:', err.message);
        res.status(500).json({ error: 'Error al scrapear', message: err.message });
    }
});

// Scraping de noticias
app.get('/api/news', async (req, res) => {
    try {
        const { data } = await axios.get('https://gunboundggh.com/news/EN', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Cache-Control': 'no-cache',
            },
        });
        const $ = cheerio.load(data);
        const news = [];

        $('.gb-sc-news-wrapper').each((i, el) => {
            news.push({
                url: $(el).attr('href'),
                image: $(el).find('img').attr('src'),
                title: $(el).find('.gb-sc-news-title').text().trim(),
                description: $(el).find('p').text().trim(),
            });
        });

        res.json(news);
    } catch (err) {
        console.error('❌ Error:', err.message);
        res.status(500).json({ error: 'Error al scrapear noticias', message: err.message });
    }
});

// Envío de notificaciones push con Expo
async function sendPushNotification(expoPushToken, title, body) {
    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            to: expoPushToken,
            sound: 'default',
            title,
            body,
        }),
    });
}

// Endpoint para enviar notificaciones push
app.post('/api/send-notification', express.json(), async (req, res) => {
    const { expoPushToken, title, body } = req.body;
    if (!expoPushToken || !title || !body) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }
    try {
        await sendPushNotification(expoPushToken, title, body);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error al enviar notificación:', err.message);
        res.status(500).json({ error: 'Error al enviar notificación', message: err.message });
    }
});

// Mock helpers data
const MOCK_HELPERS = [
    {
        id: '1',
        nombre: 'Ervic Linares',
        descripcion: 'Experto en estrategias y guías para principiantes.',
        img: '/img/char-18.png',
        whatsapp: '+51918968939',
        correo: 'excelgunboundggh@email.com',
    },

];

// Endpoint para helpers
app.get('/api/helpers', (req, res) => {
    res.json(MOCK_HELPERS);
});

app.listen(3000, () => {
    console.log('🚀 API corriendo en http://localhost:3000/api/ranking');
    console.log('📰 Endpoint de noticias en http://localhost:3000/api/news');
    console.log('🔔 Endpoint de notificaciones en http://localhost:3000/api/send-notification');
});