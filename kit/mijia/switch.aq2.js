const Base = require("./base");

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;
class SwitchAq2 extends Base {
  constructor(mijia) {
    super(mijia);
    PlatformAccessory = mijia.PlatformAccessory;
    Accessory = mijia.Accessory;
    Service = mijia.Service;
    Characteristic = mijia.Characteristic;
    UUIDGen = mijia.UUIDGen;
  }
  /**
   * parse the gateway json msg
   * @param {*json} json
   * @param {*remoteinfo} rinfo
   */
  parseMsg(json, rinfo) {
    const { cmd, model, sid } = json;
    const data = JSON.parse(json.data);
    const { voltage, status } = data;
    this.mijia.log.debug(`${model} ${cmd} voltage->${voltage} status->${status}`);
    if (status != undefined) {
      this.setSwitch(sid, voltage, status);
    }
  }
  /**
   * set up Switch(aqara Switch)
   * @param {*device id} sid
   * @param {*device voltage} voltage
   * @param {*device status} status
   */
  setSwitch(sid, voltage, status) {
    const uuid = UUIDGen.generate(`Aqara-Switch@${sid}`);
    let accessory = this.mijia.accessories[uuid];
    let service;
    if (!accessory) {
      // init a new homekit accessory
      const name = sid.substring(sid.length - 4);
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.PROGRAMMABLE_SWITCH);
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Aqara")
        .setCharacteristic(Characteristic.Model, "Aqara Switch")
        .setCharacteristic(Characteristic.SerialNumber, sid);
      accessory.on("identify", (paired, callback) => {
        callback();
      });
      service = new Service.StatelessProgrammableSwitch(name);
      accessory.addService(service, name);
      accessory.addService(new Service.BatteryService(name), name);
    } else {
      service = accessory.getService(Service.StatelessProgrammableSwitch);
    }
    accessory.reachable = true;
    accessory.context.sid = sid;
    accessory.context.model = "sensor_switch.aq2";
    if (status != undefined) {
      const event = service.getCharacteristic(Characteristic.ProgrammableSwitchEvent);
      if (status == "click") {
        event.updateValue(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS); // 0
      } else if (status == "double_click") {
        event.updateValue(Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS); // 1
      }
    }
    this.setBatteryService(sid, voltage, accessory);
    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory;
      this.registerAccessory([accessory]);
    }
    return accessory;
  }
}
module.exports = SwitchAq2;
