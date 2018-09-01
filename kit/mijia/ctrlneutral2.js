const Base = require('./base')

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen
class CtrlNeutral2 extends Base {
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
    const { channel_0, channel_1 } = data
    this.mijia.log.debug(`${model} ${cmd} channel_0->${channel_0} channel_1->${channel_1}`)
    this.setSwitch(sid, channel_0, 0)
    this.setSwitch(sid, channel_1, 1)
  }
  /**
   * set up Switch(mijia CtrlNeutral2)
   * @param {*device id} sid
   * @param {*device channel} channel
   * @param {*device index} index
   */
  setSwitch(sid, channel, index) {
    const uuid = UUIDGen.generate(`Mijia-CtrlNeutral2_${index}@${sid}`)
    let accessory = this.mijia.accessories[uuid]
    let service
    if (!accessory) {
      // init a new homekit accessory
      const name = `${sid.substring(sid.length - 4)}_${index + 1}`
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.SWITCH)
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, 'Mijia')
        .setCharacteristic(Characteristic.Model, 'Mijia CtrlNeutral2')
        .setCharacteristic(Characteristic.SerialNumber, sid)
      accessory.on('identify', (paired, callback) => {
        callback()
      })
      service = new Service.Switch(name)
      accessory.addService(service, name)
    } else {
      service = accessory.getService(Service.Switch)
    }
    accessory.reachable = true
    accessory.context.sid = sid
    accessory.context.model = 'ctrl_neutral2'
    if (channel != undefined) {
      const event = service.getCharacteristic(Characteristic.On)
      if (channel == 'on') {
        event.updateValue(true)
      } else {
        event.updateValue(false)
      }
    }
    // bind set event if not set
    const setter = service.getCharacteristic(Characteristic.On).listeners('set')
    if (!setter || setter.length == 0) {
      service.getCharacteristic(Characteristic.On).on('set', (value, callback) => {
        // const key = `channel_${index}`
        const data = { key: value ? 'on' : 'off' }
        data.key = this.mijia.generateKey(sid)
        const cmd = {
          cmd: 'write',
          model: 'ctrl_neutral2',
          sid,
          data: JSON.stringify(data),
        }
        this.mijia.sendMsgToSid(cmd, sid)
        callback()
      })
    }
    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory
      this.registerAccessory([accessory])
    }
    return accessory
  }
}
module.exports = CtrlNeutral2
