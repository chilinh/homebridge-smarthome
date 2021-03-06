const Base = require('./base')

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen
class Motion extends Base {
  constructor(mijia) {
    super(mijia)
    PlatformAccessory = mijia.PlatformAccessory
    Accessory = mijia.Accessory
    Service = mijia.Service
    Characteristic = mijia.Characteristic
    UUIDGen = mijia.UUIDGen
  }
  /**
   * parse the gateway json msg
   * @param {*json} json
   * @param {*remoteinfo} rinfo
   */
  parseMsg(json, _rinfo) {
    const { cmd, model, sid } = json
    const data = JSON.parse(json.data)
    const { voltage, status } = data
    this.mijia.log.debug(`${model} ${cmd} voltage->${voltage} status->${status}`)
    this.setMotionSensor(sid, voltage, status)
  }
  /**
   * set up MotionSensor(mijia motion sensor)
   * @param {*device id} sid
   * @param {*device voltage} voltage
   * @param {*device status} status
   */
  setMotionSensor(sid, voltage, status) {
    const uuid = UUIDGen.generate(`Mijia-MotionSensor@${sid}`)
    let accessory = this.mijia.accessories[uuid]
    let service
    if (!accessory) {
      // init a new homekit accessory
      const sub = sid.substring(sid.length - 4)
      const name = `Motion ${this.mijia.sensor_names[sub] ? this.mijia.sensor_names[sub] : sub}`
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.SENSOR)
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, 'Mijia')
        .setCharacteristic(Characteristic.Model, 'Mijia MotionSensor')
        .setCharacteristic(Characteristic.SerialNumber, sid)
      accessory.on('identify', (paired, callback) => {
        callback()
      })
      service = new Service.MotionSensor(name)
      accessory.addService(service, name)
      accessory.addService(new Service.BatteryService(name), name)
    } else {
      service = accessory.getService(Service.MotionSensor)
    }
    accessory.reachable = true
    accessory.context.sid = sid
    accessory.context.model = 'motion'
    service.getCharacteristic(Characteristic.MotionDetected).updateValue(false)
    if (status === 'motion') {
      service.getCharacteristic(Characteristic.MotionDetected).updateValue(true)
    }
    this.setBatteryService(sid, voltage, accessory)
    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory
      this.registerAccessory([accessory])
    }
    return accessory
  }
}
module.exports = Motion
