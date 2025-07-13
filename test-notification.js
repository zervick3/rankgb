const fetch = require('node-fetch');

// Función para probar el endpoint de notificaciones
async function testNotification() {
    const testData = {
        expoPushToken: 'ExponentPushToken[test-token-for-testing]',
        title: 'Test de Notificación',
        body: 'Esta es una notificación de prueba desde la API'
    };

    try {
        console.log('🧪 Probando endpoint de notificaciones...');
        console.log('📤 Enviando datos:', JSON.stringify(testData, null, 2));

        const response = await fetch('http://localhost:3000/api/send-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        console.log('📥 Respuesta del servidor:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(result, null, 2));

        if (response.ok) {
            console.log('✅ Test completado exitosamente');
        } else {
            console.log('❌ Test falló');
        }
    } catch (error) {
        console.error('❌ Error en el test:', error.message);
    }
}

// Función para probar el endpoint de información
async function testInfo() {
    try {
        console.log('\n📋 Probando endpoint de información...');

        const response = await fetch('http://localhost:3000/api/test-notification');
        const result = await response.json();

        console.log('📥 Información del endpoint:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error al obtener información:', error.message);
    }
}

// Ejecutar tests
async function runTests() {
    console.log('🚀 Iniciando tests de notificaciones...\n');

    await testInfo();
    await testNotification();

    console.log('\n✨ Tests completados');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runTests();
}

module.exports = { testNotification, testInfo }; 