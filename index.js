const http = require('http');
const crypto = require('crypto');
const twilio = require('twilio');

const signingKey = 'de1uFAu5eGLAasbuGDp1lMFHHfQCsErq';
const client = new twilio('YOUR-ACCOUNT-SID', 'YOUR-AUTH-TOKEN');

const requestListener = (request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
        const data = JSON.parse(Buffer.concat(chunks));

        // Extract the signature from Chec
        const { signature } = data;
        delete data.signature;

        // Verify the signature by recreating it and comparing them
        const expectedSignature = crypto.createHmac('sha256', signingKey)
            .update(JSON.stringify(data))
            .digest('hex');
        if (expectedSignature !== signature) {
            console.error('Signature mismatch, skipping.');
        }

        // Verify the age of the request, to ensure it wasn't more than 5 minutes old
        const maxWebhookAgeSeconds = 5 * 60 * 1000; // milliseconds
        if (new Date(data.created * 1000) < new Date() - maxWebhookAgeSeconds) {
            console.error('Webhook was sent too long ago, could be fake, ignoring.');
        }

        // Formulate SMS message
        const orderId = data.payload.id || 'Test request';
        const orderValue = data.payload.order ? data.payload.order.total_with_tax.formatted_with_symbol : '$0.00';
        const messageBody = `New order: ${orderId} for ${orderValue}`;

        // Send it!
        client.messages
            .create({
                body: messageBody,
                to: '+1987654321', // Your phone number, verified in Twilio's console
                from: '+123456789', // The registered Twilio number to send from console
            })
            .then((message) => console.log(`Sent message: ${message.sid}`))
            .catch((error) => console.error(error));

        response.writeHead(200);
        response.end();
        console.log(`${data.response_code} for ${data.event}`);
    });
};

const server = http.createServer(requestListener);
server.listen(8080); // Change this if port 8080 is already in use

console.log('Listening for incoming webhooks...');
