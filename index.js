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
    const rows = []; ////

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
        .filter(text => /^\d+$/.test(text)) // solo números
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

app.listen(3000, () => {
    console.log('🚀 API corriendo en http://localhost:3000/api/ranking');
});
