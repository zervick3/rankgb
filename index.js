const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

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
        const allData = [];

        for (let page = 1; page <= totalPages; page++) {
            console.log(`🔄 Scrapeando página ${page}...`);
            const pageData = await fetchPage(page);
            allData.push(...pageData);
        }

        res.json(allData);
    } catch (err) {
        console.error('❌ Error:', err.message);
        res.status(500).json({ error: 'Error al scrapear', message: err.message });
    }
});

// Nuevo endpoint para scrapear noticias
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

app.listen(3000, () => {
    console.log('🚀 API corriendo en http://localhost:3000/api/ranking');
    console.log('📰 Endpoint de noticias en http://localhost:3000/api/news');
});