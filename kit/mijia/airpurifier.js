const Base = require('./base')
const miio = require('miio')

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen

class AirPurifier extends Base {
  constructor(mijia, config) {
    super(mijia)
    this.config = config
    this.model = config.model
    this.devices = {} // all airpurifier devices
    this.powers = {}
    PlatformAccessory = mijia.PlatformAccessory
    Accessory = mijia.Accessory
    Service = mijia.Service
    Characteristic = mijia.Characteristic
    UUIDGen = mijia.UUIDGen
    this.discover()
  }

  setAirPurifier(reg, device) {
    const sid = reg.id
    const uuid = UUIDGen.generate(`Mijia-AirPurifier@${sid}`)
    let accessory = this.mijia.accessories[uuid]
    if (!accessory) {
      const name = `Plug ${this.mijia.sensor_names[sid] ? this.mijia.sensor_names[sid] : sid}`
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.AirPurifier)
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, 'Mijia')
        .setCharacteristic(Characteristic.Model, 'Mijia AirPurifier')
        .setCharacteristic(Characteristic.SerialNumber, sid)
      accessory.on('identify', (paired, callback) => {
        callback()
      })
      accessory.addService(new Service.AirPurifier(name), name)
      accessory.addService(new Service.AirQualitySensor(name), name)
      accessory.addService(new Service.TemperatureSensor(name), name)
      accessory.addService(new Service.HumiditySensor(name), name)
      accessory.addService(new Service.Lightbulb(name), name)
    }
    accessory.reachable = true
    accessory.updateReachability(true)
    accessory.context.sid = sid
    accessory.context.model = this.model

    const levels = [
      [200, Characteristic.AirQuality.POOR],
      [150, Characteristic.AirQuality.INFERIOR],
      [100, Characteristic.AirQuality.FAIR],
      [50, Characteristic.AirQuality.GOOD],
      [0, Characteristic.AirQuality.EXCELLENT],
    ]

    const service_air = accessory.getService(Service.AirPurifier)
    const service_air_sensor = accessory.getService(Service.AirQualitySensor)
    const service_temperature = accessory.getService(Service.TemperatureSensor)
    const service_humidity = accessory.getService(Service.HumiditySensor)
    const service_led = accessory.getService(Service.Lightbulb)

    if (device != undefined) {
      // device.power().then(p => {
      //   this.powers[sid] = p;
      //   this.mijia.log.debug(`AIR ${sid} CURRENT: ${p}`);
      //   service_air
      //     .getCharacteristic(Characteristic.Active)
      //     .updateValue(p ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
      // });

      device.on('power', power => {
        this.powers[sid] = power
        this.mijia.log.debug(`AIR POWER ${sid} changed: ${power}`)
        service_air
          .getCharacteristic(Characteristic.Active)
          .updateValue(power ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE)
      })

      device.on('temperatureChanged', temp => {
        this.mijia.log.debug(`AIR TEMP ${sid} changed: ${temp}`)
        service_temperature.getCharacteristic(Characteristic.CurrentTemperature).updateValue(parseFloat(temp))
      })

      device.on('relativeHumidityChanged', rh => {
        this.mijia.log.debug(`AIR HUMID ${sid} changed: ${rh}`)
        service_humidity.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(rh)
      })

      device.on('pm2.5Changed', pm2_5 => {
        this.mijia.log.debug(`AIR PM2_5 ${sid} changed: ${pm2_5}`)
        let value = Characteristic.AirQuality.UNKNOWN
        service_air_sensor.getCharacteristic(Characteristic.PM2_5Density).updateValue(pm2_5)
        for (const level of levels) {
          if (pm2_5 >= level[0]) {
            value = level[1]
            this.mijia.log.debug(`AIR AQI ${sid}: ${level} ${value}`)
            service_air_sensor.getCharacteristic(Characteristic.AirQuality).updateValue(value)
            break
          }
        }
      })

      device.on('modeChanged', mode => {
        this.mijia.log.debug(`AIR MODE ${sid} changed: ${mode}`)
        const target =
          mode != 'favorite' ? Characteristic.TargetAirPurifierState.AUTO : Characteristic.TargetAirPurifierState.MANUAL
        service_air.getCharacteristic(Characteristic.TargetAirPurifierState).updateValue(target)

        const state =
          mode == 'idle'
            ? Characteristic.CurrentAirPurifierState.INACTIVE
            : Characteristic.CurrentAirPurifierState.PURIFYING_AIR
        service_air.getCharacteristic(Characteristic.CurrentAirPurifierState).updateValue(state)
      })
    }

    // bind
    const setter = service_air.getCharacteristic(Characteristic.Active).listeners('set')
    if (!setter || setter.length == 0) {
      // service_air
      service_air
        .getCharacteristic(Characteristic.Active)
        .on('set', (value, callback) => {
          const dev = this.devices[sid]
          if (dev != undefined) {
            dev
              .setPower(value)
              .then(_ => callback())
              .catch(e => {
                this.mijia.log.warn(`AIR ${sid} error ${e}`)
                callback(e)
              })
          } else {
            callback()
          }
        })
        .on('get', callback => {
          const dev = this.devices[sid]
          if (dev != undefined) {
            callback(null, this.powers[sid] ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE)
          } else {
            callback(null, false)
          }
        })

      service_air.getCharacteristic(Characteristic.TargetAirPurifierState).on('set', (value, callback) => {
        const dev = this.devices[sid]
        if (dev != undefined) {
          if (!this.powers[sid]) {
            callback()
            return
          }
          const target = value ? 'auto' : 'favorite'
          dev
            .setMode(target)
            .then(_ => callback())
            .catch(e => {
              this.mijia.log.warn(`AIR ${sid} error ${e}`)
              callback(e)
            })
        } else {
          callback()
        }
      })

      service_air
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', callback => {
          const dev = this.devices[sid]
          if (dev != undefined) {
            dev
              .favoriteLevel()
              .then(level => {
                const speed = Math.ceil(level * 6.25)
                this.mijia.log.debug('getRotationSpeed: %s', speed)
                callback(null, speed)
              })
              .catch(err => callback(err))
          } else {
            callback()
          }
        })
        .on('set', (value, callback) => {
          const dev = this.devices[sid]
          if (dev != undefined) {
            if (!this.powers[sid]) {
              callback()
              return
            }
            if (dev.mode() != 'favorite') {
              dev
                .setMode('favorite')
                .then()
                .catch(err => callback(err))
            }

            // Set favorite level
            const level = Math.ceil(value / 6.25)

            this.mijia.log.debug('setRotationSpeed: %s', level)

            dev
              .setFavoriteLevel(level)
              .then(_ => callback())
              .catch(err => callback(err))
          } else {
            callback()
          }
        })
      // service_air_sensor
      service_air_sensor.getCharacteristic(Characteristic.AirQuality).on('get', callback => {
        const dev = this.devices[sid]
        let value = Characteristic.AirQuality.UNKNOWN
        if (dev != undefined) {
          const pm2_5 = dev.pm2_5
          for (const level in levels) {
            if (pm2_5 > level[0]) {
              value = level[1]
            }
          }
        }
        callback(null, value)
      })

      service_air_sensor.getCharacteristic(Characteristic.PM2_5Density).on('get', callback => {
        const dev = this.devices[sid]
        let value = 0
        if (dev != undefined) {
          value = dev.pm2_5
        }
        callback(null, value)
      })

      // service_temperature
      service_temperature.getCharacteristic(Characteristic.CurrentTemperature).on('get', callback => {
        const dev = this.devices[sid]
        let value = 0
        if (dev != undefined) {
          value = parseFloat(dev.temperature())
          this.mijia.log.debug('CURRENTtemp: %s', value)
        }
        callback(null, value)
      })
      // service_humidity
      service_humidity.getCharacteristic(Characteristic.CurrentRelativeHumidity).on('get', callback => {
        const dev = this.devices[sid]
        if (dev != undefined) {
          dev
            .relativeHumidity()
            .then(value => {
              this.mijia.log.debug('CURRENThumid: %s', value)
              callback(null, value)
            })
            .catch(e => callback(e))
        } else {
          callback(null, 0)
        }
      })
      // service_led
      service_led
        .getCharacteristic(Characteristic.On)
        .on('get', callback => {
          const dev = this.devices[sid]
          let value = false
          if (dev != undefined) {
            value = dev.led()
          }
          callback(null, value)
        })
        .on('set', (value, callback) => {
          const dev = this.devices[sid]
          if (dev != undefined) {
            if (!this.powers[sid]) {
              callback(null, false)
              return
            }
            dev.led(value)
          }
          callback(null, value)
        })

      service_led
        .getCharacteristic(Characteristic.Brightness)
        .on('get', callback => {
          const dev = this.devices[sid]
          let value = false
          if (dev != undefined) {
            value = device.ledBrightness()
            callback()
            return
          }
          callback(null, value)
        })
        .on('set', (value, callback) => {
          const dev = this.devices[sid]
          if (dev != undefined) {
            if (!this.powers[sid]) {
              callback(null, false)
              return
            }
            if (value > 50) {
              dev.ledBrightness('bright')
            } else if (value > 15) {
              dev.ledBrightness('dim')
            } else {
              dev.ledBrightness('off')
            }
          }
          callback(null, value)
        })
    }
    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory
      this.registerAccessory([accessory])
    }
  }

  discover() {
    this.mijia.log.debug(`try to discover ${this.model}`)
    const browser = miio.browse() // require a new browse
    browser.on('available', reg => {
      if (!reg.token) {
        // airpurifier support Auto-token
        return
      }

      this.mijia.log.debug(`FIND AIR ${reg.id} - ${reg.address}`)

      miio
        .device(reg)
        .then(device => {
          if (!device.matches(`type:${this.model}`)) {
            return
          }
          this.devices[reg.id] = device
          this.mijia.log.debug(`AIR CONNECTED ${reg.id} - ${reg.address}`)
          this.setAirPurifier(reg, device)
        })
        .catch(error => {
          this.mijia.log.error(`AIR ERROR ${error}`)
        })
    })

    browser.on('unavailable', reg => {
      if (!reg.token) {
        // airpurifier support Auto-token
        return
      }
      if (this.devices[reg.id] != undefined) {
        this.devices[reg.id].destroy()
        delete this.devices[reg.id]
      }
    })
  }
}

module.exports = AirPurifier
