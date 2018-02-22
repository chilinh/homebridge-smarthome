const Base = require("./base");
const color = require("../../util/color");

let PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;
class Gateway extends Base {
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
    const { rgb, illumination, proto_version, mid } = data;
    this.mijia.log.debug(`${model} ${cmd} rgb->${rgb} illumination->${illumination} proto_version->${proto_version}`);
    if (illumination != undefined) {
      this.setLightSensor(sid, illumination);
    }
    if (rgb != undefined) {
      this.setLightbulb(sid, rgb);
    }
  }
  /**
   * set up gateway LightSensor(mijia gateway lightsensor)
   * @param {*device id} sid
   * @param {*device illumination value} illumination
   */
  setLightSensor(sid, illumination) {
    const uuid = UUIDGen.generate(`Gateway-LightSensor@${sid}`);
    let accessory = this.mijia.accessories[uuid];
    let service;
    if (!accessory) {
      // init a new homekit accessory
      const sub = sid.substring(sid.length - 4);
      const name = `Luminosity ${this.mijia.sensor_names[sub] ? this.mijia.sensor_names[sub] : sub}`;
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.SENSOR);
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Mijia")
        .setCharacteristic(Characteristic.Model, "Gateway LightSensor")
        .setCharacteristic(Characteristic.SerialNumber, sid);
      accessory.on("identify", (paired, callback) => {
        callback();
      });
      service = new Service.LightSensor(name);
      accessory.addService(service, name);
    } else {
      service = accessory.getService(Service.LightSensor);
    }
    accessory.reachable = true;
    accessory.context.sid = sid;
    accessory.context.model = "gateway";
    service.getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(illumination);
    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory;
      this.registerAccessory([accessory]);
    }
  }
  /**
   * set up Lightbulb Service(mijia gateway Lightbulb)
   * @param {*device sid} sid
   * @param {*device rgb value} rgb
   */
  setLightbulb(sid, rgb) {
    const uuid = UUIDGen.generate(`Gateway-Lightbulb@${sid}`);
    let accessory = this.mijia.accessories[uuid];
    let service;
    if (!accessory) {
      // init a new homekit accessory
      const sub = sid.substring(sid.length - 4);
      const name = `Light ${this.mijia.sensor_names[sub] ? this.mijia.sensor_names[sub] : sub}`;
      accessory = new PlatformAccessory(name, uuid, Accessory.Categories.LIGHTBULB);
      accessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Mijia")
        .setCharacteristic(Characteristic.Model, "Mijia Gateway Lightbulb")
        .setCharacteristic(Characteristic.SerialNumber, sid);
      accessory.on("identify", (paired, callback) => {
        callback();
      });
      service = new Service.Lightbulb(name);
      // add optional characteristic intent to display color menu in homekit app
      service.addCharacteristic(Characteristic.Hue);
      service.addCharacteristic(Characteristic.Saturation);
      service.addCharacteristic(Characteristic.Brightness);
      accessory.addService(service, name);
    } else {
      service = accessory.getService(Service.Lightbulb);
    }
    accessory.reachable = true;
    accessory.context.sid = sid;
    accessory.context.model = "gateway";
    // update Characteristics
    const brightness = (rgb & 0xff000000) >>> 24;
    const red = (rgb & 0x00ff0000) >>> 16;
    const green = (rgb & 0x0000ff00) >>> 8;
    const blue = rgb & 0x000000ff;
    if (rgb == 0 || brightness == 0) {
      service.getCharacteristic(Characteristic.On).updateValue(false);
    } else {
      service.getCharacteristic(Characteristic.On).updateValue(true);
      const hsv = color.rgb2hsv(red, green, blue);
      const hue = parseInt(hsv[0]);
      const sat = parseInt(hsv[1]);
      service.getCharacteristic(Characteristic.Brightness).updateValue(brightness);
      service.getCharacteristic(Characteristic.Hue).updateValue(hue);
      service.getCharacteristic(Characteristic.Saturation).updateValue(sat);
      accessory.context.lastRgb = rgb;
    }
    // bind set event if not set
    const setters = service.getCharacteristic(Characteristic.On).listeners("set");
    if (!setters || setters.length == 0) {
      service.getCharacteristic(Characteristic.On).on("set", (value, callback) => {
        const data = {
          rgb: 0,
          key: ""
        };
        this.mijia.log.debug(`set gateway light on->${value}`);
        if (value) {
          // if value is true or 1
          const lastRgb = accessory.context.lastRgb;
          if (lastRgb == undefined) {
            data.rgb = 0xffffffff; // default
            accessory.context.lastRgb = data.rgb;
          } else {
            data.rgb = accessory.context.lastRgb;
          }
          accessory.context.count = 1;
        } else {
          accessory.context.count = 0;
        }
        data.key = this.mijia.generateKey(sid);
        const cmd = {
          cmd: "write",
          model: "gateway",
          sid,
          data: JSON.stringify(data)
        };
        this.mijia.sendMsgToSid(cmd, sid);
        callback();
      });

      service.getCharacteristic(Characteristic.Brightness).on("set", (value, callback) => {
        this.mijia.log.debug(`set gateway light brightness->${value}`);
        if (accessory.context.count != undefined && accessory.context.count == 1 && value == 100) {
          this.mijia.log.warn(`discard set brightness->${value} when turn on the light`);
        } else {
          const data = {
            rgb: 0,
            key: ""
          };
          let lastRgb = accessory.context.lastRgb;
          lastRgb = lastRgb || 0xffffffff;
          const rgb = (value << 24) | (lastRgb & 0x00ffffff);
          data.rgb = rgb;
          data.key = this.mijia.generateKey(sid);
          const cmd = {
            cmd: "write",
            model: "gateway",
            sid,
            data: JSON.stringify(data)
          };
          this.mijia.sendMsgToSid(cmd, sid);
          accessory.context.lastRgb = rgb;
        }
        accessory.context.count = 2;
        callback();
      });

      service.getCharacteristic(Characteristic.Saturation).on("set", (value, callback) => {
        this.mijia.log.debug(`set gateway light Saturation->${value}`);
        if (value != undefined) {
          accessory.context.lastSaturation = value;
        }
        callback();
      });

      service.getCharacteristic(Characteristic.Hue).on("set", (value, callback) => {
        this.mijia.log.debug(`set gateway light Hue->${value}`);
        const data = {
          rgb: 0,
          key: ""
        };
        const lastRgb = accessory.context.lastRgb;
        let lastSaturation = accessory.context.lastSaturation;
        lastSaturation = lastSaturation || 100;
        const lastBrightness = (lastRgb & 0xff000000) >>> 24;
        const rgbArr = color.hsv2rgb(value, lastSaturation, lastBrightness); // convert hue and sat to rgb value
        const r = rgbArr[0];
        const g = rgbArr[1];
        const b = rgbArr[2];
        let rgb = (r << 16) | (g << 8) | b;
        rgb |= lastBrightness << 24;
        this.mijia.log.debug(`set gateway light rgb->${rgb}`);
        data.rgb = rgb;
        data.key = this.mijia.generateKey(sid);
        const cmd = {
          cmd: "write",
          model: "gateway",
          sid,
          data: JSON.stringify(data)
        };
        this.mijia.sendMsgToSid(cmd, sid);
        accessory.context.lastRgb = rgb;
        callback();
      });
    }
    if (!this.mijia.accessories[uuid]) {
      this.mijia.accessories[uuid] = accessory;
      this.registerAccessory([accessory]);
    }
  }
}
module.exports = Gateway;
