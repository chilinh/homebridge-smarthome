const Base = require('./base')

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen
class Plug86 extends Base {
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
    const { voltage, status, inuse, power_consumed, load_power } = data
    this.mijia.log.debug(
      `${model} ${cmd} voltage->${voltage} status->${status} inuse->${inuse} power_consumed->${power_consumed} load_power->${load_power}`
    )
    this.setOutlet(sid, voltage, status, inuse, power_consumed, load_power)
  }
  /**
   * set up Outlet(mijia zigbee Plug)
   * @param {* sid} sid
   * @param {* voltage} voltage
   * @param {* status} status
   * @param {* inuse} inuse
   * @param {* power_consumed} power_consumed
   * @param {* load_power} load_power
   */
  setOutlet(sid, _voltage, status, inuse, _power_consumed, _load_power) {
    const uuid = UUIDGen.generate(`Mijia-86Plug@${sid}`)
    let accessory = this.mijia.accessories[uuid]
    let service
    if (!accessory) {
      // init a new homekit accessory
      const name = sid.substring(sid.length - 4)
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.OUTLET)
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, 'Mijia')
        .setCharacteristic(Characteristic.Model, 'Mijia 86Plug')
        .setCharacteristic(Characteristic.SerialNumber, sid)
      accessory.on('identify', (paired, callback) => {
        callback()
      })
      service = new Service.Outlet(name)
      accessory.addService(service, name)
    } else {
      service = accessory.getService(Service.Outlet)
    }
    accessory.reachable = true
    accessory.context.sid = sid
    accessory.context.model = '86plug'
    let use_state = false,
      on_state = false
    if (status == 'on') {
      on_state = true
      if (inuse) {
        use_state = true
      }
    }
    service.getCharacteristic(Characteristic.On).updateValue(on_state)
    service.getCharacteristic(Characteristic.OutletInUse).updateValue(use_state)
    // bind set event if not set
    const setter = service.getCharacteristic(Characteristic.On).listeners('set')
    if (!setter || setter.length == 0) {
      service.getCharacteristic(Characteristic.On).on('set', (value, callback) => {
        const data = { status: value ? 'on' : 'off' }
        data.key = this.mijia.generateKey(sid)
        const cmd = {
          cmd: 'write',
          model: '86plug',
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
module.exports = Plug86
