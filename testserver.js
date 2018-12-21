const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const server = require("http").createServer(app);

const urlencodedParser = bodyParser.urlencoded({extended: false})


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false}));

app.post('/webhooks/orders/create', (req, res) => {
  console.log('🎉 We got an order!')
  res.sendStatus(200)
})

app.post('/newRow', function (req, res) {
  const body = req.body;
  console.log(body);
  //res.set('Content-Type', 'text/plain')
  //res.sendStatus(200);
  //res.send("data worked.");
  res.send(`You sent ${JSON.stringify(body)} to Express`);
  console.log('🎉 New row in sheet!')
  parseRowFromWebhook(body);
  //console.log(res);
},)

app.get('/newRow', (req, res) => {
  console.log('Someone tried loading the zapier page');
})

//this is fake!
function parseRowFromWebhook(body) {
  console.log(JSON.stringify(body));
}

server.listen(process.env.PORT || 5000);
app.listen(3000, () => console.log('Example app listening on port 3000!'))