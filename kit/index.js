const mijia = require("./mijia");
const broadlink = require("./broadlink");
// module exports define
module.exports = {
  mijia: homebridge => mijia(homebridge),
  broadlink: homebridge => broadlink(homebridge)
};
