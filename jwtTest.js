require('dotenv').config();

// [START] Configure Zoom api Token
const jwt = require('jsonwebtoken');

const payload = {
    iss: `${process.env.ZoomAccID}`,
    exp: ((new Date()).getTime() + 5000)
};
const token = "Bearer " + jwt.sign(payload, `${process.env.ZoomSecKey}`);
// [END] Configure Zoom api Token