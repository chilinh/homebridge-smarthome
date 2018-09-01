const Base = require('./base')
const miio = require('miio')

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen

class PowerPlug extends Base {
  constructor(mijia, config) {
    super(mijia)
    this.config = config
    this.model = config.model
    this.devices = {} // all airpurifier devices
    PlatformAccessory = mijia.PlatformAccessory
    Accessory = mijia.Accessory
    Service = mijia.Service
    Characteristic = mijia.Characteristic
    UUIDGen = mijia.UUIDGen
    this.discover()
  }

  setPowerPlug(reg, channel, device) {
    const sid = reg.id
    const model = device.model
    const uuid = UUIDGen.generate(`Mijia-PowerPlug@${sid}`)
    let accessory = this.mijia.accessories[uuid]
    if (!accessory) {
      const name = `Plug ${this.mijia.sensor_names[sid] ? this.mijia.sensor_names[sid] : sid}`
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.FAN)
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, 'Mijia')
        .setCharacteristic(Characteristic.Model, 'Mijia PowerPlug')
        .setCharacteristic(Characteristic.SerialNumber, sid)
      accessory.on('identify', (paired, callback) => {
        callback()
      })
      accessory.addService(new Service.Outlet(name), name)
    }
    accessory.reachable = true
    accessory.updateReachability(true)
    accessory.context.sid = sid
    accessory.context.model = this.model

    const service = accessory.getService(Service.Outlet)

    // update Characteristics
    // let status = false
    if (device != undefined) {
      if (model == 'chuangmi.plug.v1') {
        // if (channel == "main") {
        //   status = device.on;
        // } else if (channel == "usb") {
        //   status = device.usb_on;
        // }
      } else {
        device.power().then(power => {
          this.mijia.log.debug(`PowerPlug ${sid} changed: ${power}`)
          service.getCharacteristic(Characteristic.On).updateValue(power)
        })
      }

      device.on('powerChanged', e => {
        this.mijia.log.debug(`PowerPlug ${sid} changed: ${e}`)
        service.getCharacteristic(Characteristic.On).updateValue(e)
      })
    }

    // bind
    const setters = service.getCharacteristic(Characteristic.On).listeners('set')
    if (!setters || setters.length == 0) {
      service.getCharacteristic(Characteristic.On).on('set', (value, callback) => {
        const dev = this.devices[sid]
        if (dev != undefined) {
          if (value) {
            dev
              .turnOn()
              .then(_ => callback())
              .catch(e => this.mijia.log.warb(`PowerPlug ${sid} error ${e}`))
          } else {
            dev
              .turnOff()
              .then(_ => callback())
              .catch(e => this.mijia.log.warb(`PowerPlug ${sid} error ${e}`))
          }
        }
      })
    }

    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory
      this.registerAccessory([accessory])
    }
  }

  discover() {
    const browser = miio.browse() // require a new browse

    browser.on('available', reg => {
      if (!reg.token) {
        // power plug support Auto-token
        return
      }

      this.mijia.log.debug(`FIND POWER PLUG ${reg.id} - ${reg.address}`)

      miio
        .device(reg)
        .then(device => {
          if (!device.matches(`type:${this.model}`)) {
            return
          }
          this.devices[reg.id] = device
          if (device.model == 'chuangmi.plug.v1') {
            this.setPowerPlug(reg, 'main', device)
            this.setPowerPlug(reg, 'usb', device)
          } else {
            this.setPowerPlug(reg, 0, device)
          }
          this.mijia.log.debug(`POWER PLUG CONNECTED ${reg.id} - ${reg.address}`)
        })
        .catch(error => {
          this.mijia.log.error(`POWER PLUG ERROR ${error}`)
        })
    })

    browser.on('unavailable', reg => {
      if (!reg.token) {
        // airpurifier support Auto-token
        return
      }
      if (this.devices[reg.id] != undefined) {
        const accessory = this.mijia.accessories[UUIDGen.generate(`Mijia-PowerPlug@${reg.id}`)]
        if (accessory) {
          accessory.updateReachability(false)
          accessory.reachable = false
        }
        this.devices[reg.id].destroy()
        delete this.devices[reg.id]
      }
    })
  }
}

module.exports = PowerPlug
