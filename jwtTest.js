var jwt = require('jsonwebtoken');
let expiryTime = Date.now()+60000

// {
//   "alg": "HS256",
//   "typ": "JWT"
// }

// {
//   "iss":"OUbedDKaTsmzGjpw2-U83w",
//   "exp":`${expiryTime}`
// }

// HMACSHA256(
//   base64UrlEncode(header) + "." +
//   base64UrlEncode(payload),
  
// your-256-bit-secret

// )