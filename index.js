const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json()); // Agregar middleware para parsear JSON

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
    try {
        // Validar formato del token
        if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
            throw new Error('Formato de token inválido. Debe ser un token de Expo válido.');
        }

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
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
                priority: 'high',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error del servidor Expo: ${errorData.errors?.[0]?.message || response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Notificación enviada exitosamente:', result);
        return result;
    } catch (error) {
        console.error('❌ Error en sendPushNotification:', error.message);
        throw error;
    }
}

// Endpoint para enviar notificaciones push
app.post('/api/send-notification', async (req, res) => {
    const { expoPushToken, title, body } = req.body;

    // Validación de parámetros
    if (!expoPushToken || !title || !body) {
        return res.status(400).json({
            error: 'Faltan parámetros requeridos',
            required: ['expoPushToken', 'title', 'body'],
            received: { expoPushToken: !!expoPushToken, title: !!title, body: !!body }
        });
    }

    try {
        const result = await sendPushNotification(expoPushToken, title, body);
        res.json({
            success: true,
            message: 'Notificación enviada exitosamente',
            data: result
        });
    } catch (err) {
        console.error('❌ Error al enviar notificación:', err.message);
        res.status(500).json({
            error: 'Error al enviar notificación',
            message: err.message,
            details: err.stack
        });
    }
});

// Endpoint de prueba para notificaciones
app.get('/api/test-notification', async (req, res) => {
    res.json({
        message: 'Endpoint de notificaciones funcionando',
        usage: {
            method: 'POST',
            url: '/api/send-notification',
            body: {
                expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
                title: 'Título de la notificación',
                body: 'Cuerpo de la notificación'
            }
        },
        example: {
            curl: 'curl -X POST http://localhost:3000/api/send-notification -H "Content-Type: application/json" -d \'{"expoPushToken":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]","title":"Test","body":"Mensaje de prueba"}\''
        }
    });
});

// Almacenamiento temporal para tracking de cambios
let lastRankingData = [];
let lastNewsData = [];

// Función para detectar cambios en el ranking
async function checkRankingChanges() {
    try {
        const currentRanking = await fetchAllRankingData();

        if (lastRankingData.length > 0) {
            const changes = detectRankingChanges(lastRankingData, currentRanking);

            if (changes.length > 0) {
                console.log('📊 Cambios detectados en el ranking:', changes);

                // Enviar notificación de cambios en el ranking
                await sendRankingChangeNotification(changes);
            }
        }

        lastRankingData = currentRanking;
    } catch (error) {
        console.error('❌ Error al verificar cambios en ranking:', error.message);
    }
}

// Función para obtener todos los datos del ranking
async function fetchAllRankingData() {
    const totalPages = await getTotalPages();
    const pagePromises = [];

    for (let page = 1; page <= totalPages; page++) {
        pagePromises.push(fetchPage(page));
    }

    const allPages = await Promise.all(pagePromises);
    return allPages.flat();
}

// Función para detectar cambios en el ranking
function detectRankingChanges(oldRanking, newRanking) {
    const changes = [];

    // Comparar posiciones de los top 10
    const top10Old = oldRanking.slice(0, 10);
    const top10New = newRanking.slice(0, 10);

    top10New.forEach((player, index) => {
        const oldPlayer = top10Old.find(p => p.nickname === player.nickname);

        if (oldPlayer) {
            const oldPosition = parseInt(oldPlayer.position);
            const newPosition = parseInt(player.position);

            if (newPosition < oldPosition) {
                changes.push({
                    type: 'rank_up',
                    player: player.nickname,
                    oldPosition,
                    newPosition,
                    gp: player.gp
                });
            } else if (newPosition > oldPosition) {
                changes.push({
                    type: 'rank_down',
                    player: player.nickname,
                    oldPosition,
                    newPosition,
                    gp: player.gp
                });
            }
        } else {
            // Nuevo jugador en top 10
            changes.push({
                type: 'new_top10',
                player: player.nickname,
                position: parseInt(player.position),
                gp: player.gp
            });
        }
    });

    return changes;
}

// Función para enviar notificación de cambios en ranking
async function sendRankingChangeNotification(changes) {
    // Aquí necesitarías una lista de tokens de usuarios suscritos
    const subscribedTokens = []; // TODO: Implementar sistema de suscripciones

    if (subscribedTokens.length === 0) {
        console.log('ℹ️ No hay usuarios suscritos para notificaciones de ranking');
        return;
    }

    const significantChanges = changes.filter(change =>
        change.type === 'rank_up' || change.type === 'new_top10'
    );

    if (significantChanges.length > 0) {
        const title = '🏆 Cambios en el Ranking de GunBound';
        const body = `¡${significantChanges.length} jugador(es) han subido en el ranking!`;

        for (const token of subscribedTokens) {
            try {
                await sendPushNotification(token, title, body);
            } catch (error) {
                console.error(`❌ Error enviando notificación a ${token}:`, error.message);
            }
        }
    }
}

// Función para verificar nuevas noticias
async function checkNewsUpdates() {
    try {
        const { data } = await axios.get('https://gunboundggh.com/news/EN', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Cache-Control': 'no-cache',
            },
        });

        const $ = cheerio.load(data);
        const currentNews = [];

        $('.gb-sc-news-wrapper').each((i, el) => {
            currentNews.push({
                url: $(el).attr('href'),
                image: $(el).find('img').attr('src'),
                title: $(el).find('.gb-sc-news-title').text().trim(),
                description: $(el).find('p').text().trim(),
            });
        });

        if (lastNewsData.length > 0 && currentNews.length > 0) {
            const newNews = currentNews.filter(news =>
                !lastNewsData.some(oldNews => oldNews.title === news.title)
            );

            if (newNews.length > 0) {
                console.log('📰 Nuevas noticias detectadas:', newNews.length);
                await sendNewsNotification(newNews);
            }
        }

        lastNewsData = currentNews;
    } catch (error) {
        console.error('❌ Error al verificar noticias:', error.message);
    }
}

// Función para enviar notificación de nuevas noticias
async function sendNewsNotification(newNews) {
    const subscribedTokens = []; // TODO: Implementar sistema de suscripciones

    if (subscribedTokens.length === 0) {
        console.log('ℹ️ No hay usuarios suscritos para notificaciones de noticias');
        return;
    }

    const title = '📰 Nuevas Noticias de GunBound';
    const body = `¡${newNews.length} nueva(s) noticia(s) disponible(s)!`;

    for (const token of subscribedTokens) {
        try {
            await sendPushNotification(token, title, body);
        } catch (error) {
            console.error(`❌ Error enviando notificación a ${token}:`, error.message);
        }
    }
}

// Endpoint para suscribirse a notificaciones
app.post('/api/subscribe', express.json(), async (req, res) => {
    const { expoPushToken, notifications } = req.body;

    if (!expoPushToken || !notifications) {
        return res.status(400).json({
            error: 'Faltan parámetros requeridos',
            required: ['expoPushToken', 'notifications']
        });
    }

    try {
        // TODO: Implementar almacenamiento de suscripciones en base de datos
        console.log('✅ Usuario suscrito:', { expoPushToken, notifications });

        res.json({
            success: true,
            message: 'Suscripción exitosa',
            subscribedTo: notifications
        });
    } catch (error) {
        console.error('❌ Error en suscripción:', error.message);
        res.status(500).json({
            error: 'Error al procesar suscripción',
            message: error.message
        });
    }
});

// Endpoint para desuscribirse
app.post('/api/unsubscribe', express.json(), async (req, res) => {
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
        return res.status(400).json({
            error: 'Token requerido'
        });
    }

    try {
        // TODO: Implementar eliminación de suscripción
        console.log('❌ Usuario desuscrito:', expoPushToken);

        res.json({
            success: true,
            message: 'Desuscripción exitosa'
        });
    } catch (error) {
        console.error('❌ Error en desuscripción:', error.message);
        res.status(500).json({
            error: 'Error al procesar desuscripción',
            message: error.message
        });
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
        especialidades: ["GP Boost", "Eventos", "guias"],
        experiencia: 10,
        rating: 5,
        frase: "¡Te ayudo a subir de rango rápido!"
    },

];

// Endpoint para helpers
app.get('/api/helpers', (req, res) => {
    res.json(MOCK_HELPERS);
});

// Sistema de programación para verificaciones automáticas
function startScheduledChecks() {
    console.log('⏰ Iniciando verificaciones programadas...');

    // Verificar cambios en ranking cada 30 minutos
    setInterval(async () => {
        console.log('📊 Verificando cambios en ranking...');
        await checkRankingChanges();
    }, 30 * 60 * 1000); // 30 minutos

    // Verificar nuevas noticias cada 15 minutos
    setInterval(async () => {
        console.log('📰 Verificando nuevas noticias...');
        await checkNewsUpdates();
    }, 15 * 60 * 1000); // 15 minutos

    // Verificación inicial
    setTimeout(async () => {
        console.log('🚀 Ejecutando verificación inicial...');
        await checkRankingChanges();
        await checkNewsUpdates();
    }, 5000); // 5 segundos después del inicio
}

// Endpoint para ejecutar verificaciones manualmente
app.post('/api/check-updates', async (req, res) => {
    try {
        console.log('🔍 Ejecutando verificación manual...');

        const [rankingChanges, newsUpdates] = await Promise.all([
            checkRankingChanges(),
            checkNewsUpdates()
        ]);

        res.json({
            success: true,
            message: 'Verificación completada',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error en verificación manual:', error.message);
        res.status(500).json({
            error: 'Error en verificación manual',
            message: error.message
        });
    }
});

// Endpoint para obtener estado de las verificaciones
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        lastRankingCheck: lastRankingData.length > 0 ? 'completed' : 'pending',
        lastNewsCheck: lastNewsData.length > 0 ? 'completed' : 'pending',
        rankingPlayers: lastRankingData.length,
        newsCount: lastNewsData.length,
        timestamp: new Date().toISOString()
    });
});

app.listen(3000, () => {
    console.log('🚀 API corriendo en http://localhost:3000/api/ranking');
    console.log('📰 Endpoint de noticias en http://localhost:3000/api/news');
    console.log('🔔 Endpoint de notificaciones en http://localhost:3000/api/send-notification');
    console.log('🧪 Endpoint de prueba de notificaciones en http://localhost:3000/api/test-notification');
    console.log('👥 Endpoint de helpers en http://localhost:3000/api/helpers');
    console.log('📊 Endpoint de estado en http://localhost:3000/api/status');
    console.log('🔍 Endpoint de verificación manual en http://localhost:3000/api/check-updates');
    console.log('📝 Endpoint de suscripción en http://localhost:3000/api/subscribe');

    // Iniciar verificaciones automáticas
    startScheduledChecks();
});