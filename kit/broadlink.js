let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen
let _homebridge
const util = require('util')
const broadlink_lib = require('./broadlink/')

class Broadlink {
  // config may be null
  // api may be null if launched from old homebridge version
  constructor(log, config, api) {
    this.PlatformAccessory = PlatformAccessory
    this.Accessory = Accessory
    this.Service = Service
    this.Characteristic = Characteristic
    this.UUIDGen = UUIDGen
    this.log = log
    this.config = config
    this.devices = {}
    this.accessories = {}
    if (api) {
      // Save the API object as plugin needs to register new accessory via this object.
      this.api = api
    } else {
      this.log.error("Homebridge's version is too old, please upgrade!")
    }
    if (this.api) {
      this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this))
    }
    if (_homebridge.broadlink != undefined) {
      _homebridge.broadlink = this
    }
    this.log.debug('broadlink constructor done')
  }
  static init(homebridge) {
    return new Promise((resolve, reject) => {
      homebridge.registerPlatform('homebridge-smarthome', 'smarthome-broadlink', Broadlink, true)
      resolve()
    })
  }
  /**
   * configure cached accessory
   * @param {*} accessory
   */
  configureAccessory(accessory) {
    accessory.reachable = true
    accessory.on('identify', (paired, callback) => {
      this.log.debug(`${accessory.displayName} -> Identify!!!`)
      callback()
    })
    if (!this.accessories[accessory.UUID]) {
      this.accessories[accessory.UUID] = accessory
    }
  }
  didFinishLaunching() {
    const { broadlink } = this.config
    if (broadlink != undefined) {
      const { devices } = broadlink
      if (devices && devices.length > 0) {
        // for wifi devices
        devices.map(device => {
          const { name, type, mac, ip } = device
          if (type == 'MP1' || type == 'MP2') {
            for (let i = 1; i <= 4; i++) {
              // mp1 and mp2(two usb devices) have 4 plug
              const mp = new broadlink_lib.MP(this)
              const deviceCfg = Object.assign({}, device)
              deviceCfg.name = `${name}@${i}`
              mp.init(deviceCfg)
              this.log.debug(`init broadlink mp device ->${deviceCfg.name}`)
            }
          } else {
            this.log.warn(`unsupported broadlink device ${util.inspect(device)}`)
          }
        })
      }
    }
  }
}

module.exports = homebridge => {
  // export some properties from homebridge
  PlatformAccessory = homebridge.platformAccessory
  Accessory = homebridge.hap.Accessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid
  _homebridge = homebridge
  // init mikit
  return Broadlink.init(homebridge)
}
