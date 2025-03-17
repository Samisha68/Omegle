const twilio = require('twilio');

// Create an API endpoint that generates temporary credentials
app.get('/api/turn-credentials', (req, res) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }
  
  const client = twilio(accountSid, authToken);
  
  client.tokens.create().then(token => {
    res.send(token);
  }).catch(err => {
    console.error('Error generating TURN credentials:', err);
    res.status(500).json({ error: 'Failed to generate credentials' });
  });
});