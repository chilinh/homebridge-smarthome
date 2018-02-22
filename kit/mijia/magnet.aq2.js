const Base = require("./base");

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;
class MagnetAq2 extends Base {
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
      this.setContactSensor(sid, voltage, status);
    }
  }
  /**
   * set up ContactSensor(mijia door and window sensors)
   * @param {*device id} sid
   * @param {*device voltage} voltage
   * @param {*device status} status
   */
  setContactSensor(sid, voltage, status) {
    const uuid = UUIDGen.generate(`Aqara-ContactSensor@${sid}`);
    let accessory = this.mijia.accessories[uuid];
    let service;
    if (!accessory) {
      // init a new homekit accessory
      const name = sid.substring(sid.length - 4);
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.SENSOR);
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Aqara")
        .setCharacteristic(Characteristic.Model, "Aqara ContactSensor")
        .setCharacteristic(Characteristic.SerialNumber, sid);
      accessory.on("identify", (paired, callback) => {
        callback();
      });
      service = new Service.ContactSensor(name);
      accessory.addService(service, name);
      accessory.addService(new Service.BatteryService(name), name);
    } else {
      service = accessory.getService(Service.ContactSensor);
    }
    accessory.reachable = true;
    accessory.context.sid = sid;
    accessory.context.model = "sensor_magnet.aq2";
    if (status == "closed") {
      service
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue(Characteristic.ContactSensorState.CONTACT_DETECTED);
    } else {
      service
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    }
    this.setBatteryService(sid, voltage, accessory);
    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory;
      this.registerAccessory([accessory]);
    }
    return accessory;
  }
}
module.exports = MagnetAq2;
