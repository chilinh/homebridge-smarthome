const Base = require("./base");

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;
class Switch extends Base {
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
    this.setSwitch(sid, voltage, status);
  }
  /**
   * set up Switch(mijia Switch)
   * @param {*device id} sid
   * @param {*device voltage} voltage
   * @param {*device status} status
   */
  setSwitch(sid, voltage, status) {
    const uuid = UUIDGen.generate(`Mijia-Switch@${sid}`);
    let accessory = this.mijia.accessories[uuid];
    let service;
    if (!accessory) {
      // init a new homekit accessory
      const sub = sid.substring(sid.length - 4);
      const name = `Switch ${this.mijia.sensor_names[sub] ? this.mijia.sensor_names[sub] : sub}`;
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.PROGRAMMABLE_SWITCH);
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Mijia")
        .setCharacteristic(Characteristic.Model, "Mijia Switch")
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
    accessory.context.model = "switch";
    if (status != undefined) {
      const event = service.getCharacteristic(Characteristic.ProgrammableSwitchEvent);
      if (status == "click") {
        event.updateValue(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS); // 0
      } else if (status == "double_click") {
        event.updateValue(Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS); // 1
      } else {
        event.updateValue(Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
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
module.exports = Switch;
