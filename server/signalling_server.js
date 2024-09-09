const WebSockerServer = require('ws');

const wss = new WebSockerServer.Server({ port: 8081 }, () => {
  console.log('Signalling server started on port 8081');
});

wss.broadcast = (ws, data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSockerServer.OPEN && client !== ws) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected, total clients connected: ', wss.clients.size);
  ws.on('message', (data, isBinary) => {
    const message = isBinary ? data : data.toString();
    wss.broadcast(ws, message);
  });

  ws.on('close', () => {
    console.log('Client disconnected, total clients connected: ', wss.clients.size);
  });

  ws.on('error', (err) => {
    console.error('Error occurred: ', err);
  });
});

