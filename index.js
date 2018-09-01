/**
 * this is smarthome entry point
 */
const { mijia } = require('./kit')

module.exports = homebridge => {
  //every kit will store their devices on context;
  homebridge.context = {}
  //init mijia devices
  mijia(homebridge).catch(err => {
    this.log.error('mijia error->%s', err)
  })
}
